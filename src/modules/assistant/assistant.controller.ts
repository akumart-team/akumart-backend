import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import { OptionalBearerAuth, type AuthRequest } from '../../common/platform/api';
import { AssistantMessageDto } from './dto/assistant.dto';
import { AssistantService } from './assistant.service';
@ApiTags('Assistant')
@OptionalBearerAuth()
@Controller({ path: 'assistant', version: '1' })
@UseGuards(OptionalAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AssistantController {
  constructor(private readonly service: AssistantService) {}
  @Post('messages') message(
    @Body() d: AssistantMessageDto,
    @Req() r: AuthRequest,
    @Headers('x-assistant-guest-token') guest?: string,
  ) {
    return this.service.message(d, r.user?.id, guest);
  }
  @Get('conversations/:id') history(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: AuthRequest,
    @Headers('x-assistant-guest-token') guest?: string,
  ) {
    return this.service.history(id, r.user?.id, guest);
  }
}
