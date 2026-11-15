import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../../common/platform/database.service';
import { TradePolicy } from '../../common/platform/trade-policy.service';
import { TradeListQuery, paging, list } from '../../common/platform/query.dto';
import type { OfferTermsDto } from './dto/offer.dto';
@Injectable()
export class OffersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
  ) {}
  async create(user: string, listingId: string, dto: OfferTermsDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.policy.require(user, 'basic', tx);
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listingId}::uuid FOR UPDATE`;
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
        });
        if (!listing || listing.status !== 'published')
          throw new NotFoundException('Listing not available.');
        if (listing.sellerId === user)
          throw new BadRequestException(
            'You cannot offer on your own listing.',
          );
        await this.policy.require(listing.sellerId, 'basic', tx);
        const now = await this.db.now(tx);
        const active = await tx.offer.findFirst({
          where: {
            listingId,
            buyerId: user,
            status: { in: ['awaiting_buyer', 'awaiting_seller'] },
            expiresAt: { gt: now },
          },
          select: { id: true },
        });
        if (active)
          throw new ConflictException({
            message:
              'You already have an active offer for this listing. Continue the negotiation with a counteroffer.',
            offerId: active.id,
          });
        const quantity = new Prisma.Decimal(dto.quantity);
        const available = listing.quantity
          .sub(listing.reservedQuantity)
          .sub(listing.soldQuantity);
        if (
          quantity.lt(listing.minOrder) ||
          quantity.gt(available) ||
          (!listing.allowPartial && !quantity.eq(available)) ||
          new Prisma.Decimal(dto.unitPrice).lte(0)
        )
          throw new BadRequestException('Invalid offer quantity or price.');
        const offer = await tx.offer.create({
          data: {
            listingId,
            buyerId: user,
            sellerId: listing.sellerId,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 72 * 3600000),
            steps: {
              create: { actorId: user, sequence: 1, action: 'offer', ...dto },
            },
          },
          include: { steps: true },
        });
        await this.db.notify(
          tx,
          listing.sellerId,
          'New offer',
          listing.title,
          '/app/offers',
        );
        return offer;
      }),
    };
  }
  async own(user: string, q: TradeListQuery) {
    await this.db.prisma.offer.updateMany({
      where: {
        OR: [{ buyerId: user }, { sellerId: user }],
        status: { in: ['awaiting_buyer', 'awaiting_seller'] },
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });
    const scope =
      q.mode === 'buyer'
        ? { buyerId: user }
        : q.mode === 'seller'
          ? { sellerId: user }
          : { OR: [{ buyerId: user }, { sellerId: user }] };
    const where: Prisma.OfferWhereInput = {
      AND: [
        scope,
        ...(q.listingId ? [{ listingId: q.listingId }] : []),
        ...(q.search
          ? [
              {
                listing: {
                  title: { contains: q.search, mode: 'insensitive' as const },
                },
              },
            ]
          : []),
      ],
    };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.offer.findMany({
        where,
        include: {
          steps: { orderBy: { sequence: 'asc' } },
          listing: {
            select: { id: true, title: true, unit: true, material: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.offer.count({ where }),
    ]);
    return list(data, total, q);
  }
  async detail(user: string, id: string) {
    const row = await this.db.prisma.offer.findFirst({
      where: { id, OR: [{ buyerId: user }, { sellerId: user }] },
      include: {
        steps: { orderBy: { sequence: 'asc' } },
        order: { select: { id: true } },
      },
    });
    if (!row) throw new NotFoundException('Offer not found.');
    return {
      data: {
        ...row,
        status:
          ['awaiting_buyer', 'awaiting_seller'].includes(row.status) &&
          row.expiresAt <= new Date()
            ? 'expired'
            : row.status,
      },
    };
  }
  async respond(
    user: string,
    id: string,
    action: 'accept' | 'reject' | 'counter',
    dto?: OfferTermsDto,
  ) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM offers WHERE id = ${id}::uuid FOR UPDATE`;
        const offer = await tx.offer.findFirst({
          where: { id, OR: [{ buyerId: user }, { sellerId: user }] },
          include: {
            steps: { orderBy: { sequence: 'desc' }, take: 1 },
            order: { select: { id: true } },
          },
        });
        if (!offer) throw new NotFoundException('Offer not found.');
        if (action === 'accept' && offer.status === 'accepted')
          return { offerId: id, orderId: offer.order?.id, duplicate: true };
        const now = await this.db.now(tx);
        if (
          !['awaiting_buyer', 'awaiting_seller'].includes(offer.status) ||
          offer.expiresAt <= now
        )
          throw new ConflictException('Offer is closed or expired.');
        if (
          (offer.status === 'awaiting_seller'
            ? offer.sellerId
            : offer.buyerId) !== user
        )
          throw new ConflictException('It is the other participant’s turn.');
        await this.policy.require(user, 'basic', tx);
        const last = offer.steps[0];
        const terms = dto ?? {
          unitPrice: last.unitPrice,
          quantity: last.quantity,
          conditions: last.conditions,
        };
        if (
          new Prisma.Decimal(terms.quantity).lte(0) ||
          new Prisma.Decimal(terms.unitPrice).lte(0)
        )
          throw new BadRequestException('Price and quantity must be positive.');
        let orderId: string | undefined;
        if (action === 'accept') {
          await tx.$queryRaw`SELECT id FROM listings WHERE id = ${offer.listingId}::uuid FOR UPDATE`;
          const listing = await tx.listing.findUniqueOrThrow({
            where: { id: offer.listingId },
          });
          const qty = new Prisma.Decimal(terms.quantity);
          const available = listing.quantity
            .sub(listing.reservedQuantity)
            .sub(listing.soldQuantity);
          if (
            listing.status !== 'published' ||
            qty.gt(available) ||
            qty.lt(listing.minOrder) ||
            (!listing.allowPartial && !qty.eq(available))
          )
            throw new ConflictException(
              'Listing no longer has the agreed available quantity.',
            );
          await this.policy.require(offer.buyerId, 'basic', tx);
          await this.policy.require(offer.sellerId, 'basic', tx);
          const settings = await tx.platformSettings.findUnique({
            where: { id: 1 },
          });
          if (!settings)
            throw new ServiceUnavailableException(
              'Trading fees and logistics settings must be configured first.',
            );
          await tx.listing.update({
            where: { id: listing.id },
            data: { reservedQuantity: { increment: qty } },
          });
          const order = await tx.order.create({
            data: {
              offerId: id,
              listingId: listing.id,
              buyerId: offer.buyerId,
              sellerId: offer.sellerId,
              title: listing.title,
              material: listing.material,
              quantity: qty,
              unit: listing.unit,
              unitPrice: terms.unitPrice,
              currency: listing.currency,
              sellerFeePct: settings.sellerFeePct,
              partnerFeePct: settings.partnerFeePct,
              inspectionHours: settings.inspectionHours,
              pickupCity: listing.city,
              pickupArea: listing.area,
              events: {
                create: {
                  actorId: user,
                  actorLabel: 'account',
                  action: 'offer_accepted',
                  status: 'choose_fulfilment',
                },
              },
            },
          });
          orderId = order.id;
        }
        await tx.offerStep.create({
          data: {
            offerId: id,
            actorId: user,
            sequence: last.sequence + 1,
            action,
            ...terms,
          },
        });
        await tx.offer.update({
          where: { id },
          data: {
            status:
              action === 'accept'
                ? 'accepted'
                : action === 'reject'
                  ? 'rejected'
                  : user === offer.sellerId
                    ? 'awaiting_buyer'
                    : 'awaiting_seller',
            version: { increment: 1 },
            ...(action === 'counter'
              ? { expiresAt: new Date(now.getTime() + 72 * 3600000) }
              : {}),
          },
        });
        await this.db.notify(
          tx,
          user === offer.sellerId ? offer.buyerId : offer.sellerId,
          `Offer ${action}`,
          'Your negotiation was updated.',
          orderId ? `/app/orders/${orderId}` : '/app/offers',
        );
        return { offerId: id, orderId, duplicate: false };
      }),
    };
  }
}
