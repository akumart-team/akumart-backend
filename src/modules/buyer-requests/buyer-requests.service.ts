import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  DatabaseService,
  type Tx,
} from '../../common/platform/database.service';
import { TradePolicy } from '../../common/platform/trade-policy.service';
import { PageQuery, paging, list } from '../../common/platform/query.dto';
import type {
  CreateBuyerRequestDto,
  RequestResponseDto,
  SendRequestResponseDto,
  EditRequestResponseDto,
  ReviewRequestResponseDto,
} from './dto/request.dto';
@Injectable()
export class BuyerRequestsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: TradePolicy,
  ) {}
  async browse(q: PageQuery, user?: string) {
    const scope = user
      ? { buyerId: user }
      : {
          status: 'open' as const,
          needBy: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        };
    const where: Prisma.BuyerRequestWhereInput = {
      ...scope,
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { city: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
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
    await this.policy.requireMode(user, 'buyer');
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
  private checkTerms(
    row: { quantity: Prisma.Decimal },
    dto: RequestResponseDto,
  ) {
    if (
      new Prisma.Decimal(dto.quantity).lte(0) ||
      new Prisma.Decimal(dto.quantity).gt(row.quantity) ||
      new Prisma.Decimal(dto.unitPrice).lte(0)
    )
      throw new BadRequestException('Invalid quantity or price.');
  }
  private checkOpen(row: { status: string; needBy: Date }) {
    if (
      row.status !== 'open' ||
      row.needBy < new Date(new Date().toISOString().slice(0, 10))
    )
      throw new ConflictException('This request is closed or expired.');
  }
  private checkVersion(expected: string | undefined, updatedAt: Date) {
    if (expected && Date.parse(expected) !== updatedAt.getTime())
      throw new ConflictException(
        'This response has changed. Reload it before continuing.',
      );
  }
  private snapshot(row: {
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    note: string | null;
    status: string;
    updatedAt: Date;
  }) {
    return {
      quantity: row.quantity.toString(),
      unitPrice: row.unitPrice.toString(),
      note: row.note,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private async nextTime(tx: Tx, previous: Date) {
    const now = await this.db.now(tx);
    return new Date(Math.max(now.getTime(), previous.getTime() + 1));
  }
  async respond(user: string, id: string, dto: SendRequestResponseDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.policy.require(user, 'basic', tx);
        await tx.$queryRaw`SELECT id FROM buyer_requests WHERE id = ${id}::uuid FOR UPDATE`;
        const request = await tx.buyerRequest.findUniqueOrThrow({
          where: { id },
        });
        this.checkOpen(request);
        if (request.buyerId === user)
          throw new ConflictException(
            'You cannot respond to your own request.',
          );
        this.checkTerms(request, dto);
        const existing = await tx.buyerRequestResponse.findUnique({
          where: { requestId_sellerId: { requestId: id, sellerId: user } },
        });
        if (existing && existing.status !== 'declined')
          throw new ConflictException(
            existing.status === 'sent'
              ? 'Your response is awaiting a decision. Edit it instead of sending a duplicate.'
              : 'This response has been shortlisted and cannot be changed.',
          );
        if (existing)
          this.checkVersion(dto.expectedUpdatedAt, existing.updatedAt);
        const { expectedUpdatedAt, ...terms } = dto;
        const response = existing
          ? await tx.buyerRequestResponse.update({
              where: { id: existing.id },
              data: {
                ...terms,
                status: 'sent',
                updatedAt: await this.nextTime(tx, existing.updatedAt),
              },
            })
          : await tx.buyerRequestResponse.create({
              data: { requestId: id, sellerId: user, ...terms },
            });
        await this.db.audit(
          tx,
          user,
          existing
            ? 'buyer_request.response_resubmitted'
            : 'buyer_request.response_created',
          'buyer_request_response',
          response.id,
          {
            before: existing ? this.snapshot(existing) : null,
            after: this.snapshot(response),
          },
        );
        await this.db.notify(
          tx,
          request.buyerId,
          existing ? 'Supplier resubmitted a response' : 'New request response',
          request.title,
          '/app/requests',
        );
        return response;
      }),
    };
  }
  async edit(
    user: string,
    requestId: string,
    responseId: string,
    dto: EditRequestResponseDto,
  ) {
    return {
      data: await this.db.transaction(async (tx) => {
        await this.policy.require(user, 'basic', tx);
        await tx.$queryRaw`SELECT id FROM buyer_request_responses WHERE id = ${responseId}::uuid FOR UPDATE`;
        const previous = await tx.buyerRequestResponse.findFirst({
          where: { id: responseId, requestId, sellerId: user },
          include: { request: true },
        });
        if (!previous) throw new NotFoundException('Response not found.');
        this.checkOpen(previous.request);
        if (previous.status !== 'sent')
          throw new ConflictException(
            'Only a response awaiting the buyer decision can be edited.',
          );
        this.checkVersion(dto.expectedUpdatedAt, previous.updatedAt);
        this.checkTerms(previous.request, dto);
        const { expectedUpdatedAt, ...terms } = dto;
        const updated = await tx.buyerRequestResponse.update({
          where: { id: responseId },
          data: {
            ...terms,
            updatedAt: await this.nextTime(tx, previous.updatedAt),
          },
        });
        await this.db.audit(
          tx,
          user,
          'buyer_request.response_updated',
          'buyer_request_response',
          responseId,
          { before: this.snapshot(previous), after: this.snapshot(updated) },
        );
        await this.db.notify(
          tx,
          previous.request.buyerId,
          'Supplier updated a response',
          previous.request.title,
          '/app/requests',
        );
        return updated;
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
        await tx.$queryRaw`SELECT id FROM buyer_request_responses WHERE id = ${responseId}::uuid FOR UPDATE`;
        const previous = await tx.buyerRequestResponse.findFirst({
          where: { id: responseId, requestId, request: { buyerId: user } },
        });
        if (!previous) throw new NotFoundException('Response not found.');
        this.checkVersion(dto.expectedUpdatedAt, previous.updatedAt);
        const updated = await tx.buyerRequestResponse.update({
          where: { id: responseId },
          data: {
            status: dto.status,
            updatedAt: await this.nextTime(tx, previous.updatedAt),
          },
        });
        await this.db.audit(
          tx,
          user,
          'buyer_request.response_reviewed',
          'buyer_request_response',
          responseId,
          { before: this.snapshot(previous), after: this.snapshot(updated) },
        );
        return updated;
      }),
    };
  }
}
