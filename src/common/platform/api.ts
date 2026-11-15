import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../guard/supabase-auth.guard';
import { PlatformStaffGuard, StaffRoles } from './staff.guard';
import type { StaffRole } from '../../generated/prisma/enums';
import type { Request } from 'express';
export type AuthRequest = Request & {
  user: { id: string; email?: string };
  accessToken: string;
};
export const Authenticated = () =>
  applyDecorators(
    ApiBearerAuth(),
    UseGuards(SupabaseAuthGuard, ThrottlerGuard),
  );
export const Staff = (...roles: StaffRole[]) =>
  applyDecorators(
    ApiBearerAuth(),
    StaffRoles(...roles),
    UseGuards(SupabaseAuthGuard, PlatformStaffGuard, ThrottlerGuard),
  );
