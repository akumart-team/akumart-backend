import { IsIn, IsString, Length, Matches, IsOptional } from 'class-validator';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class RecipientDto {
  @IsString() @Matches(/^\d{10}$/) accountNumber!: string;
  @IsString() @Matches(/^\d{3,20}$/) bankCode!: string;
}
export class DisputeDecisionDto {
  @IsIn(['refund', 'partial', 'release']) decision!:
    'refund' | 'partial' | 'release';
  @IsString() @Length(10, 3000) reason!: string;
  @IsOptional() @DecimalField() refundAmount?: string;
}
export class HoldDto {
  @IsString() @Length(5, 2000) reason!: string;
}
