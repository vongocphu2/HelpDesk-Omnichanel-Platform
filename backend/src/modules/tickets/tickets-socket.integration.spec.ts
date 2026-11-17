import { expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service.js';
import { TicketsGateway } from './tickets.gateway.js';

it('delivers each event once over Socket.IO after authenticated room subscriptions', async () => {
  const module = await Test.createTestingModule({
    providers: [
      TicketsGateway,
      {
        provide: AuthService,
        useValue: {
          authenticate: async (token: string) => {
            if (token !== 'test-token') throw new Error('invalid');
            return { user_id: 'agent', role: 'agent' };
          },
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const gateway = app.get(TicketsGateway);
  const url = (await app.getUrl()).replace('http:', 'ws:');
  const socket = new WebSocket(`${url}/socket.io/?EIO=4&transport=websocket`);
  const packets: string[] = [];
  socket.addEventListener('message', (event) => {
    const packet = String(event.data);
    packets.push(packet);
    if (packet.startsWith('0')) socket.send('40/ws,{"token":"test-token"}');
    if (packet === '2') socket.send('3');
  });
  try {
    await vi.waitFor(() =>
      expect(packets.some((packet) => packet.startsWith('40/ws,'))).toBe(true),
    );
    await vi.waitFor(() => expect(gateway.server.sockets.size).toBe(1));
    // Namespace rooms are accessible on the injected Socket.IO namespace.
    await vi.waitFor(() =>
      expect(gateway.server.adapter.rooms.has('inbox')).toBe(true),
    );
    socket.send('42/ws,["join:ticket",{"ticket_id":"ticket-id"}]');
    await vi.waitFor(() =>
      expect(gateway.server.adapter.rooms.has('ticket:ticket-id')).toBe(true),
    );
    gateway.emitNewMessage({
      message_id: 'message-id',
      ticket_id: 'ticket-id',
      ticket_code: 'TK-1001',
      sender_type: 'customer',
      content: 'hello',
      created_at: new Date(),
      is_ai_draft: false,
    });
    gateway.emitTicketUpdated({
      ticket_id: 'ticket-id',
      ticket_code: 'TK-1001',
      status: 'open',
    });
    await vi.waitFor(() =>
      expect(packets.some((packet) => packet.includes('ticket:updated'))).toBe(
        true,
      ),
    );
    expect(
      packets.filter((packet) => packet.includes('message:new')),
    ).toHaveLength(1);
    expect(
      packets.filter((packet) => packet.includes('ticket:updated')),
    ).toHaveLength(1);
  } finally {
    socket.close();
    await app.close();
  }
}, 15000);
