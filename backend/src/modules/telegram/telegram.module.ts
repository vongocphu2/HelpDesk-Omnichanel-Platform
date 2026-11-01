import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TicketsModule } from '../tickets/tickets.module.js';
import { TelegramController } from './telegram.controller.js';
import { TelegramService } from './telegram.service.js';

@Module({
  imports: [
    ConfigModule,
    TicketsModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule { }
