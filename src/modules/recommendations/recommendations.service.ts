import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { ListingsService } from '../listings/listings.service';
import { ListingQuery } from '../listings/dto/listing.dto';
import { RecommendationEventDto } from './dto/recommendation.dto';
const algorithm = 'preferences-recency-v1';
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly listings: ListingsService,
  ) {}
  async listingsFor(user?: string, relatedId?: string) {
    const profile = user
      ? await this.db.prisma.profile.findUnique({
          where: { id: user },
          include: { preferences: true },
        })
      : null;
    const q = new ListingQuery();
    q.limit = 100;
    if (relatedId) {
      const listing = await this.listings.detail(relatedId);
      q.material = listing.data.material;
      q.excludeId = relatedId;
    }
    const result = await this.listings.browse(q);
    const dismissed = user
      ? await this.db.prisma.recommendationEvent.findMany({
          where: {
            profileId: user,
            resourceType: 'listing',
            action: 'dismiss',
          },
          select: { resourceId: true },
          distinct: ['resourceId'],
        })
      : [];
    const data = result.data
      .filter(
        (l) =>
          l.sellerId !== user && !dismissed.some((d) => d.resourceId === l.id),
      )
      .map((l) => ({
        ...l,
        score:
          (profile?.city && l.city === profile.city ? 2 : 0) +
          (profile?.preferences?.interests.some(
            (i) => i.toLowerCase() === l.material.toLowerCase(),
          )
            ? 3
            : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ score, ...l }) => ({
        ...l,
        reason: score
          ? 'Matches your location or interests'
          : relatedId
            ? 'Similar material'
            : 'Recently published',
      }));
    return { data, algorithm, personalized: !!user };
  }
  async articles(user?: string) {
    const prefs = user
      ? await this.db.prisma.userPreferences.findUnique({
          where: { profileId: user },
        })
      : null;
    const rows = await this.db.prisma.article.findMany({
      where: { status: 'published', publishedAt: { lte: new Date() } },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        category: true,
        imageId: true,
        readMinutes: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });
    return {
      data: rows
        .sort(
          (a, b) =>
            Number(prefs?.interests.some((i) => i === b.category) ?? false) -
            Number(prefs?.interests.some((i) => i === a.category) ?? false),
        )
        .slice(0, 12),
      algorithm,
      personalized: !!user,
    };
  }
  async jobs(user: string) {
    const p = await this.db.prisma.partner.findFirst({
      where: { ownerId: user, status: 'approved' },
    });
    if (!p) return { data: [], algorithm };
    return {
      data: await this.db.prisma.order.findMany({
        where: {
          status: 'awaiting_quotes',
          quoteDeadline: { gt: new Date() },
          notices: { some: { partnerId: p.id, declinedAt: null } },
        },
        select: {
          id: true,
          title: true,
          material: true,
          quantity: true,
          unit: true,
          pickupCity: true,
          pickupArea: true,
          proposedFare: true,
          quoteDeadline: true,
        },
        take: 12,
        orderBy: { quoteDeadline: 'asc' },
      }),
      algorithm,
    };
  }
  async event(user: string, dto: RecommendationEventDto) {
    let visible = false;
    if (dto.resourceType === 'listing') {
      await this.listings.detail(dto.resourceId);
      visible = true;
    }
    if (dto.resourceType === 'article')
      visible = !!(await this.db.prisma.article.count({
        where: { id: dto.resourceId, status: 'published' },
      }));
    if (dto.resourceType === 'job')
      visible = !!(await this.db.prisma.order.count({
        where: {
          id: dto.resourceId,
          status: 'awaiting_quotes',
          quoteDeadline: { gt: new Date() },
          notices: {
            some: {
              partner: { ownerId: user, status: 'approved' },
              declinedAt: null,
            },
          },
        },
      }));
    if (!visible) throw new NotFoundException('Resource unavailable.');
    await this.db.prisma.recommendationEvent.create({
      data: { ...dto, profileId: user, algorithmVersion: algorithm },
    });
    return { recorded: true };
  }
}
