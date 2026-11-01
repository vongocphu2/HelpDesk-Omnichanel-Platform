import { User, Role } from '../../database/entities/index.js';
import { isEmail } from 'class-validator';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TicketsService } from '../tickets/tickets.service.js';
import { TelegramProcessedUpdate } from './telegram-processed-update.entity.js';
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
}
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly dataSource: DataSource,
  ) { }
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;

    if (!message?.text) {
      this.logger.debug('Bỏ qua Telegram update không có nội dung text');
      return;
    }



    this.logger.log(
      `Telegram update_id=${update.update_id}, ` +
      `message_id=${message.message_id}, ` +
      `chat_id=${message.chat.id}`,
    );
    await this.createTicketFromTelegram(update);

  }

  private async createTicketFromTelegram(
    update: TelegramUpdate,
  ): Promise<void> {
    const message = update.message;

    if (!message?.text) return;

    const text = message.text.trim();

    // Không tạo Ticket từ lệnh Telegram.
    if (text.startsWith('/')) return;

    // Định dạng:
    // Email: customer@example.com
    // Nội dung: Tôi cần hỗ trợ...
    const match = text.match(
      /^Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)\s*\nNội dung:\s*([\s\S]+)$/i,
    );

    if (!match) {
      this.logger.warn(
        `Tin nhắn ${update.update_id} chưa đúng định dạng yêu cầu`,
      );
      return;
    }

    const customerEmail = match[1].trim().toLowerCase();
    const description = match[2].trim();

    if (customerEmail.length > 255 || !isEmail(customerEmail)) {
      this.logger.warn(
        `Telegram update_id=${update.update_id}: email không hợp lệ`,
      );
      return;
    }

    if (description.length < 10) {
      this.logger.warn('Nội dung yêu cầu phải có ít nhất 10 ký tự');
      return;
    }

    const senderName =
      [
        message.from?.first_name,
        message.from?.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Telegram Customer';

    if (senderName.length > 255) {
      this.logger.warn(
        `Telegram update_id=${update.update_id}: tên người gửi quá dài`,
      );
      return;
    }

    const telegramUserId = message.from?.id;

    if (
      typeof telegramUserId !== 'number' ||
      !Number.isSafeInteger(telegramUserId) ||
      telegramUserId <= 0
    ) {
      this.logger.warn(
        `Telegram update_id=${update.update_id}: thiếu người gửi hợp lệ`,
      );
      return;
    }

    const telegramUserIdText = String(telegramUserId);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TelegramProcessedUpdate);

      // Chỉ một transaction được quyền xử lý một update_id.
      const inserted = await repo
        .createQueryBuilder()
        .insert()
        .values({
          updateId: String(update.update_id),
          chatId: String(message.chat.id),
          messageId: String(message.message_id),
          ticketId: null,
          status: 'processing',
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      if (inserted.raw.length === 0) {
        this.logger.log(
          `[TELEGRAM SKIPPED - DUPLICATE] update_id=${update.update_id}`,
        );
        return;
      }

      const userRepo = manager.getRepository(User);

      let customer = await userRepo.findOne({
        where: { telegram_user_id: telegramUserIdText },
      });

      if (!customer) {
        const customerRole = await manager
          .getRepository(Role)
          .findOne({
            where: { role_name: 'customer' },
          });

        if (!customerRole) {
          throw new Error(
            'Chưa cấu hình vai trò customer trong database',
          );
        }

        await userRepo
          .createQueryBuilder()
          .insert()
          .values({
            full_name: senderName,
            email: null,
            telegram_user_id: telegramUserIdText,
            telegram_contact_email: customerEmail,
            telegram_chat_id:
              message.chat.type === 'private'
                ? String(message.chat.id)
                : null,
            role_id: customerRole.role_id,
            status: 'active',
          })
          .orIgnore()
          .execute();

        // Đọc lại để xử lý cả trường hợp request đồng thời
        // đã tạo khách với cùng Telegram user ID.
        customer = await userRepo.findOne({
          where: { telegram_user_id: telegramUserIdText },
        });
      }

      if (!customer || customer.status !== 'active') {
        throw new Error(
          'Khách hàng Telegram không tồn tại hoặc không hoạt động',
        );
      }

      const ticket = await this.ticketsService.createFromWebForm(
        {
          customer_name: senderName,
          customer_email: customerEmail,
          subject: `Yêu cầu hỗ trợ Telegram - ${description.slice(0, 60)}`,
          description,
          channel_type: 'telegram',
          priority: 'medium',
        },
        manager,
        customer.user_id,
      );

      await repo.update(
        { id: inserted.raw[0].id as string },
        {
          ticketId: ticket.ticket_id,
          status: 'completed',
        },
      );

      this.logger.log(
        `[TELEGRAM TICKET CREATED] update_id=${update.update_id}, ` +
        `ticket=${ticket.ticket_code}`,
      );
    });
  }

}
