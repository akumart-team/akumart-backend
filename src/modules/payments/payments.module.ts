import { Module } from '@nestjs/common';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { DisputesService } from './disputes.service';
import { PaymentWebhooksService } from './webhooks.service';
import { PaymentsController } from './payments.controller';
@Module({
  providers: [
    PaystackService,
    PaymentsService,
    PayoutsService,
    DisputesService,
    PaymentWebhooksService,
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
