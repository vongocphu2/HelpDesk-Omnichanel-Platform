import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { TriageProviderService } from './triage-provider.service.js';
import { shouldBumpPriority, TriageError } from './triage-result.js';

interface ClaimedTicket {
  ticket_id: string;
  ticket_code: string;
  subject: string;
  ai_attempts: number;
}

@Injectable()
export class TicketTriageService implements OnModuleInit {
  private readonly logger = new Logger(TicketTriageService.name);
  private running = false;
  private nextRequestAt = 0;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messages: Repository<TicketMessage>,
    private readonly provider: TriageProviderService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      this.provider.isReady()
        ? `[AI TRIAGE READY] model=${this.provider.model}; interval=5s; min_request_interval=15s`
        : '[AI TRIAGE DISABLED] Kiểm tra AI_TRIAGE_ENABLED, LLM_PROVIDER, LLM_MODEL, GEMINI_API_KEY/OPENAI_API_KEY.',
    );
  }

  // Sprint 3: durable database polling. BullMQ integration remains Sprint 6.
  // Reads only committed tickets; never holds an intake transaction while calling AI.
  @Interval(5000)
  async processPendingTickets(): Promise<void> {
    if (
      this.running ||
      !this.provider.isReady() ||
      this.provider.blockedCode ||
      this.provider.retryAt ||
      Date.now() < this.nextRequestAt
    )
      return;
    this.running = true;
    try {
      // Recover a process crash during the final attempt instead of leaving it stuck.
      await this.dataSource.query(`
        UPDATE tickets SET ai_status = 'failed', ai_error = 'AI_WORKER_INTERRUPTED',
          ai_next_attempt_at = NULL
        WHERE ai_status = 'processing' AND ai_attempts >= 3 AND ai_next_attempt_at <= now()
      `);
      const claimed: ClaimedTicket[] = await this.dataSource.query(
        `
        WITH candidate AS (
          SELECT t.ticket_id FROM tickets t
          WHERE t.ai_status IN ('pending', 'processing') AND t.ai_attempts < 3
            AND (t.ai_next_attempt_at IS NULL OR t.ai_next_attempt_at <= now())
            AND t.status NOT IN ('resolved', 'closed')
            AND EXISTS (SELECT 1 FROM ticket_messages m
                        WHERE m.ticket_id = t.ticket_id AND m.sender_type = 'customer')
          ORDER BY t.created_at ASC, t.ticket_id ASC
          FOR UPDATE OF t SKIP LOCKED LIMIT 1
        ), claimed AS (
          UPDATE tickets t SET ai_status = 'processing', ai_attempts = t.ai_attempts + 1,
            ai_next_attempt_at = now() + ($1::integer * interval '1 millisecond')
          FROM candidate c WHERE t.ticket_id = c.ticket_id
          RETURNING t.ticket_id, t.ticket_code, t.subject, t.ai_attempts
        )
        SELECT * FROM claimed
      `,
        [this.provider.timeoutMs + 30000],
      );
      if (claimed[0]) await this.analyzeClaim(claimed[0]);
    } catch {
      // Avoid leaking database credentials/customer data via raw driver errors.
      this.logger.error(
        '[AI TRIAGE STORAGE_ERROR] Kiểm tra database và migration Task 3.3.',
      );
    } finally {
      this.running = false;
    }
  }

  private async analyzeClaim(ticket: ClaimedTicket): Promise<void> {
    try {
      const message = await this.messages.findOne({
        where: { ticket_id: ticket.ticket_id, sender_type: 'customer' },
        order: { created_at: 'ASC', message_id: 'ASC' },
      });
      if (!message) throw new TriageError('AI_MISSING_MESSAGE', false);
      // Conservative pacing for local testing, including retries and other tickets.
      // Actual provider limits depend on the project's model and usage tier.
      // This is per process; shared-project deployments need a shared limiter.
      this.nextRequestAt = Date.now() + 15000;
      const result = await this.provider.analyze(
        ticket.subject,
        message.content,
      );
      const bump = shouldBumpPriority(
        result,
        this.config.get<number>('ai.urgencyThreshold') ?? 0.8,
      );
      const saved = await this.tickets
        .createQueryBuilder()
        .update(Ticket)
        .set({
          sentiment_label: result.sentiment,
          sentiment_score: result.confidence,
          urgency_score: result.urgencyScore,
          ai_reason: result.reason,
          ai_detected_keywords: result.keywords,
          ai_model: this.provider.model,
          ai_status: 'completed',
          ai_analyzed_at: () => 'CURRENT_TIMESTAMP',
          ai_next_attempt_at: null,
          ai_error: null,
          // Preserve current priority on a non-urgent result and never bump closed tickets.
          priority: () =>
            `CASE WHEN :bump AND status NOT IN ('resolved', 'closed') THEN 'urgent' ELSE priority END`,
          is_urgent_bumped: () =>
            `CASE WHEN :bump AND status NOT IN ('resolved', 'closed') THEN true ELSE is_urgent_bumped END`,
        })
        .where(
          'ticket_id = :id AND ai_status = :status AND ai_attempts = :attempt',
          {
            id: ticket.ticket_id,
            status: 'processing',
            attempt: ticket.ai_attempts,
          },
        )
        .setParameter('bump', bump)
        .execute();
      if (saved.affected)
        this.logger.log(
          `[AI TRIAGE COMPLETED] ticket=${ticket.ticket_code}; sentiment=${result.sentiment}; urgent=${bump}`,
        );
    } catch (error) {
      const failure =
        error instanceof TriageError
          ? error
          : new TriageError('AI_STORAGE_ERROR');
      const retry = failure.retryable && ticket.ai_attempts < 3;
      const delayMs = Math.max(
        ticket.ai_attempts * 30000,
        failure.retryAfterMs ?? 0,
      );
      const nextAttempt = retry ? new Date(Date.now() + delayMs) : null;
      await this.tickets.update(
        {
          ticket_id: ticket.ticket_id,
          ai_status: 'processing',
          ai_attempts: ticket.ai_attempts,
        },
        {
          ai_status: retry ? 'pending' : 'failed',
          ai_error: failure.code,
          ai_next_attempt_at: nextAttempt,
        },
      );
      this.logger.warn(
        `[AI TRIAGE ${retry ? 'RETRY' : 'FAILED'}] ticket=${ticket.ticket_code}; code=${failure.code}; attempt=${ticket.ai_attempts}; retry_at=${nextAttempt?.toISOString() ?? 'none'}`,
      );
    }
  }
}
