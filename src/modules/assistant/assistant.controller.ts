import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiGoneResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import {
  OptionalBearerAuth,
  type AuthRequest,
} from '../../common/platform/api';
import { AssistantMessageDto } from './dto/assistant.dto';
import { AssistantService } from './assistant.service';
@ApiTags('Assistant')
@OptionalBearerAuth()
@Controller({ path: 'assistant', version: '1' })
@UseGuards(OptionalAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AssistantController {
  constructor(private readonly service: AssistantService) {}
  @Post('messages')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Send a temporary AI support message without saving a conversation',
  })
  message(@Body() d: AssistantMessageDto, @Req() r: AuthRequest) {
    return this.service.message(d, r.user?.id);
  }
  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired: conversations are no longer stored',
  })
  @ApiGoneResponse({ description: 'Chat history is not stored.' })
  history(@Param('id', ParseUUIDPipe) _id: string) {
    return this.service.history();
  }
}
