import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        // .shortcut: In-memory limits; use shared storage when running multiple instances.
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10, blockDuration: 60_000 }]),
    ],
    controllers: [
        AuthController,
    ],
    providers: [
        AuthService,
        AuthGuard,
        RolesGuard,
        ThrottlerGuard,
    ],
    exports: [
        AuthService,
        AuthGuard,
        RolesGuard,
    ],
})
export class AuthModule { }
