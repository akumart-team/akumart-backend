import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
@Module({
  imports: [UploadsModule],
  providers: [ContentService],
  controllers: [ContentController],
})
export class ContentModule {}
