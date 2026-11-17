import { describe, expect, it, vi } from 'vitest';
import { TelegramService } from './telegram.service.js';
import { TelegramProcessedUpdate } from './telegram-processed-update.entity.js';

describe('Telegram intake commit boundary', () => {
  it.each([false, true])(
    'publishes only after commit (rollback=%s)',
    async (rollback) => {
      const ticket = {
        ticket_id: 'id',
        ticket_code: 'TK-1001',
        subject: 'test',
      };
      const tickets = {
        createFromWebForm: vi.fn(async () => ticket),
        publishCreatedTicket: vi.fn(),
      };
      const processed = {
        createQueryBuilder: () => ({
          insert() {
            return this;
          },
          values() {
            return this;
          },
          orIgnore() {
            return this;
          },
          returning() {
            return this;
          },
          execute: async () => ({ raw: [{ id: 'processed' }] }),
        }),
        update: vi.fn(),
      };
      const users = {
        findOne: async () => ({ user_id: 'customer', status: 'active' }),
      };
      const database = {
        transaction: async (
          callback: (manager: unknown) => Promise<unknown>,
        ) => {
          const result = await callback({
            getRepository: (entity: unknown) =>
              entity === TelegramProcessedUpdate ? processed : users,
          });
          expect(tickets.publishCreatedTicket).not.toHaveBeenCalled();
          if (rollback) throw new Error('rollback');
          return result;
        },
      };
      const service = new TelegramService(
        tickets as never,
        database as never,
        { get: () => undefined } as never,
      );
      const result = service.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          text: 'Need support urgently',
          chat: { id: 123, type: 'private' },
          from: { id: 123, first_name: 'Customer' },
        },
      });
      if (rollback) {
        await expect(result).rejects.toThrow('rollback');
        expect(tickets.publishCreatedTicket).not.toHaveBeenCalled();
      } else {
        await result;
        expect(tickets.publishCreatedTicket).toHaveBeenCalledWith(ticket);
      }
    },
  );
});
