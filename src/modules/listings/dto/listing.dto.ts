import {
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
  Material,
  MaterialCondition,
  QuantityUnit,
} from '../../../generated/prisma/enums';
import { DecimalField } from '../../../common/platform/decimal.decorator';
import { PageQuery } from '../../../common/platform/query.dto';
export enum EditableListingStatus {
  draft = 'draft',
  published = 'published',
  paused = 'paused',
}
export class CreateListingDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsEnum(Material) material: Material;
  @IsString() @MinLength(1) @MaxLength(100) grade: string;
  @IsEnum(MaterialCondition) condition: MaterialCondition;
  @DecimalField(3) quantity: string;
  @IsEnum(QuantityUnit) unit: QuantityUnit;
  @DecimalField(2) unitPrice: string;
  @DecimalField(3) minOrder: string;
  @IsBoolean() allowPartial: boolean;
  @IsString() @MinLength(1) @MaxLength(100) city: string;
  @IsString() @MinLength(1) @MaxLength(200) area: string;
  @IsString() @MinLength(1) @MaxLength(5000) description: string;
  @IsOptional() @IsEnum(EditableListingStatus) status?: EditableListingStatus;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  imageIds: string[];
}
export class UpdateListingDto extends PartialType(CreateListingDto, {
  skipNullProperties: false,
}) {}
export enum ListingSort {
  newest = 'newest',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
}
export class ListingQuery extends PageQuery {
  @IsOptional() @IsEnum(Material) material?: Material;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @DecimalField(2) minPrice?: string;
  @IsOptional() @DecimalField(2) maxPrice?: string;
  @IsOptional() @IsUUID() excludeId?: string;
  @IsEnum(ListingSort) sort: ListingSort = ListingSort.newest;
}
export class ReportListingDto {
  @IsString() @MinLength(1) @MaxLength(1000) reason: string;
}
export enum ModerationStatus {
  published = 'published',
  paused = 'paused',
}
export class ModerateListingDto {
  @IsEnum(ModerationStatus) status: ModerationStatus;
  @IsString() @MinLength(1) @MaxLength(1000) reason: string;
}
