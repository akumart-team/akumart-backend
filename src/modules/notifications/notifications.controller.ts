import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { NotificationsService } from './notifications.service';
@ApiTags('Notifications')
@Authenticated()
@Controller({ path: 'users/me/notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() all(@Req() r: AuthRequest, @Query() q: PageQuery) {
    return this.service.all(r.user.id, q);
  }
  @Patch(':id') read(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.read(r.user.id, id);
  }
  @Post('read-all') @HttpCode(200) readAll(@Req() r: AuthRequest) {
    return this.service.read(r.user.id);
  }
}
