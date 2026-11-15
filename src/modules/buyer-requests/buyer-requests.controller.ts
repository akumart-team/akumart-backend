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
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { BuyerRequestsService } from './buyer-requests.service';
import {
  CreateBuyerRequestDto,
  RequestResponseDto,
  ReviewRequestResponseDto,
} from './dto/request.dto';
@ApiTags('Buyer Requests')
@Authenticated()
@Controller({ version: '1' })
export class BuyerRequestsController {
  constructor(private readonly service: BuyerRequestsService) {}
  @Get('buyer-requests') browse(@Query() q: PageQuery) {
    return this.service.browse(q);
  }
  @Get('users/me/buyer-requests') own(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.browse(q, r.user.id);
  }
  @Post('buyer-requests') create(
    @Req() r: AuthRequest,
    @Body() dto: CreateBuyerRequestDto,
  ) {
    return this.service.create(r.user.id, dto);
  }
  @Get('buyer-requests/:id') detail(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(r.user.id, id);
  }
  @Post('buyer-requests/:id/responses') respond(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestResponseDto,
  ) {
    return this.service.respond(r.user.id, id, dto);
  }
  @Patch('buyer-requests/:id/responses/:responseId') review(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @Body() dto: ReviewRequestResponseDto,
  ) {
    return this.service.review(r.user.id, id, responseId, dto);
  }
}
