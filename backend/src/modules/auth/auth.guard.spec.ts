import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import type { AuthService, AuthUser } from './auth.service.js';

function setup(authorization?: string) {
    const request: {
        headers: { authorization?: string };
        user?: AuthUser;
    } = {
        headers: { authorization },
    };

    const user: AuthUser = {
        user_id: '11111111-1111-4111-8111-111111111111',
        full_name: 'Test Agent',
        email: 'agent@example.com',
        role: 'agent',
    };

    const authenticate = vi.fn().mockResolvedValue(user);

    const guard = new AuthGuard(
        { authenticate } as unknown as AuthService,
    );

    const context = {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;

    return { guard, context, request, user, authenticate };
}

describe('AuthGuard', () => {
    it('rejects a missing authorization header', async () => {
        const { guard, context, authenticate } = setup();

        await expect(guard.canActivate(context))
            .rejects.toBeInstanceOf(UnauthorizedException);

        expect(authenticate).not.toHaveBeenCalled();
    });

    it('rejects a different authentication scheme', async () => {
        const { guard, context, authenticate } = setup('Basic abc');

        await expect(guard.canActivate(context))
            .rejects.toBeInstanceOf(UnauthorizedException);

        expect(authenticate).not.toHaveBeenCalled();
    });

    it('rejects an empty bearer token', async () => {
        const { guard, context } = setup('Bearer ');

        await expect(guard.canActivate(context))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('attaches the authenticated database user', async () => {
        const {
            guard,
            context,
            request,
            user,
            authenticate,
        } = setup('Bearer test-token');

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(authenticate).toHaveBeenCalledWith('test-token');
        expect(request.user).toEqual(user);
    });

    it('propagates token verification failure', async () => {
        const { guard, context, request, authenticate } =
            setup('Bearer invalid-token');

        authenticate.mockRejectedValueOnce(
            new UnauthorizedException(),
        );

        await expect(guard.canActivate(context))
            .rejects.toBeInstanceOf(UnauthorizedException);

        expect(request.user).toBeUndefined();
    });
});