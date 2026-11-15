import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { UpdateTicketDto } from './update-ticket.dto.js';

describe('UpdateTicketDto', () => {
    it('accepts status only', async () => {
        const dto = Object.assign(new UpdateTicketDto(), {
            status: 'open',
        });

        expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts priority only', async () => {
        const dto = Object.assign(new UpdateTicketDto(), {
            priority: 'urgent',
        });

        expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts status and priority together', async () => {
        const dto = Object.assign(new UpdateTicketDto(), {
            status: 'pending',
            priority: 'high',
        });

        expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects unsupported values', async () => {
        const dto = Object.assign(new UpdateTicketDto(), {
            status: 'in_progress',
            priority: 'critical',
        });

        expect(await validate(dto)).toHaveLength(2);
    });

    it('rejects null values', async () => {
        const dto = Object.assign(new UpdateTicketDto(), {
            status: null,
            priority: null,
        });

        expect(await validate(dto)).toHaveLength(2);
    });
});