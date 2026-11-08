import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class EmailDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  email: string;
}