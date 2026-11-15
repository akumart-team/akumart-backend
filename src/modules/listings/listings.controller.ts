import {
  Body,
  Controller,
  Delete,
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
import {
  Authenticated,
  OptionalBearerAuth,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import { PageQuery } from '../../common/platform/query.dto';
import {
  CreateListingDto,
  UpdateListingDto,
  ListingQuery,
  ReportListingDto,
  ModerateListingDto,
} from './dto/listing.dto';
import { ListingsService } from './listings.service';
@ApiTags('Listings')
@Controller({ version: '1' })
export class ListingsController {
  constructor(private readonly service: ListingsService) {}
  @Get('listings') browse(@Query() q: ListingQuery) {
    return this.service.browse(q);
  }
  @Get('listings/:id') @OptionalBearerAuth() @UseGuards(OptionalAuthGuard) detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: AuthRequest,
  ) {
    return this.service.detail(id, r.user?.id);
  }
  @Get('users/me/listings') @Authenticated() own(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.own(r.user.id, q);
  }
  @Post('listings') @Authenticated() create(
    @Req() r: AuthRequest,
    @Body() dto: CreateListingDto,
  ) {
    return this.service.save(r.user.id, dto);
  }
  @Patch('listings/:id') @Authenticated() edit(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.service.save(r.user.id, dto, id);
  }
  @Post('listings/:id/reports') @Authenticated() report(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportListingDto,
  ) {
    return this.service.report(r.user.id, id, dto.reason);
  }
  @Get('users/me/saved-listings') @Authenticated() saved(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.saved(r.user.id, q);
  }
  @Put('users/me/saved-listings/:id') @Authenticated() save(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user.id, id);
  }
  @Delete('users/me/saved-listings/:id') @Authenticated() unsave(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user.id, id, true);
  }
  @Get('sellers/:id/reviews') reviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageQuery,
  ) {
    return this.service.reviews(id, q);
  }
  @Get('admin/listings') @Staff('operations') admin(@Query() q: PageQuery) {
    return this.service.admin(q);
  }
  @Patch('admin/listings/:id/moderation') @Staff('operations') moderate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateListingDto,
  ) {
    return this.service.moderation(r.user.id, id, dto);
  }
}
