import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { TriageProviderService } from './triage-provider.service.js';
import { TicketTriageService } from './ticket-triage.service.js';
import { AiController } from './ai.controller.js';
import { AuthModule } from '../auth/auth.module.js';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Ticket, TicketMessage]),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
        blockDuration: 60_000,
      },
    ]),
  ],
  controllers: [AiController],
  providers: [TriageProviderService, ThrottlerGuard, TicketTriageService],
})
export class AiModule { }
