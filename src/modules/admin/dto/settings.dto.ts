import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class SettingsDto {
  @IsInt() @Min(0) version!: number;
  @IsOptional() @DecimalField() sellerFeePct?: string;
  @IsOptional() @DecimalField() partnerFeePct?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) pointsPerItem?: number;
  @IsOptional() @DecimalField(6) itemKgEquivalent?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000000) airtimeMinPoints?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000000) cashMinPoints?: number;
  @IsOptional() @DecimalField(6) pointValueNaira?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) inspectionHours?: number;
  @IsOptional() @DecimalField() fareBase?: string;
  @IsOptional() @DecimalField(6) farePerKg?: string;
  @IsOptional() @DecimalField() fareStep?: string;
  @IsOptional() @DecimalField() fareMinPct?: string;
  @IsOptional() @DecimalField() fareMaxPct?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) quoteDeadlineHours?: number;
}
