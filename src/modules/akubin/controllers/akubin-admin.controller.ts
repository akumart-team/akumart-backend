import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../../common/guard/supabase-auth.guard';
import type { AkubinRequest } from '../akubin.types';
import { AkubinRoles, AkubinStaffGuard } from '../guards/akubin-staff.guard';
import { AkubinAdminService } from '../services/akubin-admin.service';
import { AkubinReadService } from '../services/akubin-read.service';
import { AkubinRewardsService } from '../services/akubin-rewards.service';
import {
  BinQueryDto,
  CollectionDto,
  CreateBinDto,
  MaintenanceDto,
  UpdateBinDto,
} from '../dto/bin.dto';
import {
  CreateRewardDto,
  FulfillRedemptionDto,
  RedemptionDecisionDto,
  RegisterBinDeviceDto,
  UpdateRewardRulesDto,
} from '../dto/admin.dto';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('AkuBin Administration')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, AkubinStaffGuard, ThrottlerGuard)
@AkubinRoles('super', 'operations')
@Controller({ path: 'admin/akubin', version: '1' })
export class AkubinAdminController {
  constructor(
    private readonly admin: AkubinAdminService,
    private readonly read: AkubinReadService,
    private readonly rewards: AkubinRewardsService,
  ) {}

  @Get('bins')
  @ApiOperation({ summary: 'List operational bins' })
  bins(@Query() query: BinQueryDto) {
    return this.read.bins(query);
  }
  @Post('bins')
  @ApiOperation({
    summary:
      'Register a physical bin; does not provision hardware automatically',
  })
  create(@Req() req: AkubinRequest, @Body() dto: CreateBinDto) {
    return this.admin.createBin(req.user.id, dto);
  }
  @Patch('bins/:id')
  @ApiOperation({
    summary: 'Edit bin details, availability or collector schedule',
  })
  update(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBinDto,
  ) {
    return this.admin.updateBin(req.user.id, id, dto);
  }
  @Get('bins/:id/devices')
  @ApiOperation({
    summary: 'Controller history; credential hashes are never returned',
  })
  devices(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.devices(id);
  }
  @Post('bins/:id/devices')
  @ApiOperation({
    summary: 'Register controller; authenticated device key is returned once',
  })
  register(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterBinDeviceDto,
  ) {
    return this.admin.registerDevice(req.user.id, id, dto);
  }
  @Delete('devices/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoke controller and close its sessions; history is retained',
  })
  revoke(@Req() req: AkubinRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeDevice(req.user.id, id);
  }
  @Get('bins/:id/events')
  @ApiOperation({ summary: 'Bin operational event history' })
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.admin.history(id, 'events', query);
  }
  @Get('bins/:id/telemetry')
  @ApiOperation({
    summary: 'Sensor reports with device uptime and server receipt time',
  })
  telemetry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.admin.history(id, 'telemetry', query);
  }
  @Post('bins/:id/collections')
  @ApiOperation({ summary: 'Record collection and reset recorded capacity' })
  collect(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectionDto,
  ) {
    return this.admin.collect(req.user.id, id, dto);
  }
  @Get('bins/:id/maintenance-tickets')
  @ApiOperation({ summary: 'Maintenance history' })
  tickets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.admin.history(id, 'maintenance', query);
  }
  @Post('bins/:id/maintenance-tickets')
  @ApiOperation({ summary: 'Open issue and place bin in maintenance' })
  maintenance(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceDto,
  ) {
    return this.admin.maintenance(req.user.id, id, dto);
  }
  @Post('bins/:id/maintenance-tickets/:ticketId/resolve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve issue; staff must explicitly restore availability',
  })
  resolve(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.admin.resolveMaintenance(req.user.id, id, ticketId);
  }

  @Patch('reward-rules')
  @AkubinRoles('super', 'finance')
  @ApiOperation({
    summary:
      'Configure points-per-gram rates and redemption thresholds; no firmware reflash',
  })
  rules(@Req() req: AkubinRequest, @Body() dto: UpdateRewardRulesDto) {
    return this.admin.rules(req.user.id, dto);
  }
  @Post('rewards')
  @AkubinRoles('super', 'finance')
  @ApiOperation({ summary: 'Create a manually reviewed reward' })
  reward(@Req() req: AkubinRequest, @Body() dto: CreateRewardDto) {
    return this.admin.createReward(req.user.id, dto);
  }
  @Delete('rewards/:id')
  @HttpCode(200)
  @AkubinRoles('super', 'finance')
  @ApiOperation({
    summary: 'Archive reward without deleting redemption history',
  })
  archive(@Req() req: AkubinRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.archiveReward(req.user.id, id);
  }
  @Get('redemptions')
  @AkubinRoles('super', 'finance')
  @ApiOperation({ summary: 'Review reward requests' })
  redemptions(@Query() query: PaginationDto) {
    return this.admin.redemptions(query);
  }
  @Post('redemptions/:id/decision')
  @HttpCode(200)
  @AkubinRoles('super', 'finance')
  @ApiOperation({
    summary: 'Approve for fulfilment or reject and return points/stock once',
  })
  decision(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RedemptionDecisionDto,
  ) {
    return this.rewards.decisions(req.user.id, id, dto);
  }

  @Post('redemptions/:id/fulfillment')
  @HttpCode(200)
  @AkubinRoles('super', 'finance')
  @ApiOperation({
    summary:
      'Record staff-verified fulfilment receipt; does not send cash/airtime',
  })
  fulfill(
    @Req() req: AkubinRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfillRedemptionDto,
  ) {
    return this.rewards.fulfill(req.user.id, id, dto);
  }
}
