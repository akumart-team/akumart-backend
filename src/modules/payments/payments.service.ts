import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../common/platform/database.service';
import { TradePolicy } from '../../common/platform/trade-policy.service';
import {
  PaystackService,
  minorUnits,
} from '../../integrations/paystack/paystack.service';
import { Prisma } from '../../generated/prisma/client';
interface Transaction {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at?: string;
}
@Injectable()
export class PaymentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
    private readonly paystack: PaystackService,
  ) {}
  async checkout(user: string, id: string, campaign = false) {
    const callback = this.paystack.callbackUrl();
    const payment = await this.db.transaction(async (tx) => {
      let amount: Prisma.Decimal;
      let currency: string;
      if (campaign) {
        await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${id}::uuid FOR UPDATE`;
        const row = await tx.campaign.findFirst({
          where: { id, ownerId: user },
        });
        if (!row) throw new NotFoundException();
        if (row.status !== 'pending_review')
          throw new ConflictException('Submit the campaign before checkout.');
        amount = row.price;
        currency = row.currency;
      } else {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const row = await tx.order.findFirst({
          where: { id, buyerId: user },
          include: { assignment: { include: { partner: true } } },
        });
        if (!row) throw new NotFoundException();
        await this.policy.require(user, 'full', tx);
        await this.policy.require(row.sellerId, 'full', tx);
        if (
          row.status !== 'awaiting_payment' ||
          row.paymentStatus !== 'unpaid' ||
          !row.assignment ||
          row.assignment.partner.status !== 'approved'
        )
          throw new ConflictException(
            'Select an approved logistics partner before checkout.',
          );
        amount = row.quantity
          .mul(row.unitPrice)
          .toDecimalPlaces(2)
          .add(row.assignment.agreedFare);
        currency = row.currency;
      }
      const target = campaign ? { campaignId: id } : { orderId: id };
      const prior = await tx.payment.findFirst({
        where: { ...target, status: { in: ['pending', 'succeeded'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (prior) return prior;
      const paymentId = randomUUID();
      const reference = `akumart_${paymentId}`;
      minorUnits(amount);
      return tx.payment.create({
        data: {
          id: paymentId,
          ...target,
          amount,
          currency,
          provider: 'paystack',
          providerReference: reference,
          idempotencyKey: reference,
        },
      });
    });
    if (payment.status === 'succeeded' || payment.checkoutUrl)
      return { data: payment };
    const profile = await this.db.prisma.profile.findUniqueOrThrow({
      where: { id: user },
      select: { email: true },
    });
    const result = await this.paystack.call<{
      authorization_url: string;
      reference: string;
    }>('POST', '/transaction/initialize', {
      email: profile.email,
      amount: minorUnits(payment.amount),
      currency: payment.currency,
      reference: payment.providerReference,
      callback_url: callback,
      metadata: { paymentId: payment.id },
    });
    if (
      result.reference !== payment.providerReference ||
      !result.authorization_url?.startsWith('https://')
    )
      throw new ConflictException('Unexpected checkout response.');
    await this.db.prisma.payment.updateMany({
      where: { id: payment.id, status: 'pending' },
      data: { checkoutUrl: result.authorization_url },
    });
    return {
      data: await this.db.prisma.payment.findUnique({
        where: { id: payment.id },
      }),
    };
  }
  async own(user: string, id: string, reconcile = false) {
    const payment = await this.db.prisma.payment.findFirst({
      where: {
        id,
        OR: [{ order: { buyerId: user } }, { campaign: { ownerId: user } }],
      },
    });
    if (!payment) throw new NotFoundException();
    if (reconcile) await this.verify(payment.providerReference!);
    return {
      data: await this.db.prisma.payment.findUnique({
        where: { id },
        include: {
          refunds: {
            select: { id: true, amount: true, status: true, reason: true },
          },
        },
      }),
    };
  }
  async verify(reference: string) {
    const payment = await this.db.prisma.payment.findUnique({
      where: {
        provider_providerReference: {
          provider: 'paystack',
          providerReference: reference,
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment reference unknown.');
    if (payment.status === 'succeeded') return payment;
    const data = await this.paystack.call<Transaction>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    if (
      data.reference !== reference ||
      data.amount !== minorUnits(payment.amount) ||
      data.currency !== payment.currency
    )
      throw new ConflictException(
        'Payment reference, amount or currency mismatch.',
      );
    if (data.status !== 'success') {
      if (['failed', 'abandoned', 'reversed'].includes(data.status))
        await this.db.prisma.payment.updateMany({
          where: { id: payment.id, status: 'pending' },
          data: {
            status: 'failed',
            failureReason: `Paystack transaction ${data.status}`,
          },
        });
      return payment;
    }
    return this.db.transaction(async (tx) => {
      if (payment.orderId)
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId}::uuid FOR UPDATE`;
      else
        await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${payment.campaignId}::uuid FOR UPDATE`;
      const latest = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      if (latest.status === 'succeeded') return latest;
      if (payment.orderId) {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
        });
        if (
          order.status !== 'awaiting_payment' ||
          order.paymentStatus !== 'unpaid'
        )
          throw new ConflictException(
            'Payment received for an order requiring manual reconciliation.',
          );
        await tx.listing.update({
          where: { id: order.listingId },
          data: {
            reservedQuantity: { decrement: order.quantity },
            soldQuantity: { increment: order.quantity },
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'paid',
            paymentStatus: 'held',
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            actorLabel: 'paystack',
            action: 'payment_verified',
            status: 'paid',
          },
        });
        await this.db.notify(
          tx,
          order.sellerId,
          'Order paid',
          'A verified payment was received.',
          `/app/orders/${order.id}`,
        );
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: 'succeeded', paidAt: await this.db.now(tx) },
      });
    });
  }
}
