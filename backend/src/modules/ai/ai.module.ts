import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket, TicketMessage } from '../../database/entities/index.js';
import { TriageProviderService } from './triage-provider.service.js';
import { TicketTriageService } from './ticket-triage.service.js';
import { AiController } from './ai.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMessage])],
  controllers: [AiController],
  providers: [TriageProviderService, TicketTriageService],
})
export class AiModule {}
