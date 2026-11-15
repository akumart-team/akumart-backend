import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  DatabaseService,
  type Tx,
} from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { UploadsService } from '../uploads/uploads.service';
import { FulfilmentDto, ReviewDto, DisputeDto } from './dto/order.dto';
import { fareEstimate, kilograms } from '../../common/platform/order-math';
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
  ) {}
  async access(tx: Tx, id: string, user: string, buyerOnly = false) {
    const row = await tx.order.findFirst({
      where: {
        id,
        ...(buyerOnly
          ? { buyerId: user }
          : { OR: [{ buyerId: user }, { sellerId: user }] }),
      },
    });
    if (!row) throw new NotFoundException('Order not found.');
    return row;
  }
  async own(user: string, q: PageQuery) {
    const where = { OR: [{ buyerId: user }, { sellerId: user }] };
    const [rows, total] = await this.db.prisma.$transaction([
      this.db.prisma.order.findMany({
        where,
        include: { assignment: true },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.order.count({ where }),
    ]);
    return list(rows, total, q);
  }
  async detail(user: string, id: string) {
    await this.access(this.db.prisma, id, user);
    return {
      data: await this.db.prisma.order.findUnique({
        where: { id },
        include: {
          assignment: {
            include: { partner: { select: { business: true, phone: true } } },
          },
          events: { orderBy: { createdAt: 'asc' } },
          proofs: true,
          review: true,
          dispute: { include: { evidence: true } },
          payments: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              paidAt: true,
            },
          },
        },
      }),
    };
  }
  async estimate(user: string, id: string) {
    const order = await this.access(this.db.prisma, id, user, true);
    const settings = await this.db.prisma.platformSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings || settings.fareBase.add(settings.farePerKg).lte(0))
      throw new ServiceUnavailableException(
        'Configure delivery fare settings before requesting logistics.',
      );
    return {
      data: {
        ...fareEstimate(kilograms(order.quantity, order.unit), settings),
        currency: order.currency,
        basis: 'weight',
        includesDistance: false,
      },
    };
  }
  async fulfilment(user: string, id: string, dto: FulfilmentDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await this.access(tx, id, user, true);
        if (
          !['choose_fulfilment', 'awaiting_quotes', 'no_quotes'].includes(
            order.status,
          ) ||
          order.paymentStatus !== 'unpaid' ||
          (await tx.deliveryAssignment.count({ where: { orderId: id } }))
        )
          throw new ConflictException('Fulfilment can no longer be changed.');
        if (new Prisma.Decimal(dto.proposedFare).lte(0))
          throw new BadRequestException('Fare must be positive.');
        const settings = await tx.platformSettings.findUnique({
          where: { id: 1 },
        });
        if (!settings)
          throw new ServiceUnavailableException(
            'Logistics settings are required.',
          );
        const kg = kilograms(order.quantity, order.unit);
        const estimate = fareEstimate(kg, settings);
        const proposed = new Prisma.Decimal(dto.proposedFare);
        if (estimate.recommendedFare.lte(0))
          throw new ServiceUnavailableException(
            'Configure delivery fare settings first.',
          );
        if (
          proposed.lt(estimate.minFare) ||
          proposed.gt(estimate.maxFare) ||
          !proposed.mod(settings.fareStep).isZero()
        )
          throw new BadRequestException(
            'Fare must be within the estimated range and match the fare step.',
          );
        const now = await this.db.now(tx);
        const partners = await tx.partner.findMany({
          where: {
            status: 'approved',
            ownerId: { notIn: [order.buyerId, order.sellerId] },
            materials: { has: order.material },
            serviceAreas: { has: order.pickupCity },
            capacityKg: { gte: kg },
          },
          select: { id: true },
        });
        await tx.deliveryQuote.updateMany({
          where: { orderId: id, status: 'submitted' },
          data: { status: 'expired' },
        });
        await tx.jobNotice.createMany({
          data: partners.map((p) => ({ orderId: id, partnerId: p.id })),
          skipDuplicates: true,
        });
        await tx.jobNotice.updateMany({
          where: { orderId: id },
          data: { declinedAt: null, declineReason: null },
        });
        const updated = await tx.order.update({
          where: { id },
          data: {
            destination: dto.destination,
            proposedFare: dto.proposedFare,
            recommendedFare: estimate.recommendedFare,
            status: partners.length ? 'awaiting_quotes' : 'no_quotes',
            quoteDeadline: new Date(
              now.getTime() + settings.quoteDeadlineHours * 3600000,
            ),
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'buyer',
            action: 'fulfilment_requested',
            status: updated.status,
          },
        });
        return updated;
      }),
    };
  }
  async quotes(user: string, id: string) {
    await this.access(this.db.prisma, id, user, true);
    return {
      data: await this.db.prisma.deliveryQuote.findMany({
        where: { orderId: id },
        include: {
          partner: { select: { business: true, vehicles: true, status: true } },
        },
        orderBy: { amount: 'asc' },
      }),
    };
  }
  async extend(user: string, id: string) {
    const order = await this.access(this.db.prisma, id, user, true);
    if (
      !order.destination ||
      !order.proposedFare ||
      !['awaiting_quotes', 'no_quotes'].includes(order.status)
    )
      throw new ConflictException(
        'An unassigned delivery request is required.',
      );
    return this.fulfilment(user, id, {
      destination: order.destination,
      proposedFare: order.proposedFare.toFixed(2),
    });
  }
  async select(user: string, id: string, quoteId: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await this.access(tx, id, user, true);
        const existing = await tx.deliveryAssignment.findUnique({
          where: { orderId: id },
        });
        if (existing?.quoteId === quoteId) return existing;
        if (
          existing ||
          order.status !== 'awaiting_quotes' ||
          order.paymentStatus !== 'unpaid' ||
          !order.quoteDeadline ||
          order.quoteDeadline <= (await this.db.now(tx))
        )
          throw new ConflictException('Quote selection is closed.');
        const quote = await tx.deliveryQuote.findFirst({
          where: {
            id: quoteId,
            orderId: id,
            status: 'submitted',
            partner: {
              status: 'approved',
              ownerId: { notIn: [order.buyerId, order.sellerId] },
              capacityKg: { gte: kilograms(order.quantity, order.unit) },
              materials: { has: order.material },
              serviceAreas: { has: order.pickupCity },
            },
          },
        });
        if (!quote) throw new NotFoundException('Quote unavailable.');
        const assignment = await tx.deliveryAssignment.create({
          data: {
            orderId: id,
            quoteId,
            partnerId: quote.partnerId,
            agreedFare: quote.amount,
          },
        });
        await tx.deliveryQuote.updateMany({
          where: { orderId: id, status: 'submitted' },
          data: { status: 'declined' },
        });
        await tx.deliveryQuote.update({
          where: { id: quoteId },
          data: { status: 'selected' },
        });
        await tx.order.update({
          where: { id },
          data: { status: 'awaiting_payment', version: { increment: 1 } },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'buyer',
            action: 'quote_selected',
            status: 'awaiting_payment',
          },
        });
        return assignment;
      }),
    };
  }
  async cancel(user: string, id: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await this.access(tx, id, user, true);
        if (order.status === 'cancelled') return order;
        if (
          ![
            'choose_fulfilment',
            'awaiting_quotes',
            'no_quotes',
            'awaiting_payment',
          ].includes(order.status) ||
          order.paymentStatus !== 'unpaid' ||
          (await tx.payment.count({
            where: { orderId: id, status: { in: ['pending', 'succeeded'] } },
          }))
        )
          throw new ConflictException(
            'An order with a payment attempt must be reconciled by support before cancellation.',
          );
        await tx.listing.update({
          where: { id: order.listingId },
          data: { reservedQuantity: { decrement: order.quantity } },
        });
        await tx.deliveryQuote.updateMany({
          where: { orderId: id, status: { in: ['submitted', 'selected'] } },
          data: { status: 'expired' },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'buyer',
            action: 'cancelled',
            status: 'cancelled',
          },
        });
        return tx.order.update({
          where: { id },
          data: { status: 'cancelled', version: { increment: 1 } },
        });
      }),
    };
  }
  async confirm(user: string, id: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await this.access(tx, id, user, true);
        if (['confirmed', 'settled'].includes(order.status)) return order;
        if (
          order.status !== 'proof_uploaded' ||
          order.paymentStatus !== 'held' ||
          (await tx.settlementHold.count({
            where: { orderId: id, releasedAt: null },
          })) ||
          (await tx.dispute.count({ where: { orderId: id } }))
        )
          throw new ConflictException(
            'Delivery proof and a payment without an active dispute or hold are required.',
          );
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'buyer',
            action: 'receipt_confirmed',
            status: 'confirmed',
          },
        });
        return tx.order.update({
          where: { id },
          data: { status: 'confirmed', version: { increment: 1 } },
        });
      }),
    };
  }
  async review(user: string, id: string, dto: ReviewDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const order = await this.access(tx, id, user, true);
        if (order.status !== 'settled')
          throw new ConflictException('Only settled orders can be reviewed.');
        return tx.orderReview.create({
          data: { orderId: id, buyerId: user, ...dto },
        });
      }),
    };
  }
  async dispute(user: string, id: string, dto: DisputeDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const order = await this.access(tx, id, user, true);
        const now = await this.db.now(tx);
        if (
          !['delivered', 'proof_uploaded'].includes(order.status) ||
          order.paymentStatus !== 'held' ||
          (order.inspectionDue && order.inspectionDue <= now)
        )
          throw new ConflictException(
            'The inspection dispute window is not open.',
          );
        await this.uploads.assertReady(
          tx,
          dto.uploadIds,
          user,
          'dispute_evidence',
        );
        const dispute = await tx.dispute.create({
          data: {
            orderId: id,
            openedById: user,
            reason: dto.reason,
            evidence: {
              create: dto.uploadIds.map((uploadId) => ({ uploadId })),
            },
          },
        });
        await tx.settlementHold.create({
          data: {
            orderId: id,
            reason: 'Open delivery dispute',
            placedById: user,
          },
        });
        await tx.order.update({
          where: { id },
          data: { status: 'disputed', version: { increment: 1 } },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'buyer',
            action: 'dispute_opened',
            status: 'disputed',
          },
        });
        return dispute;
      }),
    };
  }
}
