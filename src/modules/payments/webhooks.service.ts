import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../common/platform/database.service';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { DisputesService } from './disputes.service';
@Injectable()
export class PaymentWebhooksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly disputes: DisputesService,
    private readonly paystack: PaystackService,
  ) {}
  async receive(body: Buffer) {
    let payload: {
      event: string;
      data: { reference?: string; id?: number; status?: string };
    };
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON.');
    }
    if (!payload || typeof payload.event !== 'string' || !payload.data)
      throw new BadRequestException('Invalid event.');
    const externalId = createHash('sha256').update(body).digest('hex');
    const row = await this.db.prisma.webhookEvent.upsert({
      where: { provider_externalId: { provider: 'paystack', externalId } },
      create: {
        provider: 'paystack',
        externalId,
        type: payload.event,
        payload: {
          event: payload.event,
          data: {
            reference: payload.data.reference ?? '',
            id: String(payload.data.id ?? ''),
            status: payload.data.status ?? '',
          },
        },
      },
      update: {},
    });
    if (row.status === 'processed') return { received: true };
    await this.db.prisma.webhookEvent.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    try {
      let ref = payload.data.reference;
      if (
        payload.event.startsWith('refund.') &&
        !ref &&
        Number.isSafeInteger(payload.data.id)
      ) {
        const canonical = await this.paystack.call<{ reference?: string }>(
          'GET',
          `/refund/${payload.data.id}`,
        );
        ref = canonical.reference;
      }
      if (
        (payload.event === 'charge.success' ||
          payload.event.startsWith('transfer.') ||
          payload.event.startsWith('refund.')) &&
        !ref
      )
        throw new BadRequestException(
          'Financial event is missing its reference.',
        );
      if (payload.event === 'charge.success' && ref)
        await this.payments.verify(ref);
      else if (payload.event.startsWith('transfer.') && ref)
        await this.payouts.reconcile(ref);
      else if (payload.event.startsWith('refund.') && ref)
        await this.disputes.reconcile(ref);
      await this.db.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { status: 'processed', processedAt: new Date(), lastError: null },
      });
      return { received: true };
    } catch (e) {
      if (e instanceof NotFoundException) {
        // Other products may share this merchant account. Unknown references cannot mutate AkuMart data.
        await this.db.prisma.webhookEvent.update({
          where: { id: row.id },
          data: {
            status: 'processed',
            processedAt: new Date(),
            lastError:
              'Reference belongs to another application or requires reconciliation.',
          },
        });
        return { received: true };
      }
      await this.db.prisma.webhookEvent.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          lastError: 'Provider reconciliation failed; retry required.',
        },
      });
      throw e;
    }
  }
}
