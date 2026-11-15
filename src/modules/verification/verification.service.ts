import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../common/platform/database.service';
import { PageQuery, paging, list } from '../../common/platform/query.dto';
import { UploadsService } from '../uploads/uploads.service';
import type {
  SubmitVerificationDto,
  VerificationDecisionDto,
} from './dto/verification.dto';
@Injectable()
export class VerificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly uploads: UploadsService,
  ) {}
  async own(id: string) {
    const data = await this.db.prisma.verificationSubmission.findMany({
      where: { profileId: id },
      include: { documents: true, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }
  async submit(id: string, dto: SubmitVerificationDto) {
    if (
      JSON.stringify(dto.data).length > 10000 ||
      Object.values(dto.data).some(
        (v) => typeof v !== 'string' || v.length > 2000,
      )
    )
      throw new BadRequestException(
        'Verification fields must be short strings.',
      );
    return {
      data: await this.db.transaction(async (tx) => {
        if (
          await tx.verificationSubmission.findFirst({
            where: {
              profileId: id,
              level: dto.level,
              status: { in: ['collecting', 'checking', 'pending_review'] },
            },
          })
        )
          throw new ConflictException(
            'An application is already under review.',
          );
        if (
          dto.level === 'full' &&
          !(await tx.verificationSubmission.findFirst({
            where: {
              profileId: id,
              level: 'basic',
              type: dto.type,
              status: 'approved',
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          }))
        )
          throw new BadRequestException(
            'Matching basic verification must be approved first.',
          );
        await this.uploads.assertReady(
          tx,
          dto.documents.map((d) => d.uploadId),
          id,
          'verification_document',
        );
        const row = await tx.verificationSubmission.create({
          data: {
            profileId: id,
            level: dto.level,
            type: dto.type,
            data: dto.data,
            documents: { create: dto.documents },
            events: {
              create: {
                actorId: id,
                action: 'submitted',
                status: 'pending_review',
              },
            },
          },
        });
        return row;
      }),
    };
  }
  async queue(q: PageQuery) {
    const [data, total] = await this.db.prisma.$transaction([
      this.db.prisma.verificationSubmission.findMany({
        include: {
          documents: true,
          events: { orderBy: { createdAt: 'asc' } },
          profile: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...paging(q),
      }),
      this.db.prisma.verificationSubmission.count(),
    ]);
    return list(data, total, q);
  }
  async decide(actor: string, id: string, dto: VerificationDecisionDto) {
    return {
      data: await this.db.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.verification_submissions WHERE id = ${id}::uuid FOR UPDATE`;
        const row = await tx.verificationSubmission.findUniqueOrThrow({
          where: { id },
        });
        if (row.profileId === actor)
          throw new BadRequestException(
            'Staff cannot review their own verification.',
          );
        if (!['pending_review', 'checking', 'collecting'].includes(row.status))
          throw new ConflictException('Application is no longer open.');
        const now = await this.db.now(tx);
        const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
        if (expiresAt && expiresAt <= now)
          throw new BadRequestException(
            'Verification expiry must be in the future.',
          );
        if (dto.decision === 'approved') {
          if (
            row.level === 'full' &&
            !(await tx.verificationSubmission.findFirst({
              where: {
                profileId: row.profileId,
                level: 'basic',
                type: row.type,
                status: 'approved',
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            }))
          )
            throw new ConflictException(
              'Matching basic verification is required.',
            );
          const previous = await tx.verificationSubmission.findMany({
            where: {
              profileId: row.profileId,
              level: row.level,
              status: 'approved',
            },
          });
          for (const old of previous) {
            await tx.verificationSubmission.update({
              where: { id: old.id },
              data: { status: 'superseded' },
            });
            await tx.verificationEvent.create({
              data: {
                submissionId: old.id,
                actorId: actor,
                action: 'superseded',
                status: 'superseded',
                reason: 'Replaced by a new approved submission.',
              },
            });
          }
        }
        const updated = await tx.verificationSubmission.update({
          where: { id },
          data: {
            status: dto.decision,
            reason: dto.reason,
            reviewedById: actor,
            reviewedAt: now,
            expiresAt,
          },
        });
        await tx.verificationEvent.create({
          data: {
            submissionId: id,
            actorId: actor,
            action: 'reviewed',
            status: dto.decision,
            reason: dto.reason,
          },
        });
        await this.db.audit(
          tx,
          actor,
          'verification.reviewed',
          'verification',
          id,
          { decision: dto.decision },
        );
        await this.db.notify(
          tx,
          row.profileId,
          'Verification updated',
          dto.reason,
          '/app/verification',
        );
        return updated;
      }),
    };
  }
}
