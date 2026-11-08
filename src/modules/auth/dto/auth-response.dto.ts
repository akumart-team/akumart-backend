import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() expiresAt: number;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty() message: string;
}