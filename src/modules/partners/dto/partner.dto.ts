import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DecimalField } from '../../../common/platform/decimal.decorator';
import { Material } from '../../../generated/prisma/enums';
export class PartnerDocumentDto {
  @IsUUID() uploadId!: string;
  @IsIn(['cac', 'owner_id', 'vehicle_registration', 'insurance']) kind!: string;
}
export class PartnerApplicationDto {
  @IsString() @Length(2, 200) business!: string;
  @IsString() @Length(2, 200) contact!: string;
  @IsEmail() email!: string;
  @IsString() @Length(7, 25) phone!: string;
  @IsString() @Length(2, 150) base!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  serviceAreas!: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Material, { each: true })
  materials!: Material[];
  @IsString() @Length(2, 500) vehicles!: string;
  @IsInt() @Min(1) @Max(10000) vehicleCount!: number;
  @DecimalField(3) capacityKg!: string;
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PartnerDocumentDto)
  documents!: PartnerDocumentDto[];
}
export class PartnerDecisionDto {
  @IsIn(['approved', 'rejected', 'suspended']) status!:
    'approved' | 'rejected' | 'suspended';
  @IsString() @Length(5, 2000) reason!: string;
}
export class QuoteDto {
  @DecimalField() amount!: string;
  @IsString() @Length(2, 100) eta!: string;
  @IsString() @Length(2, 200) vehicle!: string;
}
export class DeclineJobDto {
  @IsString() @Length(3, 1000) reason!: string;
}
export class DeliveryEventDto {
  @IsIn(['picked_up', 'in_transit', 'delivered']) status!:
    'picked_up' | 'in_transit' | 'delivered';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class DeliveryProofDto {
  @IsUUID() uploadId!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
