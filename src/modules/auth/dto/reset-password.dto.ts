import { IsString, MaxLength, MinLength } from 'class-validator';
import { VerifyCodeDto } from './verify-code.dto';

export class ResetPasswordDto extends VerifyCodeDto {
  @IsString() @MinLength(8) @MaxLength(72)
  newPassword: string;
}