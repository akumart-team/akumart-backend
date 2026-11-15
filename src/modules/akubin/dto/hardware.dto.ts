import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StartBinSessionDto {
  @ApiProperty({ example: 'AKUBIN-001' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  binId: string;

  @ApiProperty({
    description: 'Permanent account PIN; preserve leading zeros',
    writeOnly: true,
  })
  @IsString()
  @Matches(/^\d{6,12}$/)
  identifier: string;
}

export enum HardwareMaterial {
  metal = 'metal',
  plastic = 'plastic',
  paper = 'paper',
}

export class RecordDepositDto {
  @ApiProperty({ example: 'AKUBIN-001' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  binId: string;

  @ApiProperty({ enum: HardwareMaterial })
  @IsEnum(HardwareMaterial)
  material: HardwareMaterial;

  @ApiProperty({
    example: 100,
    description: 'Grams; server normalizes to 3 decimal places',
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  @Max(1_000_000)
  weight_g: number;

  @ApiProperty({ example: 'AKUBIN-001-12345-7890' })
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,160}$/)
  idempotencyKey: string;

  @ApiPropertyOptional({
    description: 'Legacy firmware field. Ignored; user comes from the session.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Legacy display estimate. Ignored; points are calculated server-side.',
  })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  points?: number;
}

export class BinTelemetryDto {
  @ApiProperty({ example: 'AKUBIN-001' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  binId: string;

  @ApiProperty({
    example: 10,
    description:
      'Ultrasonic distance, including the firmware timeout sentinel 999',
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(10_000)
  distance_cm: number;

  @ApiProperty()
  @IsBoolean()
  isFull: boolean;

  @ApiProperty({
    description: 'Unsigned 32-bit millis() since device boot, not Unix time',
  })
  @IsInt()
  @Min(0)
  @Max(4_294_967_295)
  timestamp: number;
}
