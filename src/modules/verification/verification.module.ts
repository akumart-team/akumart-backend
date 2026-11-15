import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
@Module({
  imports: [UploadsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
