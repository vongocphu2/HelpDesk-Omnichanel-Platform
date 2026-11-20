
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Ticket, User } from '../../database/entities/index.js';

@Injectable()
export class RoundRobinAssignmentService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  /**
   * Task 4.4 - Phân công Ticket tự động theo Round-robin.
   *
   * - Chỉ chọn Agent đang hoạt động.
   * - Ưu tiên Agent cùng Team với Ticket.
   * - Không ghi đè Ticket đã được phân công.
   * - Lưu lượt phân công trong PostgreSQL.
   * - Hỗ trợ transaction có sẵn của Email/Telegram.
   */
  async assignNextAgent(
    ticketId: string,
    existingManager?: EntityManager,
  ): Promise<Ticket> {
    const execute = async (
      manager: EntityManager,
    ): Promise<Ticket> => {
      const ticketRepo = manager.getRepository(Ticket);
      const userRepo = manager.getRepository(User);

      // 1. Đọc Ticket để xác định phạm vi phân công.
      // Chưa khóa Ticket ở bước này.
      const initialTicket = await ticketRepo
        .createQueryBuilder('ticket')
        .where(
          '(ticket.ticket_id::text = :ticketId OR ticket.ticket_code = :ticketId)',
          { ticketId },
        )
        .getOne();

      if (!initialTicket) {
        throw new NotFoundException('Không tìm thấy Ticket');
      }

      if (initialTicket.assigned_agent_id) {
        throw new ConflictException('Ticket đã được phân công');
      }

      const scopeKey = initialTicket.team_id
        ? `team:${initialTicket.team_id}`
        : 'global';

      // 2. Tạo trạng thái Round-robin nếu chưa có.
      await manager.query(
        `
          INSERT INTO public.round_robin_state
            (scope_key, last_agent_id)
          VALUES ($1, NULL)
          ON CONFLICT (scope_key) DO NOTHING
        `,
        [scopeKey],
      );

      // 3. Khóa trạng thái Round-robin trước khi khóa Ticket.
      // Các yêu cầu cùng scope sẽ xử lý lần lượt.
      const states: Array<{ last_agent_id: string | null }> =
        await manager.query(
          `
            SELECT last_agent_id
            FROM public.round_robin_state
            WHERE scope_key = $1
            FOR UPDATE
          `,
          [scopeKey],
        );

      if (states.length === 0) {
        throw new ConflictException(
          'Không thể đọc trạng thái Round-robin',
        );
      }

      // 4. Khóa Ticket và kiểm tra lại dữ liệu.
      // Ticket có thể đã thay đổi trong lúc đợi khóa.
      const ticket = await ticketRepo
        .createQueryBuilder('ticket')
        .setLock('pessimistic_write')
        .where(
          '(ticket.ticket_id::text = :ticketId OR ticket.ticket_code = :ticketId)',
          { ticketId },
        )
        .getOne();

      if (!ticket) {
        throw new NotFoundException('Không tìm thấy Ticket');
      }

      if (ticket.assigned_agent_id) {
        throw new ConflictException('Ticket đã được phân công');
      }

      // Team thay đổi sau khi xác định scope:
      // dừng lại để tránh phân công sai Team.
      if (ticket.team_id !== initialTicket.team_id) {
        throw new ConflictException(
          'Team của Ticket đã thay đổi, vui lòng thử lại',
        );
      }

      // 5. Tìm Agent hợp lệ theo thứ tự cố định.
      const query = userRepo
        .createQueryBuilder('agent')
        .innerJoin('agent.role', 'role')
        .where('LOWER(role.role_name) = :roleName', {
          roleName: 'agent',
        })
        .andWhere('LOWER(agent.status) = :status', {
          status: 'active',
        });

      if (ticket.team_id) {
        query.andWhere('agent.team_id = :teamId', {
          teamId: ticket.team_id,
        });
      }

      const agents = await query
        .orderBy('agent.user_id', 'ASC')
        .getMany();

      if (agents.length === 0) {
        throw new ConflictException(
          'Không có Agent đang hoạt động để phân công',
        );
      }

      // 6. Chọn Agent tiếp theo sau lượt gần nhất.
      // Nếu đã đến Agent cuối, quay lại Agent đầu.
      const lastAgentId = states[0].last_agent_id;

      const nextAgent =
        agents.find(
          (agent) => agent.user_id > (lastAgentId ?? ''),
        ) ?? agents[0];

      // 7. Lưu Ticket và cập nhật lượt trong cùng transaction.
      ticket.assigned_agent_id = nextAgent.user_id;

      await ticketRepo.save(ticket);

      await manager.query(
        `
          UPDATE public.round_robin_state
          SET last_agent_id = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE scope_key = $1
        `,
        [scopeKey, nextAgent.user_id],
      );

      return ticket;
    };

    // Email/Telegram: sử dụng transaction hiện có.
    if (existingManager) {
      return execute(existingManager);
    }

    // API độc lập: tự tạo transaction.
    return this.ticketRepo.manager.transaction(execute);
  }
}
