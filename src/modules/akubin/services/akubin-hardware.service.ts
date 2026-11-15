import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../../generated/prisma/client';
import { AkubinDatabase } from './akubin-database.service';
import { AkubinConfig } from './akubin-config.service';
import { AkubinPinService } from './akubin-pin.service';
import type { AkubinTransaction } from '../akubin.types';
import type {
  BinTelemetryDto,
  RecordDepositDto,
  StartBinSessionDto,
} from '../dto/hardware.dto';

@Injectable()
export class AkubinHardwareService {
  constructor(
    private readonly db: AkubinDatabase,
    private readonly config: AkubinConfig,
    private readonly pins: AkubinPinService,
  ) {}

  async controller(tx: AkubinTransaction, code: string, deviceKey?: string) {
    const bin = await tx.bin.findUnique({ where: { code } });
    if (!bin) throw new NotFoundException('Bin not registered.');
    await this.db.lockBin(tx, bin.id);
    const device = await tx.binDevice.findFirst({
      where: { binId: bin.id, revokedAt: null },
    });
    if (!device)
      throw new ServiceUnavailableException('Bin controller not registered.');
    if (device.authMode === 'legacy_bin_id') {
      if (!this.config.legacyEnabled)
        throw new UnauthorizedException('Legacy hardware access is disabled.');
    } else if (
      !deviceKey ||
      !device.credentialHash ||
      !(await argon2.verify(device.credentialHash, deviceKey))
    ) {
      throw new UnauthorizedException('Invalid device credentials.');
    }
    // Refresh after the lock, rather than trusting a stale status read.
    const lockedBin = await tx.bin.findUniqueOrThrow({ where: { id: bin.id } });
    return { bin: lockedBin, device };
  }

