import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import type {
  PreferencesDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/user.dto';
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}
  async me(id: string) {
    return {
      data: await this.db.prisma.profile.findUniqueOrThrow({
        where: { id },
        include: {
          preferences: true,
          verifications: {
            select: {
              id: true,
              level: true,
              type: true,
              status: true,
              reason: true,
              expiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          staff: { select: { role: true, active: true } },
          partner: { select: { id: true, status: true } },
        },
      }),
    };
  }
  async update(id: string, dto: UpdateProfileDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const profile = await tx.profile.update({ where: { id }, data: dto });
        await this.db.audit(tx, id, 'profile.updated', 'profile', id);
        return profile;
      }),
    };
  }
  async preferences(id: string, dto: UpdatePreferencesDto, onboard = false) {
    return {
      data: await this.db.transaction(async (tx) => {
        const old = await tx.userPreferences.findUniqueOrThrow({
          where: { profileId: id },
        });
        const marketRole = dto.marketRole ?? old.marketRole;
        const activeMode =
          dto.activeMode ??
          (marketRole === 'both'
            ? (old.activeMode ?? 'buyer')
            : marketRole === 'buyer' || marketRole === 'seller'
              ? marketRole
              : null);
        if (activeMode && marketRole !== 'both' && marketRole !== activeMode)
          throw new BadRequestException(
            'Active mode must match marketplace role.',
          );
        const preferences = await tx.userPreferences.update({
          where: { profileId: id },
          data: {
            marketRole,
            activeMode,
            ...(dto.akubin !== undefined ? { akubin: dto.akubin } : {}),
            ...(dto.interests !== undefined
              ? { interests: dto.interests }
              : {}),
          },
        });
        if (onboard) {
          const profile = await tx.profile.findUniqueOrThrow({ where: { id } });
          if (
            !profile.firstName.trim() ||
            !profile.lastName.trim() ||
            !profile.displayName?.trim() ||
            !profile.phone ||
            !/^\+?\d{10,15}$/.test(profile.phone) ||
            !profile.city ||
            profile.city.trim().length < 2 ||
            (!profile.termsAcceptedAt && dto.acceptedTerms !== true) ||
            marketRole === 'none'
          )
            throw new BadRequestException(
              'Complete your name, display name, phone, city, account role and accepted terms before finishing setup.',
            );
          await tx.profile.update({
            where: { id },
            data: {
              profileCompleted: true,
              onboardedAt: profile.onboardedAt ?? (await this.db.now(tx)),
              ...(!profile.termsAcceptedAt && dto.acceptedTerms === true
                ? {
                    termsAcceptedAt: await this.db.now(tx),
                    termsVersion: '1.0',
                  }
                : {}),
            },
          });
        }
        return preferences;
      }),
    };
  }
  complete(id: string, dto: PreferencesDto) {
    return this.preferences(id, dto, true);
  }
  async dashboard(id: string) {
    const [
      listings,
      incomingOffers,
      outgoingOffers,
      purchases,
      sales,
      recentOrders,
    ] = await this.db.prisma.$transaction([
      this.db.prisma.listing.count({ where: { sellerId: id } }),
      this.db.prisma.offer.count({
        where: { sellerId: id, status: 'awaiting_seller' },
      }),
      this.db.prisma.offer.count({
        where: { buyerId: id, status: 'awaiting_buyer' },
      }),
      this.db.prisma.order.count({ where: { buyerId: id } }),
      this.db.prisma.order.count({ where: { sellerId: id } }),
      this.db.prisma.order.findMany({
        where: { OR: [{ buyerId: id }, { sellerId: id }] },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          paymentStatus: true,
          quantity: true,
          unitPrice: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      data: {
        listings,
        incomingOffers,
        outgoingOffers,
        purchases,
        sales,
        recentOrders,
      },
    };
  }
}
