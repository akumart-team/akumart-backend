import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class SetBinPinDto {
  @ApiProperty({
    description: 'Unique 6–12 digit permanent PIN',
    writeOnly: true,
  })
  @IsString()
  @Matches(/^\d{6,12}$/)
  pin: string;

  @ApiPropertyOptional({
    description: 'Required when a PIN is already configured',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,12}$/)
  currentPin?: string;
}

export class RedeemRewardDto {
  @ApiProperty()
  @IsUUID()
  rewardId: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,160}$/)
  idempotencyKey: string;

  @ApiPropertyOptional({
    description: 'Airtime recipient; falls back to profile phone',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{10,15}$/)
  phone?: string;
}

export enum LeaderboardPeriod {
  week = 'week',
  month = 'month',
  all = 'all',
}
export class LeaderboardQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeaderboardPeriod, default: 'week' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod = LeaderboardPeriod.week;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
