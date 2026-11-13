import { describe, expect, it, vi } from 'vitest';
import {
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { Ticket } from '../../database/entities/index.js';
import { TicketsService } from './tickets.service.js';

function setup(found = true) {
    const ticket = {
        ticket_id: '11111111-1111-4111-8111-111111111111',
        ticket_code: 'TK-1001',
        status: 'open',
        priority: 'urgent',
        is_urgent_bumped: true,
        closed_at: null,
    };

    const tickets = {
        findOne: vi.fn().mockResolvedValue(found ? ticket : null),
        save: vi.fn().mockResolvedValue(ticket),
    };

    const history = {
        create: vi.fn((value) => value),
        save: vi.fn().mockResolvedValue({}),
    };

    const manager = {
        getRepository: vi.fn((entity) =>
            entity === Ticket ? tickets : history,
        ),
    };

    const transaction = vi.fn((callback) => callback(manager));
    const repository = { manager: { transaction } };

    const service = new TicketsService(
        repository as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
    );

    vi.spyOn(service, 'findById').mockResolvedValue(ticket as Ticket);

    return { service, ticket, tickets, history, transaction };
}

describe('TicketsService.update', () => {
    it('rejects an empty update', async () => {
        const { service, transaction } = setup();

        await expect(service.update('TK-1001', {}))
            .rejects.toBeInstanceOf(BadRequestException);

        expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects a missing ticket', async () => {
        const { service } = setup(false);

        await expect(service.update('TK-9999', { status: 'closed' }))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('closes the ticket and records the previous status', async () => {
        const { service, ticket, history } = setup();

        await service.update('TK-1001', { status: 'closed' });

        expect(ticket.status).toBe('closed');
        expect(ticket.closed_at).toBeInstanceOf(Date);
        expect(history.save).toHaveBeenCalledWith({
            ticket_id: ticket.ticket_id,
            old_status: 'open',
            new_status: 'closed',
            changed_by: null,
        });
    });

    it('does not write duplicate history for an unchanged status', async () => {
        const { service, tickets, history } = setup();

        await service.update('TK-1001', { status: 'open' });

        expect(tickets.save).not.toHaveBeenCalled();
        expect(history.save).not.toHaveBeenCalled();
    });

    it('clears the AI queue bump when priority is lowered manually', async () => {
        const { service, ticket, history } = setup();

        await service.update('TK-1001', { priority: 'medium' });

        expect(ticket.priority).toBe('medium');
        expect(ticket.is_urgent_bumped).toBe(false);
        expect(history.save).not.toHaveBeenCalled();
    });

    it('propagates a history write failure', async () => {
        const { service, history } = setup();
        history.save.mockRejectedValueOnce(new Error('history failed'));

        await expect(service.update('TK-1001', { status: 'closed' }))
            .rejects.toThrow('history failed');
    });
});