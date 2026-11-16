import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../../common/platform/database.service';
import { TradePolicy } from '../../common/platform/trade-policy.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { UploadsService } from '../uploads/uploads.service';
import type {
  CreateListingDto,
  UpdateListingDto,
  ListingQuery,
  ModerateListingDto,
} from './dto/listing.dto';
export const LISTING_INCLUDE = {
  images: {
    orderBy: { position: 'asc' },
    select: { uploadId: true, position: true },
  },
  seller: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      city: true,
    },
  },
} satisfies Prisma.ListingInclude;
export const listingView = <
  T extends {
    quantity: Prisma.Decimal;
    reservedQuantity: Prisma.Decimal;
    soldQuantity: Prisma.Decimal;
  },
>(
  row: T,
) => ({
  ...row,
  availableQuantity: row.quantity
    .sub(row.reservedQuantity)
    .sub(row.soldQuantity)
    .toString(),
});
@Injectable()
export class ListingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
    private readonly uploads: UploadsService,
  ) {}
  async browse(q: ListingQuery) {
    const where = Prisma.sql`l.status = 'published' AND l.quantity - l.reserved_quantity - l.sold_quantity > 0
      AND EXISTS (SELECT 1 FROM verification_submissions v WHERE v.profile_id = l.seller_id AND v.level = 'basic' AND v.status = 'approved' AND (v.expires_at IS NULL OR v.expires_at > now()))
      ${q.material ? Prisma.sql`AND l.material::text = ${q.material}` : Prisma.empty}
      ${q.city ? Prisma.sql`AND lower(l.city) = lower(${q.city})` : Prisma.empty}
      ${q.search ? Prisma.sql`AND (l.title ILIKE ${`%${q.search}%`} OR l.description ILIKE ${`%${q.search}%`})` : Prisma.empty}
      ${q.minPrice ? Prisma.sql`AND l.unit_price >= ${q.minPrice}::numeric` : Prisma.empty}
      ${q.maxPrice ? Prisma.sql`AND l.unit_price <= ${q.maxPrice}::numeric` : Prisma.empty}
      ${q.excludeId ? Prisma.sql`AND l.id <> ${q.excludeId}::uuid` : Prisma.empty}`;
    const sort =
      q.sort === 'price_asc'
        ? Prisma.sql`l.unit_price ASC, l.id`
        : q.sort === 'price_desc'
          ? Prisma.sql`l.unit_price DESC, l.id`
          : Prisma.sql`l.created_at DESC, l.id`;
    const [ids, totals] = await this.db.prisma.$transaction([
      this.db.prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT l.id FROM listings l WHERE ${where} ORDER BY ${sort} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      ),
      this.db.prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT count(*) AS total FROM listings l WHERE ${where}`,
      ),
    ]);
    const rows = await this.db.prisma.listing.findMany({
      where: { id: { in: ids.map((x) => x.id) } },
      include: LISTING_INCLUDE,
    });
    return list(
      ids.map((x) => listingView(rows.find((r) => r.id === x.id)!)),
      Number(totals[0].total),
      q,
    );
  }
  async detail(id: string, user?: string) {
    const row = await this.db.prisma.listing.findUnique({
      where: { id },
      include: LISTING_INCLUDE,
    });
    if (!row || (row.sellerId !== user && row.status !== 'published'))
      throw new NotFoundException('Listing not found.');
    if (row.sellerId !== user) {
      const approved = await this.db.prisma.verificationSubmission.findFirst({
        where: {
          profileId: row.sellerId,
          level: 'basic',
          status: 'approved',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!approved) throw new NotFoundException('Listing not found.');
      await this.db.prisma.listing.update({
        where: { id },
        data: { views: { increment: 1 } },
      });
    }
    return { data: listingView(row) };
  }
  async own(user: string, q: PageQuery) {
    const where = { sellerId: user };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.listing.findMany({
        where,
        include: LISTING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.listing.count({ where }),
    ]);
    return list(data.map(listingView), total, q);
  }
  async save(
    user: string,
    dto: CreateListingDto | UpdateListingDto,
    id?: string,
  ) {
    if (Object.values(dto).some((v) => v === null))
      throw new BadRequestException('Null values are not supported.');
    return {
      data: await this.db.transaction(async (tx) => {
        await this.policy.require(user, 'basic', tx);
        if (id)
          await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id}::uuid FOR UPDATE`;
        const old = id
          ? await tx.listing.findFirst({ where: { id, sellerId: user } })
          : null;
        if (id && !old) throw new NotFoundException('Listing not found.');
        if (old?.status === 'flagged')
          throw new ConflictException(
            'Flagged listings require staff moderation.',
          );
        const { imageIds, ...fields } = dto;
        const merged = { ...old, ...fields };
        const quantity = new Prisma.Decimal(merged.quantity!);
        const minimum = new Prisma.Decimal(merged.minOrder!);
        if (new Prisma.Decimal(merged.unitPrice!).lte(0))
          throw new BadRequestException('Unit price must be positive.');
        if (
          quantity.lte(0) ||
          minimum.lte(0) ||
          minimum.gt(quantity) ||
          quantity.lt(
            (old?.reservedQuantity ?? new Prisma.Decimal(0)).add(
              old?.soldQuantity ?? 0,
            ),
          )
        )
          throw new BadRequestException(
            'Quantity/minimum or existing stock reservations are invalid.',
          );
        if (
          old &&
          (old.reservedQuantity.gt(0) ||
            old.soldQuantity.gt(0) ||
            (await tx.offer.count({ where: { listingId: old.id } }))) &&
          ((dto.unit && dto.unit !== old.unit) ||
            (dto.material && dto.material !== old.material))
        )
          throw new ConflictException(
            'Material and unit cannot change after negotiation starts.',
          );
        if (imageIds)
          await this.uploads.assertReady(tx, imageIds, user, 'listing_image');
        const status = fields.status ?? old?.status ?? 'draft';
        const imageCount =
          imageIds?.length ??
          (id ? await tx.listingImage.count({ where: { listingId: id } }) : 0);
        if (
          status === 'published' &&
          (!imageCount ||
            quantity
              .sub(old?.reservedQuantity ?? 0)
              .sub(old?.soldQuantity ?? 0)
              .lte(0))
        )
          throw new BadRequestException(
            'Publishing requires a photo and available stock.',
          );
        const row = old
          ? await tx.listing.update({
              where: { id },
              data: {
                ...fields,
                ...(status === 'published' && !old.publishedAt
                  ? { publishedAt: await this.db.now(tx) }
                  : {}),
              },
            })
          : await tx.listing.create({
              data: {
                ...(fields as CreateListingDto),
                sellerId: user,
                status,
                publishedAt:
                  status === 'published' ? await this.db.now(tx) : null,
              },
            });
        if (imageIds) {
          await tx.listingImage.deleteMany({ where: { listingId: row.id } });
          await tx.listingImage.createMany({
            data: imageIds.map((uploadId, position) => ({
              listingId: row.id,
              uploadId,
              position,
            })),
          });
        }
        await this.db.audit(
          tx,
          user,
          old ? 'listing.updated' : 'listing.created',
          'listing',
          row.id,
        );
        return listingView(
          await tx.listing.findUniqueOrThrow({
            where: { id: row.id },
            include: LISTING_INCLUDE,
          }),
        );
      }),
    };
  }
  async saved(user: string, q: PageQuery) {
    const where = {
      profileId: user,
      listing: {
        sellerId: { not: user },
        status: 'published' as const,
        seller: {
          verifications: {
            some: {
              level: 'basic' as const,
              status: 'approved' as const,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
    };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.savedListing.findMany({
        where,
        include: { listing: { include: LISTING_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.savedListing.count({ where }),
    ]);
    return list(
      data.map((r) => listingView(r.listing)),
      total,
      q,
    );
  }
  async bookmark(user: string, id: string, remove = false) {
    if (remove)
      await this.db.prisma.savedListing.deleteMany({
        where: { profileId: user, listingId: id },
      });
    else {
      await this.db.transaction(async (tx) => {
        const preferences = await tx.userPreferences.findUnique({
          where: { profileId: user },
        });
        const buying =
          preferences?.marketRole === 'buyer' ||
          (preferences?.marketRole === 'both' &&
            preferences.activeMode !== 'seller');
        if (!buying)
          throw new ForbiddenException(
            'Use a buyer account or switch to buyer mode to save listings.',
          );
        const listing = await tx.listing.findUnique({
          where: { id },
          select: { sellerId: true, status: true },
        });
        if (!listing) throw new NotFoundException('Listing not found.');
        if (listing.sellerId === user)
          throw new ForbiddenException('You cannot save your own listing.');
        if (listing.status !== 'published')
          throw new NotFoundException('Listing not found.');
        const verified = await tx.verificationSubmission.findFirst({
          where: {
            profileId: listing.sellerId,
            level: 'basic',
            status: 'approved',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });
        if (!verified) throw new NotFoundException('Listing not found.');
        await tx.savedListing.upsert({
          where: { profileId_listingId: { profileId: user, listingId: id } },
          create: { profileId: user, listingId: id },
          update: {},
        });
      });
    }
    return { data: { saved: !remove } };
  }
  async report(user: string, id: string, reason: string) {
    await this.detail(id, user);
    return {
      data: await this.db.prisma.listingReport.create({
        data: { listingId: id, reporterId: user, reason },
        select: { id: true, createdAt: true },
      }),
    };
  }
  async moderation(actor: string, id: string, dto: ModerateListingDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const old = await tx.listing.findUniqueOrThrow({ where: { id } });
        if (old.sellerId === actor)
          throw new BadRequestException(
            'Staff cannot moderate their own listing.',
          );
        if (dto.status === 'published')
          await this.policy.require(old.sellerId, 'basic', tx);
        const row = await tx.listing.update({
          where: { id },
          data: { status: dto.status },
        });
        await tx.listingReport.updateMany({
          where: { listingId: id, resolvedAt: null },
          data: { resolvedAt: await this.db.now(tx) },
        });
        await this.db.audit(tx, actor, 'listing.moderated', 'listing', id, {
          reason: dto.reason,
          status: dto.status,
        });
        return row;
      }),
    };
  }
  async admin(q: PageQuery) {
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.listing.findMany({
        include: { reports: { where: { resolvedAt: null } } },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.listing.count(),
    ]);
    return list(data.map(listingView), total, q);
  }
  async reviews(sellerId: string, q: PageQuery) {
    const where = { order: { sellerId, status: 'settled' as const } };
    const [data, total, rating] = await this.db.prisma.$transaction([
      this.db.prisma.orderReview.findMany({
        where,
        select: { stars: true, text: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.orderReview.count({ where }),
      this.db.prisma.orderReview.aggregate({ where, _avg: { stars: true } }),
    ]);
    return { ...list(data, total, q), rating: rating._avg.stars };
  }
}
