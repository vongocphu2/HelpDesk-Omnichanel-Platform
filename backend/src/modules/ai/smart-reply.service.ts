import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { TriageProviderService } from './triage-provider.service.js';
import { GeminiTriageService } from './gemini-triage.service.js';
import { ConfigService } from '@nestjs/config';
import { TriageError } from './triage-result.js';

export interface SmartReplyResult {
  draft: string;
  confidence: number;
  based_on_similar: boolean;
  model: string;
}

@Injectable()
export class SmartReplyService {
  private readonly logger = new Logger(SmartReplyService.name);

  // Gemini instance dùng riêng cho Smart Reply (cùng config)
  private readonly gemini: GeminiTriageService;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    private readonly provider: TriageProviderService,
    private readonly config: ConfigService,
  ) {
    this.gemini = new GeminiTriageService(config);
  }

  /**
   * Tìm các ticket đã giải quyết có chủ đề tương tự (PostgreSQL full-text similarity).
   * Trả về tối đa 3 ticket kèm tin nhắn gốc + phản hồi agent đầu tiên.
   */
  private async findSimilarResolved(
    subject: string,
    ticketId: string,
  ): Promise<{ question: string; answer: string }[]> {
    try {
      const rows = (await this.ticketRepo.query(
        `
        SELECT t.ticket_id, t.subject,
          (SELECT content FROM ticket_messages
           WHERE ticket_id = t.ticket_id AND sender_type = 'customer'
           ORDER BY created_at ASC LIMIT 1) AS question,
          (SELECT content FROM ticket_messages
           WHERE ticket_id = t.ticket_id AND sender_type IN ('agent','system')
           ORDER BY created_at ASC LIMIT 1) AS answer
        FROM tickets t
        WHERE t.status IN ('resolved','closed')
          AND t.ticket_id != $1
          AND t.subject IS NOT NULL
          AND similarity(t.subject, $2) > 0.15
        ORDER BY similarity(t.subject, $2) DESC
        LIMIT 3
        `,
        [ticketId, subject],
      )) as { question: string | null; answer: string | null }[];

      return rows
        .filter((r) => r.question && r.answer)
        .map((r) => ({
          question: r.question!.slice(0, 500),
          answer: r.answer!.slice(0, 500),
        }));
    } catch {
      // pg_trgm extension may not be installed — degrade gracefully.
      return [];
    }
  }

  /**
   * Sinh AI Smart Reply draft cho một ticket.
   * Agent xem qua, chỉnh sửa nhẹ rồi bấm gửi.
   */
  async generateDraft(ticketId: string): Promise<SmartReplyResult> {
    // Chấp nhận cả UUID và mã ticket (TK-xxxx)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ticketId,
      );

    const ticket = await this.ticketRepo.findOne({
      where: isUuid ? { ticket_id: ticketId } : { ticket_code: ticketId },
      relations: { channel: true, customer: true },

    });

    if (!ticket) {
      throw new NotFoundException(
        `Không tìm thấy ticket: ${ticketId}`,
      );
    }

    // Lấy tối đa 10 tin nhắn gần nhất để làm ngữ cảnh
    const messages = await this.messageRepo.find({
      where: { ticket_id: ticket.ticket_id },
      order: { created_at: 'DESC' },
      take: 10,
    });

    const conversation = [...messages]
      .reverse()
      .map(
        (m) =>
          `[${m.sender_type.toUpperCase()}]: ${m.content.slice(0, 400)}`,
      )
      .join('\n');

    const similar = await this.findSimilarResolved(
      ticket.subject,
      ticket.ticket_id,
    );
    const basedOnSimilar = similar.length > 0;

    const similarContext =
      basedOnSimilar
        ? '\n\nVÍ DỤ XỬ LÝ TƯƠNG TỰ:\n' +
          similar
            .map(
              (s, i) =>
                `[Ví dụ ${i + 1}]\nKhách: ${s.question}\nAgent: ${s.answer}`,
            )
            .join('\n\n')
        : '';

    const prompt = `Bạn là nhân viên CSKH chuyên nghiệp của HelpDesk+.
Hãy soạn một câu trả lời ngắn gọn, lịch sự, chuẩn mực bằng tiếng Việt cho khách hàng dựa trên lịch sử hội thoại.
KHÔNG bịa đặt thông tin. Nếu chưa có đủ thông tin, hãy hứa xem xét và phản hồi sớm.
Trả về CHỈ nội dung câu trả lời (không tiêu đề, không ghi chú).

TICKET: ${ticket.subject}
KÊNH: ${ticket.channel?.channel_type ?? 'web'}
LỊCH SỬ HỘI THOẠI:
${conversation}${similarContext}`;

    try {
      const draft = await this.callGeminiRaw(prompt);
      return {
        draft: draft.trim(),
        confidence: basedOnSimilar ? 0.85 : 0.7,
        based_on_similar: basedOnSimilar,
        model: this.gemini.model,
      };
    } catch (error) {
      const code =
        error instanceof TriageError ? error.code : 'AI_SMART_REPLY_ERROR';
      this.logger.warn(
        `[SMART REPLY] ticket=${ticket.ticket_code}; error=${code}`,
      );
      throw error;
    }
  }

  /**
   * Gọi Gemini với prompt tự do (không dùng JSON schema của triage).
   */
  private async callGeminiRaw(prompt: string): Promise<string> {
    if (!this.gemini.isReady()) {
      throw new TriageError('AI_NOT_CONFIGURED', false);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.gemini.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.get<string>('ai.apiKey')!.trim(),
        },
        signal: AbortSignal.timeout(this.gemini.timeoutMs),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.4,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new TriageError(`AI_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
    };

    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('');

    if (!text.trim()) {
      throw new TriageError('AI_EMPTY_RESPONSE');
    }

    return text;
  }
}
