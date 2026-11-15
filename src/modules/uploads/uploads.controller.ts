import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { OptionalAuthGuard } from '../../common/platform/optional-auth.guard';
import { UploadsService } from './uploads.service';
import { UploadDto, type IncomingFile } from './dto/upload.dto';
@ApiTags('Uploads')
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly service: UploadsService) {}
  @Post()
  @Authenticated()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['purpose', 'file'],
      properties: {
        purpose: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  create(
    @Req() r: AuthRequest,
    @Body() dto: UploadDto,
    @UploadedFile() file: IncomingFile,
  ) {
    return this.service.create(r.user.id, dto.purpose, file);
  }
  @Get(':id/access')
  @UseGuards(OptionalAuthGuard)
  access(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.access(id, r.user?.id);
  }
}
