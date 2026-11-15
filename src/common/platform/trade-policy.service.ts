import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, type Tx } from './database.service';
@Injectable()
export class TradePolicy {
  constructor(private readonly db: DatabaseService) {}
  async require(
    profileId: string,
    level: 'basic' | 'full',
    tx: Tx = this.db.prisma,
  ) {
    const now = new Date();
    const records = await tx.verificationSubmission.findMany({
      where: {
        profileId,
        status: 'approved',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { level: true, type: true },
    });
    const basic = records.find((v) => v.level === 'basic');
    if (
      !basic ||
      (level === 'full' &&
        !records.some((v) => v.level === 'full' && v.type === basic.type))
    )
      throw new ForbiddenException(
        `${level} marketplace verification is required.`,
      );
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      select: { termsAcceptedAt: true },
    });
    if (!profile?.termsAcceptedAt)
      throw new ForbiddenException('Accept the terms before trading.');
  }
}
