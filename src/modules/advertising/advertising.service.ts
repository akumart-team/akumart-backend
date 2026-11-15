import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { UploadsService } from '../uploads/uploads.service';
import {
  CampaignDto,
  CampaignDecisionDto,
  AdvertisingPackageDto,
  PlacementQuery,
  CampaignTrackingDto,
} from './dto/advertising.dto';
@Injectable()
export class AdvertisingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
    private readonly config: ConfigService,
  ) {}
  async packages() {
    return {
      data: await this.db.prisma.advertisingPackage.findMany({
        where: { active: true },
        orderBy: { price: 'asc' },
      }),
    };
  }
  async package(actor: string, dto: AdvertisingPackageDto) {
    if (new Prisma.Decimal(dto.price).lte(0))
      throw new BadRequestException('Price must be positive.');
    return {
      data: await this.db.transaction(async (tx) => {
        const { id, ...data } = dto;
        const row = await tx.advertisingPackage.upsert({
          where: { id },
          create: dto,
          update: data,
        });
        await this.db.audit(
          tx,
          actor,
          'advertising_package_updated',
          'advertising_package',
          id,
        );
        return row;
      }),
    };
  }
  async create(user: string, dto: CampaignDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const pack = await tx.advertisingPackage.findFirst({
          where: { id: dto.packageId, active: true },
        });
        if (!pack) throw new NotFoundException('Package unavailable.');
        await this.uploads.assertReady(
          tx,
          [dto.imageId],
          user,
          'campaign_creative',
        );
        return tx.campaign.create({
          data: {
            ...dto,
            ownerId: user,
            price: pack.price,
            currency: pack.currency,
            durationDays: pack.durationDays,
            status: 'pending_review',
          },
        });
      }),
    };
  }
  async campaigns(user: string, q: PageQuery, admin = false) {
    const where = admin ? {} : { ownerId: user };
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.campaign.findMany({
        where,
        include: {
          payments: { select: { id: true, status: true, paidAt: true } },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.campaign.count({ where }),
    ]);
    return list(data, n, q);
  }
  async stats(user: string, id: string) {
    if (
      !(await this.db.prisma.campaign.findFirst({
        where: { id, ownerId: user },
      }))
    )
      throw new NotFoundException();
    const [impressions, clicks] = await this.db.prisma.$transaction([
      this.db.prisma.campaignEvent.count({
        where: { campaignId: id, kind: 'impression' },
      }),
      this.db.prisma.campaignEvent.count({
        where: { campaignId: id, kind: 'click' },
      }),
    ]);
    return {
      data: {
        impressions,
        clicks,
        clickThroughRate: impressions ? clicks / impressions : 0,
      },
    };
  }
  async decide(actor: string, id: string, dto: CampaignDecisionDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${id}::uuid FOR UPDATE`;
        const c = await tx.campaign.findUnique({ where: { id } });
        if (!c) throw new NotFoundException();
        if (c.ownerId === actor)
          throw new ForbiddenException(
            'You cannot moderate your own campaign.',
          );
        const now = await this.db.now(tx);
        if (
          dto.status === 'approved' &&
          (!(await tx.payment.count({
            where: { campaignId: id, status: 'succeeded' },
          })) ||
            (c.endsAt && c.endsAt <= now) ||
            (await tx.refund.count({
              where: { payment: { campaignId: id }, status: { not: 'failed' } },
            })))
        )
          throw new ConflictException(
            'An unrefunded verified payment and unexpired campaign are required.',
          );
        const data = {
          ...dto,
          reviewedById: actor,
          reviewedAt: now,
          ...(dto.status === 'approved' && !c.startsAt
            ? {
                startsAt: now,
                endsAt: new Date(now.getTime() + c.durationDays * 86400000),
              }
            : {}),
        };
        const row = await tx.campaign.update({ where: { id }, data });
        await this.db.audit(tx, actor, 'campaign_reviewed', 'campaign', id, {
          ...dto,
        });
        return row;
      }),
    };
  }
  private secret() {
    const key = this.config.get<string>('CAMPAIGN_TRACKING_SECRET');
    if (!key || key.length < 32)
      throw new ServiceUnavailableException(
        'Campaign tracking secret must be configured.',
      );
    return key;
  }
  async placements(q: PlacementQuery) {
    const now = new Date();
    const data = await this.db.prisma.campaign.findMany({
      where: {
        status: 'approved',
        startsAt: { lte: now },
        endsAt: { gt: now },
        payments: { some: { status: 'succeeded' } },
        AND: [
          {
            OR: [
              { locations: { isEmpty: true } },
              ...(q.city ? [{ locations: { has: q.city } }] : []),
            ],
          },
          {
            OR: [
              { materials: { isEmpty: true } },
              ...(q.material ? [{ materials: { has: q.material } }] : []),
            ],
          },
          {
            OR: [
              { roles: { isEmpty: true } },
              ...(q.role ? [{ roles: { has: q.role } }] : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        body: true,
        imageId: true,
        destinationUrl: true,
      },
      take: 6,
      orderBy: { startsAt: 'desc' },
    });
    return {
      data: data.map((c) => {
        const payload = Buffer.from(
          JSON.stringify({
            id: c.id,
            placement: q.placement,
            nonce: randomUUID(),
            exp: Date.now() + 3600000,
          }),
        ).toString('base64url');
        return {
          ...c,
          trackingToken: `${payload}.${createHmac('sha256', this.secret()).update(payload).digest('hex')}`,
        };
      }),
    };
  }
  async track(dto: CampaignTrackingDto) {
    const [payload, signature, extra] = dto.token.split('.');
    const expected = createHmac('sha256', this.secret())
      .update(payload ?? '')
      .digest();
    if (
      extra ||
      !/^[0-9a-f]{64}$/.test(signature ?? '') ||
      !timingSafeEqual(expected, Buffer.from(signature, 'hex'))
    )
      throw new BadRequestException('Invalid tracking token.');
    let data: { id: string; nonce: string; placement: string; exp: number };
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid token.');
    }
    if (
      !Number.isFinite(data.exp) ||
      data.exp < Date.now() ||
      !(await this.db.prisma.campaign.findFirst({
        where: {
          id: data.id,
          status: 'approved',
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
          payments: { some: { status: 'succeeded' } },
        },
      }))
    )
      throw new BadRequestException('Campaign token expired.');
    const eventKey = `${data.nonce}:${dto.kind}`;
    await this.db.prisma.campaignEvent.upsert({
      where: { eventKey },
      create: {
        campaignId: data.id,
        eventKey,
        kind: dto.kind,
        placement: data.placement,
      },
      update: {},
    });
    return { recorded: true };
  }
}
