import { Module } from '@nestjs/common';
import { BuyerRequestsController } from './buyer-requests.controller';
import { BuyerRequestsService } from './buyer-requests.service';
@Module({
  controllers: [BuyerRequestsController],
  providers: [BuyerRequestsService],
})
export class BuyerRequestsModule {}
