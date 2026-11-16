import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeBin = (value: unknown) =>
  typeof value === 'string' &&
  (uuid.test(value) || /^AKUBIN[-_][A-Z0-9_-]{1,64}$/i.test(value))
    ? value
    : undefined;
const segments = new Set([
  'api',
  'akubin',
  'admin',
  'webhooks',
  'akubin-telemetry',
  'bins',
  'locations',
  'reward-rules',
  'rewards',
  'leaderboard',
  'sessions',
  'phone-pin',
  'deposits',
  'me',
  'pin',
  'summary',
  'wallet',
  'points-ledger',
  'end',
  'redemptions',
  'devices',
  'events',
  'telemetry',
  'collections',
  'maintenance-tickets',
  'resolve',
  'decision',
  'fulfillment',
]);
function endpoint(req: Request): string {
  // Never log the raw URL/query: invalid path parameters may contain a PIN or phone.
  return req.originalUrl
    .split('?')[0]
    .split('/')
    .map((segment) =>
      !segment || segments.has(segment) || /^v[1-9][0-9]?$/.test(segment)
        ? segment
        : ':id',
    )
    .join('/');
}
function secrets(req: Request) {
  const values: string[] = [];
  const collect = (body: unknown, depth: number) => {
    if (!body || typeof body !== 'object' || depth > 3) return;
    for (const [key, value] of Object.entries(body).slice(0, 100)) {
      if (
        /pin|identifier|phone|email|password|token|secret|key/i.test(key) &&
        (typeof value === 'string' || typeof value === 'number')
      ) {
        if (String(value).length >= 3) values.push(String(value));
      } else if (typeof value === 'object') collect(value, depth + 1);
    }
  };
  collect(req.body, 0);
  collect(req.query, 0);
  for (const name of ['authorization', 'cookie', 'x-akubin-device-key']) {
    const value = req.get(name);
    if (value) {
      values.push(value);
      if (name === 'authorization')
        values.push(value.replace(/^Bearer\s+/i, ''));
    }
  }
  return values.sort((a, b) => b.length - a.length);
}
function safeMessage(value: string, hidden: string[]) {
  let message = value;
  for (const secret of hidden)
    message = message.split(secret).join('[REDACTED]');
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/(?:https?|postgres(?:ql)?):\/\/\S+/gi, '[URL]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN]')
    .replace(/\+?\b[0-9]{6,}\b/g, '[NUMBER]')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 300);
}

@Injectable()
export class AkubinHttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AkuBinHTTP');

  use(
    req: Request & { user?: { id?: string } },
    res: Response,
    next: NextFunction,
  ) {
    const requestId = randomUUID();
    const started = performance.now();
    const route = endpoint(req);
    const hidden = secrets(req);
    const auth = req.get('authorization')
      ? 'bearer'
      : req.get('x-akubin-device-key')
        ? 'device-key'
        : 'none';
    const base = { requestId, method: req.method, endpoint: route, auth };
    res.setHeader('X-Request-ID', requestId);
    this.logger.log(
      JSON.stringify({ event: 'akubin.request.started', ...base }),
    );
    let errors: string[] | undefined;
    let createdSessionId: string | undefined;
    const originalJson = res.json;
    res.json = function (body: unknown) {
      if (
        res.statusCode < 400 &&
        route.endsWith('/sessions/phone-pin') &&
        body &&
        typeof body === 'object'
      ) {
        const session = (body as { data?: { sessionId?: unknown } }).data
          ?.sessionId;
        if (typeof session === 'string' && uuid.test(session))
          createdSessionId = session;
      }
      if (res.statusCode >= 400) {
        if (res.statusCode >= 500) errors = ['Internal server error'];
        else {
          const value =
            body && typeof body === 'object'
              ? (body as { message?: unknown }).message
              : undefined;
          const messages = Array.isArray(value) ? value : [value];
          errors = messages
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 8)
            .map((item) =>
              safeMessage(item, [
                ...hidden,
                ...secrets(req),
                ...Object.values(req.params).filter(
                  (value): value is string => typeof value === 'string',
                ),
              ]),
            );
        }
      }
      return originalJson.call(this, body);
    };
    let completed = false;
    const finish = (aborted: boolean) => {
      if (completed) return;
      completed = true;
      const status = aborted ? 499 : res.statusCode;
      const binId =
        safeBin(req.body?.binId) ||
        safeBin(req.params?.code) ||
        (route.includes('/bins/') ? safeBin(req.params?.id) : undefined);
      const sessionId =
        typeof req.params?.id === 'string' &&
        route.includes('/sessions/') &&
        uuid.test(req.params.id)
          ? req.params.id
          : createdSessionId;
      const userId =
        typeof req.user?.id === 'string' && uuid.test(req.user.id)
          ? req.user.id
          : undefined;
      const entry = JSON.stringify({
        event: aborted ? 'akubin.request.aborted' : 'akubin.request.completed',
        ...base,
        status,
        outcome: aborted ? 'aborted' : status >= 400 ? 'error' : 'success',
        durationMs: Math.round((performance.now() - started) * 10) / 10,
        ...(userId ? { userId } : {}),
        ...(binId ? { binId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(errors?.length ? { errors } : {}),
      });
      if (status >= 500) this.logger.error(entry);
      else if (status >= 400) this.logger.warn(entry);
      else this.logger.log(entry);
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(!res.writableFinished));
    next();
  }
}
