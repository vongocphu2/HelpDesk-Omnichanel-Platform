import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { EmailController } from './email.controller.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { EmailProcessedMessage } from './email-processed.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
@Module({
  imports: [
    AuthModule,
    ConfigModule,
    TicketsModule,
    TypeOrmModule.forFeature([EmailProcessedMessage]),
  ],
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule { }
