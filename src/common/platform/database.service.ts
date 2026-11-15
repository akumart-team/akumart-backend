import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../integrations/database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
export type Tx = Prisma.TransactionClient;
@Injectable()
export class DatabaseService {
  constructor(readonly prisma: PrismaService) {}
  async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let i = 0; i < 3; i++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: 'Serializable',
          timeout: 15000,
          maxWait: 5000,
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === 'P2034' && i < 2) continue;
          if (e.code === 'P2002' || e.code === 'P2034')
            throw new ConflictException(
              'Record already exists or was concurrently changed. Retry with the same request key.',
            );
          if (e.code === 'P2025')
            throw new NotFoundException('Record not found.');
          if (e.code === 'P2003' || e.code === 'P2004')
            throw new BadRequestException(
              'Request conflicts with database relationships or business rules.',
            );
        }
        throw e;
      }
    }
    throw new ConflictException('Please retry.');
  }
  async now(tx: Tx) {
    return (
      await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now`
    )[0].now;
  }
  async audit(
    tx: Tx,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    detail?: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        actorLabel: 'account',
        action,
        resourceType,
        resourceId,
        detail,
      },
    });
  }
  async notify(
    tx: Tx,
    profileId: string,
    title: string,
    body: string,
    href?: string,
  ) {
    await tx.notification.create({ data: { profileId, title, body, href } });
  }
}
