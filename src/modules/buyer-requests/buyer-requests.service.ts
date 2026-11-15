import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../../common/platform/database.service';
import { TradePolicy } from '../../common/platform/trade-policy.service';
import { PageQuery, paging, list } from '../../common/platform/query.dto';
import type {
  CreateBuyerRequestDto,
  RequestResponseDto,
  ReviewRequestResponseDto,
} from './dto/request.dto';
@Injectable()
export class BuyerRequestsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
  ) {}
  async browse(q: PageQuery, user?: string) {
    const where = user
      ? { buyerId: user }
      : {
          status: 'open' as const,
          needBy: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        };
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.buyerRequest.findMany({
        where,
        include: user ? { responses: true } : undefined,
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.buyerRequest.count({ where }),
    ]);
    return list(data, total, q);
  }
  async create(user: string, dto: CreateBuyerRequestDto) {
    if (
      new Prisma.Decimal(dto.quantity).lte(0) ||
      new Prisma.Decimal(dto.maxUnitPrice).lte(0) ||
      new Date(dto.needBy) < new Date(new Date().toISOString().slice(0, 10))
    )
      throw new BadRequestException(
        'Positive quantities/prices and a current/future need-by date are required.',
      );
    await this.policy.require(user, 'basic');
    return {
      data: await this.db.prisma.buyerRequest.create({
        data: { ...dto, needBy: new Date(dto.needBy), buyerId: user },
      }),
    };
  }
  async detail(user: string, id: string) {
    const row = await this.db.prisma.buyerRequest.findUnique({
      where: { id },
      include: {
        responses: {
          where: { OR: [{ sellerId: user }, { request: { buyerId: user } }] },
        },
      },
    });
    if (
      !row ||
      (row.status !== 'open' && row.buyerId !== user && !row.responses.length)
    )
      throw new NotFoundException('Request not found.');
    return { data: row };
  }
  async respond(user: string, id: string, dto: RequestResponseDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.policy.require(user, 'basic', tx);
        const row = await tx.buyerRequest.findUniqueOrThrow({ where: { id } });
        if (
          row.buyerId === user ||
          row.status !== 'open' ||
          row.needBy < new Date(new Date().toISOString().slice(0, 10))
        )
          throw new ConflictException(
            'Request is closed or belongs to this account.',
          );
        if (
          new Prisma.Decimal(dto.quantity).lte(0) ||
          new Prisma.Decimal(dto.quantity).gt(row.quantity) ||
          new Prisma.Decimal(dto.unitPrice).lte(0)
        )
          throw new BadRequestException('Invalid quantity or price.');
        const response = await tx.buyerRequestResponse.create({
          data: { requestId: id, sellerId: user, ...dto },
        });
        await this.db.notify(
          tx,
          row.buyerId,
          'New request response',
          row.title,
          '/app/requests',
        );
        return response;
      }),
    };
  }
  async review(
    user: string,
    requestId: string,
    responseId: string,
    dto: ReviewRequestResponseDto,
  ) {
    if (dto.status === 'sent')
      throw new BadRequestException('Choose shortlisted or declined.');
    return {
      data: await this.db.transaction(async (tx) => {
        const response = await tx.buyerRequestResponse.findFirst({
          where: { id: responseId, requestId, request: { buyerId: user } },
        });
        if (!response) throw new NotFoundException('Response not found.');
        return tx.buyerRequestResponse.update({
          where: { id: responseId },
          data: { status: dto.status },
        });
      }),
    };
  }
}
