import { Transform } from 'class-transformer';
import {
  Equals, IsBoolean, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  firstName: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  lastName: string;

  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email: string;

  @IsString() @MinLength(8) @MaxLength(72)
  password: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms & Conditions' })
  acceptedTerms: boolean;
}