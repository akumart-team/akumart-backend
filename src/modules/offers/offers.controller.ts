import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { TradeListQuery } from '../../common/platform/query.dto';
import { OffersService } from './offers.service';
import { OfferTermsDto } from './dto/offer.dto';
@ApiTags('Offers')
@Authenticated()
@Controller({ version: '1' })
export class OffersController {
  constructor(private readonly service: OffersService) {}
  @Post('listings/:id/offers') create(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferTermsDto,
  ) {
    return this.service.create(r.user.id, id, dto);
  }
  @Get('users/me/offers') own(
    @Req() r: AuthRequest,
    @Query() q: TradeListQuery,
  ) {
    return this.service.own(r.user.id, q);
  }
  @Get('offers/:id') detail(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(r.user.id, id);
  }
  @Post('offers/:id/counteroffers') counter(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferTermsDto,
  ) {
    return this.service.respond(r.user.id, id, 'counter', dto);
  }
  @Post('offers/:id/accept') @HttpCode(200) accept(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.respond(r.user.id, id, 'accept');
  }
  @Post('offers/:id/reject') @HttpCode(200) reject(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.respond(r.user.id, id, 'reject');
  }
}
