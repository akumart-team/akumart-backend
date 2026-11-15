import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { Prisma } from '../../generated/prisma/client';
import { SettingsDto } from './dto/settings.dto';
@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}
  async me(id: string) {
    return {
      data: await this.db.prisma.staffMembership.findUnique({
        where: { profileId: id },
        select: { profileId: true, role: true, active: true },
      }),
    };
  }
  async dashboard() {
    const [
      users,
      listings,
      orders,
      partnersPending,
      verificationsPending,
      disputesOpen,
      ticketsOpen,
      campaignsPending,
    ] = await this.db.prisma.$transaction([
      this.db.prisma.profile.count(),
      this.db.prisma.listing.count(),
      this.db.prisma.order.count(),
      this.db.prisma.partner.count({ where: { status: 'pending' } }),
      this.db.prisma.verificationSubmission.count({
        where: { status: 'pending_review' },
      }),
      this.db.prisma.dispute.count({ where: { status: { not: 'resolved' } } }),
      this.db.prisma.supportTicket.count({
        where: { status: { not: 'resolved' } },
      }),
      this.db.prisma.campaign.count({ where: { status: 'pending_review' } }),
    ]);
    return {
      data: {
        users,
        listings,
        orders,
        partnersPending,
        verificationsPending,
        disputesOpen,
        ticketsOpen,
        campaignsPending,
      },
    };
  }
  async users(q: PageQuery) {
    const where = q.search
      ? {
          OR: [
            { email: { contains: q.search, mode: 'insensitive' as const } },
            { firstName: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.profile.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          city: true,
          createdAt: true,
          preferences: true,
          verifications: {
            select: {
              id: true,
              level: true,
              type: true,
              status: true,
              expiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 4,
          },
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.profile.count({ where }),
    ]);
    return list(data, n, q);
  }
  async user(id: string) {
    const row = await this.db.prisma.profile.findUnique({
      where: { id },
      include: {
        preferences: true,
        verifications: {
          select: {
            id: true,
            level: true,
            type: true,
            status: true,
            expiresAt: true,
          },
        },
        wallet: true,
        partner: { select: { id: true, business: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException();
    return { data: row };
  }
  async orders(q: PageQuery) {
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.order.findMany({
        include: {
          assignment: true,
          holds: { where: { releasedAt: null } },
          dispute: true,
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.order.count(),
    ]);
    return list(data, n, q);
  }
  async order(id: string) {
    const row = await this.db.prisma.order.findUnique({
      where: { id },
      include: {
        assignment: { include: { partner: true } },
        proofs: true,
        events: { orderBy: { createdAt: 'asc' } },
        dispute: { include: { evidence: true } },
        holds: true,
        payments: { include: { refunds: true } },
        settlement: { include: { transfers: true } },
      },
    });
    if (!row) throw new NotFoundException();
    return { data: row };
  }
  async finance(q: PageQuery) {
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.payment.findMany({
        include: { refunds: true },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.payment.count(),
    ]);
    return list(data, n, q);
  }
  async audit(q: PageQuery) {
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.auditLog.count(),
    ]);
    return list(data, n, q);
  }
  async settings() {
    return {
      data: await this.db.prisma.platformSettings.findUnique({
        where: { id: 1 },
      }),
    };
  }
  async initializeSettings(actor: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        const row = await tx.platformSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {},
        });
        await this.db.audit(
          tx,
          actor,
          'settings_initialized',
          'platform_settings',
          '1',
        );
        return row;
      }),
    };
  }
  async updateSettings(actor: string, dto: SettingsDto) {
    if (Object.values(dto).some((v) => v === null))
      throw new BadRequestException('Null values are not allowed.');
    for (const key of [
      'sellerFeePct',
      'partnerFeePct',
      'fareMinPct',
      'fareMaxPct',
    ] as const)
      if (dto[key] !== undefined && new Prisma.Decimal(dto[key]!).gt(100))
        throw new BadRequestException(
          'Percentages must be between zero and 100.',
        );
    for (const key of [
      'fareStep',
      'itemKgEquivalent',
      'pointValueNaira',
    ] as const)
      if (dto[key] !== undefined && new Prisma.Decimal(dto[key]!).lte(0))
        throw new BadRequestException(`${key} must be positive.`);
    return {
      data: await this.db.transaction(async (tx) => {
        const { version, ...data } = dto;
        const result = await tx.platformSettings.updateMany({
          where: { id: 1, version },
          data: { ...data, version: { increment: 1 } },
        });
        if (!result.count)
          throw new ConflictException(
            'Settings changed; reload before saving.',
          );
        await this.db.audit(
          tx,
          actor,
          'settings_updated',
          'platform_settings',
          '1',
          { ...dto },
        );
        return tx.platformSettings.findUnique({ where: { id: 1 } });
      }),
    };
  }
  async hold(actor: string, id: string, reason: string, holdId?: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundException();
        if ([order.buyerId, order.sellerId].includes(actor))
          throw new ForbiddenException(
            'You cannot manage your own payment hold.',
          );
        if (await tx.settlement.count({ where: { orderId: id } }))
          throw new ConflictException('A payout has already been initiated.');
        if (holdId) {
          if (
            await tx.dispute.count({
              where: { orderId: id, status: { not: 'resolved' } },
            })
          )
            throw new ConflictException('Resolve the dispute first.');
          const changed = await tx.settlementHold.updateMany({
            where: { id: holdId, orderId: id, releasedAt: null },
            data: { releasedAt: await this.db.now(tx), releasedById: actor },
          });
          if (!changed.count) throw new NotFoundException();
        } else {
          if (order.paymentStatus !== 'held')
            throw new ConflictException(
              'Only held payments can receive a settlement hold.',
            );
          await tx.settlementHold.create({
            data: { orderId: id, reason, placedById: actor },
          });
        }
        await this.db.audit(
          tx,
          actor,
          holdId ? 'hold_released' : 'hold_placed',
          'order',
          id,
          { reason },
        );
        return tx.settlementHold.findMany({ where: { orderId: id } });
      }),
    };
  }
}
