import { afterEach, describe, expect, it, vi } from 'vitest';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TicketsModule } from './tickets.module.js';
import { EmailModule } from '../email/email.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { EmailService } from '../email/email.service.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { TicketsGateway } from './tickets.gateway.js';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { ConversationQueryDto } from './dto/conversation-query.dto.js';

afterEach(() => vi.unstubAllGlobals());

describe('Sprint 5 integration regressions', () => {
  it('resolves both channel services through the real Tickets/Email/Telegram module graph', async () => {
    const ticket = {
      ticket_id: 'id',
      ticket_code: 'TK-1234',
      subject: 'test',
      channel: { channel_type: 'email' },
      customer: { email: 'customer@example.test', telegram_chat_id: '123' },
    };
    const ticketRepo = { findOne: vi.fn(async () => ticket) };
    const messageRepo = {
      create: (x: unknown) => x,
      save: async (x: object) => ({
        ...x,
        message_id: 'msg',
        created_at: new Date(),
      }),
    };
    @Global()
    @Module({
      providers: [
        {
          provide: DataSource,
          useValue: {
            options: { type: 'postgres' },
            entityMetadatas: [],
            getRepository: (entity: unknown) =>
              entity === Ticket
                ? ticketRepo
                : entity === TicketMessage
                  ? messageRepo
                  : {},
          },
        },
      ],
      exports: [DataSource],
    })
    class DatabaseStubModule {}
    const email = { sendEmail: vi.fn(async () => 'message-id') };
    const telegram = { sendTelegramMessage: vi.fn(async () => {}) };
    const app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              TELEGRAM_BOT_TOKEN: 'test-token',
              jwt: { secret: 'ab'.repeat(32), expiresIn: '1h' },
            }),
          ],
        }),
        DatabaseStubModule,
        TicketsModule,
        EmailModule,
        TelegramModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue(email)
      .overrideProvider(TelegramService)
      .useValue(telegram)
      .compile();
    try {
      const gateway = app.get(TicketsGateway);
      gateway.server = { to: () => ({ emit: vi.fn() }) } as never;
      const service = app.get(OutboundDispatcherService);
      expect(
        (await service.sendReply('TK-1234', 'agent', { content: 'hello' }))
          .delivered,
      ).toBe(true);
      expect(email.sendEmail).toHaveBeenCalledOnce();
      ticket.channel.channel_type = 'telegram';
      expect(
        (await service.sendReply('TK-1234', 'agent', { content: 'hello' }))
          .delivered,
      ).toBe(true);
      expect(telegram.sendTelegramMessage).toHaveBeenCalledOnce();
      telegram.sendTelegramMessage.mockRejectedValueOnce(
        new Error('TELEGRAM_DELIVERY_FAILED'),
      );
      expect(
        (await service.sendReply('TK-1234', 'agent', { content: 'hello' }))
          .delivered,
      ).toBe(false);
    } finally {
      await app.close();
    }
  });

  it.each([
    { page: 'abc' },
    { page: '1.5' },
    { page: '0' },
    { limit: 'abc' },
    { limit: '101' },
    { limit: '0' },
  ])('rejects invalid pagination %j', async (query) => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(
      pipe.transform(query, { type: 'query', metatype: ConversationQueryDto }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('uses default pagination and transforms valid numbers', async () => {
    const pipe = new ValidationPipe({ transform: true });
    const metadata = { type: 'query' as const, metatype: ConversationQueryDto };
    expect(await pipe.transform({}, metadata)).toEqual({ page: 1, limit: 20 });
    expect(await pipe.transform({ page: '2', limit: '10' }, metadata)).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it.each([403, 429, 500, 200])(
    'rejects Telegram failure status %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: status === 200,
          status,
          json: async () => ({ ok: false }),
        })),
      );
      const telegram = new TelegramService(
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        telegram.sendTelegramMessage('secret', 123, 'hello'),
      ).rejects.toThrow('TELEGRAM_DELIVERY_FAILED');
    },
  );

  it('rejects Telegram network failure without leaking token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('https://api.telegram.org/botsecret');
      }),
    );
    const telegram = new TelegramService({} as never, {} as never, {} as never);
    await expect(
      telegram.sendTelegramMessage('secret', 123, 'hello'),
    ).rejects.toThrow(/^TELEGRAM_DELIVERY_FAILED$/);
  });
});
