
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedEmail } from './normalized-email.interface.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EmailProcessedMessage } from './email-processed.entity.js';
interface EmailSyncState {
  uidValidity: string | null;
  lastProcessedUid: number | null;
  failedUids: number[];
}
@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ticketsService: TicketsService,
    @InjectRepository(EmailProcessedMessage)
    private readonly processedEmailRepo: Repository<EmailProcessedMessage>,
    private readonly dataSource: DataSource,
  ) {}

  // Hàm 1: Lấy cấu hình IMAP từ file .env
  getImapConfig() {
    const port = Number(this.configService.get<string>('EMAIL_IMAP_PORT'));
    return {
      host: this.configService.get<string>('EMAIL_IMAP_HOST'),
      port,
      secure: this.getImapSecure(port),
      user: this.configService.get<string>('EMAIL_USER'),
    };
  }

  // Hàm 2: Kiểm tra kết nối Gmail qua IMAP
  async testImapConnection(): Promise<boolean> {
    const client = this.createImapClient();

    try {
      await client.connect();

      console.log('Kết nối Gmail IMAP thành công!');
      return true;
    } catch {
      console.error('Kết nối Gmail IMAP thất bại.');
      return false;
    } finally {
      await this.closeImapClient(client);
    }
  }

  // Hàm 3: Đọc thông tin tối đa 5 email cuối trong INBOX
  async readInboxEmails() {
    const client = this.createImapClient();

    try {
      // Bước 1: Kết nối Gmail
      await client.connect();

      // Bước 2: Mở hộp thư INBOX
      const lock = await client.getMailboxLock('INBOX');

      try {
        const mailbox = client.mailbox;

        if (!mailbox) {
          throw new Error('Không thể mở hộp thư INBOX');
        }

        // Bước 3: Lấy tổng số email
        const total = mailbox.exists;

        if (total === 0) {
          console.log('Hộp thư INBOX hiện không có email.');
          return [];
        }

        // Bước 4: Xác định tối đa 5 email cuối
        const start = Math.max(1, total - 4);

        const emails: {
          uid: number;
          subject: string;
          from: string;
          date: Date | null;
        }[] = [];

        // Bước 5: Đọc thông tin email
        for await (const message of client.fetch(
          `${start}:${total}`,
          {
            envelope: true,
            uid: true,
          },
        )) {
          const rawDate = message.envelope?.date;
          const date = rawDate == null ? null : new Date(rawDate);

          emails.push({
            uid: message.uid,
            subject:
              message.envelope?.subject ?? '(Không có tiêu đề)',
            from:
              message.envelope?.from?.[0]?.address ??
              '(Không rõ người gửi)',
            date: date && !Number.isNaN(date.getTime()) ? date : null,
          });
        }

        return emails;
      } finally {
        // Bước 6: Giải phóng khóa INBOX
        lock.release();
      }
    } finally {
      // Bước 7: Đóng kết nối IMAP
      await this.closeImapClient(client);
    }
  }
  
  // Hàm 4: Đọc nội dung của một email theo UID
  async readEmailContent(uid: number) {
    if (!Number.isSafeInteger(uid) || uid <= 0) {
      throw new Error('UID email không hợp lệ');
    }

    const client = this.createImapClient();

    try {
      // Kết nối Gmail bằng IMAP
      await client.connect();

      // Mở hộp thư INBOX
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Tìm email theo UID và lấy dữ liệu gốc
        const message = await client.fetchOne(
          uid,
          { source: true },
          { uid: true },
        );

        if (!message || !message.source) {
          throw new Error('Không tìm thấy email trong INBOX');
        }

        // Phân tích dữ liệu email bằng mailparser
        const parsed = await simpleParser(message.source);

        // Trả về thông tin cần thiết
        return {
          uid: uid,
          messageId: parsed.messageId ?? null,
          subject: parsed.subject ?? '(Không có tiêu đề)',
          from: parsed.from?.value?.[0]?.address ?? '',
          text: parsed.text ?? '',
          date: parsed.date ?? null,
        };
      } finally {
        // Giải phóng khóa hộp thư
        lock.release();
      }
    } finally {
      // Đóng kết nối Gmail
      await this.closeImapClient(client);
    }
  }
  
  // Chuẩn hóa email thành dữ liệu dùng cho Ticket Service
  async normalizeEmail(uid: number): Promise<NormalizedEmail> {
    // Đọc nội dung email từ Gmail
    const email = await this.readEmailContent(uid);

    // Lấy địa chỉ email người gửi
    const fromEmail = email.from?.trim() ?? '';

    // Không xử lý email thiếu người gửi
    if (!fromEmail) {
      throw new Error(
        `Email UID ${uid} không có thông tin người gửi`,
      );
    }

    return {
      messageId: email.messageId?.trim() || null,
      subject: email.subject?.trim() || '(Không có tiêu đề)',
      fromEmail,
      content: email.text?.trim() || '',
      receivedAt: email.date ?? null,
      imapUid: uid,
      channel: 'EMAIL',
    };
  }
  
