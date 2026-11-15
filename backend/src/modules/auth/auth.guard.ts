import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import type {
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
    user: AuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const authorization = request.headers.authorization;
        const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');

        if (!match) {
            throw new UnauthorizedException(
                'Cần cung cấp Authorization: Bearer <token>',
            );
        }

        request.user = await this.authService.authenticate(match[1]);

        return true;
    }
}