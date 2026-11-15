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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  Authenticated,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import { PageQuery } from '../../common/platform/query.dto';
import { SupportService } from './support.service';
import { EnquiryDto, TicketDto, UpdateTicketDto } from './dto/support.dto';
@ApiTags('Support')
@Controller({ version: '1' })
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Post('support/tickets')
  @UseGuards(OptionalAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  ticket(@Body() dto: TicketDto, @Req() r: AuthRequest) {
    return this.service.ticket(dto, r.user?.id);
  }
  @Post('enquiries')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  enquiry(@Body() dto: EnquiryDto) {
    return this.service.enquiry(dto);
  }
  @Get('users/me/support/tickets') @Authenticated() own(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.tickets(q, r.user.id);
  }
  @Get('admin/support/tickets') @Staff('support', 'operations') all(
    @Query() q: PageQuery,
  ) {
    return this.service.tickets(q);
  }
  @Patch('admin/support/tickets/:id') @Staff('support', 'operations') update(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.service.update(r.user.id, id, dto);
  }
  @Get('admin/enquiries') @Staff('support', 'operations') enquiries(
    @Query() q: PageQuery,
  ) {
    return this.service.enquiries(q);
  }
}
