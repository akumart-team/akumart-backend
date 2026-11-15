import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class AssistantMessageDto {
  @IsOptional() @IsUUID() conversationId?: string;
  @IsString() @Length(1, 3000) message!: string;
}
