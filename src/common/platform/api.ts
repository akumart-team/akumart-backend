import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../guard/supabase-auth.guard';
import { PlatformStaffGuard, StaffRoles } from './staff.guard';
import type { StaffRole } from '../../generated/prisma/enums';
import type { Request } from 'express';
export type AuthRequest = Request & {
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    user_metadata?: Record<string, unknown>;
  };
  accessToken: string;
};
// Prefer the authorized bearer in Swagger while documenting anonymous access too.
export const OptionalBearerAuth = () =>
  applyDecorators(ApiSecurity('bearer'), ApiSecurity({}));
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
