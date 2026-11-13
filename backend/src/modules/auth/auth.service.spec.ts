import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { SignJWT } from 'jose';
import { AuthService } from './auth.service.js';

const secret = 'ab'.repeat(32);
const password = 'LocalTestPassword123!';
const userId = '11111111-1111-4111-8111-111111111111';

let passwordHash: string;

beforeAll(async () => {
    passwordHash = await hash(password, 4);
});

function setup() {
    const user = {
        user_id: userId,
        full_name: 'Test Admin',
        email: 'admin@example.com',
        password_hash: passwordHash,
        status: 'active',
        role: { role_name: 'admin' },
    };

    const query = {
        addSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
    };

    const users = {
        createQueryBuilder: vi.fn().mockReturnValue(query),
        findOne: vi.fn().mockResolvedValue(user),
    };

    const config = new ConfigService({
        jwt: { secret, expiresIn: '1h' },
    });

    const service = new AuthService(users as never, config);

    return { service, user, query, users };
}

describe('AuthService', () => {
    it('logs in and verifies the issued token without exposing the hash', async () => {
        const { service } = setup();

        const result = await service.login({
            email: 'admin@example.com',
            password,
        });

        expect(result.expires_in).toBe(3600);
        expect(result.token_type).toBe('Bearer');
        expect(JSON.stringify(result)).not.toContain(passwordHash);

        const currentUser = await service.authenticate(result.access_token);

        expect(currentUser.user_id).toBe(userId);
        expect(currentUser.role).toBe('admin');
        expect(currentUser).not.toHaveProperty('password_hash');
    });

    it('rejects a wrong password', async () => {
        const { service } = setup();

        await expect(service.login({
            email: 'admin@example.com',
            password: 'WrongPassword',
        })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
        const { service, query } = setup();
        query.getOne.mockResolvedValueOnce(null);

        await expect(service.login({
            email: 'missing@example.com',
            password,
        })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects passwords exceeding 72 UTF-8 bytes', async () => {
        const { service, users } = setup();

        await expect(service.login({
            email: 'admin@example.com',
            password: 'ắ'.repeat(25),
        })).rejects.toBeInstanceOf(UnauthorizedException);

        expect(users.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects a token whose signature was changed', async () => {
        const { service } = setup();
        const result = await service.login({
            email: 'admin@example.com',
            password,
        });

        const parts = result.access_token.split('.');
        parts[2] =
            (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);

        await expect(service.authenticate(parts.join('.')))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
        const { service } = setup();
        const now = Math.floor(Date.now() / 1000);

        const token = await new SignJWT({})
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setSubject(userId)
            .setIssuer('helpdesk-api')
            .setAudience('helpdesk-staff')
            .setIssuedAt(now - 120)
            .setExpirationTime(now - 60)
            .sign(Buffer.from(secret, 'hex'));

        await expect(service.authenticate(token))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an existing token after the account is locked', async () => {
        const { service, user } = setup();
        const result = await service.login({
            email: 'admin@example.com',
            password,
        });

        user.status = 'inactive';

        await expect(service.authenticate(result.access_token))
            .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('uses the current database role', async () => {
        const { service, user } = setup();
        const result = await service.login({
            email: 'admin@example.com',
            password,
        });

        user.role.role_name = 'agent';

        const currentUser = await service.authenticate(result.access_token);

        expect(currentUser.role).toBe('agent');
    });

    it('rejects customer accounts at staff login', async () => {
        const { service, user } = setup();
        user.role.role_name = 'customer';

        await expect(service.login({
            email: 'admin@example.com',
            password,
        })).rejects.toBeInstanceOf(UnauthorizedException);
    });
});