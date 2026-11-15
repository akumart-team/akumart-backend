import { PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
export class ArticleDto {
  @IsString() @Length(3, 200) title!: string;
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(3, 180)
  slug!: string;
  @IsString() @Length(10, 1000) excerpt!: string;
  @IsString() @Length(20, 100000) body!: string;
  @IsString() @Length(2, 80) category!: string;
  @IsOptional() @IsUUID() imageId?: string;
  @IsInt() @Min(1) @Max(180) readMinutes!: number;
  @IsIn(['draft', 'published', 'unpublished']) status!:
    'draft' | 'published' | 'unpublished';
}
export class UpdateArticleDto extends PartialType(ArticleDto, {
  skipNullProperties: false,
}) {}
export class NewsDto {
  @IsString() @Length(3, 300) title!: string;
  @IsString() @Length(2, 100) source!: string;
  @IsString() @Length(10, 3000) summary!: string;
  @IsUrl({ protocols: ['https'], require_protocol: true }) url!: string;
}
export class NewsDecisionDto {
  @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';
}
