import {
  IsEnum,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  Material,
  QuantityUnit,
  RequestResponseStatus,
} from '../../../generated/prisma/enums';
import { DecimalField } from '../../../common/platform/decimal.decorator';
export class CreateBuyerRequestDto {
  @IsEnum(Material) material: Material;
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @DecimalField(3) quantity: string;
  @IsEnum(QuantityUnit) unit: QuantityUnit;
  @DecimalField(2) maxUnitPrice: string;
  @IsString() @MinLength(1) @MaxLength(100) city: string;
  @IsISO8601() needBy: string;
}
export class RequestResponseDto {
  @DecimalField(2) unitPrice: string;
  @DecimalField(3) quantity: string;
  @IsString() @MaxLength(2000) note: string;
}
export class ReviewRequestResponseDto {
  @IsEnum(RequestResponseStatus) status: RequestResponseStatus;
}
