import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatabaseService,
  type Tx,
} from '../../common/platform/database.service';
import { PageQuery, list, paging } from '../../common/platform/query.dto';
import { Prisma } from '../../generated/prisma/client';
import { kilograms } from '../../common/platform/order-math';
import { UploadsService } from '../uploads/uploads.service';
import {
  PartnerApplicationDto,
  PartnerDecisionDto,
  QuoteDto,
  DeliveryEventDto,
  DeliveryProofDto,
} from './dto/partner.dto';
@Injectable()
export class PartnersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
  ) {}
  async partner(tx: Tx, user: string, approved = true) {
    const p = await tx.partner.findUnique({ where: { ownerId: user } });
    if (!p || (approved && p.status !== 'approved'))
      throw new ForbiddenException(
        'An approved logistics partner account is required.',
      );
    return p;
  }
  async apply(user: string, dto: PartnerApplicationDto) {
    if (
      new Set(dto.documents.map((d) => d.kind)).size !== 4 ||
      new Prisma.Decimal(dto.capacityKg).lte(0)
    )
      throw new BadRequestException(
        'Four different required document kinds and positive capacity are required.',
      );
    return {
      data: await this.db.transaction(async (tx) => {
        const old = await tx.partner.findUnique({ where: { ownerId: user } });
        if (old && old.status !== 'rejected')
          throw new ConflictException('An application already exists.');
        await this.uploads.assertReady(
          tx,
          dto.documents.map((d) => d.uploadId),
          user,
          'partner_document',
        );
        const { documents, ...fields } = dto;
        if (old)
          await tx.partnerDocument.deleteMany({ where: { partnerId: old.id } });
        const data = {
          ...fields,
          status: 'pending' as const,
          reason: null,
          reviewedAt: null,
          reviewedById: null,
          documents: { create: documents },
        };
        return old
          ? tx.partner.update({ where: { id: old.id }, data })
          : tx.partner.create({ data: { ...data, ownerId: user } });
      }),
    };
  }
  async me(user: string) {
    return {
      data: await this.db.prisma.partner.findUnique({
        where: { ownerId: user },
        include: {
          documents: true,
          _count: { select: { assignments: true, quotes: true } },
        },
      }),
    };
  }
  async queue(q: PageQuery) {
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.partner.findMany({
        include: { documents: true },
        orderBy: { appliedAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.partner.count(),
    ]);
    return list(data, n, q);
  }
  async decision(actor: string, id: string, dto: PartnerDecisionDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        const p = await tx.partner.findUnique({ where: { id } });
        if (!p) throw new NotFoundException();
        if (p.ownerId === actor)
          throw new ForbiddenException(
            'You cannot review your own application.',
          );
        if (
          dto.status === 'approved' &&
          (await tx.partnerDocument.count({
            where: { partnerId: id, upload: { status: 'ready' } },
          })) !== 4
        )
          throw new ConflictException('Four ready documents are required.');
        const result = await tx.partner.update({
          where: { id },
          data: {
            ...dto,
            reviewedAt: await this.db.now(tx),
            reviewedById: actor,
          },
        });
        await this.db.audit(tx, actor, 'partner_reviewed', 'partner', id, {
          ...dto,
        });
        await this.db.notify(
          tx,
          p.ownerId,
          'Partner application updated',
          dto.reason,
          '/partner',
        );
        return result;
      }),
    };
  }
  async jobs(user: string, q: PageQuery, assigned = false) {
    const p = await this.partner(this.db.prisma, user);
    const where: Prisma.OrderWhereInput = assigned
      ? { assignment: { partnerId: p.id } }
      : {
          status: 'awaiting_quotes',
          quoteDeadline: { gt: new Date() },
          notices: { some: { partnerId: p.id, declinedAt: null } },
        };
    const [data, n] = await this.db.prisma.$transaction([
      this.db.prisma.order.findMany({
        where,
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
          status: true,
          ...(assigned
            ? {
                destination: true,
                assignment: true,
                buyer: { select: { displayName: true, phone: true } },
                seller: { select: { displayName: true, phone: true } },
              }
            : {}),
          quotes: { where: { partnerId: p.id } },
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.order.count({ where }),
    ]);
    return list(data, n, q);
  }
  async quote(user: string, id: string, dto: QuoteDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const p = await this.partner(tx, user);
        const job = await tx.order.findFirst({
          where: {
            id,
            status: 'awaiting_quotes',
            quoteDeadline: { gt: await this.db.now(tx) },
            notices: { some: { partnerId: p.id, declinedAt: null } },
          },
        });
        if (!job) throw new NotFoundException('Job unavailable.');
        if (
          p.capacityKg.lt(kilograms(job.quantity, job.unit)) ||
          !p.materials.includes(job.material) ||
          !p.serviceAreas.includes(job.pickupCity)
        )
          throw new ConflictException(
            'Partner does not meet this delivery requirement.',
          );
        if (
          [job.buyerId, job.sellerId].includes(user) ||
          new Prisma.Decimal(dto.amount).lte(0)
        )
          throw new BadRequestException('Invalid quote.');
        return tx.deliveryQuote.upsert({
          where: { orderId_partnerId: { orderId: id, partnerId: p.id } },
          create: { orderId: id, partnerId: p.id, ...dto },
          update: { ...dto, status: 'submitted' },
        });
      }),
    };
  }
  async decline(user: string, id: string, reason: string) {
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await this.partner(tx, user);
      const job = await tx.order.findFirst({
        where: {
          id,
          status: 'awaiting_quotes',
          notices: { some: { partnerId: p.id } },
        },
      });
      if (!job) throw new NotFoundException();
      await tx.jobNotice.update({
        where: { orderId_partnerId: { orderId: id, partnerId: p.id } },
        data: { declinedAt: await this.db.now(tx), declineReason: reason },
      });
      await tx.deliveryQuote.updateMany({
        where: { orderId: id, partnerId: p.id, status: 'submitted' },
        data: { status: 'declined' },
      });
      return { message: 'Job declined.' };
    });
  }
  async progress(
    user: string,
    id: string,
    dto: DeliveryEventDto | DeliveryProofDto,
  ) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
        const p = await this.partner(tx, user);
        const job = await tx.order.findFirst({
          where: { id, assignment: { partnerId: p.id } },
        });
        if (!job) throw new NotFoundException();
        const proof = 'uploadId' in dto;
        const status = proof ? 'proof_uploaded' : dto.status;
        const allowed = {
          picked_up: ['paid'],
          in_transit: ['picked_up'],
          delivered: ['picked_up', 'in_transit'],
          proof_uploaded: ['delivered'],
        };
        if (
          job.paymentStatus !== 'held' ||
          !allowed[status].includes(job.status)
        )
          throw new ConflictException('Invalid delivery transition.');
        if (proof) {
          await this.uploads.assertReady(
            tx,
            [dto.uploadId],
            user,
            'delivery_proof',
          );
          await tx.deliveryProof.create({
            data: { orderId: id, submittedById: user, ...dto },
          });
        }
        const now = await this.db.now(tx);
        const result = await tx.order.update({
          where: { id },
          data: {
            status,
            version: { increment: 1 },
            ...(proof
              ? {
                  inspectionDue: new Date(
                    now.getTime() + job.inspectionHours * 3600000,
                  ),
                }
              : {}),
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            actorId: user,
            actorLabel: 'partner',
            action: status,
            status,
            detail: { note: dto.note ?? '' },
          },
        });
        await this.db.notify(
          tx,
          job.buyerId,
          'Delivery updated',
          status,
          `/app/orders/${id}`,
        );
        return result;
      }),
    };
  }
}
