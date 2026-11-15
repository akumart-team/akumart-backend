import {
  ConflictException,
  ForbiddenException,
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
import { RecipientDto } from './dto/payment.dto';
@Injectable()
export class PayoutsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
    private readonly paystack: PaystackService,
  ) {}
  async banks() {
    return {
      data: await this.paystack.call<unknown[]>(
        'GET',
        '/bank?country=nigeria&currency=NGN&perPage=100',
      ),
    };
  }
  async recipient(user: string) {
    return {
      data: await this.db.prisma.payoutRecipient.findUnique({
        where: { profileId: user },
        select: {
          accountName: true,
          accountLast4: true,
          bankCode: true,
          updatedAt: true,
        },
      }),
    };
  }
  async setup(user: string, dto: RecipientDto) {
    const partner = await this.db.prisma.partner.findFirst({
      where: { ownerId: user, status: 'approved' },
    });
    if (!partner) await this.policy.require(user, 'full');
    const account = await this.paystack.call<{
      account_name: string;
      account_number: string;
    }>(
      'GET',
      `/bank/resolve?account_number=${encodeURIComponent(dto.accountNumber)}&bank_code=${encodeURIComponent(dto.bankCode)}`,
    );
    if (account.account_number !== dto.accountNumber || !account.account_name)
      throw new ConflictException('Bank account could not be verified.');
    const result = await this.paystack.call<{ recipient_code: string }>(
      'POST',
      '/transferrecipient',
      {
        type: 'nuban',
        name: account.account_name,
        account_number: dto.accountNumber,
        bank_code: dto.bankCode,
        currency: 'NGN',
      },
    );
    if (!result.recipient_code?.startsWith('RCP_'))
      throw new ConflictException('Invalid recipient response.');
    await this.db.transaction(async (tx) => {
      const data = {
        accountName: account.account_name,
        accountLast4: dto.accountNumber.slice(-4),
        bankCode: dto.bankCode,
        recipientCode: result.recipient_code,
      };
      await tx.payoutRecipient.upsert({
        where: { profileId: user },
        create: { profileId: user, ...data },
        update: data,
      });
      await this.db.audit(
        tx,
        user,
        'payout_recipient_updated',
        'profile',
        user,
        { accountLast4: data.accountLast4, bankCode: data.bankCode },
      );
    });
    return this.recipient(user);
  }
  async release(actor: string, orderId: string) {
    this.paystack.requireTransfers();
    const settlement = await this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          assignment: { include: { partner: true } },
          settlement: { include: { transfers: true } },
        },
      });
      if (!order) throw new NotFoundException();
      if (
        [
          order.buyerId,
          order.sellerId,
          order.assignment?.partner.ownerId,
        ].includes(actor)
      )
        throw new ForbiddenException(
          'You cannot release a transaction involving your own account.',
        );
      if (
        await tx.settlementHold.count({ where: { orderId, releasedAt: null } })
      )
        throw new ConflictException('Resolve settlement holds before release.');
      if (order.settlement) return order.settlement;
      if (
        order.status !== 'confirmed' ||
        !['held', 'partially_refunded'].includes(order.paymentStatus) ||
        !order.assignment ||
        (await tx.refund.count({
          where: {
            payment: { orderId },
            status: { in: ['pending', 'processing'] },
          },
        }))
      )
        throw new ConflictException(
          'Confirmed delivery without pending refunds is required for release.',
        );
      await this.policy.require(order.sellerId, 'full', tx);
      const recipients = await tx.payoutRecipient.findMany({
        where: {
          profileId: { in: [order.sellerId, order.assignment.partner.ownerId] },
        },
      });
      if (recipients.length !== 2)
        throw new ConflictException(
          'Seller and logistics partner must configure payout accounts.',
        );
      const refunded = await tx.refund.aggregate({
        where: { payment: { orderId }, status: 'completed' },
        _sum: { amount: true },
      });
      const sellerGross = order.quantity
        .mul(order.unitPrice)
        .toDecimalPlaces(2)
        .sub(refunded._sum.amount ?? 0);
      const partnerGross = order.assignment.agreedFare;
      if (sellerGross.lte(0))
        throw new ConflictException(
          'Refund allocation requires finance reconciliation.',
        );
      const sellerFee = sellerGross
        .mul(order.sellerFeePct)
        .div(100)
        .toDecimalPlaces(2);
      const partnerFee = partnerGross
        .mul(order.partnerFeePct)
        .div(100)
        .toDecimalPlaces(2);
      const sellerPayout = sellerGross.sub(sellerFee);
      const partnerPayout = partnerGross.sub(partnerFee);
      const transfers = (
        [
          ['seller', order.sellerId, sellerPayout],
          ['partner', order.assignment.partner.ownerId, partnerPayout],
        ] as const
      )
        .filter(([, , amount]) => amount.gt(0))
        .map(([beneficiary, profileId, amount]) => {
          const reference = `aku_transfer_${randomUUID()}`;
          return {
            beneficiary,
            amount,
            provider: 'paystack',
            recipientReference: recipients.find(
              (r) => r.profileId === profileId,
            )!.recipientCode,
            providerReference: reference,
            idempotencyKey: reference,
          };
        });
      const result = await tx.settlement.create({
        data: {
          orderId,
          currency: order.currency,
          sellerGross,
          partnerGross,
          sellerFee,
          partnerFee,
          sellerPayout,
          partnerPayout,
          transfers: { create: transfers },
        },
        include: { transfers: true },
      });
      await this.db.audit(
        tx,
        actor,
        'settlement_release_requested',
        'order',
        orderId,
      );
      return result;
    });
    if (settlement.status === 'completed') return { data: settlement };
    for (const transfer of settlement.transfers) {
      if (transfer.status !== 'pending') continue;
      const data = await this.paystack.call<{
        reference: string;
        status: string;
        amount: number;
        currency: string;
        recipient: { recipient_code: string } | string;
      }>('POST', '/transfer', {
        source: 'balance',
        amount: minorUnits(transfer.amount),
        currency: settlement.currency,
        recipient: transfer.recipientReference,
        reference: transfer.providerReference,
        reason: `AkuMart order ${orderId}`,
      });
      // Re-query the canonical transfer before marking money as received.
      await this.db.prisma.settlementTransfer.updateMany({
        where: { id: transfer.id, status: 'pending' },
        data: { status: 'processing' },
      });
      if (data.status === 'success')
        await this.reconcile(transfer.providerReference!);
    }
    await this.complete(settlement.id);
    return {
      data: await this.db.prisma.settlement.findUnique({
        where: { id: settlement.id },
        include: { transfers: true },
      }),
    };
  }
  async reconcile(reference: string) {
    const transfer = await this.db.prisma.settlementTransfer.findUnique({
      where: {
        provider_providerReference: {
          provider: 'paystack',
          providerReference: reference,
        },
      },
      include: { settlement: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    const data = await this.paystack.call<{
      reference: string;
      status: string;
      amount: number;
      currency: string;
      recipient: { recipient_code: string };
    }>('GET', `/transfer/verify/${encodeURIComponent(reference)}`);
    if (
      data.reference !== reference ||
      data.amount !== minorUnits(transfer.amount) ||
      data.currency !== transfer.settlement.currency ||
      data.recipient?.recipient_code !== transfer.recipientReference
    )
      throw new ConflictException('Transfer details mismatch.');
    if (data.status === 'success')
      await this.db.prisma.settlementTransfer.updateMany({
        where: { id: transfer.id, status: { not: 'completed' } },
        data: {
          status: 'completed',
          completedAt: new Date(),
          failureReason: null,
        },
      });
    else if (['failed', 'reversed'].includes(data.status)) {
      // A reversal requires finance review; preserve history rather than initiating another payout.
      await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${transfer.settlement.orderId}::uuid FOR UPDATE`;
        await tx.settlementTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'failed',
            failureReason: `Paystack transfer ${data.status}`,
          },
        });
        await tx.settlement.update({
          where: { id: transfer.settlementId },
          data: { status: 'failed' },
        });
        const reason = `Provider transfer ${data.status}; finance reconciliation required.`;
        const release = await tx.auditLog.findFirst({
          where: {
            action: 'settlement_release_requested',
            resourceType: 'order',
            resourceId: transfer.settlement.orderId,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (
          release?.actorId &&
          !(await tx.settlementHold.count({
            where: {
              orderId: transfer.settlement.orderId,
              reason,
              releasedAt: null,
            },
          }))
        )
          await tx.settlementHold.create({
            data: {
              orderId: transfer.settlement.orderId,
              placedById: release.actorId,
              reason,
            },
          });
        await tx.auditLog.create({
          data: {
            actorLabel: 'paystack',
            action: 'transfer_reconciliation_required',
            resourceType: 'settlement_transfer',
            resourceId: transfer.id,
            detail: { status: data.status },
          },
        });
        await tx.order.update({
          where: { id: transfer.settlement.orderId },
          data: { status: 'disputed', version: { increment: 1 } },
        });
      });
    }
    await this.complete(transfer.settlementId);
  }
  private async complete(id: string) {
    await this.db.transaction(async (tx) => {
      const s = await tx.settlement.findUniqueOrThrow({
        where: { id },
        include: { transfers: true },
      });
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${s.orderId}::uuid FOR UPDATE`;
      if (
        s.status === 'completed' ||
        s.transfers.some((t) => t.status !== 'completed')
      )
        return;
      await tx.settlement.update({
        where: { id },
        data: { status: 'completed' },
      });
      await tx.order.update({
        where: { id: s.orderId },
        data: {
          status: 'settled',
          paymentStatus: 'released',
          version: { increment: 1 },
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: s.orderId,
          actorLabel: 'paystack',
          action: 'payouts_verified',
          status: 'settled',
        },
      });
    });
  }
}
