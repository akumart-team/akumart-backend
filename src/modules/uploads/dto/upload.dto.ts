import { IsEnum } from 'class-validator';
import { UploadPurpose } from '../../../generated/prisma/enums';
export class UploadDto {
  @IsEnum(UploadPurpose) purpose: UploadPurpose;
}
export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
