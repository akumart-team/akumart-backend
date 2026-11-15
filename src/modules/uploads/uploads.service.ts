import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  DatabaseService,
  type Tx,
} from '../../common/platform/database.service';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import type { UploadPurpose } from '../../generated/prisma/enums';
import type { IncomingFile } from './dto/upload.dto';
@Injectable()
export class UploadsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}
  private get bucket() {
    const b = this.config.get<string>('UPLOADS_BUCKET');
    if (!b)
      throw new ServiceUnavailableException(
        'Private upload bucket is not configured.',
      );
    return b;
  }
  async create(user: string, purpose: UploadPurpose, file?: IncomingFile) {
    if (!file?.size)
      throw new BadRequestException('A non-empty file is required.');
    const b = file.buffer;
    const actual = b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? 'image/jpeg'
      : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : b.toString('ascii', 0, 4) === 'RIFF' &&
            b.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : b.toString('ascii', 0, 5) === '%PDF-'
            ? 'application/pdf'
            : null;
    if (
      !actual ||
      actual !== file.mimetype ||
      (['listing_image', 'campaign_creative', 'article_image'].includes(
        purpose,
      ) &&
        !actual.startsWith('image/'))
    )
      throw new BadRequestException(
        'File signature/type is not supported for this purpose.',
      );
    const bucket = this.bucket;
    const id = randomUUID();
    const storageKey = `${purpose}/${user}/${id}`;
    await this.db.prisma.upload.create({
      data: {
        id,
        uploadedById: user,
        purpose,
        provider: 'supabase',
        storageKey,
        originalName: file.originalname.slice(0, 200),
        mimeType: actual,
        sizeBytes: BigInt(file.size),
      },
    });
    const { error } = await this.supabase.admin.storage
      .from(bucket)
      .upload(storageKey, b, { contentType: actual, upsert: false });
    if (error) {
      await this.db.prisma.upload.update({
        where: { id },
        data: { status: 'rejected' },
      });
      throw new ServiceUnavailableException(
        'File storage failed. Please retry the upload.',
      );
    }
    await this.db.prisma.upload.update({
      where: { id },
      data: { status: 'ready' },
    });
    return {
      data: {
        id,
        purpose,
        originalName: file.originalname.slice(0, 200),
        mimeType: actual,
        sizeBytes: String(file.size),
        status: 'ready',
      },
    };
  }
  async assertReady(
    tx: Tx,
    ids: string[],
    user: string,
    purpose: UploadPurpose,
  ) {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate files are not allowed.');
    const count = await tx.upload.count({
      where: { id: { in: ids }, uploadedById: user, purpose, status: 'ready' },
    });
    if (count !== ids.length)
      throw new BadRequestException(
        'Files must be ready, owned by this account, and match their attachment purpose.',
      );
  }
  async access(id: string, user?: string) {
    const upload = await this.db.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.status !== 'ready')
      throw new NotFoundException('File not found.');
    let allowed = user === upload.uploadedById;
    if (!allowed) {
      if (upload.purpose === 'listing_image')
        allowed = !!(await this.db.prisma.listingImage.findFirst({
          where: {
            uploadId: id,
            listing: {
              status: 'published',
              seller: {
                verifications: {
                  some: {
                    level: 'basic',
                    status: 'approved',
                    OR: [
                      { expiresAt: null },
                      { expiresAt: { gt: new Date() } },
                    ],
                  },
                },
              },
            },
          },
        }));
      if (upload.purpose === 'article_image')
        allowed = !!(await this.db.prisma.article.findFirst({
          where: { imageId: id, status: 'published' },
        }));
      if (upload.purpose === 'campaign_creative')
        allowed = !!(await this.db.prisma.campaign.findFirst({
          where: {
            imageId: id,
            status: 'approved',
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
            payments: { some: { status: 'succeeded' } },
          },
        }));
    }
    if (!allowed && user) {
      const staff = await this.db.prisma.staffMembership.findUnique({
        where: { profileId: user },
      });
      allowed =
        !!staff?.active &&
        (['super', 'support', 'operations'].includes(staff.role) ||
          (staff.role === 'content' &&
            ['article_image', 'campaign_creative'].includes(upload.purpose)) ||
          (staff.role === 'finance' &&
            ['delivery_proof', 'dispute_evidence'].includes(upload.purpose)));
      if (
        !allowed &&
        ['delivery_proof', 'dispute_evidence'].includes(upload.purpose)
      ) {
        const proof = await this.db.prisma.deliveryProof.findFirst({
          where: {
            uploadId: id,
            order: {
              OR: [
                { buyerId: user },
                { sellerId: user },
                { assignment: { partner: { ownerId: user } } },
              ],
            },
          },
        });
        const evidence = await this.db.prisma.disputeEvidence.findFirst({
          where: {
            uploadId: id,
            dispute: { order: { OR: [{ buyerId: user }, { sellerId: user }] } },
          },
        });
        allowed = !!(proof || evidence);
      }
    }
    if (!allowed) throw new ForbiddenException('File access is not permitted.');
    const { data, error } = await this.supabase.admin.storage
      .from(this.bucket)
      .createSignedUrl(upload.storageKey, 300);
    if (error || !data?.signedUrl)
      throw new ServiceUnavailableException('Unable to issue file access.');
    return { data: { id, url: data.signedUrl, expiresIn: 300 } };
  }
}
