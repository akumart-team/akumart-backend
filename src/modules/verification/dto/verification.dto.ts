import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  VerificationLevel,
  VerificationType,
} from '../../../generated/prisma/enums';
export class VerificationFileDto {
  @IsUUID() uploadId: string;
  @IsString() @MinLength(1) @MaxLength(80) kind: string;
}
export class SubmitVerificationDto {
  @IsEnum(VerificationLevel) level: VerificationLevel;
  @IsEnum(VerificationType) type: VerificationType;
  @IsObject() data: Record<string, string>;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((x: VerificationFileDto | null) => x?.uploadId)
  @ValidateNested({ each: true })
  @Type(() => VerificationFileDto)
  documents: VerificationFileDto[];
}
export enum VerificationDecision {
  approved = 'approved',
  rejected = 'rejected',
  needs_resubmission = 'needs_resubmission',
}
export class VerificationDecisionDto {
  @IsEnum(VerificationDecision) decision: VerificationDecision;
  @IsString() @MinLength(1) @MaxLength(1000) reason: string;
  @IsOptional() @IsISO8601() expiresAt?: string;
}
