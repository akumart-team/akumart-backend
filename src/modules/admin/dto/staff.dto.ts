import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { StaffRole } from '../../../generated/prisma/enums';

export class AssignStaffDto {
  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiProperty({ description: 'False disables staff access without deleting history.' })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
