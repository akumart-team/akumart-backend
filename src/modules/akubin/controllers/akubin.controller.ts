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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../../common/guard/supabase-auth.guard';
import { AkubinReadService } from '../services/akubin-read.service';
import { AkubinHardwareService } from '../services/akubin-hardware.service';
import { AkubinRewardsService } from '../services/akubin-rewards.service';
import { BinQueryDto } from '../dto/bin.dto';
import { LeaderboardQueryDto } from '../dto/account.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { RecordDepositDto, StartBinSessionDto } from '../dto/hardware.dto';

@ApiTags('AkuBin')
@Controller({ path: 'akubin', version: '1' })
export class AkubinController {
  constructor(
    private readonly read: AkubinReadService,
    private readonly hardware: AkubinHardwareService,
    private readonly rewards: AkubinRewardsService,
  ) {}

  @Get(['bins', 'locations'])
  @ApiOperation({
    summary: 'Browse public bins; locations is a compatible alias',
  })
  bins(@Query() query: BinQueryDto) {
    return this.read.bins(query);
  }

  @Get(['bins/:code', 'locations/:code'])
  @ApiOperation({
    summary: 'Public bin details by printed code, e.g. AKUBIN-001',
  })
  bin(@Param('code') code: string) {
    return this.read.bin(code.toUpperCase());
  }

  @Get('reward-rules')
  @ApiOperation({
    summary: 'Configured points rates and redemption thresholds',
  })
  rules() {
    return this.read.rules();
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Available reward catalogue' })
  catalogue(@Query() query: PaginationDto) {
    return this.rewards.catalogue(query);
  }

  @Get('leaderboard')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verified recycling leaderboard; week/month boundaries are UTC',
  })
  leaderboard(@Query() query: LeaderboardQueryDto) {
    return this.read.leaderboard(query);
  }

  @Post('sessions/phone-pin')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiHeader({
    name: 'x-akubin-device-key',
    required: false,
    description:
      'Required for authenticated controllers; omitted by explicitly enabled legacy firmware',
  })
  @ApiOperation({
    summary: 'Firmware: identify permanent PIN and start/resume a session',
  })
  start(
    @Body() dto: StartBinSessionDto,
    @Headers('x-akubin-device-key') key?: string,
  ) {
    return this.hardware.start(dto, key);
  }

  @Post('sessions/:id/deposits')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiHeader({ name: 'x-akubin-device-key', required: false })
  @ApiOperation({
    summary: 'Firmware: record deposit and award points exactly once',
  })
  deposit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDepositDto,
    @Headers('x-akubin-device-key') key?: string,
  ) {
    return this.hardware.deposit(id, dto, key);
  }
}
