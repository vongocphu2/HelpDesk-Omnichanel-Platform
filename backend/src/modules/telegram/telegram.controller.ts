
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  InternalServerErrorException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { TelegramService } from './telegram.service.js';
@Controller('telegram')
export class TelegramController implements OnModuleInit {
  private expectedSecret!: Buffer;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) { }

  onModuleInit(): void {
    const secret = this
  }

  private validateUpdate(
    value: unknown,
  ): asserts value is Parameters<TelegramService['handleUpdate']>[0] {
    const isObject = (
      input: unknown,
    ): input is Record<string, unknown> =>
      typeof input === 'object' &&
      input !== null &&
      !Array.isArray(input);

    const isInteger = (input: unknown): input is number =>
      typeof input === 'number' && Number.isSafeInteger(input);

    if (
      !isObject(value) ||
      !isInteger(value.update_id) ||
      value.update_id < 0
    ) {
      throw new BadRequestException('Telegram update_id không hợp lệ');
    }

    // Update hợp lệ thuộc loại khác sẽ được service bỏ qua.
    if (value.message === undefined) {
      return;
    }

    const message = value.message;

    if (
      !isObject(message) ||
      !isInteger(message.message_id) ||
      message.message_id < 0
    ) {
      throw new BadRequestException('Telegram message không hợp lệ');
    }

    const chat = message.chat;

    if (
      !isObject(chat) ||
      !isInteger(chat.id) ||
      typeof chat.type !== 'string' ||
      chat.type.length === 0
    ) {
      throw new BadRequestException('Telegram chat không hợp lệ');
    }

    if (
      message.text !== undefined &&
      typeof message.text !== 'string'
    ) {
      throw new BadRequestException('Telegram text phải là chuỗi');
    }

    if (message.from !== undefined) {
      const sender = message.from;

      if (
        !isObject(sender) ||
        !isInteger(sender.id) ||
        typeof sender.first_name !== 'string' ||
        (sender.last_name !== undefined &&
          typeof sender.last_name !== 'string') ||
        (sender.username !== undefined &&
          typeof sender.username !== 'string')
      ) {
        throw new BadRequestException('Người gửi Telegram không hợp lệ');
      }
    }
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token')
    receivedToken: string | undefined,
    @Body() update: unknown,
  ) {
    if (!this.expectedSecret) {
      throw new InternalServerErrorException(
        'Telegram webhook chưa được cấu hình',
      );
    }

    if (typeof receivedToken !== 'string' || receivedToken.length === 0) {
      throw new UnauthorizedException(
        'Thiếu Telegram webhook secret',
      );
    }

    const received = Buffer.from(receivedToken);

    if (
      this.expectedSecret.length !== received.length ||
      !timingSafeEqual(this.expectedSecret, received)
    ) {
      throw new UnauthorizedException(
        'Telegram webhook secret không hợp lệ',
      );
    }
    this.validateUpdate(update);

    await this.telegramService.handleUpdate(update);

    return { ok: true };
  }
}
