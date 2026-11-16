import { pointsValueNaira } from './points-value';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { AkubinDatabase } from './akubin-database.service';
import { PUBLIC_BIN_SELECT, pageArgs, paginated } from '../akubin.types';
import {
  LeaderboardPeriod,
  type LeaderboardQueryDto,
} from '../dto/account.dto';
import type { BinQueryDto } from '../dto/bin.dto';
import type { PaginationDto } from '../dto/pagination.dto';

@Injectable()
export class AkubinReadService {
  constructor(private readonly db: AkubinDatabase) {}

  async bins(query: BinQueryDto) {
    const where: Prisma.BinWhereInput = {
      ...(query.city
        ? { city: { equals: query.city, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.material ? { materials: { has: query.material } } : {}),
    };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.bin.findMany({
        where,
        select: PUBLIC_BIN_SELECT,
        orderBy: { code: 'asc' },
        ...pageArgs(query),
      }),
      this.db.prisma.bin.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async bin(code: string) {
    const bin = await this.db.prisma.bin.findUnique({
      where: { code },
      select: PUBLIC_BIN_SELECT,
    });
    if (!bin) throw new NotFoundException('Bin not found.');
    return { data: bin };
  }

  async rules() {
    const [settings, rates] = await this.db.prisma.$transaction([
      this.db.prisma.platformSettings.findUnique({ where: { id: 1 } }),
      this.db.prisma.materialPointRate.findMany({
        orderBy: { material: 'asc' },
      }),
    ]);
    if (!settings)
      throw new ServiceUnavailableException(
        'AkuBin reward rules are not configured.',
      );
    return {
      data: {
        pointValueNaira: settings.pointValueNaira.toString(),
        airtimeMinPoints: settings.airtimeMinPoints,
        cashMinPoints: settings.cashMinPoints,
        rates: rates.map((rate) => ({
          material: rate.material,
          pointsPerKg: rate.pointsPerKg.toString(),
          pointsPerGram: rate.pointsPerKg.div(1000).toString(),
        })),
        updatedAt: settings.updatedAt,
      },
    };
  }

  async wallet(profileId: string) {
    const [wallet, settings] = await this.db.prisma.$transaction([
      this.db.prisma.pointsWallet.findUnique({
        where: { profileId },
        select: { balance: true, updatedAt: true },
      }),
      this.db.prisma.platformSettings.findUnique({
        where: { id: 1 },
        select: { pointValueNaira: true },
      }),
    ]);
    if (!wallet) throw new NotFoundException('Points wallet not found.');
    return {
      data: {
        balancePoints: wallet.balance.toString(),
        balanceValueNaira: pointsValueNaira(
          wallet.balance,
          settings?.pointValueNaira,
        ),
        pointValueNaira: settings?.pointValueNaira.toString() ?? null,
        updatedAt: wallet.updatedAt,
      },
    };
  }

  async summary(profileId: string) {
    const [wallet, totals, depositCount, redemptions, settings] =
      await this.db.prisma.$transaction([
        this.db.prisma.pointsWallet.findUnique({ where: { profileId } }),
        this.db.prisma.deposit.aggregate({
          where: { profileId, status: 'verified' },
          _sum: { weightKg: true, awardedPoints: true },
          _count: true,
        }),
        this.db.prisma.deposit.count({ where: { profileId } }),
        this.db.prisma.redemption.count({ where: { profileId } }),
        this.db.prisma.platformSettings.findUnique({
          where: { id: 1 },
          select: { pointValueNaira: true },
        }),
      ]);
    if (!wallet) throw new NotFoundException('Points wallet not found.');
    return {
      data: {
        balancePoints: wallet.balance.toString(),
        balanceValueNaira: pointsValueNaira(
          wallet.balance,
          settings?.pointValueNaira,
        ),
        pointValueNaira: settings?.pointValueNaira.toString() ?? null,
        lifetimeEarnedPoints: totals._sum.awardedPoints?.toString() ?? '0',
        lifetimeEarnedValueNaira: pointsValueNaira(
          totals._sum.awardedPoints ?? new Prisma.Decimal(0),
          settings?.pointValueNaira,
        ),
        weightKg: totals._sum.weightKg?.toString() ?? '0',
        depositCount,
        verifiedDepositCount: totals._count,
        redemptionCount: redemptions,
      },
    };
  }

  async ledger(profileId: string, query: PaginationDto) {
    const where = { profileId };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.pointsLedgerEntry.findMany({
        where,
        select: {
          id: true,
          kind: true,
          amount: true,
          depositId: true,
          redemptionId: true,
          reason: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.pointsLedgerEntry.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async deposits(profileId: string, query: PaginationDto) {
    const where = { profileId };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.deposit.findMany({
        where,
        select: {
          id: true,
          sessionId: true,
          material: true,
          measure: true,
          amount: true,
          weightKg: true,
          awardedPoints: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
          bin: { select: { code: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.deposit.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  private sessionSelect = {
    id: true,
    status: true,
    startedAt: true,
    lastActivityAt: true,
    expiresAt: true,
    endedAt: true,
    bin: { select: { code: true, name: true } },
  } satisfies Prisma.BinSessionSelect;

  private async expireOwnSessions(profileId: string) {
    await this.db.transaction(async (tx) => {
      const now = await this.db.now(tx);
      await tx.binSession.updateMany({
        where: { profileId, status: 'active', expiresAt: { lte: now } },
        data: { status: 'expired', endedAt: now },
      });
    });
  }

  async sessions(profileId: string, query: PaginationDto) {
    await this.expireOwnSessions(profileId);
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.binSession.findMany({
        where: { profileId },
        select: this.sessionSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.db.prisma.binSession.count({ where: { profileId } }),
    ]);
    return paginated(data, total, query);
  }

  async session(profileId: string, id: string) {
    await this.expireOwnSessions(profileId);
    const data = await this.db.prisma.binSession.findFirst({
      where: { id, profileId },
      select: this.sessionSelect,
    });
    if (!data) throw new NotFoundException('Session not found.');
    return { data };
  }

  async end(profileId: string, id: string) {
    await this.db.transaction(async (tx) => {
      const session = await tx.binSession.findFirst({
        where: { id, profileId },
      });
      if (!session) throw new NotFoundException('Session not found.');
      await this.db.lockBin(tx, session.binId);
      const now = await this.db.now(tx);
      await tx.binSession.updateMany({
        where: { id, profileId, status: 'active' },
        data: {
          status: session.expiresAt <= now ? 'expired' : 'ended',
          endedAt: now,
        },
      });
    });
    return this.session(profileId, id);
  }

  async leaderboard(query: LeaderboardQueryDto) {
    const now = new Date();
    let since: Date | null = null;
    if (query.period === LeaderboardPeriod.week) {
      since = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      since.setUTCDate(since.getUTCDate() - ((since.getUTCDay() + 6) % 7));
    } else if (query.period === LeaderboardPeriod.month)
      since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const filter = Prisma.sql`d.status = 'verified' ${since ? Prisma.sql`AND d.created_at >= ${since}` : Prisma.empty}
      ${query.city ? Prisma.sql`AND lower(p.city) = lower(${query.city})` : Prisma.empty}`;
    const rows = await this.db.prisma.$queryRaw<
      {
        name: string;
        city: string | null;
        points: string;
        weightKg: string;
        total: bigint;
      }[]
    >(Prisma.sql`
      SELECT COALESCE(NULLIF(p.display_name, ''), NULLIF(trim(p.first_name || ' ' || p.last_name), ''), 'Member') AS name,
        p.city, sum(d.awarded_points)::text AS points, sum(d.weight_kg)::text AS "weightKg", count(*) OVER() AS total
      FROM public.deposits d JOIN public.profiles p ON p.id = d.profile_id WHERE ${filter}
      GROUP BY p.id ORDER BY sum(d.awarded_points) DESC, p.id ASC OFFSET ${(query.page - 1) * query.limit} LIMIT ${query.limit}`);
    const total = rows[0]
      ? Number(rows[0].total)
      : (
          await this.db.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
          SELECT count(DISTINCT d.profile_id) AS total FROM public.deposits d
          JOIN public.profiles p ON p.id = d.profile_id WHERE ${filter}`)
        )[0].total;
    return paginated(
      rows.map((row, index) => ({
        rank: (query.page - 1) * query.limit + index + 1,
        name: row.name,
        city: row.city,
        points: row.points,
        weightKg: row.weightKg,
      })),
      Number(total),
      query,
    );
  }
}
