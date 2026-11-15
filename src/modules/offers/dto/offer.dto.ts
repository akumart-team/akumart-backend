import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class OfferTermsDto {
  @DecimalField(2) unitPrice: string;
  @DecimalField(3) quantity: string;
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  conditions: string[];
}
