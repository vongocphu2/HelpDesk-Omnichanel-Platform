import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';

/**
 * Task 5.3 — Socket.IO Realtime Gateway
 *
 * Events (server → client):
 *   ticket:updated   { ticket_id, ticket_code, status, priority, assigned_agent_id }
 *   message:new      { message_id, ticket_id, ticket_code, sender_type, content, created_at, is_ai_draft }
 *   triage:completed { ticket_id, ticket_code, sentiment_label, urgency_score, is_urgent_bumped }
 *
 * Events (client → server):
 *   join:ticket  { ticket_id }  — subscribe to a ticket room
 *   leave:ticket { ticket_id }  — unsubscribe
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/ws',
})
export class TicketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TicketsGateway.name);

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    // Xác thực JWT từ query param hoặc Authorization header
    const token =
      (client.handshake.query['token'] as string | undefined) ??
      (client.handshake.headers.authorization?.replace(/^Bearer /i, '') ?? '');

    if (!token) {
      this.logger.debug(`[WS] Client ${client.id} không có token — ngắt kết nối`);
      client.disconnect();
      return;
    }

    try {
      const user = await this.authService.authenticate(token);
      // Gắn user vào socket data để dùng sau
      client.data.user = user;
      this.logger.debug(`[WS] Connected: ${client.id} user=${user.user_id} role=${user.role}`);
    } catch {
      this.logger.debug(`[WS] Client ${client.id} token không hợp lệ — ngắt kết nối`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`[WS] Disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:ticket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticket_id: string },
  ): void {
    if (!data?.ticket_id) return;
    const room = `ticket:${data.ticket_id}`;
    void client.join(room);
    this.logger.debug(`[WS] ${client.id} joined ${room}`);
  }

  @SubscribeMessage('leave:ticket')
  handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticket_id: string },
  ): void {
    if (!data?.ticket_id) return;
    const room = `ticket:${data.ticket_id}`;
    void client.leave(room);
    this.logger.debug(`[WS] ${client.id} left ${room}`);
  }

  // ─── Phát sóng từ service khác ───────────────────────────────────────────

  /** Phát khi có tin nhắn mới trong ticket */
  emitNewMessage(payload: {
    message_id: string;
    ticket_id: string;
    ticket_code: string;
    sender_type: string;
    content: string;
    created_at: Date;
    is_ai_draft: boolean;
  }): void {
    this.server
      .to(`ticket:${payload.ticket_id}`)
      .emit('message:new', payload);
    // Phát tới room 'inbox' cho danh sách tổng Unified Inbox
    this.server.to('inbox').emit('message:new', payload);
  }

  /** Phát khi ticket được cập nhật (status, priority, assign) */
  emitTicketUpdated(payload: {
    ticket_id: string;
    ticket_code: string;
    status?: string;
    priority?: string;
    is_urgent_bumped?: boolean;
    assigned_agent_id?: string | null;
  }): void {
    this.server
      .to(`ticket:${payload.ticket_id}`)
      .emit('ticket:updated', payload);
    this.server.to('inbox').emit('ticket:updated', payload);
  }

  /** Phát khi AI Triage hoàn tất */
  emitTriageCompleted(payload: {
    ticket_id: string;
    ticket_code: string;
    sentiment_label: string | null;
    urgency_score: number | null;
    is_urgent_bumped: boolean;
  }): void {
    this.server
      .to(`ticket:${payload.ticket_id}`)
      .emit('triage:completed', payload);
    this.server.to('inbox').emit('triage:completed', payload);
  }
}
