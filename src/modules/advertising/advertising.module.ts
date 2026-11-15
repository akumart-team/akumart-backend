import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { AdvertisingController } from './advertising.controller';
import { AdvertisingService } from './advertising.service';
@Module({
  imports: [UploadsModule],
  providers: [AdvertisingService],
  controllers: [AdvertisingController],
})
export class AdvertisingModule {}
