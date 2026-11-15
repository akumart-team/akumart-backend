import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  Authenticated,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { DisputesService } from './disputes.service';
import { PaymentWebhooksService } from './webhooks.service';
import { RecipientDto, DisputeDecisionDto } from './dto/payment.dto';
@ApiTags('Payments and finance')
@Controller({ version: '1' })
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly disputes: DisputesService,
    private readonly paystack: PaystackService,
    private readonly webhooks: PaymentWebhooksService,
  ) {}
  @Post('orders/:id/checkout') @Authenticated() checkout(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.checkout(r.user.id, id);
  }
  @Post('advertising/campaigns/:id/checkout') @Authenticated() adCheckout(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.checkout(r.user.id, id, true);
  }
  @Get('payments/:id') @Authenticated() payment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.own(r.user.id, id);
  }
  @Post('payments/:id/verify') @Authenticated() verify(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.own(r.user.id, id, true);
  }
  @Get('payments/banks/nigeria') @Authenticated() banks() {
    return this.payouts.banks();
  }
  @Get('users/me/payout-recipient') @Authenticated() recipient(
    @Req() r: AuthRequest,
  ) {
    return this.payouts.recipient(r.user.id);
  }
  @Post('users/me/payout-recipient') @Authenticated() setup(
    @Req() r: AuthRequest,
    @Body() d: RecipientDto,
  ) {
    return this.payouts.setup(r.user.id, d);
  }
  @Post('admin/orders/:id/release') @Staff('finance') release(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payouts.release(r.user.id, id);
  }
  @Get('admin/disputes') @Staff('support', 'finance') disputesList(
    @Query() q: PageQuery,
  ) {
    return this.disputes.queue(q);
  }
  @Post('admin/disputes/:id/decision') @Staff('finance') decision(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DisputeDecisionDto,
  ) {
    return this.disputes.decide(r.user.id, id, d);
  }
  @Post('admin/refunds/:id/retry') @Staff('finance') retry(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.disputes.sendRefund(id);
  }
  @Post('admin/advertising/campaigns/:id/refund')
  @Staff('finance')
  campaignRefund(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.disputes.campaignRefund(r.user.id, id);
  }
  @Post('admin/transfers/:reference/reconcile') @Staff('finance') transfer(
    @Param('reference') reference: string,
  ) {
    return this.payouts.reconcile(reference);
  }
  @Post('admin/refunds/:reference/reconcile') @Staff('finance') refund(
    @Param('reference') reference: string,
  ) {
    return this.disputes.reconcile(reference);
  }
  @Post('webhooks/paystack') @HttpCode(200) webhook(
    @Req() r: RawBodyRequest<Request>,
    @Headers('paystack-signature') modern?: string,
    @Headers('x-paystack-signature') legacy?: string,
  ) {
    this.paystack.verifySignature(r.rawBody, modern, legacy);
    return this.webhooks.receive(r.rawBody!);
  }
}
