import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authenticated, OptionalBearerAuth, type AuthRequest } from '../../common/platform/api';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import { RecommendationsService } from './recommendations.service';
import { RecommendationEventDto } from './dto/recommendation.dto';
@ApiTags('Recommendations')
@Controller({ path: 'recommendations', version: '1' })
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}
  @Get('listings') @OptionalBearerAuth() @UseGuards(OptionalAuthGuard) listings(
    @Req() r: AuthRequest,
  ) {
    return this.service.listingsFor(r.user?.id);
  }
  @Get('listings/:id/similar') similar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listingsFor(undefined, id);
  }
  @Get('articles') @OptionalBearerAuth() @UseGuards(OptionalAuthGuard) articles(
    @Req() r: AuthRequest,
  ) {
    return this.service.articles(r.user?.id);
  }
  @Get('jobs') @Authenticated() jobs(@Req() r: AuthRequest) {
    return this.service.jobs(r.user.id);
  }
  @Post('events') @Authenticated() event(
    @Req() r: AuthRequest,
    @Body() dto: RecommendationEventDto,
  ) {
    return this.service.event(r.user.id, dto);
  }
}
