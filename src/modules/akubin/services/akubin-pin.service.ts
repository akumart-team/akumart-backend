import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import * as argon2 from 'argon2';
import { AkubinDatabase } from './akubin-database.service';
import { AkubinConfig } from './akubin-config.service';
import type { SetBinPinDto } from '../dto/account.dto';

export const PIN_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 3,
  parallelism: 1,
} as const;

@Injectable()
export class AkubinPinService {
  constructor(
    private readonly db: AkubinDatabase,
    private readonly config: AkubinConfig,
  ) {}

  lookup(pin: string) {
    return createHmac('sha256', this.config.pinSecret)
      .update(pin)
      .digest('hex');
  }

  async status(profileId: string) {
    const security = await this.db.prisma.userSecurity.findUnique({
      where: { profileId },
      select: { pinHash: true, pinLookupHash: true, pinLockedUntil: true },
    });
    if (!security)
      throw new NotFoundException('Account security record not found.');
    return {
      data: {
        configured: !!(security.pinHash && security.pinLookupHash),
        lockedUntil: security.pinLockedUntil,
      },
    };
  }

  async set(profileId: string, dto: SetBinPinDto) {
    const pinLookupHash = this.lookup(dto.pin);
    const pinHash = await argon2.hash(dto.pin, PIN_HASH_OPTIONS);
    try {
      const result = await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT profile_id FROM public.user_security WHERE profile_id = ${profileId}::uuid FOR UPDATE`;
        const security = await tx.userSecurity.findUnique({
          where: { profileId },
        });
        if (!security)
          throw new NotFoundException('Account security record not found.');
        const now = await this.db.now(tx);
        if (security.pinLockedUntil && security.pinLockedUntil > now)
          return false;
        if (
          security.pinHash &&
          (!dto.currentPin ||
            !(await argon2.verify(security.pinHash, dto.currentPin)))
        ) {
          const failedPinAttempts = security.failedPinAttempts + 1;
          await tx.userSecurity.update({
            where: { profileId },
            data: {
              failedPinAttempts,
              pinLockedUntil:
                failedPinAttempts >= 5
                  ? new Date(now.getTime() + 900000)
                  : null,
            },
          });
          return false; // Commit the failed-attempt counter before reporting rejection.
        }
        await tx.userSecurity.update({
          where: { profileId },
          data: {
            pinHash,
            pinLookupHash,
            failedPinAttempts: 0,
            pinLockedUntil: null,
          },
        });
        await tx.binSession.updateMany({
          where: { profileId, status: 'active' },
          data: { status: 'revoked', endedAt: now },
        });
        await tx.auditLog.create({
          data: {
            actorId: profileId,
            actorLabel: 'account',
            action: 'akubin.pin_changed',
            resourceType: 'profile',
            resourceId: profileId,
          },
        });
        return true;
      });
      if (!result)
        throw new UnauthorizedException(
          'Current PIN is invalid or temporarily locked.',
        );
      return {
        data: { configured: true },
        message: 'AkuBin PIN saved. Existing bin sessions have ended.',
      };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException(
          'This PIN is unavailable. Choose another PIN.',
        );
      throw error;
    }
  }
}
