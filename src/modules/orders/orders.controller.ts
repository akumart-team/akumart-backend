import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { TradeListQuery } from '../../common/platform/query.dto';
import { OrdersService } from './orders.service';
import {
  FulfilmentDto,
  SelectQuoteDto,
  ReviewDto,
  DisputeDto,
} from './dto/order.dto';
@ApiTags('Orders')
@Controller({ path: 'orders', version: '1' })
@Authenticated()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Get() list(@Req() r: AuthRequest, @Query() q: TradeListQuery) {
    return this.service.own(r.user.id, q);
  }
  @Get(':id') detail(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(r.user.id, id);
  }
  @Get(':id/logistics/estimate') estimate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.estimate(r.user.id, id);
  }
  @Post(':id/fulfilment') fulfilment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfilmentDto,
  ) {
    return this.service.fulfilment(r.user.id, id, dto);
  }
  @Get(':id/quotes') quotes(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.quotes(r.user.id, id);
  }
  @Post(':id/quotes/extend') extend(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.extend(r.user.id, id);
  }
  @Post(':id/quotes/select') select(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectQuoteDto,
  ) {
    return this.service.select(r.user.id, id, dto.quoteId);
  }
  @Post(':id/cancel') cancel(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(r.user.id, id);
  }
  @Post(':id/confirm-receipt') confirm(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirm(r.user.id, id);
  }
  @Post(':id/review') review(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.service.review(r.user.id, id, dto);
  }
  @Post(':id/disputes') dispute(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeDto,
  ) {
    return this.service.dispute(r.user.id, id, dto);
  }
}
