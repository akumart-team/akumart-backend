import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AkubinHardwareService } from '../services/akubin-hardware.service';
import { BinTelemetryDto } from '../dto/hardware.dto';

@ApiTags('AkuBin Hardware')
@Controller({ path: 'webhooks', version: '1' })
export class AkubinTelemetryController {
  constructor(private readonly hardware: AkubinHardwareService) {}
  @Post('akubin-telemetry')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiHeader({ name: 'X-Akubin-Device-Key', required: false })
  @ApiOperation({
    summary: 'Firmware fill sensor report; timestamp is device uptime',
  })
  report(
    @Body() dto: BinTelemetryDto,
    @Headers('x-akubin-device-key') key?: string,
  ) {
    return this.hardware.telemetry(dto, key);
  }
}
