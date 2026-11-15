import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../integrations/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import type { AkubinTransaction } from '../akubin.types';

@Injectable()
export class AkubinDatabase {
  constructor(readonly prisma: PrismaService) {}

  async transaction<T>(
    work: (tx: AkubinTransaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Concurrent update. Please retry using the same idempotency key.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Please retry.');
  }

  async now(tx: AkubinTransaction): Promise<Date> {
    const [row] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    return row.now;
  }

  async lockBin(tx: AkubinTransaction, id: string) {
    await tx.$queryRaw`SELECT id FROM public.bins WHERE id = ${id}::uuid FOR UPDATE`;
  }

  isUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
