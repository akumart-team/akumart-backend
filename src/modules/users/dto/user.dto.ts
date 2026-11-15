import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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
import { Transform } from 'class-transformer';
import { SIGNUP_ROLES } from '../../auth/dto/register.dto';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(trim)
  firstName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(trim)
  lastName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(trim)
  displayName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(/^\+?\d{10,15}$/)
  @Transform(trim)
  phone?: string;
  @ApiPropertyOptional()
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  @MinLength(2)
  @Transform(trim)
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
  @ApiProperty({ enum: SIGNUP_ROLES })
  @IsEnum(MarketRole)
  @IsIn(SIGNUP_ROLES)
  marketRole: MarketRole;
  @IsBoolean() akubin: boolean;
  @IsArray()
  @ArrayUnique()
  @IsEnum(Material, { each: true })
  interests: Material[];
  @IsOptional() @IsEnum(MarketMode) activeMode?: MarketMode;
  @IsOptional() @IsBoolean() @Equals(true) acceptedTerms?: boolean;
}
export class UpdatePreferencesDto extends PartialType(PreferencesDto, {
  skipNullProperties: false,
}) {}
