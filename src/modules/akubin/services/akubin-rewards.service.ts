import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AkubinDatabase } from './akubin-database.service';
import { pageArgs, paginated } from '../akubin.types';
import type { PaginationDto } from '../dto/pagination.dto';
import type { RedeemRewardDto } from '../dto/account.dto';
import {
  RedemptionDecision,
  type FulfillRedemptionDto,
  type RedemptionDecisionDto,
} from '../dto/admin.dto';

@Injectable()
export class AkubinRewardsService {
  constructor(private readonly db: AkubinDatabase) {}

  async catalogue(query: PaginationDto) {
    const where = { active: true };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.reward.findMany({
        where,
        select: {
          id: true,
          name: true,
          kind: true,
          costPoints: true,
          valueLabel: true,
          valueAmount: true,
          stock: true,
        },
        orderBy: [{ costPoints: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.reward.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async history(profileId: string, query: PaginationDto) {
    const where = { profileId };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.redemption.findMany({
        where,
        select: {
          id: true,
          rewardId: true,
          rewardName: true,
          kind: true,
          costPoints: true,
          valueAmount: true,
          currency: true,
          status: true,
          reason: true,
          createdAt: true,
          fulfilledAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.redemption.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async redeem(profileId: string, dto: RedeemRewardDto) {
    const key = `akubin:redemption:${profileId}:${dto.idempotencyKey}`;
    const run = () =>
      this.db.transaction(async (tx) => {
        const existing = await tx.redemption.findUnique({
          where: { idempotencyKey: key },
        });
        if (existing) {
          if (
            existing.profileId !== profileId ||
            existing.rewardId !== dto.rewardId ||
            (dto.phone && existing.recipientPhone !== dto.phone)
          )
            throw new ConflictException(
              'Idempotency key was used for a different redemption.',
            );
          return {
            id: existing.id,
            status: existing.status,
            costPoints: existing.costPoints,
            duplicate: true,
          };
        }
        await tx.$queryRaw`SELECT id FROM public.rewards WHERE id = ${dto.rewardId}::uuid FOR UPDATE`;
        const reward = await tx.reward.findUnique({
          where: { id: dto.rewardId },
        });
        if (!reward?.active)
          throw new NotFoundException('Reward not available.');
        if (reward.stock !== null && reward.stock <= 0)
          throw new ConflictException('Reward is out of stock.');
        const settings = await tx.platformSettings.findUnique({
          where: { id: 1 },
        });
        if (!settings)
          throw new ServiceUnavailableException(
            'Reward rules are not configured.',
          );
        await tx.$queryRaw`SELECT profile_id FROM public.points_wallets WHERE profile_id = ${profileId}::uuid FOR UPDATE`;
        const wallet = await tx.pointsWallet.findUnique({
          where: { profileId },
        });
        const minimum = Math.max(
          reward.costPoints,
          reward.kind === 'airtime'
            ? settings.airtimeMinPoints
            : reward.kind === 'cash'
              ? settings.cashMinPoints
              : 0,
        );
        if (!wallet || wallet.balance.lt(minimum))
          throw new ConflictException(
            `At least ${minimum} points are required.`,
          );
        const profile = await tx.profile.findUniqueOrThrow({
          where: { id: profileId },
          select: { phone: true },
        });
        const phone =
          reward.kind === 'airtime' ? (dto.phone ?? profile.phone) : null;
        if (
          reward.kind === 'airtime' &&
          (!phone || !/^\+?\d{10,15}$/.test(phone))
        )
          throw new BadRequestException(
            'A valid airtime recipient phone number is required.',
          );
        // No fulfilment provider is integrated: never report airtime/cash as already delivered.
        const redemption = await tx.redemption.create({
          data: {
            profileId,
            rewardId: reward.id,
            rewardName: reward.name,
            kind: reward.kind,
            costPoints: reward.costPoints,
            valueAmount: reward.valueAmount,
            recipientPhone: phone,
            idempotencyKey: key,
            status: 'pending_review',
          },
        });
        await tx.pointsLedgerEntry.create({
          data: {
            profileId,
            kind: 'redemption_debit',
            amount: -reward.costPoints,
            redemptionId: redemption.id,
            idempotencyKey: `redemption:${redemption.id}:debit`,
          },
        });
        if (reward.stock !== null)
          await tx.reward.update({
            where: { id: reward.id },
            data: { stock: { decrement: 1 } },
          });
        await tx.notification.create({
          data: {
            profileId,
            title: 'Redemption requested',
            body: `${reward.name} is awaiting review.`,
            href: '/app/akubin/rewards',
          },
        });
        return {
          id: redemption.id,
          status: redemption.status,
          costPoints: redemption.costPoints,
          duplicate: false,
        };
      });
    try {
      return { data: await run() };
    } catch (error) {
      if (this.db.isUniqueError(error)) return { data: await run() };
      throw error;
    }
  }

  async decisions(actorId: string, id: string, dto: RedemptionDecisionDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.redemptions WHERE id = ${id}::uuid FOR UPDATE`;
        const redemption = await tx.redemption.findUnique({ where: { id } });
        if (!redemption) throw new NotFoundException('Redemption not found.');
        const status =
          dto.decision === RedemptionDecision.approve ? 'approved' : 'rejected';
        if (redemption.status === status)
          return { id, status, duplicate: true };
        if (redemption.status !== 'pending_review')
          throw new ConflictException(
            'Only pending redemptions can be reviewed.',
          );
        const now = await this.db.now(tx);
        await tx.redemption.update({
          where: { id },
          data: {
            status,
            reason: dto.reason,
            reviewedAt: now,
            reviewedById: actorId,
          },
        });
        if (status === 'rejected') {
          await tx.pointsLedgerEntry.create({
            data: {
              profileId: redemption.profileId,
              kind: 'redemption_refund',
              amount: redemption.costPoints,
              redemptionId: id,
              idempotencyKey: `redemption:${id}:refund`,
            },
          });
          const reward = await tx.reward.findUniqueOrThrow({
            where: { id: redemption.rewardId },
          });
          if (reward.stock !== null)
            await tx.reward.update({
              where: { id: reward.id },
              data: { stock: { increment: 1 } },
            });
        }
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: `akubin.redemption_${status}`,
            resourceType: 'redemption',
            resourceId: id,
            detail: { reason: dto.reason ?? null },
          },
        });
        await tx.notification.create({
          data: {
            profileId: redemption.profileId,
            title: `Redemption ${status}`,
            body:
              status === 'rejected'
                ? 'Reserved points have been returned.'
                : 'Approved; fulfilment is pending.',
            href: '/app/akubin/rewards',
          },
        });
        return { id, status, duplicate: false };
      }),
    };
  }

  async fulfill(actorId: string, id: string, dto: FulfillRedemptionDto) {
    try {
      return {
        data: await this.db.transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM public.redemptions WHERE id = ${id}::uuid FOR UPDATE`;
          const redemption = await tx.redemption.findUnique({ where: { id } });
          if (!redemption) throw new NotFoundException('Redemption not found.');
          if (redemption.status === 'completed') {
            if (
              redemption.provider !== dto.provider ||
              redemption.providerReference !== dto.reference
            )
              throw new ConflictException(
                'Redemption was fulfilled using another reference.',
              );
            return { id, status: redemption.status, duplicate: true };
          }
          if (redemption.status !== 'approved')
            throw new ConflictException(
              'Only approved redemptions can be recorded as fulfilled.',
            );
          await tx.redemption.update({
            where: { id },
            data: {
              status: 'completed',
              provider: dto.provider,
              providerReference: dto.reference,
              fulfilledAt: await this.db.now(tx),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId,
              actorLabel: 'staff',
              action: 'akubin.redemption_fulfilled',
              resourceType: 'redemption',
              resourceId: id,
              detail: { provider: dto.provider, reference: dto.reference },
            },
          });
          await tx.notification.create({
            data: {
              profileId: redemption.profileId,
              title: 'Reward fulfilled',
              body: `${redemption.rewardName} was recorded as fulfilled by the review team.`,
              href: '/app/akubin/rewards',
            },
          });
          return { id, status: 'completed', duplicate: false };
        }),
      };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException('Fulfilment reference is already used.');
      throw error;
    }
  }
}
