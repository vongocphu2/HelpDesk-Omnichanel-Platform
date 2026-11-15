
import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { Ticket, User } from '../../database/entities/index.js';
import { TicketsService } from './tickets.service.js';

// Task 4.2 - Unit Tests cho chức năng phân công Ticket thủ công.
// Sử dụng mock TypeORM, không kết nối PostgreSQL thật.
function setupAssignment(options: {
  ticketExists?: boolean;
  agentExists?: boolean;
} = {}) {
  const ticket = {
    ticket_id: '11111111-1111-4111-8111-111111111111',
    ticket_code: 'TK-1001',
    assigned_agent_id: null as string | null,
  };

  const agent = {
    user_id: '22222222-2222-4222-8222-222222222222',
    status: 'active',
  };

  // Giả lập TypeORM QueryBuilder để tìm Ticket.
  const ticketQuery = {
    setLock: vi.fn(),
    where: vi.fn(),
    getOne: vi.fn().mockResolvedValue(
      options.ticketExists === false ? null : ticket,
    ),
  };

  ticketQuery.setLock.mockReturnValue(ticketQuery);
  ticketQuery.where.mockReturnValue(ticketQuery);

  // Giả lập QueryBuilder kiểm tra Agent.
  const agentQuery = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    getOne: vi.fn().mockResolvedValue(
      options.agentExists === false ? null : agent,
    ),
  };

  agentQuery.innerJoin.mockReturnValue(agentQuery);
  agentQuery.where.mockReturnValue(agentQuery);
  agentQuery.andWhere.mockReturnValue(agentQuery);

  // Repository của Ticket.
  const ticketRepository = {
    createQueryBuilder: vi.fn().mockReturnValue(ticketQuery),
    save: vi.fn().mockImplementation(async (value) => value),
  };

  // Repository của User.
  const userRepository = {
    createQueryBuilder: vi.fn().mockReturnValue(agentQuery),
  };

  // EntityManager sử dụng trong transaction.
  const manager = {
    getRepository: vi.fn((entity) => {
      if (entity === Ticket) return ticketRepository;
      if (entity === User) return userRepository;
      throw new Error('Unexpected entity');
    }),
  };

  const transaction = vi.fn(async (callback) => callback(manager));

  const repository = {
    manager: { transaction },
  };

  // Giữ cách khởi tạo TicketsService tương thích
  // với bộ test Task 4.1 hiện có của Phú.
  const service = new TicketsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  vi.spyOn(service, 'findById').mockResolvedValue(ticket as Ticket);

  return {
    service,
    ticket,
    agent,
    ticketQuery,
    agentQuery,
    ticketRepository,
    transaction,
  };
}

describe('TicketsService.assignTicket - Task 4.2', () => {
  it('phân công Ticket thành công cho Agent hợp lệ', async () => {
    const {
      service,
      ticket,
      agent,
      ticketQuery,
      agentQuery,
      ticketRepository,
      transaction,
    } = setupAssignment();

    const result = await service.assignTicket(
      ticket.ticket_id,
      agent.user_id,
    );

    // Ticket được phân công cho đúng Agent.
    expect(ticket.assigned_agent_id).toBe(agent.user_id);

    // Service sử dụng transaction và khóa bản ghi.
    expect(transaction).toHaveBeenCalledOnce();
    expect(ticketQuery.setLock).toHaveBeenCalledWith(
      'pessimistic_write',
    );

    // Kiểm tra đúng điều kiện Agent.
    expect(agentQuery.innerJoin).toHaveBeenCalledWith(
      'user.role',
      'role',
    );
    expect(agentQuery.andWhere).toHaveBeenCalledWith(
      'LOWER(role.role_name) = :roleName',
      { roleName: 'agent' },
    );
    expect(agentQuery.andWhere).toHaveBeenCalledWith(
      'LOWER(user.status) = :status',
      { status: 'active' },
    );

    // Ticket được lưu và trả về.
    expect(ticketRepository.save).toHaveBeenCalledWith(ticket);
    expect(result.assigned_agent_id).toBe(agent.user_id);
  });

  it('từ chối khi Ticket không tồn tại', async () => {
    const { service, agent, ticketRepository } =
      setupAssignment({ ticketExists: false });

    await expect(
      service.assignTicket('TK-NOT-FOUND', agent.user_id),
    ).rejects.toThrow(NotFoundException);

    expect(ticketRepository.save).not.toHaveBeenCalled();
  });

  it('từ chối khi Agent không hợp lệ hoặc không hoạt động', async () => {
    const { service, ticket, agent, ticketRepository } =
      setupAssignment({ agentExists: false });

    await expect(
      service.assignTicket(ticket.ticket_id, agent.user_id),
    ).rejects.toThrow(BadRequestException);

    expect(ticketRepository.save).not.toHaveBeenCalled();
    expect(ticket.assigned_agent_id).toBeNull();
  });

  it('trả lỗi khi lưu Ticket thất bại', async () => {
    const {
      service,
      ticket,
      agent,
      ticketRepository,
      transaction,
    } = setupAssignment();

    ticketRepository.save.mockRejectedValueOnce(
      new Error('Database save failed'),
    );

    await expect(
      service.assignTicket(ticket.ticket_id, agent.user_id),
    ).rejects.toThrow('Database save failed');

    expect(transaction).toHaveBeenCalledOnce();
  });
});
