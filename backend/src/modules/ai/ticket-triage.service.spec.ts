import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { TriageProviderService } from './triage-provider.service.js';
import { TicketTriageService } from './ticket-triage.service.js';
import { TriageError } from './triage-result.js';

const claimed = {
  ticket_id: 'ticket-1',
  ticket_code: 'TK-1234',
  subject: 'Không đăng nhập được',
  ai_attempts: 1,
};
const result = {
  sentiment: 'frustrated',
  confidence: 0.9,
  isUrgent: true,
  urgencyScore: 0.95,
  keywords: ['gấp'],
  reason: 'Cần xử lý gấp.',
};

describe('TicketTriageService', () => {
  let service: TicketTriageService;
  let database: { query: ReturnType<typeof vi.fn> };
  let messages: { findOne: ReturnType<typeof vi.fn> };
  let openai: {
    isReady: ReturnType<typeof vi.fn>;
    analyze: ReturnType<typeof vi.fn>;
    model: string;
    timeoutMs: number;
    retryAt: string | null;
    blockedCode: string | null;
  };
  let builder: Record<
    'update' | 'set' | 'where' | 'setParameter' | 'execute',
    ReturnType<typeof vi.fn>
  >;
  let tickets: {
    update: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    database = {
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([claimed]),
    };
    messages = {
      findOne: vi.fn().mockResolvedValue({
        content: 'Tôi cần hỗ trợ gấp, toàn hệ thống ngừng hoạt động.',
      }),
    };
    openai = {
      isReady: vi.fn(() => true),
      analyze: vi.fn().mockResolvedValue(result),
      model: 'gpt-4.1-mini',
      timeoutMs: 20000,
      retryAt: null,
      blockedCode: null,
    };
    builder = {
      update: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
      setParameter: vi.fn(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    for (const method of ['update', 'set', 'where', 'setParameter'] as const)
      builder[method].mockReturnValue(builder);
    tickets = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(() => builder),
    };
    service = new TicketTriageService(
      database as unknown as DataSource,
      tickets as unknown as Repository<Ticket>,
      messages as unknown as Repository<TicketMessage>,
      openai as unknown as TriageProviderService,
      { get: () => 0.8 } as unknown as ConfigService,
    );
  });

  afterEach(() => vi.useRealTimers());

  it.each([false, true])(
    'spaces calls to different tickets even after a failure (%s)',
    async (failFirst) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-07T08:00:00Z'));
      if (failFirst)
        openai.analyze.mockRejectedValueOnce(new TriageError('AI_TIMEOUT'));
      await service.processPendingTickets();
      expect(openai.analyze).toHaveBeenCalledTimes(1);
      database.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { ...claimed, ticket_id: 'ticket-2', ticket_code: 'TK-5678' },
        ]);
      vi.advanceTimersByTime(14999);
      await service.processPendingTickets();
      expect(openai.analyze).toHaveBeenCalledTimes(1);
      expect(database.query).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(1);
      await service.processPendingTickets();
      expect(openai.analyze).toHaveBeenCalledTimes(2);
      expect(database.query).toHaveBeenCalledTimes(4);
    },
  );

  it('does not consume attempts on other tickets while OpenAI is in cooldown', async () => {
    openai.retryAt = new Date(Date.now() + 82968000).toISOString();
    await service.processPendingTickets();
    expect(database.query).not.toHaveBeenCalled();
    expect(openai.analyze).not.toHaveBeenCalled();
  });

  it('does not claim more tickets when OpenAI needs billing/configuration action', async () => {
    openai.blockedCode = 'AI_CREDIT_BALANCE_EXHAUSTED';
    await service.processPendingTickets();
    expect(database.query).not.toHaveBeenCalled();
    expect(openai.analyze).not.toHaveBeenCalled();
  });

  it('preserves the ticket and records a permanent billing error without retry', async () => {
    openai.analyze.mockRejectedValue(
      new TriageError('AI_CREDIT_BALANCE_EXHAUSTED', false),
    );
    await service.processPendingTickets();
    expect(builder.set).not.toHaveBeenCalled();
    expect(tickets.update).toHaveBeenCalledWith(expect.any(Object), {
      ai_status: 'failed',
      ai_error: 'AI_CREDIT_BALANCE_EXHAUSTED',
      ai_next_attempt_at: null,
    });
  });

  it('persists the provider retry deadline instead of retrying a daily limit after 30 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T09:00:00Z'));
    openai.analyze.mockRejectedValue(
      new TriageError('AI_HTTP_429', true, 82968000),
    );
    await service.processPendingTickets();
    expect(tickets.update).toHaveBeenCalledWith(expect.any(Object), {
      ai_status: 'pending',
      ai_error: 'AI_HTTP_429',
      ai_next_attempt_at: new Date(Date.now() + 82968000),
    });
  });

  it('does no work or external calls when disabled', async () => {
    openai.isReady.mockReturnValue(false);
    await service.processPendingTickets();
    expect(database.query).not.toHaveBeenCalled();
    expect(openai.analyze).not.toHaveBeenCalled();
  });

  it('does not analyze if another worker claimed all eligible tickets', async () => {
    database.query.mockReset().mockResolvedValue([]);
    await service.processPendingTickets();
    expect(openai.analyze).not.toHaveBeenCalled();
  });

  it('persists validated scores and protects the write with the attempt number', async () => {
    await service.processPendingTickets();
    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment_label: 'frustrated',
        sentiment_score: 0.9,
        urgency_score: 0.95,
        ai_status: 'completed',
        ai_model: 'gpt-4.1-mini',
        ai_error: null,
      }),
    );
    expect(builder.where).toHaveBeenCalledWith(expect.any(String), {
      id: 'ticket-1',
      status: 'processing',
      attempt: 1,
    });
    expect(builder.setParameter).toHaveBeenCalledWith('bump', true);
  });

  it('does not bump a frustrated but non-urgent ticket', async () => {
    openai.analyze.mockResolvedValue({
      ...result,
      isUrgent: false,
      urgencyScore: 0.2,
    });
    await service.processPendingTickets();
    expect(builder.setParameter).toHaveBeenCalledWith('bump', false);
  });

  it('leaves ticket data intact on a transient failure and schedules a retry', async () => {
    openai.analyze.mockRejectedValue(new TriageError('AI_TIMEOUT'));
    await service.processPendingTickets();
    expect(builder.set).not.toHaveBeenCalled();
    expect(tickets.update).toHaveBeenCalledWith(
      { ticket_id: 'ticket-1', ai_status: 'processing', ai_attempts: 1 },
      {
        ai_status: 'pending',
        ai_error: 'AI_TIMEOUT',
        ai_next_attempt_at: expect.any(Date),
      },
    );
  });

  it('stops retrying a permanent credential failure', async () => {
    openai.analyze.mockRejectedValue(new TriageError('AI_HTTP_403', false));
    await service.processPendingTickets();
    expect(tickets.update).toHaveBeenCalledWith(expect.any(Object), {
      ai_status: 'failed',
      ai_error: 'AI_HTTP_403',
      ai_next_attempt_at: null,
    });
  });

  it('marks the third failed attempt for investigation', async () => {
    database.query
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ...claimed, ai_attempts: 3 }]);
    openai.analyze.mockRejectedValue(new TriageError('AI_HTTP_429'));
    await service.processPendingTickets();
    expect(tickets.update).toHaveBeenCalledWith(
      expect.objectContaining({ ai_attempts: 3 }),
      {
        ai_status: 'failed',
        ai_error: 'AI_HTTP_429',
        ai_next_attempt_at: null,
      },
    );
  });

  it('prevents overlapping ticks while waiting for OpenAI', async () => {
    let finish!: (value: unknown) => void;
    openai.analyze.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = service.processPendingTickets();
    await vi.waitFor(() => expect(openai.analyze).toHaveBeenCalledTimes(1));
    await service.processPendingTickets();
    expect(database.query).toHaveBeenCalledTimes(2);
    finish(result);
    await first;
  });

  it('can run again after a storage error', async () => {
    database.query
      .mockReset()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue([]);
    await service.processPendingTickets();
    await service.processPendingTickets();
    expect(database.query).toHaveBeenCalledTimes(3);
  });
});
