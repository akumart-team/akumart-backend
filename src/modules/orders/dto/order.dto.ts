import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class FulfilmentDto {
  @IsString() @Length(5, 500) destination!: string;
  @DecimalField() proposedFare!: string;
}
export class SelectQuoteDto {
  @IsUUID() quoteId!: string;
}
export class ReviewDto {
  @IsInt() @Min(1) @Max(5) stars!: number;
  @IsOptional() @IsString() @MaxLength(3000) text?: string;
}
export class DisputeDto {
  @IsString() @Length(10, 5000) reason!: string;
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  uploadIds!: string[];
}
