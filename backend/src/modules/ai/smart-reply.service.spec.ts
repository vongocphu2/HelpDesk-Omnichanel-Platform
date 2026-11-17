import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SmartReplyService } from './smart-reply.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ticket giả với các field tối thiểu mà SmartReplyService cần */
function makeTicket(overrides = {}) {
  return {
    ticket_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ticket_code: 'TK-0001',
    subject: 'Lỗi thanh toán không thành công',
    channel: { channel_type: 'web' },
    customer: { email: 'khach@example.com', full_name: 'Khách Test' },
    ...overrides,
  };
}

/** Tin nhắn giả trong hội thoại */
function makeMessage(content: string, sender_type = 'customer') {
  return {
    message_id: crypto.randomUUID(),
    sender_type,
    content,
    created_at: new Date(),
    sender: { full_name: 'Test User' },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  const ticket = makeTicket();

  // ticketRepo.findOne trả về ticket giả
  // ticketRepo.query dùng cho findSimilarResolved (pg_trgm) — mặc định trả rỗng
  const ticketRepo = {
    findOne: vi.fn().mockResolvedValue(ticket),
    query: vi.fn().mockResolvedValue([]),
  };

  // messageRepo.find trả về 2 tin nhắn giả để build conversation context
  const messageRepo = {
    find: vi.fn().mockResolvedValue([
      makeMessage('Tôi không thanh toán được, báo lỗi 500'),
      makeMessage('Chào bạn, chúng tôi đang xem xét', 'agent'),
    ]),
  };

  // TriageProviderService — chỉ cần model và timeoutMs để GeminiTriageService khởi tạo
  const provider = {
    isReady: vi.fn().mockReturnValue(true),
    model: 'gemini-1.5-flash',
    timeoutMs: 15000,
  };

  // ConfigService — trả về api key giả để GeminiTriageService không throw
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'ai.apiKey') return 'fake-api-key';
      return 'gemini-1.5-flash';
    }),
  };

  const service = new SmartReplyService(
    ticketRepo as never,
    messageRepo as never,
    provider as never,
    config as never,
  );

  return { service, ticket, ticketRepo, messageRepo };
}

// ─── Mock helper: spy callGeminiRaw mà không dùng mockResolvedValue ───────────
// vi.spyOn(obj as never, method) trả về kiểu never → không có mockResolvedValue.
// Dùng mockImplementation(() => Promise.resolve(...)) để bypass lỗi TypeScript.
// Sửa lại — ép kiểu rõ ràng hơn
function spyGemini(service: SmartReplyService, response: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.spyOn(service as any, 'callGeminiRaw').mockImplementation(
    () => Promise.resolve(response),
  );
}

//Tại sao dùng as any thay as never? never là kiểu không có property nào — 
//nên mockImplementation không tồn tại. any tắt hoàn toàn type check, 
//cho phép gọi bất kỳ method nào kể cả private.



// ─── Test cases ───────────────────────────────────────────────────────────────

describe('SmartReplyService.generateDraft', () => {

  it('ném NotFoundException khi ticket không tồn tại', async () => {
    // findOne trả null → ticket không có trong DB → service phải ném lỗi 404
    const { service, ticketRepo } = setup();
    ticketRepo.findOne.mockResolvedValue(null);

    await expect(service.generateDraft('TK-9999'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('chấp nhận mã ticket dạng TK-xxxx (không phải UUID)', async () => {
    // Service phải nhận cả UUID lẫn mã TK-xxxx
    // Khi id không khớp UUID pattern → query bằng ticket_code
    const { service, ticketRepo } = setup();
    spyGemini(service, 'Chào bạn, chúng tôi sẽ hỗ trợ ngay.');

    await service.generateDraft('TK-0001');

    expect(ticketRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticket_code: 'TK-0001' } }),
    );
  });

  it('trả về draft hợp lệ khi AI trả lời (happy path)', async () => {
    // AI trả về text → service đóng gói vào SmartReplyResult với đúng các field
    const { service } = setup();
    const fakeDraft = 'Xin lỗi vì sự bất tiện. Chúng tôi đã ghi nhận lỗi thanh toán.';
    spyGemini(service, fakeDraft);

    const result = await service.generateDraft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(result.draft).toBe(fakeDraft.trim());
    expect(result.model).toBe('gemini-1.5-flash');
    // Không có ticket tương tự (query trả []) → based_on_similar = false → confidence = 0.7
    expect(result.based_on_similar).toBe(false);
    expect(result.confidence).toBe(0.7);
  });

  it('tăng confidence lên 0.85 khi tìm được ticket tương tự', async () => {
    // pg_trgm tìm thấy ticket đã giải quyết có subject tương tự
    // → AI có thêm context mẫu → confidence cao hơn (0.85)
    const { service, ticketRepo } = setup();
    ticketRepo.query.mockResolvedValue([
      { question: 'Lỗi thanh toán 500', answer: 'Vui lòng thử lại sau 5 phút' },
    ]);
    spyGemini(service, 'Draft có context từ ticket tương tự');

    const result = await service.generateDraft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(result.based_on_similar).toBe(true);
    expect(result.confidence).toBe(0.85);
  });

});
