import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket, TicketMessage, User } from '../../database/entities/index.js';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { EmailModule } from '../email/email.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { TicketsRealtimeModule } from './tickets-realtime.module.js';

@Module({
  imports: [
    TicketsRealtimeModule,
    forwardRef(() => EmailModule),
    forwardRef(() => TelegramModule),
    TypeOrmModule.forFeature([Ticket, TicketMessage, User]),
  ],
  providers: [OutboundDispatcherService],
  exports: [OutboundDispatcherService],
})
export class OutboundDispatcherModule {}
