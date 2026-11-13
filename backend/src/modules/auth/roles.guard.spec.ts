import { describe, expect, it } from 'vitest';
import {
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { StaffRole } from './roles.decorator.js';

function setup(role?: string, allowed?: StaffRole[]) {
    const handler = () => { };
    class TestController { }

    if (allowed !== undefined) {
        Reflect.defineMetadata(ROLES_KEY, allowed, handler);
    }

    const context = {
        getHandler: () => handler,
        getClass: () => TestController,
        switchToHttp: () => ({
            getRequest: () => ({
                user: role ? { role } : undefined,
            }),
        }),
    } as unknown as ExecutionContext;

    return {
        guard: new RolesGuard(new Reflector()),
        context,
    };
}

describe('RolesGuard', () => {
    it('allows an explicitly permitted role', () => {
        const { guard, context } = setup('admin', ['admin']);

        expect(guard.canActivate(context)).toBe(true);
    });

    it('allows manager when manager is listed', () => {
        const { guard, context } =
            setup('manager', ['admin', 'manager']);

        expect(guard.canActivate(context)).toBe(true);
    });

    it('rejects an agent from an admin-only operation', () => {
        const { guard, context } = setup('agent', ['admin']);

        expect(() => guard.canActivate(context))
            .toThrow(ForbiddenException);
    });

    it('rejects a missing authenticated user', () => {
        const { guard, context } = setup(undefined, ['admin']);

        expect(() => guard.canActivate(context))
            .toThrow(UnauthorizedException);
    });

    it('rejects a route without role metadata', () => {
        const { guard, context } = setup('admin');

        expect(() => guard.canActivate(context))
            .toThrow(ForbiddenException);
    });
});
