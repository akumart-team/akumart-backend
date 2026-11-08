import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @IsString() @IsNotEmpty()
  accessToken: string;

  @IsString() @IsNotEmpty()
  refreshToken: string;

  // Google users skip the form, so the frontend sends this after showing the terms checkbox
  @IsOptional() @IsBoolean()
  acceptedTerms?: boolean;
}