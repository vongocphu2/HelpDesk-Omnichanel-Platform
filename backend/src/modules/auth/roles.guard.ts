import {
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import type {
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import type { StaffRole } from './roles.decorator.js';
import type { AuthenticatedRequest } from './auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        if (!request.user) {
            throw new UnauthorizedException('Chưa xác thực tài khoản');
        }

        const roles = this.reflector.getAllAndOverride<StaffRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (
            !roles ||
            !roles.some((role) => role === request.user.role)
        ) {
            throw new ForbiddenException(
                'Bạn không có quyền thực hiện thao tác này',
            );
        }

        return true;
    }
}