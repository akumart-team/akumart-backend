import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
@Module({
  imports: [UploadsModule],
  providers: [PartnersService],
  controllers: [PartnersController],
})
export class PartnersModule {}
