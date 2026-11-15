import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService, type Tx } from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { AssignStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private async lock(tx: Tx) {
    // Serialize bootstrap, grants and revocations, including an initially empty table.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(17421, 1)::text AS locked`;
  }

  async bootstrap(user: { id: string; email_confirmed_at?: string }) {
    const founder = this.config.get<string>('STAFF_BOOTSTRAP_PROFILE_ID');
    if (!founder) throw new NotFoundException('Staff bootstrap is disabled.');
    if (user.id !== founder || !user.email_confirmed_at)
      throw new ForbiddenException('Only the configured, email-verified account can bootstrap staff.');
    return {
      data: await this.db.transaction(async (tx) => {
        await this.lock(tx);
        // Any historical super membership closes bootstrap, even when inactive.
        if (await tx.staffMembership.count({ where: { role: 'super' } }))
          throw new ConflictException('Staff has already been bootstrapped. Ask an active super administrator to manage access.');
        if (!(await tx.profile.findUnique({ where: { id: user.id }, select: { id: true } })))
          throw new NotFoundException('Account profile not found.');
        const before = await tx.staffMembership.findUnique({ where: { profileId: user.id } });
        const staff = await tx.staffMembership.upsert({
          where: { profileId: user.id },
          create: { profileId: user.id, role: 'super', active: true },
          update: { role: 'super', active: true },
        });
        await this.db.audit(tx, user.id, 'staff.bootstrapped', 'staff_membership', user.id, {
          before: before ? { role: before.role, active: before.active } : null,
          after: { role: staff.role, active: staff.active },
        });
        return staff;
      }),
    };
  }

  async members(q: PageQuery) {
    const where = q.search ? {
      profile: { email: { contains: q.search, mode: 'insensitive' as const } },
    } : {};
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.staffMembership.findMany({
        where,
        include: { profile: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { profileId: 'asc' }],
        ...paging(q),
      }),
      this.db.prisma.staffMembership.count({ where }),
    ]);
    return list(data, total, q);
  }

  async assign(actorId: string, profileId: string, dto: AssignStaffDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.lock(tx);
        // Recheck after acquiring the lock: the actor may have just been revoked.
        const actor = await tx.staffMembership.findUnique({ where: { profileId: actorId } });
        if (!actor?.active || actor.role !== 'super')
          throw new ForbiddenException('Active super staff permission required.');
        if (!(await tx.profile.findUnique({ where: { id: profileId }, select: { id: true } })))
          throw new NotFoundException('Account profile not found.');
        const before = await tx.staffMembership.findUnique({ where: { profileId } });
        if (before?.active && before.role === 'super' && (!dto.active || dto.role !== 'super')) {
          const activeSupers = await tx.staffMembership.count({ where: { role: 'super', active: true } });
          if (activeSupers <= 1)
            throw new ConflictException('The last active super administrator cannot be demoted or deactivated.');
        }
        const staff = await tx.staffMembership.upsert({
          where: { profileId },
          create: { profileId, role: dto.role, active: dto.active },
          update: { role: dto.role, active: dto.active },
        });
        await this.db.audit(tx, actorId, 'staff.assigned', 'staff_membership', profileId, {
          before: before ? { role: before.role, active: before.active } : null,
          after: { role: staff.role, active: staff.active },
          reason: dto.reason,
        });
        return staff;
      }),
    };
  }
}
