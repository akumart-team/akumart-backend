import {
  BadGatewayException,
  GoneException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantMessageDto } from './dto/assistant.dto';
@Injectable()
export class AssistantService {
  constructor(private readonly config: ConfigService) {}
  history() {
    throw new GoneException('Chat history is not stored. Start a new chat.');
  }
  async message(dto: AssistantMessageDto, user?: string) {
    const url = this.config.get<string>('ASSISTANT_API_URL');
    const key = this.config.get<string>('ASSISTANT_API_KEY');
    if (!url?.startsWith('https://'))
      throw new ServiceUnavailableException(
        'The assistant provider has not been configured.',
      );
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          user_id: user || 'guest_user',
          session_id: dto.sessionId,
          message: dto.message,
          conversation_history: dto.history || [],
        }),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 40000) throw new Error();
      const body = JSON.parse(text) as Record<string, unknown>;
      if (
        typeof body.reply !== 'string' ||
        !body.reply.trim() ||
        body.reply.length > 10000
      )
        throw new Error();
      const strings = (value: unknown) =>
        Array.isArray(value)
          ? value
              .filter(
                (item): item is string =>
                  typeof item === 'string' && item.length <= 500,
              )
              .slice(0, 6)
          : [];
      const escalation = body.escalation as { required?: unknown } | null;
      return {
        data: {
          reply: body.reply,
          escalateToHuman:
            body.escalate_to_human === true || escalation?.required === true,
          quickSuggestions: strings(body.quick_suggestions),
          relatedRoutes: strings(body.related_routes),
        },
      };
    } catch {
      throw new BadGatewayException(
        'Assistant is unavailable. Please retry or contact support.',
      );
    }
  }
}
