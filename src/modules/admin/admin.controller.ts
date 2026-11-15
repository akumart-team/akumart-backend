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
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authenticated, Staff, type AuthRequest } from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { HoldDto } from '../payments/dto/payment.dto';
import { SettingsDto } from './dto/settings.dto';
import { AdminService } from './admin.service';
import { StaffService } from './staff.service';
import { AssignStaffDto } from './dto/staff.dto';
@ApiTags('Administration')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly service: AdminService, private readonly staff: StaffService) {}

  @Post('staff/bootstrap')
  @Authenticated()
  @ApiOperation({ summary: 'Create the first super staff membership; requires the server-configured verified profile and no previous super' })
  bootstrapStaff(@Req() r: AuthRequest) {
    return this.staff.bootstrap(r.user);
  }

  @Get('staff')
  @Staff('super')
  @ApiOperation({ summary: 'List and search staff memberships, including inactive access' })
  staffMembers(@Query() q: PageQuery) {
    return this.staff.members(q);
  }

  @Put('staff/:profileId')
  @Staff('super')
  @ApiOperation({ summary: 'Assign, change or deactivate a staff role; audited and protects the last active super' })
  assignStaff(@Req() r: AuthRequest, @Param('profileId', ParseUUIDPipe) profileId: string, @Body() dto: AssignStaffDto) {
    return this.staff.assign(r.user.id, profileId, dto);
  }
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
