import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '../../../generated/prisma/client';
import { AkubinDatabase } from './akubin-database.service';
import { AkubinConfig } from './akubin-config.service';
import { PIN_HASH_OPTIONS } from './akubin-pin.service';
import { PUBLIC_BIN_SELECT, pageArgs, paginated } from '../akubin.types';
import type {
  CollectionDto,
  CreateBinDto,
  MaintenanceDto,
  UpdateBinDto,
} from '../dto/bin.dto';
import type {
  CreateRewardDto,
  RegisterBinDeviceDto,
  UpdateRewardRulesDto,
} from '../dto/admin.dto';
import type { PaginationDto } from '../dto/pagination.dto';

@Injectable()
export class AkubinAdminService {
  constructor(
    private readonly db: AkubinDatabase,
    private readonly config: AkubinConfig,
  ) {}

  async createBin(actorId: string, dto: CreateBinDto) {
    if (dto.status === null)
      throw new BadRequestException('Bin status cannot be null.');
    try {
      return {
        data: await this.db.transaction(async (tx) => {
          const bin = await tx.bin.create({
            data: { ...dto, code: dto.code.toUpperCase() },
            select: PUBLIC_BIN_SELECT,
          });
          await tx.auditLog.create({
            data: {
              actorId,
              actorLabel: 'staff',
              action: 'akubin.bin_created',
              resourceType: 'bin',
              resourceId: bin.id,
            },
          });
          return bin;
        }),
      };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException('Bin code is already registered.');
      throw error;
    }
  }

  async updateBin(actorId: string, id: string, dto: UpdateBinDto) {
    if (Object.values(dto).some((value) => value === null))
      throw new BadRequestException(
        'Use an omitted field to leave it unchanged; null is not accepted.',
      );
    try {
      return {
        data: await this.db.transaction(async (tx) => {
          await this.db.lockBin(tx, id);
          if (!(await tx.bin.findUnique({ where: { id } })))
            throw new NotFoundException('Bin not found.');
          const bin = await tx.bin.update({
            where: { id },
            data: {
              ...dto,
              ...(dto.code ? { code: dto.code.toUpperCase() } : {}),
              ...(dto.nextCollectionAt
                ? { nextCollectionAt: new Date(dto.nextCollectionAt) }
                : {}),
            },
            select: PUBLIC_BIN_SELECT,
          });
          await tx.auditLog.create({
            data: {
              actorId,
              actorLabel: 'staff',
              action: 'akubin.bin_updated',
              resourceType: 'bin',
              resourceId: id,
            },
          });
          return bin;
        }),
      };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException('Bin code is already registered.');
      throw error;
    }
  }

  async registerDevice(
    actorId: string,
    binId: string,
    dto: RegisterBinDeviceDto,
  ) {
    if (dto.authMode === 'legacy_bin_id' && !this.config.legacyEnabled)
      throw new BadRequestException(
        'Enable the legacy hardware pilot before registering a legacy controller.',
      );
    const deviceKey =
      dto.authMode === 'authenticated' ? randomBytes(32).toString('hex') : null;
    const credentialHash = deviceKey
      ? await argon2.hash(deviceKey, PIN_HASH_OPTIONS)
      : null;
    try {
      return {
        data: await this.db.transaction(async (tx) => {
          await this.db.lockBin(tx, binId);
          if (!(await tx.bin.findUnique({ where: { id: binId } })))
            throw new NotFoundException('Bin not found.');
          if (
            await tx.binDevice.findFirst({ where: { binId, revokedAt: null } })
          )
            throw new ConflictException(
              'Revoke the current controller before registering a replacement.',
            );
          const device = await tx.binDevice.create({
            data: {
              binId,
              serialNumber: dto.serialNumber,
              authMode: dto.authMode,
              credentialHash,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId,
              actorLabel: 'staff',
              action: 'akubin.device_registered',
              resourceType: 'bin_device',
              resourceId: device.id,
            },
          });
          return {
            id: device.id,
            binId,
            serialNumber: device.serialNumber,
            authMode: device.authMode,
            deviceKey,
          };
        }),
      };
    } catch (error) {
      if (this.db.isUniqueError(error))
        throw new ConflictException(
          'Controller serial or active bin controller already exists.',
        );
      throw error;
    }
  }

