
import { describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Ticket, User } from '../../database/entities/index.js';
import { RoundRobinAssignmentService } from './round-robin-assignment.service.js';

const AGENTS = [
  { user_id: '11111111-1111-4111-8111-111111111111' },
  { user_id: '22222222-2222-4222-8222-222222222222' },
  { user_id: '33333333-3333-4333-8333-333333333333' },
];

function setup(options: {
  ticketExists?: boolean;
  assignedAgentId?: string | null;
  teamId?: string | null;
  agents?: typeof AGENTS;
} = {}) {
  const ticket = {
    ticket_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ticket_code: 'TK-1001',
    assigned_agent_id: options.assignedAgentId ?? null,
    team_id: options.teamId ?? null,
  };

  let lastAgentId: string | null = null;

  const ticketQuery = {
    setLock: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(
      options.ticketExists === false ? null : ticket,
    ),
  };

  const agentQuery = {
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(options.agents ?? AGENTS),
  };

  const ticketRepo = {
    createQueryBuilder: vi.fn().mockReturnValue(ticketQuery),
    save: vi.fn(async (value) => value),
  };

  const userRepo = {
    createQueryBuilder: vi.fn().mockReturnValue(agentQuery),
  };

  const manager = {
    getRepository: vi.fn((entity) => {
      if (entity === Ticket) return ticketRepo;
      if (entity === User) return userRepo;
      throw new Error('Unexpected entity');
    }),

    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT last_agent_id')) {
        return [{ last_agent_id: lastAgentId }];
      }

      if (sql.includes('UPDATE public.round_robin_state')) {
        lastAgentId = params[1] as string;
      }

      return [];
    }),
  };

  const transaction = vi.fn(async (callback) => callback(manager));

  const service = new RoundRobinAssignmentService({
    manager: { transaction },
  } as never);

  return {
    service,
    ticket,
    ticketRepo,
    ticketQuery,
    agentQuery,
    manager,
    transaction,
  };
}

describe('RoundRobinAssignmentService - Task 4.4', () => {
  it('phân công Agent đầu tiên khi chưa có lượt trước', async () => {
    const { service, ticket, ticketRepo, ticketQuery, manager } =
      setup();

    const result = await service.assignNextAgent(ticket.ticket_id);

    expect(result.assigned_agent_id).toBe(AGENTS[0].user_id);
    expect(ticketRepo.save).toHaveBeenCalledOnce();
    expect(ticketQuery.setLock).toHaveBeenCalledWith(
      'pessimistic_write',
    );

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['global'],
    );
  });

  it('phân công lần lượt A → B → C → A', async () => {
    const { service, ticket } = setup();

    const selectedAgents: string[] = [];

    for (let i = 0; i < 4; i++) {
      // Giả lập một Ticket mới chưa được phân công.
      ticket.assigned_agent_id = null;

      const result = await service.assignNextAgent(ticket.ticket_id);
      selectedAgents.push(result.assigned_agent_id!);
    }

    expect(selectedAgents).toEqual([
      AGENTS[0].user_id,
      AGENTS[1].user_id,
      AGENTS[2].user_id,
      AGENTS[0].user_id,
    ]);
  });

  it('không ghi đè Ticket đã được phân công', async () => {
    const { service, ticket, ticketRepo } = setup({
      assignedAgentId: AGENTS[0].user_id,
    });

    await expect(
      service.assignNextAgent(ticket.ticket_id),
    ).rejects.toThrow(ConflictException);

    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('báo lỗi khi Ticket không tồn tại', async () => {
    const { service, ticketRepo } = setup({
      ticketExists: false,
    });

    await expect(
      service.assignNextAgent('TK-NOT-FOUND'),
    ).rejects.toThrow(NotFoundException);

    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('báo lỗi khi không có Agent hợp lệ', async () => {
    const { service, ticket, ticketRepo } = setup({
      agents: [],
    });

    await expect(
      service.assignNextAgent(ticket.ticket_id),
    ).rejects.toThrow(ConflictException);

    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('chỉ tìm Agent thuộc Team của Ticket', async () => {
    const teamId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const { service, ticket, agentQuery, manager } = setup({
      teamId,
    });

    await service.assignNextAgent(ticket.ticket_id);

    expect(agentQuery.andWhere).toHaveBeenCalledWith(
      'agent.team_id = :teamId',
      { teamId },
    );

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [`team:${teamId}`],
    );
  });

  it('lọc Agent đang active và có vai trò agent', async () => {
    const { service, ticket, agentQuery } = setup();

    await service.assignNextAgent(ticket.ticket_id);

    expect(agentQuery.innerJoin).toHaveBeenCalledWith(
      'agent.role',
      'role',
    );

    expect(agentQuery.andWhere).toHaveBeenCalledWith(
      'LOWER(agent.status) = :status',
      { status: 'active' },
    );
  });
});
