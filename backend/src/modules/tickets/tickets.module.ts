import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    Ticket, User, Role, Channel, TicketMessage, TicketStatusHistory,
} from '../../database/entities/index.js';
import { TicketsService } from './tickets.service.js';
import { RoundRobinAssignmentService } from './round-robin-assignment.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsRealtimeModule } from './tickets-realtime.module.js';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
    imports: [
        AuthModule,
        TicketsRealtimeModule,
        forwardRef(() => AiModule),
        TypeOrmModule.forFeature([
            Ticket, User, Role, Channel, TicketMessage, TicketStatusHistory,
        ]),
    ],
    controllers: [TicketsController],
    providers: [TicketsService, RoundRobinAssignmentService, OutboundDispatcherService],
    exports: [TicketsService, RoundRobinAssignmentService, TicketsRealtimeModule, OutboundDispatcherService],
})
export class TicketsModule {}
