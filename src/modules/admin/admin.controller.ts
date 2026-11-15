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
import { Staff, type AuthRequest } from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { HoldDto } from '../payments/dto/payment.dto';
import { SettingsDto } from './dto/settings.dto';
import { AdminService } from './admin.service';
@ApiTags('Administration')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('me') @Staff('super', 'operations', 'support', 'finance', 'content') me(
    @Req() r: AuthRequest,
  ) {
    return this.service.me(r.user.id);
  }
  @Get('dashboard') @Staff('operations') dashboard() {
    return this.service.dashboard();
  }
  @Get('users') @Staff('operations', 'support') users(@Query() q: PageQuery) {
    return this.service.users(q);
  }
  @Get('users/:id') @Staff('operations', 'support') user(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.user(id);
  }
  @Get('orders') @Staff('operations', 'support', 'finance') orders(
    @Query() q: PageQuery,
  ) {
    return this.service.orders(q);
  }
  @Get('orders/:id') @Staff('operations', 'support', 'finance') order(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.order(id);
  }
  @Get('finance/payments') @Staff('finance') finance(@Query() q: PageQuery) {
    return this.service.finance(q);
  }
  @Get('audit') @Staff('super') audit(@Query() q: PageQuery) {
    return this.service.audit(q);
  }
  @Get('settings') @Staff('super', 'finance', 'operations') settings() {
    return this.service.settings();
  }
  @Post('settings') @Staff('super') initialize(@Req() r: AuthRequest) {
    return this.service.initializeSettings(r.user.id);
  }
  @Patch('settings') @Staff('super') update(
    @Req() r: AuthRequest,
    @Body() d: SettingsDto,
  ) {
    return this.service.updateSettings(r.user.id, d);
  }
  @Post('orders/:id/holds') @Staff('finance') hold(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: HoldDto,
  ) {
    return this.service.hold(r.user.id, id, d.reason);
  }
  @Post('orders/:id/holds/:holdId/release') @Staff('finance') unhold(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @Body() d: HoldDto,
  ) {
    return this.service.hold(r.user.id, id, d.reason, holdId);
  }
}
