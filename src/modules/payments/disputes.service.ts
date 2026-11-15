import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { Prisma } from '../../generated/prisma/client';
import {
  PaystackService,
  minorUnits,
} from '../../integrations/paystack/paystack.service';
import { DisputeDecisionDto } from './dto/payment.dto';
@Injectable()
export class DisputesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly paystack: PaystackService,
  ) {}
  async queue(q: PageQuery) {
    const [rows, count] = await this.db.prisma.$transaction([
      this.db.prisma.dispute.findMany({
        include: { evidence: true, refunds: true, order: true },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.dispute.count(),
    ]);
    return list(rows, count, q);
  }
  async decide(actor: string, id: string, dto: DisputeDecisionDto) {
    const result = await this.db.transaction(async (tx) => {
      const found = await tx.dispute.findUnique({ where: { id } });
      if (!found) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.orderId}::uuid FOR UPDATE`;
      const dispute = await tx.dispute.findUniqueOrThrow({
        where: { id },
        include: {
          order: { include: { assignment: { include: { partner: true } } } },
          refunds: true,
        },
      });
      if (
        [
          dispute.openedById,
          dispute.order.sellerId,
          dispute.order.assignment?.partner.ownerId,
        ].includes(actor)
      )
        throw new ForbiddenException('You cannot decide your own dispute.');
      if (dispute.status === 'resolved')
        return { dispute, refund: dispute.refunds[0] };
      if (
        dispute.order.paymentStatus !== 'held' ||
        (await tx.settlement.count({ where: { orderId: dispute.orderId } }))
      )
        throw new ConflictException('Settlement has already begun.');
      const payment = await tx.payment.findFirst({
        where: { orderId: dispute.orderId, status: 'succeeded' },
      });
      if (!payment) throw new ConflictException('No verified payment.');
      const amount =
        dto.decision === 'refund'
          ? payment.amount
          : dto.decision === 'partial'
            ? new Prisma.Decimal(dto.refundAmount ?? '0')
            : new Prisma.Decimal(0);
      const merchandise = dispute.order.quantity
        .mul(dispute.order.unitPrice)
        .toDecimalPlaces(2);
      if (
        (dto.decision === 'partial' &&
          (amount.lte(0) || amount.gte(merchandise))) ||
        (dto.decision === 'release' && dto.refundAmount !== undefined)
      )
        throw new BadRequestException(
          'A partial refund must be less than the merchandise value; full refunds include delivery.',
        );
      const now = await this.db.now(tx);
      const updated = await tx.dispute.update({
        where: { id },
        data: {
          status: 'resolved',
          decision: dto.decision,
          decisionReason: dto.reason,
          refundAmount: amount.gt(0) ? amount : null,
          resolvedById: actor,
          resolvedAt: now,
        },
      });
      let refund: Awaited<ReturnType<typeof tx.refund.create>> | undefined;
      if (amount.gt(0)) {
        const reference = `aku_refund_${randomUUID()}`;
        refund = await tx.refund.create({
          data: {
            paymentId: payment.id,
            disputeId: id,
            amount,
            reason: dto.reason,
            idempotencyKey: reference,
            providerReference: reference,
          },
        });
      } else {
        await tx.settlementHold.updateMany({
          where: {
            orderId: dispute.orderId,
            releasedAt: null,
            reason: 'Open delivery dispute',
          },
          data: { releasedAt: now, releasedById: actor },
        });
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { status: 'confirmed', version: { increment: 1 } },
        });
      }
      await this.db.audit(tx, actor, 'dispute_decided', 'dispute', id, {
        ...dto,
      });
      return { dispute: updated, refund };
    });
    if (result.refund?.status === 'pending')
      await this.sendRefund(result.refund.id);
    return {
      data: await this.db.prisma.dispute.findUnique({
        where: { id },
        include: { refunds: true },
      }),
    };
  }
  async sendRefund(id: string) {
    const refund = await this.db.prisma.refund.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!refund) throw new NotFoundException();
    if (refund.status !== 'pending') return { data: refund };
    const data = await this.paystack.call<{
      reference: string;
      status: string;
    }>('POST', '/refund', {
      transaction: refund.payment.providerReference,
      amount: minorUnits(refund.amount),
      currency: refund.payment.currency,
      reference: refund.providerReference,
      merchant_note: refund.reason,
    });
    if (data.reference !== refund.providerReference)
      throw new ConflictException('Refund reference mismatch.');
    await this.db.prisma.refund.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'processing' },
    });
    if (data.status === 'processed')
      await this.reconcile(refund.providerReference!);
    return { data: await this.db.prisma.refund.findUnique({ where: { id } }) };
  }
  async campaignRefund(actor: string, campaignId: string) {
    const refund = await this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId}::uuid FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) throw new NotFoundException();
      if (campaign.ownerId === actor)
        throw new ForbiddenException('You cannot refund your own campaign.');
      if (campaign.status !== 'rejected' || campaign.startsAt)
        throw new ConflictException(
          'Only rejected campaigns that never ran qualify for this full refund.',
        );
      const payment = await tx.payment.findFirst({
        where: { campaignId, status: 'succeeded' },
      });
      if (!payment) throw new ConflictException('No verified payment.');
      const existing = await tx.refund.findFirst({
        where: { paymentId: payment.id },
      });
      if (existing) return existing;
      const reference = `aku_refund_${randomUUID()}`;
      return tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: 'Campaign rejected before publication',
          idempotencyKey: reference,
          providerReference: reference,
        },
      });
    });
    return this.sendRefund(refund.id);
  }
  async reconcile(reference: string) {
    const refund = await this.db.prisma.refund.findFirst({
      where: { providerReference: reference },
      include: { payment: true },
    });
    if (!refund) throw new NotFoundException();
    const results = await this.paystack.call<
      {
        reference: string;
        amount: number;
        currency: string;
        status: string;
        transaction: number | { id: number; reference: string };
      }[]
    >('GET', `/refund?reference=${encodeURIComponent(reference)}&perPage=100`);
    const data = results.find((r) => r.reference === reference);
    const transaction = await this.paystack.call<{
      id: number;
      reference: string;
      amount: number;
      currency: string;
    }>(
      'GET',
      `/transaction/verify/${encodeURIComponent(refund.payment.providerReference!)}`,
    );
    const sourceMatches =
      typeof data?.transaction === 'number'
        ? data.transaction === transaction.id
        : data?.transaction?.reference === transaction.reference;
    if (
      !data ||
      data.amount !== minorUnits(refund.amount) ||
      data.currency !== refund.payment.currency ||
      transaction.reference !== refund.payment.providerReference ||
      transaction.amount !== minorUnits(refund.payment.amount) ||
      transaction.currency !== refund.payment.currency ||
      !sourceMatches
    )
      throw new ConflictException('Refund details mismatch.');
    if (data.status === 'failed') {
      await this.db.prisma.refund.updateMany({
        where: { id: refund.id, status: { not: 'completed' } },
        data: {
          status: 'failed',
          failureReason: 'Paystack refund failed; finance review required.',
        },
      });
      return;
    }
    if (data.status !== 'processed') return;
    if (refund.payment.campaignId) {
      await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${refund.payment.campaignId}::uuid FOR UPDATE`;
        await tx.refund.updateMany({
          where: { id: refund.id, status: { not: 'completed' } },
          data: { status: 'completed', completedAt: await this.db.now(tx) },
        });
      });
      return;
    }
    await this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${refund.payment.orderId}::uuid FOR UPDATE`;
      const row = await tx.refund.findUniqueOrThrow({
        where: { id: refund.id },
      });
      if (row.status === 'completed') return;
      await tx.refund.update({
        where: { id: row.id },
        data: { status: 'completed', completedAt: await this.db.now(tx) },
      });
      const total = await tx.refund.aggregate({
        where: { paymentId: refund.paymentId, status: 'completed' },
        _sum: { amount: true },
      });
      const full = total._sum.amount!.gte(refund.payment.amount);
      await tx.order.update({
        where: { id: refund.payment.orderId! },
        data: {
          status: full ? 'refunded' : 'confirmed',
          paymentStatus: full ? 'refunded' : 'partially_refunded',
          version: { increment: 1 },
        },
      });
      const decision = refund.disputeId
        ? await tx.dispute.findUnique({ where: { id: refund.disputeId } })
        : null;
      if (decision?.resolvedById)
        await tx.settlementHold.updateMany({
          where: {
            orderId: refund.payment.orderId!,
            releasedAt: null,
            reason: 'Open delivery dispute',
          },
          data: {
            releasedAt: await this.db.now(tx),
            releasedById: decision.resolvedById,
          },
        });
      await tx.orderEvent.create({
        data: {
          orderId: refund.payment.orderId!,
          actorLabel: 'paystack',
          action: full ? 'refund_verified' : 'partial_refund_verified',
          status: full ? 'refunded' : 'confirmed',
        },
      });
    });
  }
}