  async revokeDevice(actorId: string, id: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        const device = await tx.binDevice.findUnique({ where: { id } });
        if (!device) throw new NotFoundException('Controller not found.');
        await this.db.lockBin(tx, device.binId);
        const current = await tx.binDevice.findUniqueOrThrow({ where: { id } });
        if (current.revokedAt) return { id, revoked: true };
        const now = await this.db.now(tx);
        await tx.binDevice.updateMany({
          where: { id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.binSession.updateMany({
          where: { deviceId: id, status: 'active' },
          data: { status: 'revoked', endedAt: now },
        });
        await tx.bin.update({
          where: { id: device.binId },
          data: { status: 'offline' },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.device_revoked',
            resourceType: 'bin_device',
            resourceId: id,
          },
        });
        return { id, revoked: true };
      }),
    };
  }

  async devices(binId: string) {
    return {
      data: await this.db.prisma.binDevice.findMany({
        where: { binId },
        select: {
          id: true,
          binId: true,
          serialNumber: true,
          authMode: true,
          lastSeenAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }

  async history(
    binId: string,
    type: 'events' | 'telemetry' | 'maintenance',
    query: PaginationDto,
  ) {
    if (
      !(await this.db.prisma.bin.findUnique({
        where: { id: binId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Bin not found.');
    if (type === 'events') {
      const [data, total] = await this.db.prisma.$transaction([
        this.db.prisma.binEvent.findMany({
          where: { binId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...pageArgs(query),
        }),
        this.db.prisma.binEvent.count({ where: { binId } }),
      ]);
      return paginated(data, total, query);
    }
    if (type === 'telemetry') {
      const [data, total] = await this.db.prisma.$transaction([
        this.db.prisma.binTelemetry.findMany({
          where: { binId },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          ...pageArgs(query),
        }),
        this.db.prisma.binTelemetry.count({ where: { binId } }),
      ]);
      return paginated(
        data.map((row) => ({
          ...row,
          deviceUptimeMs: row.deviceUptimeMs.toString(),
        })),
        total,
        query,
      );
    }
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.binMaintenanceTicket.findMany({
        where: { binId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.binMaintenanceTicket.count({ where: { binId } }),
    ]);
    return paginated(data, total, query);
  }

  async collect(actorId: string, binId: string, dto: CollectionDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.db.lockBin(tx, binId);
        const bin = await tx.bin.findUnique({ where: { id: binId } });
        if (!bin) throw new NotFoundException('Bin not found.');
        const now = await this.db.now(tx);
        const collection = await tx.binCollection.create({
          data: {
            binId,
            collector: dto.collector,
            recordedById: actorId,
            collectedAt: now,
            capacityAfterPct: 0,
            note: dto.note,
          },
        });
        await tx.bin.update({
          where: { id: binId },
          data: {
            capacityPct: 0,
            collector: dto.collector,
            ...(bin.status === 'full' ? { status: 'online' } : {}),
            ...(dto.nextCollectionAt
              ? { nextCollectionAt: new Date(dto.nextCollectionAt) }
              : {}),
          },
        });
        await tx.binEvent.create({
          data: {
            binId,
            actor: actorId,
            action: 'collection_completed',
            detail: { collectionId: collection.id },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.collection_completed',
            resourceType: 'bin',
            resourceId: binId,
          },
        });
        return collection;
      }),
    };
  }

  async maintenance(actorId: string, binId: string, dto: MaintenanceDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.db.lockBin(tx, binId);
        if (!(await tx.bin.findUnique({ where: { id: binId } })))
          throw new NotFoundException('Bin not found.');
        const ticket = await tx.binMaintenanceTicket.create({
          data: { binId, issue: dto.issue, openedById: actorId },
        });
        await tx.bin.update({
          where: { id: binId },
          data: { status: 'maintenance' },
        });
        await tx.binEvent.create({
          data: {
            binId,
            actor: actorId,
            action: 'maintenance_opened',
            detail: { ticketId: ticket.id },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.maintenance_opened',
            resourceType: 'bin',
            resourceId: binId,
          },
        });
        return ticket;
      }),
    };
  }

  async resolveMaintenance(actorId: string, binId: string, ticketId: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        const ticket = await tx.binMaintenanceTicket.findFirst({
          where: { id: ticketId, binId },
        });
        if (!ticket)
          throw new NotFoundException('Maintenance ticket not found.');
        if (ticket.status === 'resolved') return ticket;
        const updated = await tx.binMaintenanceTicket.update({
          where: { id: ticketId },
          data: {
            status: 'resolved',
            resolvedAt: await this.db.now(tx),
            resolvedById: actorId,
          },
        });
        // Staff explicitly restores availability after inspecting the bin; do not auto-unlock it.
        await tx.binEvent.create({
          data: {
            binId,
            actor: actorId,
            action: 'maintenance_resolved',
            detail: { ticketId },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.maintenance_resolved',
            resourceType: 'bin',
            resourceId: binId,
          },
        });
        return updated;
      }),
    };
  }

  async rules(actorId: string, dto: UpdateRewardRulesDto) {
    if (Object.values(dto).some((value) => value === null))
      throw new BadRequestException('Reward rule values cannot be null.');
    const value = new Prisma.Decimal(dto.pointValueNaira);
    if (value.lte(0))
      throw new BadRequestException('Point value must be positive.');
    for (const rate of dto.rates)
      if (new Prisma.Decimal(rate.pointsPerGram).gt(1000))
        throw new BadRequestException('Points per gram must not exceed 1000.');
    await this.db.transaction(async (tx) => {
      await tx.platformSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          pointValueNaira: value,
          airtimeMinPoints: dto.airtimeMinPoints ?? 100,
          cashMinPoints: dto.cashMinPoints ?? 1000,
        },
        update: {
          pointValueNaira: value,
          airtimeMinPoints: dto.airtimeMinPoints,
          cashMinPoints: dto.cashMinPoints,
          version: { increment: 1 },
        },
      });
      for (const rate of dto.rates) {
        const pointsPerKg = new Prisma.Decimal(rate.pointsPerGram).mul(1000);
        await tx.materialPointRate.upsert({
          where: { material: rate.material },
          create: { material: rate.material, pointsPerKg },
          update: { pointsPerKg },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          actorLabel: 'staff',
          action: 'akubin.reward_rules_updated',
          resourceType: 'platform_settings',
          resourceId: '1',
          detail: {
            pointValueNaira: value.toString(),
            rates: dto.rates.map((rate) => ({
              material: rate.material,
              pointsPerGram: rate.pointsPerGram,
            })),
          },
        },
      });
    });
    return { message: 'Reward rules updated.' };
  }

  async createReward(actorId: string, dto: CreateRewardDto) {
    if (dto.active === null)
      throw new BadRequestException('Reward availability cannot be null.');
    if (dto.valueAmount && new Prisma.Decimal(dto.valueAmount).lte(0))
      throw new BadRequestException('Reward value must be positive.');
    return {
      data: await this.db.transaction(async (tx) => {
        const reward = await tx.reward.create({
          data: { ...dto, automated: false },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.reward_created',
            resourceType: 'reward',
            resourceId: reward.id,
          },
        });
        return reward;
      }),
    };
  }

  async archiveReward(actorId: string, id: string) {
    return {
      data: await this.db.transaction(async (tx) => {
        if (!(await tx.reward.findUnique({ where: { id } })))
          throw new NotFoundException('Reward not found.');
        const reward = await tx.reward.update({
          where: { id },
          data: { active: false },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorLabel: 'staff',
            action: 'akubin.reward_archived',
            resourceType: 'reward',
            resourceId: id,
          },
        });
        return reward;
      }),
    };
  }

  async redemptions(query: PaginationDto) {
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.redemption.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: {
          id: true,
          profileId: true,
          rewardName: true,
          kind: true,
          costPoints: true,
          valueAmount: true,
          currency: true,
          recipientPhone: true,
          status: true,
          reason: true,
          createdAt: true,
        },
      }),
      this.db.prisma.redemption.count(),
    ]);
    return paginated(data, total, query);
  }
}
