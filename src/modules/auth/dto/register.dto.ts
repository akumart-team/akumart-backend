import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const SIGNUP_ROLES = ['buyer', 'seller', 'both', 'logistics'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\+?\d{10,15}$/)
  phone: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @ApiProperty({ enum: SIGNUP_ROLES })
  @IsIn(SIGNUP_ROLES, {
    message: 'Choose buyer, seller, both or logistics.',
  })
  marketRole: SignupRole;

  @ApiProperty({
    type: Boolean,
    description:
      'Independent AkuBin preference, available for every account role.',
    default: false,
  })
  @IsBoolean()
  akubin: boolean;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/\S/, { message: 'Password cannot contain only spaces.' })
  password: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms & Conditions' })
  acceptedTerms: boolean;
}
