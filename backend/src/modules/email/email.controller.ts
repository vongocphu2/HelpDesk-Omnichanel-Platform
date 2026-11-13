
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('email')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
  ) { }

  @Get('test-connection')
  async testConnection() {
    const connected =
      await this.emailService.testImapConnection();

    return {
      status: connected ? 'connected' : 'disconnected',
      message: connected
        ? 'Kết nối Gmail IMAP thành công'
        : 'Không thể kết nối Gmail IMAP',
    };
  }

  // Chỉ dùng để kiểm thử đồng bộ Email -> Ticket.
  // Phải bảo vệ hoặc gỡ endpoint này trước khi triển khai.
  @Post('sync')
  async syncEmails() {
    await this.emailService.checkNewEmailsAutomatically();

    return {
      message: 'Đã thực hiện yêu cầu đồng bộ Email',
    };
  }
}
