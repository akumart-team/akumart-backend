import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  MarketRole,
  MarketMode,
  Material,
} from '../../../generated/prisma/enums';
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(/^\+?\d{10,15}$/)
  phone?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  city?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(200)
  companyName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  businessType?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(300)
  location?: string;
}
export class PreferencesDto {
  @IsEnum(MarketRole) marketRole: MarketRole;
  @IsBoolean() akubin: boolean;
  @IsArray()
  @ArrayUnique()
  @IsEnum(Material, { each: true })
  interests: Material[];
  @IsOptional() @IsEnum(MarketMode) activeMode?: MarketMode;
}
export class UpdatePreferencesDto extends PartialType(PreferencesDto, {
  skipNullProperties: false,
}) {}
