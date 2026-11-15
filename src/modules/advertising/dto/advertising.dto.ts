import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Material, MarketRole } from '../../../generated/prisma/enums';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class CampaignDto {
  @IsString() @Length(1, 40) packageId!: string;
  @IsString() @Length(3, 150) title!: string;
  @IsString() @Length(10, 2000) body!: string;
  @IsUrl({ protocols: ['https'], require_protocol: true })
  destinationUrl!: string;
  @IsUUID() imageId!: string;
  @IsArray()
  @ArrayMaxSize(40)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  locations!: string[];
  @IsArray()
  @ArrayUnique()
  @IsEnum(Material, { each: true })
  materials!: Material[];
  @IsArray()
  @ArrayUnique()
  @IsEnum(MarketRole, { each: true })
  roles!: MarketRole[];
}
export class CampaignDecisionDto {
  @IsIn(['approved', 'rejected', 'paused']) status!:
    'approved' | 'rejected' | 'paused';
  @IsString() @Length(5, 2000) reason!: string;
}
export class AdvertisingPackageDto {
  @IsString() @Matches(/^[a-z0-9_-]{1,40}$/) id!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsInt() @Min(1) @Max(365) durationDays!: number;
  @DecimalField() price!: string;
  @IsBoolean() active!: boolean;
}
export class PlacementQuery {
  @IsIn(['home', 'marketplace', 'articles', 'dashboard']) placement!: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsEnum(Material) material?: Material;
  @IsOptional() @IsEnum(MarketRole) role?: MarketRole;
}
export class CampaignTrackingDto {
  @IsString() @Length(20, 2000) token!: string;
  @IsIn(['impression', 'click']) kind!: 'impression' | 'click';
}
