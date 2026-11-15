import { IsEnum, IsUUID } from 'class-validator';
import {
  RecommendationAction,
  RecommendationResource,
} from '../../../generated/prisma/enums';
export class RecommendationEventDto {
  @IsEnum(RecommendationResource) resourceType!: RecommendationResource;
  @IsUUID() resourceId!: string;
  @IsEnum(RecommendationAction) action!: RecommendationAction;
}
