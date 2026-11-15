import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email: string;

  @IsString() @Length(6, 8) @Matches(/^\d{6,8}$/, { message: 'code must contain 6 to 8 digits' })
  code: string;
}
