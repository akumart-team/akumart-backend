import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Authenticated,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { PartnersService } from './partners.service';
import {
  PartnerApplicationDto,
  PartnerDecisionDto,
  QuoteDto,
  DeclineJobDto,
  DeliveryEventDto,
  DeliveryProofDto,
} from './dto/partner.dto';
@ApiTags('Logistics partners')
@Controller({ version: '1' })
export class PartnersController {
  constructor(private readonly service: PartnersService) {}
  @Post('partners/applications') @Authenticated() apply(
    @Req() r: AuthRequest,
    @Body() d: PartnerApplicationDto,
  ) {
    return this.service.apply(r.user.id, d);
  }
  @Get('partners/me') @Authenticated() me(@Req() r: AuthRequest) {
    return this.service.me(r.user.id);
  }
  @Get('partners/me/jobs') @Authenticated() jobs(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.jobs(r.user.id, q);
  }
  @Get('partners/me/deliveries') @Authenticated() deliveries(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.jobs(r.user.id, q, true);
  }
  @Post('partners/me/jobs/:id/quotes') @Authenticated() quote(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: QuoteDto,
  ) {
    return this.service.quote(r.user.id, id, d);
  }
  @Post('partners/me/jobs/:id/decline') @Authenticated() decline(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DeclineJobDto,
  ) {
    return this.service.decline(r.user.id, id, d.reason);
  }
  @Post('partners/me/deliveries/:id/events') @Authenticated() progress(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DeliveryEventDto,
  ) {
    return this.service.progress(r.user.id, id, d);
  }
  @Post('partners/me/deliveries/:id/proof') @Authenticated() proof(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DeliveryProofDto,
  ) {
    return this.service.progress(r.user.id, id, d);
  }
  @Get('admin/partners') @Staff('operations') queue(@Query() q: PageQuery) {
    return this.service.queue(q);
  }
  @Patch('admin/partners/:id') @Staff('operations') decide(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PartnerDecisionDto,
  ) {
    return this.service.decision(r.user.id, id, d);
  }
}
