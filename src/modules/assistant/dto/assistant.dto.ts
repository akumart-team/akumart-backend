import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
export class AssistantHistoryDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';
  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @IsString()
  @Length(1, 10000)
  content!: string;
}
export class AssistantMessageDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Temporary chat ID. No history is persisted.',
  })
  @IsUUID()
  sessionId!: string;
  @ApiProperty({ minLength: 1, maxLength: 3000 })
  @IsString()
  @Length(1, 3000)
  message!: string;
  @ApiPropertyOptional({ type: [AssistantHistoryDto], maxItems: 12 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryDto)
  history?: AssistantHistoryDto[];
}
