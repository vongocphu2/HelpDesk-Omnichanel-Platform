import { describe, it, expect, vi } from 'vitest';
import { TicketsGateway } from './tickets.gateway.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  // AuthService mock — authenticate trả về user giả
  const authService = {
    authenticate: vi.fn().mockResolvedValue({
      user_id: 'agent-uuid',
      full_name: 'Agent Test',
      email: 'agent@test.com',
      role: 'agent',
    }),
  };

  const gateway = new TicketsGateway(authService as never);

  // Mock Socket.IO Server — emit/to là các mock function
  // Gateway dùng this.server.to(...).emit(...) để phát sóng
  const emitMock = vi.fn();
  const toMock = vi.fn().mockReturnValue({ emit: emitMock });
  gateway.server = { to: toMock } as never;

  return { gateway, toMock, emitMock, authService };
}

// ─── Test cases ───────────────────────────────────────────────────────────────

describe('TicketsGateway', () => {
  it('joins inbox only after authentication succeeds', async () => {
    const { gateway, authService } = setup();
    let authenticate!: (user: object) => void;
    authService.authenticate.mockReturnValueOnce(new Promise(resolve => { authenticate = resolve; }));
    const client = { id: 'socket', handshake: {auth:{token:'token'},query:{},headers:{}}, data:{}, join:vi.fn(), disconnect:vi.fn() };
    const pending = gateway.handleConnection(client as never);
    gateway.handleJoinTicket(client as never, {ticket_id:'test'});
    expect(client.join).not.toHaveBeenCalled();
    authenticate({user_id:'agent', role:'agent'});
    await pending;
    expect(client.join).toHaveBeenCalledWith('inbox');
    gateway.handleJoinTicket(client as never, {ticket_id:'test'});
    expect(client.join).toHaveBeenCalledWith('ticket:test');
  });

  it('disconnects an invalid token without joining rooms', async () => {
    const { gateway, authService } = setup();
    authService.authenticate.mockRejectedValueOnce(new Error('invalid token'));
    const client = {id:'socket',handshake:{auth:{token:'bad'},query:{},headers:{}},data:{},join:vi.fn(),disconnect:vi.fn()};
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('emitNewMessage phát tới đúng room của ticket', () => {
    // Gateway phải phát sóng tới room "ticket:<ticket_id>"
    // để chỉ những client đang xem ticket đó nhận được
    const { gateway, toMock, emitMock } = setup();

    gateway.emitNewMessage({
      message_id: 'msg-001',
      ticket_id: 'ticket-uuid-001',
      ticket_code: 'TK-0001',
      sender_type: 'agent',
      content: 'Chúng tôi đang xử lý.',
      created_at: new Date(),
      is_ai_draft: false,
    });

    // Phải gọi to('ticket:ticket-uuid-001') trước khi emit
    expect(toMock).toHaveBeenCalledWith(['ticket:ticket-uuid-001', 'inbox']);
    // Event name phải là 'message:new'
    expect(emitMock).toHaveBeenCalledWith(
      'message:new',
      expect.objectContaining({
        ticket_id: 'ticket-uuid-001',
        content: 'Chúng tôi đang xử lý.',
      }),
    );
  });

  it('emitTicketUpdated phát tới đúng room và inbox', () => {
    // Khi ticket thay đổi status/priority/assign → phát tới:
    // 1. room của ticket cụ thể
    // 2. room 'inbox' (danh sách tổng Unified Inbox cũng cập nhật)
    const { gateway, toMock, emitMock } = setup();

    gateway.emitTicketUpdated({
      ticket_id: 'ticket-uuid-002',
      ticket_code: 'TK-0002',
      status: 'resolved',
      priority: 'medium',
    });

    expect(toMock).toHaveBeenCalledWith(['ticket:ticket-uuid-002', 'inbox']);
    expect(emitMock).toHaveBeenCalledWith(
      'ticket:updated',
      expect.objectContaining({ status: 'resolved' }),
    );
  });

  it('emitTriageCompleted phát kết quả AI tới đúng room', () => {
    // Sau khi AI triage xong → phát kết quả để Frontend cập nhật
    // badge sentiment và cờ urgent mà không cần reload trang
    const { gateway, toMock, emitMock } = setup();

    gateway.emitTriageCompleted({
      ticket_id: 'ticket-uuid-003',
      ticket_code: 'TK-0003',
      sentiment_label: 'angry',
      urgency_score: 0.95,
      is_urgent_bumped: true,
    });

    expect(toMock).toHaveBeenCalledWith(['ticket:ticket-uuid-003', 'inbox']);
    expect(emitMock).toHaveBeenCalledWith(
      'triage:completed',
      expect.objectContaining({
        sentiment_label: 'angry',
        is_urgent_bumped: true,
      }),
    );
  });

  it('handleJoinTicket cho client vào đúng room', () => {
    // Client gửi event join:ticket → server cho socket vào room tương ứng
    // để nhận các sự kiện realtime của ticket đó
    const { gateway } = setup();

    const joinMock = vi.fn();
    const client = { id: 'socket-001', data: { user: { role: 'agent' } }, join: joinMock } as never;

    gateway.handleJoinTicket(client, { ticket_id: 'ticket-uuid-004' });

    expect(joinMock).toHaveBeenCalledWith('ticket:ticket-uuid-004');
  });

  it('handleLeaveTicket cho client rời room', () => {
    // Client đóng tab hoặc chuyển sang ticket khác → rời room cũ
    const { gateway } = setup();

    const leaveMock = vi.fn();
    const client = { id: 'socket-001', data: { user: { role: 'agent' } }, leave: leaveMock } as never;

    gateway.handleLeaveTicket(client, { ticket_id: 'ticket-uuid-004' });

    expect(leaveMock).toHaveBeenCalledWith('ticket:ticket-uuid-004');
  });

});
