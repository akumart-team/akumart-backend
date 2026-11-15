import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { PageQuery } from '../../common/platform/query.dto';
import { AdvertisingService } from './advertising.service';
import {
  CampaignDto,
  CampaignDecisionDto,
  AdvertisingPackageDto,
  PlacementQuery,
  CampaignTrackingDto,
} from './dto/advertising.dto';
@ApiTags('Advertising')
@Controller({ version: '1' })
export class AdvertisingController {
  constructor(private readonly service: AdvertisingService) {}
  @Get('advertising/packages') packages() {
    return this.service.packages();
  }
  @Post('advertising/campaigns') @Authenticated() create(
    @Req() r: AuthRequest,
    @Body() d: CampaignDto,
  ) {
    return this.service.create(r.user.id, d);
  }
  @Get('advertising/campaigns') @Authenticated() own(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.campaigns(r.user.id, q);
  }
  @Get('advertising/campaigns/:id/stats') @Authenticated() stats(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.stats(r.user.id, id);
  }
  @Get('advertising/placements') @UseGuards(ThrottlerGuard) placements(
    @Query() q: PlacementQuery,
  ) {
    return this.service.placements(q);
  }
  @Post('advertising/events')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  track(@Body() d: CampaignTrackingDto) {
    return this.service.track(d);
  }
  @Get('admin/advertising/campaigns') @Staff('content') queue(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.campaigns(r.user.id, q, true);
  }
  @Patch('admin/advertising/campaigns/:id') @Staff('content') decide(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CampaignDecisionDto,
  ) {
    return this.service.decide(r.user.id, id, d);
  }
  @Put('admin/advertising/packages') @Staff('super') package(
    @Req() r: AuthRequest,
    @Body() d: AdvertisingPackageDto,
  ) {
    return this.service.package(r.user.id, d);
  }
}
