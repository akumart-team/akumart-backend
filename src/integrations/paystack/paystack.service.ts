import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
export function minorUnits(value: Prisma.Decimal) {
  const n = value.mul(100);
  if (!n.isInteger() || !n.isPositive() || n.gt(Number.MAX_SAFE_INTEGER))
    throw new ServiceUnavailableException(
      'Amount cannot be represented safely by the payment provider.',
    );
  return n.toNumber();
}
@Injectable()
export class PaystackService {
  constructor(private readonly config: ConfigService) {}
  async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!key)
      throw new ServiceUnavailableException(
        'Paystack has not been configured.',
      );
    try {
      const response = await fetch(`https://api.paystack.co${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const result = (await response.json()) as { status: boolean; data: T };
      if (!response.ok || !result.status)
        throw new BadGatewayException(
          'Paystack could not complete the request. Reconcile the existing reference before retrying.',
        );
      return result.data;
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      throw new BadGatewayException(
        'Paystack is unavailable. The pending reference is retained for reconciliation.',
      );
    }
  }
  callbackUrl() {
    const url = this.config.get<string>('PAYSTACK_CALLBACK_URL');
    if (!url || !/^https?:\/\//.test(url))
      throw new ServiceUnavailableException(
        'PAYSTACK_CALLBACK_URL must be configured.',
      );
    return url;
  }
  requireTransfers() {
    if (this.config.get<string>('PAYSTACK_TRANSFERS_ENABLED') !== 'true')
      throw new ServiceUnavailableException(
        'Paystack transfers must be enabled after configuring the merchant balance and transfer approval policy.',
      );
  }
  verifySignature(body: Buffer | undefined, modern?: string, legacy?: string) {
    if (!body) throw new UnauthorizedException('Raw webhook body required.');
    const compare = (expected: Buffer, hex: string) =>
      /^[a-f0-9]{128}$/i.test(hex) &&
      timingSafeEqual(expected, Buffer.from(hex, 'hex'));
    if (modern) {
      const parts = modern.split(',').map((x) => x.trim());
      const timestamp = parts.find((x) => x.startsWith('t='))?.slice(2) ?? '';
      const secret = this.config.get<string>('PAYSTACK_WEBHOOK_SECRET');
      if (
        !secret ||
        !/^\d+$/.test(timestamp) ||
        Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
      )
        throw new UnauthorizedException('Invalid webhook signature.');
      const expected = createHmac('sha512', secret)
        .update(timestamp)
        .update('.')
        .update(body)
        .digest();
      if (
        !parts
          .filter((x) => x.startsWith('v1='))
          .some((x) => compare(expected, x.slice(x.lastIndexOf(':') + 1)))
      )
        throw new UnauthorizedException('Invalid webhook signature.');
      return;
    }
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (
      !key ||
      !legacy ||
      !compare(createHmac('sha512', key).update(body).digest(), legacy)
    )
      throw new UnauthorizedException('Invalid webhook signature.');
  }
}
