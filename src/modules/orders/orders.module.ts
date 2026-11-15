import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
@Module({
  imports: [UploadsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
