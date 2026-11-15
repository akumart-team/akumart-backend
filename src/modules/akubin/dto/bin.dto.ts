import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BinStatus, Material } from '../../../generated/prisma/enums';
import { PaginationDto } from './pagination.dto';

export class BinQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
  @ApiPropertyOptional({ enum: BinStatus })
  @IsOptional()
  @IsEnum(BinStatus)
  status?: BinStatus;
  @ApiPropertyOptional({ enum: Material })
  @IsOptional()
  @IsEnum(Material)
  material?: Material;
}

export class CreateBinDto {
  @ApiProperty({ example: 'AKUBIN-001' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  code: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  area: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  landmark?: string;
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
  @ApiProperty({ enum: Material, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Material, { each: true })
  materials: Material[];
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  hours: string;
  @ApiPropertyOptional({ enum: BinStatus })
  @IsOptional()
  @IsEnum(BinStatus)
  status?: BinStatus;
}

export class UpdateBinDto extends PartialType(CreateBinDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  collector?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextCollectionAt?: string;
}

export class CollectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  collector: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextCollectionAt?: string;
}

export class MaintenanceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  issue: string;
}
