import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../../common/guard/supabase-auth.guard';
import type { AkubinRequest } from '../akubin.types';
import { AkubinPinService } from '../services/akubin-pin.service';
import { AkubinReadService } from '../services/akubin-read.service';
import { AkubinRewardsService } from '../services/akubin-rewards.service';
import { RedeemRewardDto, SetBinPinDto } from '../dto/account.dto';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('AkuBin Account')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, ThrottlerGuard)
@Controller({ path: 'akubin', version: '1' })
export class AkubinAccountController {
  constructor(
    private readonly pins: AkubinPinService,
    private readonly read: AkubinReadService,
    private readonly rewards: AkubinRewardsService,
  ) {}

  @Get('me/pin')
  @ApiOperation({ summary: 'PIN configuration status; never returns PIN/hash' })
  pinStatus(@Req() req: AkubinRequest) {
    return this.pins.status(req.user.id);
  }

  @Put('me/pin')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Set/change unique permanent PIN; existing PIN requires currentPin',
  })
  pin(@Req() req: AkubinRequest, @Body() dto: SetBinPinDto) {
    return this.pins.set(req.user.id, dto);
  }

  @Get('me/summary')
  @ApiOperation({ summary: 'Personal recycling totals and available points' })
  summary(@Req() req: AkubinRequest) {
    return this.read.summary(req.user.id);
  }
  @Get('me/wallet')
  @ApiOperation({ summary: 'Available points, not a money balance' })
  wallet(@Req() req: AkubinRequest) {
    return this.read.wallet(req.user.id);
  }
  @Get('me/points-ledger')
  @ApiOperation({ summary: 'Own points credit/debit history' })
  ledger(@Req() req: AkubinRequest, @Query() query: PaginationDto) {
    return this.read.ledger(req.user.id, query);
  }
  @Get('me/deposits')
  @ApiOperation({ summary: 'Own deposit history' })
  deposits(@Req() req: AkubinRequest, @Query() query: PaginationDto) {
    return this.read.deposits(req.user.id, query);
  }
  @Get('me/sessions')
  @ApiOperation({ summary: 'Own bin session history' })
  sessions(@Req() req: AkubinRequest, @Query() query: PaginationDto) {
    return this.read.sessions(req.user.id, query);
  }
  @Get('me/sessions/:id')
  @ApiOperation({ summary: 'Own session details' })
  session(@Req() req: AkubinRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.read.session(req.user.id, id);
  }
  @Post('me/sessions/:id/end')
  @HttpCode(200)
  @ApiOperation({
    summary: 'End own session from the app; firmware changes are not required',
  })
  end(@Req() req: AkubinRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.read.end(req.user.id, id);
  }
  @Get('me/redemptions')
  @ApiOperation({ summary: 'Own reward redemption history' })
  history(@Req() req: AkubinRequest, @Query() query: PaginationDto) {
    return this.rewards.history(req.user.id, query);
  }
  @Post('redemptions')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Reserve points/stock and submit reward for review; no simulated fulfilment',
  })
  redeem(@Req() req: AkubinRequest, @Body() dto: RedeemRewardDto) {
    return this.rewards.redeem(req.user.id, dto);
  }
}
