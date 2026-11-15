import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  DeviceAuthMode,
  Material,
  RewardKind,
} from '../../../generated/prisma/enums';

export class RegisterBinDeviceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber: string;
  @ApiProperty({
    enum: DeviceAuthMode,
    description: 'legacy_bin_id requires explicit pilot configuration',
  })
  @IsEnum(DeviceAuthMode)
  authMode: DeviceAuthMode;
}

export class MaterialRateDto {
  @ApiProperty({ enum: Material })
  @IsEnum(Material)
  material: Material;
  @ApiProperty({
    example: '0.025',
    description: 'Points per gram, decimal string with up to 6 places',
  })
  @IsString()
  @Matches(/^\d{1,6}(\.\d{1,6})?$/)
  pointsPerGram: string;
}

export class UpdateRewardRulesDto {
  @ApiProperty({ type: [MaterialRateDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((rate: MaterialRateDto | null) => rate?.material)
  @ValidateNested({ each: true })
  @Type(() => MaterialRateDto)
  rates: MaterialRateDto[];

  @ApiProperty({
    example: '20',
    description: 'Naira reward value per point, not a cash wallet balance',
  })
  @IsString()
  @Matches(/^\d{1,9}(\.\d{1,6})?$/)
  pointValueNaira: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  airtimeMinPoints?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  cashMinPoints?: number;
}

export class CreateRewardDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;
  @ApiProperty({ enum: RewardKind })
  @IsEnum(RewardKind)
  kind: RewardKind;
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  costPoints: number;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  valueLabel: string;
  @ApiPropertyOptional({ example: '100' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  valueAmount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  stock?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export enum RedemptionDecision {
  approve = 'approve',
  reject = 'reject',
}
export class RedemptionDecisionDto {
  @ApiProperty({ enum: RedemptionDecision })
  @IsEnum(RedemptionDecision)
  decision: RedemptionDecision;
  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @ValidateIf(
    (dto: RedemptionDecisionDto) =>
      dto.decision === RedemptionDecision.reject || dto.reason !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason?: string;
}

export class FulfillRedemptionDto {
  @ApiProperty({
    description:
      'Operator/provider that already fulfilled the reward, e.g. manual_pickup',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,50}$/)
  provider: string;
  @ApiProperty({
    description:
      'Existing receipt/transfer reference; this endpoint does not initiate a payment',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reference: string;
}
