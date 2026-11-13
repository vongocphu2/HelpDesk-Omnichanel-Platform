import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
    it('accepts an email and password', async () => {
        const dto = Object.assign(new LoginDto(), {
            email: 'admin@example.com',
            password: 'LocalTestPassword123!',
        });

        expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects an invalid email', async () => {
        const dto = Object.assign(new LoginDto(), {
            email: 'not-an-email',
            password: 'LocalTestPassword123!',
        });

        const errors = await validate(dto);

        expect(errors.map((error) => error.property))
            .toContain('email');
    });

    it('rejects an empty password', async () => {
        const dto = Object.assign(new LoginDto(), {
            email: 'admin@example.com',
            password: '',
        });

        const errors = await validate(dto);

        expect(errors.map((error) => error.property))
            .toContain('password');
    });

    it('rejects a missing password', async () => {
        const dto = Object.assign(new LoginDto(), {
            email: 'admin@example.com',
        });

        const errors = await validate(dto);

        expect(errors.map((error) => error.property))
            .toContain('password');
    });

    it('rejects an excessively long password', async () => {
        const dto = Object.assign(new LoginDto(), {
            email: 'admin@example.com',
            password: 'a'.repeat(73),
        });

        const errors = await validate(dto);

        expect(errors.map((error) => error.property))
            .toContain('password');
    });
});