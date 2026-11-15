import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, paging, list } from '../../common/platform/query.dto';
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}
  async all(id: string, q: PageQuery) {
    const where = { profileId: id };
    const [data, total, unreadCount] = await this.db.prisma.$transaction([
      this.db.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paging(q),
      }),
      this.db.prisma.notification.count({ where }),
      this.db.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { ...list(data, total, q), unreadCount };
  }
  async read(user: string, id?: string) {
    const result = await this.db.prisma.notification.updateMany({
      where: { profileId: user, ...(id ? { id } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    if (
      id &&
      !result.count &&
      !(await this.db.prisma.notification.findFirst({
        where: { id, profileId: user },
      }))
    )
      throw new NotFoundException('Notification not found.');
    return { data: { updated: result.count } };
  }
}
