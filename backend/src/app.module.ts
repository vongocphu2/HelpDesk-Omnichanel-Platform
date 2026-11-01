import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration.js';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './modules/email/email.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { WebformModule } from './modules/webform/webform.module.js';
import { EmailProcessedMessage } from './modules/email/email-processed.entity.js';
import { TelegramModule } from './modules/telegram/telegram.module.js';
import { TelegramProcessedUpdate } from './modules/telegram/telegram-processed-update.entity.js';
import {
  Role,
  User,
  Team,
  Channel,
  SlaPolicy,
  Ticket,
  TicketMessage,
  TicketStatusHistory,
  AuditLog,
} from './database/entities/index.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
          Role,
          User,
          Team,
          Channel,
          SlaPolicy,
          Ticket,
          TicketMessage,
          TicketStatusHistory,
          AuditLog,
          EmailProcessedMessage,
          TelegramProcessedUpdate,
        ],
        synchronize: configService.get<boolean>('database.synchronize', true),
        logging: configService.get<boolean>('database.logging', false),
      }),
    }),

    HealthModule,
    ScheduleModule.forRoot(),
    EmailModule,
    TicketsModule,
    WebformModule,
    TelegramModule,
  ],
})
export class AppModule { }
