import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { AddTelegramIdentity1793462400000 } from './migrations/1793462400000-AddTelegramIdentity.js';

await ConfigModule.forRoot({
    envFilePath: ['.env', '../.env'],
});

const port = Number(process.env.DB_PORT ?? '5432');

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('DB_PORT không hợp lệ');
}

const password = process.env.DB_PASSWORD;

if (!password) {
    throw new Error('Thiếu DB_PASSWORD để chạy migration');
}

export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port,
    username: process.env.DB_USERNAME ?? 'postgres',
    password,
    database: process.env.DB_DATABASE ?? 'helpdesk_db',

    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrationsTransactionMode: 'all',

    migrations: [AddTelegramIdentity1793462400000],
});