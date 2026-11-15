import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { UploadsService } from '../uploads/uploads.service';
import { ArticleDto, UpdateArticleDto, NewsDto } from './dto/content.dto';
@Injectable()
export class ContentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
  ) {}
  async articles(q: PageQuery, admin = false) {
    const where = {
      ...(!admin
        ? { status: 'published' as const, publishedAt: { lte: new Date() } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' as const } },
              {
                category: { contains: q.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [rows, count] = await this.db.prisma.$transaction([
      this.db.prisma.article.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          imageId: true,
          readMinutes: true,
          publishedAt: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.article.count({ where }),
    ]);
    return list(rows, count, q);
  }
  async article(slug: string, admin = false) {
    const row = await this.db.prisma.article.findFirst({
      where: {
        slug,
        ...(!admin
          ? { status: 'published', publishedAt: { lte: new Date() } }
          : {}),
      },
      include: { author: { select: { displayName: true } } },
    });
    if (!row) throw new NotFoundException();
    return { data: row };
  }
  async save(actor: string, dto: ArticleDto | UpdateArticleDto, id?: string) {
    if (Object.values(dto).some((v) => v === null))
      throw new BadRequestException('Null values are not supported.');
    return {
      data: await this.db.transaction(async (tx) => {
        if (dto.imageId)
          await this.uploads.assertReady(
            tx,
            [dto.imageId],
            actor,
            'article_image',
          );
        const old = id ? await tx.article.findUnique({ where: { id } }) : null;
        if (id && !old) throw new NotFoundException();
        const publishedAt =
          dto.status === 'published'
            ? (old?.publishedAt ?? (await this.db.now(tx)))
            : old?.publishedAt;
        const data = { ...dto, publishedAt };
        const row = id
          ? await tx.article.update({ where: { id }, data })
          : await tx.article.create({
              data: { ...(data as ArticleDto), authorId: actor, publishedAt },
            });
        await this.db.audit(tx, actor, 'article_saved', 'article', row.id);
        return row;
      }),
    };
  }
  async bookmark(user: string, id: string, remove = false) {
    if (remove)
      await this.db.prisma.savedArticle.deleteMany({
        where: { profileId: user, articleId: id },
      });
    else {
      if (
        !(await this.db.prisma.article.findFirst({
          where: { id, status: 'published' },
        }))
      )
        throw new NotFoundException();
      await this.db.prisma.savedArticle.upsert({
        where: { profileId_articleId: { profileId: user, articleId: id } },
        create: { profileId: user, articleId: id },
        update: {},
      });
    }
    return { saved: !remove };
  }
  async saved(user: string, q: PageQuery) {
    const where = {
      profileId: user,
      article: { status: 'published' as const },
    };
    const [rows, n] = await this.db.prisma.$transaction([
      this.db.prisma.savedArticle.findMany({
        where,
        include: { article: true },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.savedArticle.count({ where }),
    ]);
    return list(
      rows.map((r) => r.article),
      n,
      q,
    );
  }
  async news(q: PageQuery, admin = false) {
    const where = admin ? {} : { status: 'approved' as const };
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.newsCandidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.newsCandidate.count({ where }),
    ]);
    return list(data, n, q);
  }
  async propose(actor: string, dto: NewsDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const row = await tx.newsCandidate.create({ data: dto });
        await this.db.audit(tx, actor, 'news_proposed', 'news', row.id);
        return row;
      }),
    };
  }
  async decide(actor: string, id: string, status: 'approved' | 'rejected') {
    return {
      data: await this.db.transaction(async (tx) => {
        const row = await tx.newsCandidate.update({
          where: { id },
          data: {
            status,
            reviewedById: actor,
            reviewedAt: await this.db.now(tx),
          },
        });
        await this.db.audit(tx, actor, 'news_reviewed', 'news', id, { status });
        return row;
      }),
    };
  }
}
