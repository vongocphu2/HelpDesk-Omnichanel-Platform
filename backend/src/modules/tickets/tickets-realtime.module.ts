import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TicketsGateway } from './tickets.gateway.js';

// One gateway instance shared by intake, ticket updates and the AI worker.
@Module({
  imports: [AuthModule],
  providers: [TicketsGateway],
  exports: [TicketsGateway],
})
export class TicketsRealtimeModule {}
