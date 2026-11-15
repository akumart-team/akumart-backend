import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Authenticated,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import {
  SubmitVerificationDto,
  VerificationDecisionDto,
} from './dto/verification.dto';
import { VerificationService } from './verification.service';
@ApiTags('Verification')
@Controller({ version: '1' })
export class VerificationController {
  constructor(private readonly service: VerificationService) {}
  @Get('users/me/verification') @Authenticated() own(@Req() r: AuthRequest) {
    return this.service.own(r.user.id);
  }
  @Post('users/me/verification/submissions') @Authenticated() submit(
    @Req() r: AuthRequest,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.service.submit(r.user.id, dto);
  }
  @Get('admin/verifications') @Staff('support', 'operations') queue(
    @Query() q: PageQuery,
  ) {
    return this.service.queue(q);
  }
  @Post('admin/verifications/:id/decision')
  @Staff('support', 'operations')
  decide(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDecisionDto,
  ) {
    return this.service.decide(r.user.id, id, dto);
  }
}
