import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { EmailService } from '../email/email.service.js';
import { TelegramService } from '../telegram/telegram.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ticket giả với channel và customer đầy đủ */
function makeTicket(channelType = 'web', overrides = {}) {
  return {
    ticket_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ticket_code: 'TK-0002',
    subject: 'Hỗ trợ kỹ thuật',
    channel: { channel_type: channelType },
    customer: {
      email: 'khach@example.com',
      telegram_chat_id: '123456789',
    },
    ...overrides,
  };
}

/** Message giả được trả về sau khi lưu DB */
function makeSavedMessage() {
  return {
    message_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ticket_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: new Date(),
    is_ai_draft: false,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup(channelType = 'web') {
  const ticket = makeTicket(channelType);

  // ticketRepo.findOne trả ticket giả
  const ticketRepo = {
    findOne: vi.fn().mockResolvedValue(ticket),
  };

  // messageRepo.create + save mô phỏng lưu tin nhắn vào DB
  const messageRepo = {
    create: vi.fn().mockReturnValue(makeSavedMessage()),
    save: vi.fn().mockResolvedValue(makeSavedMessage()),
  };

  const userRepo = { findOne: vi.fn() };

  // EmailService.sendEmail — mock để không gửi email thật
  const emailService = {
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };

  // TelegramService.sendTelegramMessage — mock để không gọi Telegram API thật
  const telegramService = {
    sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  };

  const config = {
    get: vi.fn().mockReturnValue('fake-token'),
  };

  // TicketsGateway.emitNewMessage — mock để không cần Socket.IO thật
  const gateway = {
    emitNewMessage: vi.fn(),
  };

// Constructor mới: ticketRepo, messageRepo, userRepo, config, gateway, moduleRef
// EmailService và TelegramService không còn trong constructor — moduleRef.resolve() trả đúng service theo class
const moduleRef = {
    resolve: vi.fn().mockImplementation((token: unknown) => {
        // token là class constructor — so sánh trực tiếp
        if (token === EmailService) return Promise.resolve(emailService);
        if (token === TelegramService) return Promise.resolve(telegramService);
        return Promise.resolve(null);
    }),
};

const service = new OutboundDispatcherService(
    ticketRepo as never,
    messageRepo as never,
    userRepo as never,
    config as never,
    gateway as never,
    moduleRef as never,
);

  return { service, ticket, ticketRepo, messageRepo, emailService, telegramService, gateway };
}

// ─── Test cases ───────────────────────────────────────────────────────────────

describe('OutboundDispatcherService.sendReply', () => {

  it('ném NotFoundException khi ticket không tồn tại', async () => {
    // ticketRepo.findOne trả null → ticket không có trong DB → 404
    const { service, ticketRepo } = setup();
    ticketRepo.findOne.mockResolvedValue(null);

    await expect(
      service.sendReply('TK-9999', 'agent-id', { content: 'Xin chào' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lưu tin nhắn vào DB và emit Socket.IO khi kênh là web', async () => {
    // Kênh web: không gọi email/telegram, chỉ lưu DB và emit realtime
    const { service, messageRepo, emailService, telegramService, gateway } = setup('web');

    const result = await service.sendReply(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'agent-uuid',
      { content: 'Chúng tôi đã ghi nhận yêu cầu của bạn.' },
    );

    // Phải lưu message vào DB
    expect(messageRepo.save).toHaveBeenCalledOnce();
    // Phải emit realtime tới client qua Socket.IO
    expect(gateway.emitNewMessage).toHaveBeenCalledOnce();
    // Không gọi email hay telegram vì kênh là web
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(telegramService.sendTelegramMessage).not.toHaveBeenCalled();
    // Kết quả trả về delivered = true
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('web');
  });

  it('gửi email khi kênh là email', async () => {
    // Kênh email: sau khi lưu DB phải gọi emailService.sendEmail
    const { service, emailService } = setup('email');

    const result = await service.sendReply(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'agent-uuid',
      { content: 'Phản hồi qua email.' },
    );

    expect(emailService.sendEmail).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('email');
  });

  it('gửi telegram khi kênh là telegram', async () => {
    // Kênh telegram: sau khi lưu DB phải gọi telegramService.sendTelegramMessage
    const { service, telegramService } = setup('telegram');

    const result = await service.sendReply(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'agent-uuid',
      { content: 'Phản hồi qua Telegram.' },
    );

    expect(telegramService.sendTelegramMessage).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('telegram');
  });

  it('đánh dấu is_ai_draft = true khi agent gửi draft AI', async () => {
    // Agent xem draft AI, bấm gửi → is_ai_draft = true được lưu vào DB
    const { service, messageRepo } = setup('web');

    await service.sendReply(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'agent-uuid',
      { content: 'Draft từ AI.', is_ai_draft: true },
    );

    // messageRepo.create phải nhận is_ai_draft = true
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_ai_draft: true }),
    );
  });

});
