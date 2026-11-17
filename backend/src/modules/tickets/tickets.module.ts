import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    Ticket, User, Role, Channel, TicketMessage, TicketStatusHistory,
} from '../../database/entities/index.js';
import { TicketsService } from './tickets.service.js';
import { RoundRobinAssignmentService } from './round-robin-assignment.service.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsGateway } from './tickets.gateway.js';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
    imports: [
        AuthModule,
        forwardRef(() => AiModule),
        TypeOrmModule.forFeature([
            Ticket, User, Role, Channel, TicketMessage, TicketStatusHistory,
        ]),
    ],
    controllers: [TicketsController],
    providers: [TicketsService, RoundRobinAssignmentService, TicketsGateway, OutboundDispatcherService],
    exports: [TicketsService, RoundRobinAssignmentService, TicketsGateway, OutboundDispatcherService],
})
export class TicketsModule {}