  async start(dto: StartBinSessionDto, deviceKey?: string) {
    const lookup = this.pins.lookup(dto.identifier);
    try {
      const result = await this.db.transaction(async (tx) => {
        const { bin, device } = await this.controller(tx, dto.binId, deviceKey);
        const now = await this.db.now(tx);
        if (bin.status !== 'online')
          throw new ConflictException(
            `Bin is ${bin.status} and cannot accept deposits.`,
          );
        const hardwareMaterials = bin.materials.filter((material) =>
          ['metal', 'plastic', 'paper'].includes(material),
        );
        const rates = await tx.materialPointRate.count({
          where: { material: { in: hardwareMaterials } },
        });
        if (
          !hardwareMaterials.length ||
          rates !== hardwareMaterials.length ||
          !(await tx.platformSettings.findUnique({ where: { id: 1 } }))
        ) {
          throw new ServiceUnavailableException(
            'Configure the bin reward rates before starting a session.',
          );
        }
        const failures = await tx.binEvent.count({
          where: {
            binId: bin.id,
            action: 'pin_rejected',
            createdAt: { gte: new Date(now.getTime() - 60000) },
          },
        });
        if (failures >= 20)
          throw new HttpException(
            'Too many PIN attempts. Please wait.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        const security = await tx.userSecurity.findUnique({
          where: { pinLookupHash: lookup },
        });
        if (
          !security ||
          !security.pinHash ||
          (security.pinLockedUntil && security.pinLockedUntil > now) ||
          !(await argon2.verify(security.pinHash, dto.identifier))
        ) {
          await tx.binEvent.create({
            data: { binId: bin.id, actor: 'hardware', action: 'pin_rejected' },
          });
          return null; // Do not roll back throttling history on rejection.
        }
        await tx.$queryRaw`SELECT profile_id FROM public.user_security WHERE profile_id = ${security.profileId}::uuid FOR UPDATE`;
        const current = await tx.userSecurity.findUniqueOrThrow({
          where: { profileId: security.profileId },
        });
        if (
          current.pinLookupHash !== lookup ||
          current.pinHash !== security.pinHash ||
          (current.pinLockedUntil && current.pinLockedUntil > now)
        )
          throw new UnauthorizedException(
            'PIN changed or is locked. Please try again.',
          );
        await tx.userSecurity.update({
          where: { profileId: current.profileId },
          data: { failedPinAttempts: 0, pinLockedUntil: null },
        });
        await tx.binSession.updateMany({
          where: {
            status: 'active',
            expiresAt: { lte: now },
            OR: [{ binId: bin.id }, { profileId: security.profileId }],
          },
          data: { status: 'expired', endedAt: now },
        });
        const own = await tx.binSession.findFirst({
          where: { profileId: security.profileId, status: 'active' },
        });
        if (own?.binId === bin.id && own.deviceId === device.id) {
          const resumed = await tx.binSession.update({
            where: { id: own.id },
            data: {
              lastActivityAt: now,
              expiresAt: new Date(now.getTime() + this.config.sessionTtlMs),
            },
          });
          return {
            sessionId: resumed.id,
            expiresAt: resumed.expiresAt,
            resumed: true,
          };
        }
        if (own)
          throw new ConflictException(
            'Account already has an active session at another bin.',
          );
        const occupied = await tx.binSession.findFirst({
          where: { binId: bin.id, status: 'active' },
        });
        if (occupied) {
          throw new ConflictException(
            'Bin has an active session. Wait for it to expire or ask its owner to end it.',
          );
        }
        const session = await tx.binSession.create({
          data: {
            profileId: security.profileId,
            binId: bin.id,
            deviceId: device.id,
            status: 'active',
            createdAt: now,
            startedAt: now,
            lastActivityAt: now,
            expiresAt: new Date(now.getTime() + this.config.sessionTtlMs),
          },
        });
        await tx.binDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
        await tx.bin.update({
          where: { id: bin.id },
          data: { lastSeenAt: now },
        });
        await tx.binEvent.create({
          data: {
            binId: bin.id,
            actor: 'hardware',
            action: 'session_started',
            detail: { sessionId: session.id },
          },
        });
        return {
          sessionId: session.id,
          expiresAt: session.expiresAt,
          resumed: false,
        };
      });
      if (!result)
        throw new UnauthorizedException('Invalid or unavailable PIN.');
      return { data: result };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException(
          'A session is already active. Please retry.',
        );
      throw error;
    }
  }

  async deposit(sessionId: string, dto: RecordDepositDto, deviceKey?: string) {
    const grams = new Prisma.Decimal(String(dto.weight_g)).toDecimalPlaces(3);
    if (grams.lt(5) || grams.gt(this.config.maxWeightGrams))
      throw new BadRequestException(
        `Weight must be between 5 and ${this.config.maxWeightGrams} grams.`,
      );
    const run = () =>
      this.db.transaction(async (tx) => {
        const { bin, device } = await this.controller(tx, dto.binId, deviceKey);
        const existing = await tx.deposit.findUnique({
          where: {
            deviceId_deviceEventId: {
              deviceId: device.id,
              deviceEventId: dto.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (
            existing.sessionId !== sessionId ||
            existing.material !== dto.material ||
            !existing.amount.eq(grams)
          )
            throw new ConflictException(
              'Idempotency key was already used for a different deposit.',
            );
          const wallet = await tx.pointsWallet.findUniqueOrThrow({
            where: { profileId: existing.profileId },
          });
          return {
            depositId: existing.id,
            sessionId,
            points: existing.awardedPoints.toString(),
            balancePoints: wallet.balance.toString(),
            duplicate: true,
          };
        }
        if (bin.status !== 'online')
          throw new ConflictException(
            `Bin is ${bin.status} and cannot accept deposits.`,
          );
        if (!bin.materials.includes(dto.material))
          throw new BadRequestException(
            'Material is not supported by this bin.',
          );
        await tx.$queryRaw`SELECT id FROM public.bin_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
        const session = await tx.binSession.findUnique({
          where: { id: sessionId },
        });
        const now = await this.db.now(tx);
        if (
          !session ||
          session.binId !== bin.id ||
          session.deviceId !== device.id
        )
          throw new NotFoundException(
            'Session not found for this bin controller.',
          );
        if (session.status !== 'active' || session.expiresAt <= now)
          throw new ConflictException(
            'Session has ended or expired. Enter your PIN again.',
          );
        const rate = await tx.materialPointRate.findUnique({
          where: { material: dto.material },
        });
        if (!rate)
          throw new ServiceUnavailableException(
            'Reward rate is not configured for this material.',
          );
        const kilograms = grams.div(1000);
        const points = kilograms.mul(rate.pointsPerKg).toDecimalPlaces(6);
        const deposit = await tx.deposit.create({
          data: {
            profileId: session.profileId,
            sessionId,
            binId: bin.id,
            deviceId: device.id,
            deviceEventId: dto.idempotencyKey,
            material: dto.material,
            measure: 'weight',
            amount: grams,
            weightKg: kilograms,
            status: 'verified',
            awardedPoints: points,
            pointsRate: rate.pointsPerKg,
          },
        });
        if (points.gt(0))
          await tx.pointsLedgerEntry.create({
            data: {
              profileId: session.profileId,
              kind: 'deposit_credit',
              amount: points,
              depositId: deposit.id,
              idempotencyKey: `deposit:${deposit.id}`,
            },
          }); // Database trigger alone updates the points wallet.
        await tx.binSession.update({
          where: { id: sessionId },
          data: {
            lastActivityAt: now,
            expiresAt: new Date(now.getTime() + this.config.sessionTtlMs),
          },
        });
        await tx.binDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
        await tx.bin.update({
          where: { id: bin.id },
          data: { lastSeenAt: now },
        });
        await tx.binEvent.create({
          data: {
            binId: bin.id,
            actor: 'hardware',
            action: 'deposit_recorded',
            detail: {
              depositId: deposit.id,
              material: dto.material,
              weightGrams: grams.toString(),
            },
          },
        });
        await tx.notification.create({
          data: {
            profileId: session.profileId,
            title: `+${points.toString()} points`,
            body: `${grams.toString()}g ${dto.material} recorded at ${bin.code}.`,
            href: '/app/akubin',
          },
        });
        const wallet = await tx.pointsWallet.findUniqueOrThrow({
          where: { profileId: session.profileId },
        });
        return {
          depositId: deposit.id,
          sessionId,
          points: points.toString(),
          balancePoints: wallet.balance.toString(),
          duplicate: false,
        };
      });
    try {
      return { data: await run() };
    } catch (error) {
      // A concurrent insert of the same hardware event is resolved as an idempotent retry.
      if (this.db.isUniqueError(error)) return { data: await run() };
      throw error;
    }
  }

  async telemetry(dto: BinTelemetryDto, deviceKey?: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        const { bin, device } = await this.controller(tx, dto.binId, deviceKey);
        const now = await this.db.now(tx);
        const distance = new Prisma.Decimal(
          String(dto.distance_cm),
        ).toDecimalPlaces(3);
        const valid = distance.gt(2) && distance.lte(500);
        const full = valid && distance.lt(15);
        // Never clear FULL on timeout sentinel 999, zero/near-zero or other invalid readings.
        let status = bin.status;
        if (bin.status !== 'maintenance') {
          if (!valid && bin.status === 'online') status = 'offline';
          else if (full) status = 'full';
          else if (valid && bin.status === 'full') status = 'online';
        }
        const record = await tx.binTelemetry.create({
          data: {
            binId: bin.id,
            deviceId: device.id,
            distanceCm: distance,
            reportedFull: dto.isFull,
            deviceUptimeMs: BigInt(dto.timestamp),
          },
        });
        await tx.bin.update({
          where: { id: bin.id },
          data: {
            status,
            lastSeenAt: now,
            ...(full ? { capacityPct: 100 } : {}),
          },
        });
        await tx.binDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
        await tx.binEvent.create({
          data: {
            binId: bin.id,
            actor: 'hardware',
            action: !valid ? 'sensor_fault' : full ? 'bin_full' : 'fill_report',
            detail: {
              telemetryId: record.id,
              distanceCm: distance.toString(),
              reportedFull: dto.isFull,
            },
          },
        });
        return {
          telemetryId: record.id,
          binId: bin.code,
          status,
          sensorValid: valid,
          receivedAt: record.receivedAt,
        };
      }),
    };
  }
}
