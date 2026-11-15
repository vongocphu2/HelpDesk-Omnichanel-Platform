import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { DataSource } from 'typeorm';

import { Role, User } from '../../database/entities/index.js';
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
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private isPolling = false;
  private pollingAbortController: AbortController | null = null;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const mode = this.configService.get<string>('TELEGRAM_MODE') || 'polling';

    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN chưa được cấu hình, bỏ qua Telegram Bot.',
      );
      return;
    }

    if (mode === 'polling') {
      this.logger.log(
        'Khởi chạy Telegram Bot ở chế độ Long Polling (kết nối trực tiếp, bền bỉ)...',
      );
      void this.startPolling(token);
    } else {
      this.logger.log(
        `Telegram Bot được cấu hình ở chế độ Webhook (mode=${mode}).`,
      );
    }
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.isPolling) {
      this.isPolling = false;
      if (this.pollingAbortController) {
        this.pollingAbortController.abort();
        this.pollingAbortController = null;
      }
      this.logger.log('Đã dừng Telegram Long Polling.');
    }
  }

  private async startPolling(token: string): Promise<void> {
    this.isPolling = true;
    this.pollingAbortController = new AbortController();

    // 1. Gỡ bỏ Webhook cũ trên Telegram để Telegram cho phép nhận tin qua getUpdates
    try {
      const deleteWebhookUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`;
      const delRes = await fetch(deleteWebhookUrl);
      const delJson = (await delRes.json()) as {
        ok: boolean;
        description?: string;
      };
      if (delJson.ok) {
        this.logger.log(
          'Đã gỡ Webhook cũ trên Telegram thành công, chuyển sang nhận tin qua Long Polling.',
        );
      } else {
        this.logger.warn(`Không thể gỡ Webhook cũ: ${delJson.description}`);
      }
    } catch (err) {
      this.logger.warn(
        `Lỗi khi gọi deleteWebhook Telegram: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. Vòng lặp Long Polling kéo tin nhắn
    let offset = 0;
    const pollLoop = async () => {
      while (this.isPolling) {
        try {
          const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`;
          const response = await fetch(url, {
            signal: this.pollingAbortController?.signal,
          });

          if (!response.ok) {
            this.logger.warn(
              `Telegram getUpdates HTTP status ${response.status}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
          }

          const data = (await response.json()) as {
            ok: boolean;
            result?: TelegramUpdate[];
            description?: string;
          };

          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              if (!this.isPolling) break;
              offset = Math.max(offset, update.update_id + 1);
              try {
                await this.handleUpdate(update);
              } catch (handleErr) {
                this.logger.error(
                  `Lỗi xử lý Telegram update ${update.update_id}: ${handleErr instanceof Error ? handleErr.message : String(handleErr)}`,
                );
              }
            }
          } else {
            this.logger.warn(
              `Telegram getUpdates không thành công: ${data.description}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (err: unknown) {
          if (!this.isPolling) break;
          if (err instanceof Error && err.name === 'AbortError') break;

          this.logger.debug(
            `Telegram polling gián đoạn: ${err instanceof Error ? err.message : String(err)}. Thử lại sau 3s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    };

    void pollLoop();
  }

  async sendTelegramMessage(
    token: string,
    chatId: number,
    text: string,
  ): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
    } catch (err) {
      this.logger.debug(`Không gửi được tin nhắn phản hồi Telegram: ${err}`);
    }
  }

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

    // Phản hồi chào mừng khi người dùng gửi lệnh /start
    if (text.startsWith('/start')) {
      const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      if (token && message.chat.id) {
        void this.sendTelegramMessage(
          token,
          message.chat.id,
          `👋 Xin chào ${message.from?.first_name || 'quý khách'}!\n\nChào mừng bạn đến với kênh tiếp nhận yêu cầu hỗ trợ **HelpDesk+**.\n\n📌 Hãy nhập trực tiếp nội dung sự cố hoặc câu hỏi bạn cần trợ giúp tại đây. Hệ thống sẽ tự động tạo Ticket và kết nối tới nhân viên CSKH nhanh chóng.`,
        );
      }
      return;
    }

    // Không tạo Ticket từ các lệnh bot khác
    if (text.startsWith('/')) return;

    // Cho phép khách hàng gửi tin nhắn tự nhiên hoặc theo định dạng có Email
    let customerEmail = '';
    let description = text;

    const match = text.match(
      /^Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)\s*\nNội dung:\s*([\s\S]+)$/i,
    );

    if (match) {
      customerEmail = match[1].trim().toLowerCase();
      description = match[2].trim();
    } else {
      // Tự động gán email định danh từ Telegram user
      const username =
        message.from?.username ||
        `user_${message.from?.id || 'guest'}`;
      customerEmail = `${username}@telegram.org`;
      description = text;
    }

    if (customerEmail.length > 255 || !isEmail(customerEmail)) {
      customerEmail = `tg_${message.from?.id || 'guest'}@telegram.org`;
    }

    if (description.length < 5) {
      this.logger.warn('Nội dung yêu cầu phải có ít nhất 5 ký tự');
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

      // Chỉ một transaction được quyền xử lý một update_id (Deduplication).
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

      // Phản hồi xác nhận tự động tới khách hàng trên Telegram
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      if (botToken && message.chat.id) {
        void this.sendTelegramMessage(
          botToken,
          message.chat.id,
          `✅ HelpDesk+ đã tiếp nhận yêu cầu hỗ trợ của bạn!\n🎫 Mã Ticket: ${ticket.ticket_code}\n📌 Tiêu đề: ${ticket.subject}\n\nĐội ngũ CSKH sẽ phản hồi bạn trong thời gian sớm nhất.`,
        );
      }
    });
  }
}
