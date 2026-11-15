import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    Ticket,
    User,
    Role,
    Channel,
    TicketMessage,
    TicketStatusHistory,
} from '../../database/entities/index.js';
import { TicketsService } from './tickets.service.js';
// Task 4.4 - Tự động phân công Ticket theo Round-robin
import { RoundRobinAssignmentService } from './round-robin-assignment.service.js';
import { TicketsController } from './tickets.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [
        AuthModule,
        TypeOrmModule.forFeature([
            Ticket,
            User,
            Role,
            Channel,
            TicketMessage,
            TicketStatusHistory,
        ]),
    ],
    controllers: [TicketsController],
    providers: [
        TicketsService,
        RoundRobinAssignmentService,
    ],
    exports: [
        TicketsService,
        RoundRobinAssignmentService,
    ],
})
export class TicketsModule { }
