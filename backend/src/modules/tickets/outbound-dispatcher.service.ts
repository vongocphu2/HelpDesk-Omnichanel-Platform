import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Ticket, TicketMessage, User } from '../../database/entities/index.js';
import { EmailService } from '../email/email.service.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { TicketsGateway } from './tickets.gateway.js';

export interface SendReplyDto {
  content: string;
  /** Nếu true, lưu tin nhắn là AI Draft (đã được agent duyệt và gửi). */
  is_ai_draft?: boolean;
}

export interface SendReplyResult {
  message_id: string;
  ticket_code: string;
  channel: string;
  delivered: boolean;
  delivery_note?: string;
}

@Injectable()
export class OutboundDispatcherService {
  private readonly logger = new Logger(OutboundDispatcherService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly gateway: TicketsGateway,
    // ModuleRef cho phép lấy EmailService/TelegramService lúc runtime
    // thay vì inject vào constructor — tránh circular ESM dependency
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Lưu tin nhắn agent vào DB và gửi ra kênh tương ứng.
   */
  async sendReply(
    ticketIdentifier: string,
    agentId: string,
    dto: SendReplyDto,
  ): Promise<SendReplyResult> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ticketIdentifier,
      );

    const ticket = await this.ticketRepo.findOne({
      where: isUuid
        ? { ticket_id: ticketIdentifier }
        : { ticket_code: ticketIdentifier },
      relations: { channel: true, customer: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy ticket: ${ticketIdentifier}`);
    }

    // Lưu tin nhắn vào database
    const saved = this.messageRepo.create({
      ticket_id: ticket.ticket_id,
      sender_id: agentId,
      sender_type: 'agent',
      content: dto.content,
      is_ai_draft: dto.is_ai_draft ?? false,
    });
    const message = await this.messageRepo.save(saved);

    // Phát realtime tới clients đang xem ticket này (Task 5.3)
    this.gateway.emitNewMessage({
      message_id: message.message_id,
      ticket_id: ticket.ticket_id,
      ticket_code: ticket.ticket_code,
      sender_type: 'agent',
      content: dto.content,
      created_at: message.created_at,
      is_ai_draft: message.is_ai_draft,
    });

    const channelType = ticket.channel?.channel_type ?? 'web';
    let delivered = false;
    let delivery_note: string | undefined;

    try {
      if (channelType === 'email') {
        delivered = await this.dispatchEmail(ticket, dto.content);
      } else if (channelType === 'telegram') {
        delivered = await this.dispatchTelegram(ticket, dto.content);
      } else {
        // Web form — tin nhắn đã lưu DB, client nhận qua WebSocket
        delivered = true;
        delivery_note = 'Tin nhắn lưu DB; client nhận qua WebSocket.';
      }
    } catch (err) {
      delivery_note = `Lưu DB thành công nhưng gửi kênh ${channelType} thất bại: ${
        err instanceof Error ? err.message : String(err)
      }`;
      this.logger.warn(
        `[OUTBOUND] ticket=${ticket.ticket_code} channel=${channelType} error=${delivery_note}`,
      );
    }

    this.logger.log(
      `[OUTBOUND] ticket=${ticket.ticket_code} channel=${channelType} delivered=${delivered} msg=${message.message_id}`,
    );

    return {
      message_id: message.message_id,
      ticket_code: ticket.ticket_code,
      channel: channelType,
      delivered,
      delivery_note,
    };
  }

  private async dispatchEmail(ticket: Ticket, content: string): Promise<boolean> {
    // Lấy EmailService lúc runtime để tránh circular dependency lúc khởi tạo
    const emailService = await this.moduleRef.resolve(EmailService);

    const customer = ticket.customer as User | null;
    const toEmail =
      (customer as User & { telegram_contact_email?: string | null })
        ?.telegram_contact_email ?? customer?.email;

    if (!toEmail) {
      this.logger.warn(
        `[OUTBOUND EMAIL] ticket=${ticket.ticket_code}: không có địa chỉ email khách`,
      );
      return false;
    }

    await emailService.sendEmail(
      toEmail,
      `Re: [${ticket.ticket_code}] ${ticket.subject}`,
      content,
    );
    return true;
  }

  private async dispatchTelegram(ticket: Ticket, content: string): Promise<boolean> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return false;

    // Lấy TelegramService lúc runtime để tránh circular dependency lúc khởi tạo
    const telegramService = await this.moduleRef.resolve(TelegramService);

    const customer = ticket.customer as User | null;
    const chatId =
      (customer as User & { telegram_chat_id?: string | null })
        ?.telegram_chat_id;

    if (!chatId || !/^\d+$/.test(chatId)) {
      this.logger.warn(
        `[OUTBOUND TELEGRAM] ticket=${ticket.ticket_code}: không có telegram_chat_id`,
      );
      return false;
    }

    await telegramService.sendTelegramMessage(
      token,
      parseInt(chatId, 10),
      `[${ticket.ticket_code}] ${content}`,
    );
    return true;
  }
}
