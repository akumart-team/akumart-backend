import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EnquiryKind,
  TicketChannel,
  TicketPriority,
  TicketStatus,
} from '../../../generated/prisma/enums';
export class TicketDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(200) subject: string;
  @IsString() @MinLength(1) @MaxLength(5000) message: string;
  @IsEnum(TicketChannel) channel: TicketChannel;
}
export class EnquiryDto {
  @IsEnum(EnquiryKind) kind: EnquiryKind;
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsEmail() email: string;
  @IsObject() data: Record<string, string>;
}
export class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsUUID() assigneeId?: string;
}
