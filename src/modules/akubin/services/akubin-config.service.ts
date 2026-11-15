import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AkubinConfig {
  constructor(private readonly config: ConfigService) {}

  private number(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new ServiceUnavailableException(
        `Invalid server configuration: ${key}`,
      );
    }
    return value;
  }

  get sessionTtlMs() {
    return this.number('AKUBIN_SESSION_TTL_SECONDS', 300, 60, 3600) * 1000;
  }
  get maxWeightGrams() {
    return this.number('AKUBIN_MAX_DEPOSIT_GRAMS', 100000, 5, 1000000);
  }
  get legacyEnabled() {
    return this.config.get<string>('AKUBIN_ALLOW_LEGACY_HARDWARE') === 'true';
  }
  get pinSecret() {
    const secret = this.config.get<string>('AKUBIN_PIN_LOOKUP_SECRET');
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException(
        'AkuBin PIN lookup secret is not configured.',
      );
    return secret;
  }
}
