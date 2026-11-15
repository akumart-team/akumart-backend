import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../common/platform/database.service';
import { AssistantMessageDto } from './dto/assistant.dto';
@Injectable()
export class AssistantService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}
  private ownership(user?: string, guest?: string) {
    if (user) return { profileId: user };
    if (!guest || !/^[a-f0-9]{64}$/.test(guest))
      throw new BadRequestException(
        'A valid X-Assistant-Guest-Token is required.',
      );
    return {
      profileId: null,
      guestSessionHash: createHash('sha256').update(guest).digest('hex'),
    };
  }
  async history(id: string, user?: string, guest?: string) {
    const row = await this.db.prisma.assistantConversation.findFirst({
      where: { id, ...this.ownership(user, guest) },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!row) throw new NotFoundException('Conversation not found.');
    return { data: { id: row.id, messages: row.messages.reverse() } };
  }
  async message(dto: AssistantMessageDto, user?: string, guest?: string) {
    const url = this.config.get<string>('ASSISTANT_API_URL');
    const key = this.config.get<string>('ASSISTANT_API_KEY');
    if (!url || !url.startsWith('https://') || !key)
      throw new ServiceUnavailableException(
        'The assistant provider has not been configured.',
      );
    const token =
      !user && !dto.conversationId ? randomBytes(32).toString('hex') : guest;
    const owner = this.ownership(user, token);
    const conversation = dto.conversationId
      ? (await this.history(dto.conversationId, user, token)).data
      : await this.db.prisma.assistantConversation.create({ data: owner });
    const history = (
      await this.history(conversation.id, user, token)
    ).data.messages
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    // The provider receives conversation text only. It has no credentials or authority to mutate application data.
    let answer: string;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: dto.message }],
        }),
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error();
      const body = await response.text();
      if (body.length > 40000) throw new Error();
      const result = JSON.parse(body) as { reply?: unknown };
      if (
        typeof result.reply !== 'string' ||
        !result.reply.trim() ||
        result.reply.length > 10000
      )
        throw new Error();
      answer = result.reply;
    } catch {
      throw new BadGatewayException(
        'Assistant provider is unavailable. Please retry.',
      );
    }
    await this.db.transaction(async (tx) => {
      await tx.assistantMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: dto.message,
        },
      });
      await tx.assistantMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: answer,
        },
      });
      await tx.assistantConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: await this.db.now(tx) },
      });
    });
    return {
      data: {
        conversationId: conversation.id,
        reply: answer,
        ...(!user && !dto.conversationId ? { guestToken: token } : {}),
      },
    };
  }
}
