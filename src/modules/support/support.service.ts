import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, paging, list } from '../../common/platform/query.dto';
import type { TicketDto, EnquiryDto, UpdateTicketDto } from './dto/support.dto';
@Injectable()
export class SupportService {
  constructor(private readonly db: DatabaseService) {}
  async ticket(dto: TicketDto, user?: string) {
    if (dto.channel === 'dispute')
      throw new BadRequestException(
        'Open order disputes through the order endpoint.',
      );
    return {
      data: await this.db.prisma.supportTicket.create({
        data: { ...dto, requesterId: user, priority: 'normal' },
        select: { id: true, status: true, createdAt: true },
      }),
    };
  }
  async enquiry(dto: EnquiryDto) {
    if (
      JSON.stringify(dto.data).length > 10000 ||
      Object.values(dto.data).some(
        (v) => typeof v !== 'string' || v.length > 5000,
      )
    )
      throw new BadRequestException(
        'Enquiry data must contain short string values.',
      );
    return {
      data: await this.db.prisma.enquiry.create({
        data: dto,
        select: { id: true, createdAt: true },
      }),
    };
  }
  async tickets(q: PageQuery, user?: string) {
    const where = user ? { requesterId: user } : {};
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.supportTicket.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paging(q),
      }),
      this.db.prisma.supportTicket.count({ where }),
    ]);
    return list(data, total, q);
  }
  async enquiries(q: PageQuery) {
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.enquiry.findMany({
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.enquiry.count(),
    ]);
    return list(data, total, q);
  }
  async update(actor: string, id: string, dto: UpdateTicketDto) {
    if (Object.values(dto).some((v) => v === null))
      throw new BadRequestException('Null ticket updates are not supported.');
    return {
      data: await this.db.transaction(async (tx) => {
        if (!(await tx.supportTicket.findUnique({ where: { id } })))
          throw new NotFoundException('Ticket not found.');
        if (dto.assigneeId) {
          const staff = await tx.staffMembership.findUnique({
            where: { profileId: dto.assigneeId },
          });
          if (
            !staff?.active ||
            !['super', 'support', 'operations'].includes(staff.role)
          )
            throw new BadRequestException(
              'Assignee must be active support/operations staff.',
            );
        }
        const row = await tx.supportTicket.update({
          where: { id },
          data: {
            ...dto,
            ...(dto.status
              ? {
                  resolvedAt:
                    dto.status === 'resolved' ? await this.db.now(tx) : null,
                }
              : {}),
          },
        });
        await this.db.audit(tx, actor, 'ticket.updated', 'support_ticket', id);
        return row;
      }),
    };
  }
}