async createTicketFromEmail(email: NormalizedEmail) {
  const subject =
    email.subject.trim().length >= 5
      ? email.subject.trim()
      : `Email: ${email.subject.trim() || 'Không có tiêu đề'}`;

  const description =
    email.content.trim().length >= 10
      ? email.content.trim()
      : email.content.trim() ||
        'Khách hàng gửi email không có nội dung.';

  return this.ticketsService.createFromWebForm({
    customer_name:
      email.fromEmail.split('@')[0] || 'Email Customer',
    customer_email: email.fromEmail,
    subject,
    description,
    channel_type: 'email',
    priority: 'medium',
  });
}


  // Tự động kiểm tra Gmail mỗi 1 phút
  private isCheckingEmail = false;
  
 
private async processEmailWithTransaction(
  email: NormalizedEmail,
  uidValidity: string,
): Promise<void> {
  const mailbox = this.configService
    .getOrThrow<string>('EMAIL_USER')
    .trim()
    .toLowerCase();

  await this.dataSource.transaction(async (manager) => {
    const processedRepo = manager.getRepository(EmailProcessedMessage);

    // Khóa duy nhất ngăn đăng ký trùng một email.
    const inserted = await processedRepo
      .createQueryBuilder()
      .insert()
      .values({
        mailbox,
        uidValidity,
        imapUid: email.imapUid,
        messageId: email.messageId,
        ticketId: null,
        status: 'processing',
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    // Email đã được xử lý trong một transaction trước đó.
    if (inserted.raw.length === 0) {
      console.log('[EMAIL SKIPPED - DUPLICATE]', {
        imapUid: email.imapUid,
      });
      return;
    }

    // Tạo Ticket bằng cùng EntityManager.
    const ticket = await this.ticketsService.createFromWebForm(
      {
        customer_name:
          email.fromEmail.split('@')[0] || 'Email Customer',
        customer_email: email.fromEmail,
        subject:
          email.subject.trim().length >= 5
            ? email.subject.trim()
            : `Email: ${email.subject.trim() || 'Không có tiêu đề'}`,
        description:
          email.content.trim().length >= 10
            ? email.content.trim()
            : email.content.trim() ||
              'Khách hàng gửi email không có nội dung.',
        channel_type: 'email',
        priority: 'medium',
      },
      manager,
    );

    // Đánh dấu hoàn tất trong cùng transaction.
    await processedRepo.update(
      { id: inserted.identifiers[0].id as string },
      {
        ticketId: ticket.ticket_id,
        status: 'completed',
      },
    );

    console.log('[EMAIL TICKET CREATED]', {
      imapUid: email.imapUid,
      ticketId: ticket.ticket_id,
      ticketCode: ticket.ticket_code,
    });
  });
}


  
  
  @Cron(CronExpression.EVERY_MINUTE)
  async checkNewEmailsAutomatically(): Promise<void> {
    // Tránh chạy chồng hai lần kiểm tra
    if (this.isCheckingEmail) {
      return;
    }

    // Nếu chưa cấu hình email trong môi trường thì bỏ qua
    const host = this.configService.get<string>('EMAIL_IMAP_HOST');
    const user = this.configService.get<string>('EMAIL_USER');
    if (!host || !user || user.includes('example.com') || user.includes('your_helpdesk')) {
      return;
    }

    this.isCheckingEmail = true;

    try {
      // Đọc trạng thái đã lưu từ JSON
      const state = await this.loadEmailSyncState();

      // Lấy UIDVALIDITY và mốc UID hiện tại từ Gmail
      const inboxInfo = await this.getInboxSyncInfo();

      // Lần chạy đầu tiên: bỏ qua email cũ (phương án A)
      if (
        state.uidValidity === null &&
        state.lastProcessedUid === null
      ) {
        await this.saveEmailSyncState({
          uidValidity: inboxInfo.uidValidity,
          lastProcessedUid: inboxInfo.lastUid,
          failedUids: [],
        });

        console.log(
          `[EMAIL AUTO CHECK] Khởi tạo trạng thái: UID ${inboxInfo.lastUid}`,
        );

        return;
      }

      // Không tự đặt lại trạng thái khi UIDVALIDITY thay đổi
      if (state.uidValidity !== inboxInfo.uidValidity) {
        throw new Error(
          'UIDVALIDITY đã thay đổi. Cần kiểm tra trạng thái đồng bộ.',
        );
      }

      if (state.lastProcessedUid === null) {
        throw new Error('Trạng thái UID chưa hợp lệ');
      }

      // Tìm các email mới
      const newUids = await this.getNewEmailUids(
        state.lastProcessedUid,
      );

      // Retry failed messages even after the cursor has advanced or the app restarts.
      const pendingUids = new Set(state.failedUids);
      const uids = [...new Set([...state.failedUids, ...newUids])]
        .sort((a, b) => a - b);

      if (uids.length === 0) {
        console.log('[EMAIL AUTO CHECK] Không có email mới.');
        return;
      }

      console.log(
        `[EMAIL AUTO CHECK] Xử lý ${uids.length} email mới hoặc cần thử lại.`,
      );

      for (const uid of uids) {
        try {
          const email = await this.normalizeEmail(uid);

          console.log('[EMAIL NORMALIZED]', {
            imapUid: email.imapUid,
            messageIdPresent: email.messageId !== null,
            subjectPresent: email.subject.length > 0,
            fromEmailPresent: email.fromEmail.length > 0,
            contentLength: email.content.length,
            receivedAt: email.receivedAt,
            channel: email.channel,
          });

          await this.processEmailWithTransaction(email, state.uidValidity);
          pendingUids.delete(uid);
        } catch (error) {
          pendingUids.add(uid);
          console.error(
            `[EMAIL AUTO CHECK] UID ${uid} thất bại; sẽ thử lại ở lượt sau:`,
            error instanceof Error ? error.message : 'Lỗi không xác định',
          );
        }

        // Persist the cursor and retry list together. A disk failure aborts this
        // poll; the DB's unique key makes replaying a committed ticket safe.
        await this.saveEmailSyncState({
          uidValidity: state.uidValidity,
          lastProcessedUid: Math.max(state.lastProcessedUid, uid),
          failedUids: [...pendingUids].sort((a, b) => a - b),
        });
        state.lastProcessedUid = Math.max(state.lastProcessedUid, uid);
      }

    } catch (error) {
      console.error(
        '[EMAIL AUTO CHECK] Lỗi đồng bộ:',
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định',
      );
    } finally {
      this.isCheckingEmail = false;
    }
  }

  // Lấy UID của các email có UID lớn hơn lastUid
  async getNewEmailUids(lastUid: number): Promise<number[]> {
    if (!Number.isSafeInteger(lastUid) || lastUid < 0) {
      throw new Error('lastUid không hợp lệ');
    }

    const client = this.createImapClient();

    try {
      await client.connect();

      const lock = await client.getMailboxLock('INBOX');

      try {
        const messages = client.fetch(
          `${lastUid + 1}:*`,
          { uid: true },
          { uid: true },
        );

        const uids: number[] = [];

        for await (const message of messages) {
          if (message.uid > lastUid) {
            uids.push(message.uid);
          }
        }

        return uids.sort((a, b) => a - b);
      } finally {
        lock.release();
      }
    } finally {
      await this.closeImapClient(client);
    }
  }
  
  // Gửi email thông qua Gmail SMTP
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<string> {
    const host = this.configService.get<string>('EMAIL_SMTP_HOST');
    const port = Number(
      this.configService.get<string>('EMAIL_SMTP_PORT'),
    );
    const secure =
      this.configService.get<string>('EMAIL_SMTP_SECURE') === 'true';

    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME');
    const rawFrom = this.configService.get<string>('EMAIL_FROM') || user;
    const from = fromName && rawFrom ? `"${fromName}" <${rawFrom}>` : rawFrom;

    // Kiểm tra cấu hình SMTP
    if (
      !host ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !user ||
      !pass ||
      !from
    ) {
      throw new Error('Cấu hình SMTP chưa đầy đủ hoặc không hợp lệ');
    }

    if (!to?.trim() || !subject?.trim()) {
      throw new Error('Thiếu người nhận hoặc tiêu đề email');
    }

    // Tạo kết nối SMTP
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    // Gửi email
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return info.messageId;
  }
  
  // Đọc trạng thái đồng bộ email từ file JSON
  private async loadEmailSyncState(): Promise<EmailSyncState> {
    const dirPath = join(
      process.cwd(),
      'data',
    );
    const filePath = join(
      dirPath,
      'email-sync-state.json',
    );

    try {
      const fileContent = await readFile(filePath, 'utf8');

      const state: unknown = JSON.parse(fileContent);

      // Kiểm tra cấu trúc dữ liệu trước khi sử dụng
      if (
        typeof state !== 'object' ||
        state === null ||
        !('uidValidity' in state) ||
        !('lastProcessedUid' in state)
      ) {
        throw new Error('File trạng thái email không hợp lệ');
      }

      const { uidValidity, lastProcessedUid } = state;
      // Older state files do not have a retry list.
      const failedUids = 'failedUids' in state ? state.failedUids : [];

      if (
        !(
          uidValidity === null ||
          typeof uidValidity === 'string'
        ) ||
        !(
          lastProcessedUid === null ||
          (
            typeof lastProcessedUid === 'number' &&
            Number.isSafeInteger(lastProcessedUid) &&
            lastProcessedUid >= 0
          )
        )
      ) {
        throw new Error('Dữ liệu trạng thái email không hợp lệ');
      }

      if (
        !Array.isArray(failedUids) ||
        !failedUids.every((uid: unknown) =>
          typeof uid === 'number' && Number.isSafeInteger(uid) && uid > 0,
        )
      ) {
        throw new Error('Danh sách UID cần thử lại không hợp lệ');
      }

      return {
        uidValidity,
        lastProcessedUid,
        failedUids: [...new Set<number>(failedUids)],
      };
    } catch (error: unknown) {
      const isEnoent =
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'ENOENT';

      if (isEnoent) {
        const defaultState: EmailSyncState = {
          uidValidity: null,
          lastProcessedUid: null,
          failedUids: [],
        };

        // Tự động tạo thư mục data và file trạng thái ban đầu khi project mới clone
        await mkdir(dirPath, { recursive: true });
        await writeFile(
          filePath,
          JSON.stringify(defaultState, null, 2),
          'utf8',
        );

        return defaultState;
      }

      throw error;
    }
  }
  
  // Lưu trạng thái đồng bộ IMAP vào file JSON
  private async saveEmailSyncState(
    state: EmailSyncState,
  ): Promise<void> {
    const dirPath = join(
      process.cwd(),
      'data',
    );
    const filePath = join(
      dirPath,
      'email-sync-state.json',
    );

    const tempPath = `${filePath}.tmp`;

    const content = JSON.stringify(state, null, 2);

    await mkdir(dirPath, { recursive: true });

    try {
      // Ghi trạng thái mới vào file tạm
      await writeFile(tempPath, content, 'utf8');

      // Thay thế file chính bằng file tạm
      await rename(tempPath, filePath);
    } catch (error) {
      // Dọn file tạm nếu quá trình ghi thất bại
      await rm(tempPath, { force: true }).catch(() => undefined);

      throw error;
    }
  }
  
  // Lấy thông tin đồng bộ của hộp thư INBOX
  async getInboxSyncInfo(): Promise<{
    uidValidity: string;
    lastUid: number;
  }> {
    const client = this.createImapClient();

    try {
      await client.connect();

      const lock = await client.getMailboxLock('INBOX');

      try {
        const mailbox = client.mailbox;

        if (!mailbox) {
          throw new Error('Không thể mở hộp thư INBOX');
        }

        // UIDVALIDITY của hộp thư
        const uidValidity = String(mailbox.uidValidity);

        // UID tiếp theo mà máy chủ dự kiến cấp
        const uidNext = mailbox.uidNext;

        if (
          !uidValidity ||
          uidValidity === 'undefined' ||
          !Number.isSafeInteger(uidNext) ||
          uidNext < 1
        ) {
          throw new Error('Thông tin đồng bộ INBOX không hợp lệ');
        }

        return {
          uidValidity,
          lastUid: uidNext - 1,
        };
      } finally {
        lock.release();
      }
    } finally {
      await this.closeImapClient(client);
    }
  }

  private getImapSecure(port: number): boolean {
    const configured = this.configService.get<string>('EMAIL_IMAP_SECURE');
    return configured === undefined || configured === ''
      ? port === 993
      : configured === 'true';
  }

  // Hàm hỗ trợ: Tạo kết nối IMAP
  private createImapClient(): ImapFlow {
    const host =
      this.configService.getOrThrow<string>('EMAIL_IMAP_HOST');

    const port = Number(
      this.configService.getOrThrow<string>('EMAIL_IMAP_PORT'),
    );

    const secure = this.getImapSecure(port);

    const user =
      this.configService.getOrThrow<string>('EMAIL_USER');

    const pass =
      this.configService.getOrThrow<string>('EMAIL_PASSWORD');

    return new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      logger: false,
    });
  }

  // Hàm hỗ trợ: Đóng kết nối IMAP
  private async closeImapClient(client: ImapFlow): Promise<void> {
    if (client.usable) {
      await client.logout();
    } else {
      client.close();
    }
  }
}
