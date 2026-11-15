import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../integrations/database/prisma.service';
import type { StaffRole } from '../../../generated/prisma/enums';
import type { AkubinRequest } from '../akubin.types';

export const AkubinRoles = (...roles: StaffRole[]) =>
  SetMetadata('akubin:roles', roles);

@Injectable()
export class AkubinStaffGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const roles =
      this.reflector.getAllAndOverride<StaffRole[]>('akubin:roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const req = context.switchToHttp().getRequest<AkubinRequest>();
    const staff = await this.prisma.staffMembership.findUnique({
      where: { profileId: req.user.id },
    });
    if (!staff?.active || !roles.includes(staff.role))
      throw new ForbiddenException('Staff permission required.');
    return true;
  }
}
