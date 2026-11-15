import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
@Module({
  imports: [ListingsModule],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}
