import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../integrations/database/prisma.service';
import type { StaffRole } from '../../generated/prisma/enums';
export const StaffRoles = (...roles: StaffRole[]) =>
  SetMetadata('platform:roles', roles);
@Injectable()
export class PlatformStaffGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const roles =
      this.reflector.getAllAndOverride<StaffRole[]>('platform:roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const user = context.switchToHttp().getRequest().user;
    const staff =
      user &&
      (await this.prisma.staffMembership.findUnique({
        where: { profileId: user.id },
      }));
    if (
      !staff?.active ||
      (!roles.includes(staff.role) && staff.role !== 'super')
    )
      throw new ForbiddenException('Staff permission required.');
    return true;
  }
}
