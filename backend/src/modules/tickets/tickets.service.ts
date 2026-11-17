// Các thành phần NestJS dùng để xử lý nghiệp vụ và trả lỗi HTTP
import {Injectable,NotFoundException,ConflictException,Logger,BadRequestException,} from '@nestjs/common';
import { RoundRobinAssignmentService } from './round-robin-assignment.service.js';
import { TicketsGateway } from './tickets.gateway.js';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  Ticket,
  User,
  Role,
  Channel,
  TicketMessage,
  TicketStatusHistory,
} from '../../database/entities/index.js';

import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { QueryTicketDto } from './dto/query-ticket.dto.js';

import { UpdateTicketDto } from './dto/update-ticket.dto.js';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,

    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,

    @InjectRepository(TicketStatusHistory)
    private readonly statusHistoryRepo: Repository<TicketStatusHistory>,
    private readonly roundRobinService: RoundRobinAssignmentService,
    private readonly gateway: TicketsGateway,
  ) { }
  /**
 * Task 4.7 - Lấy danh sách Agent đang hoạt động.
 */
  async getActiveAgents() {
   const agents = await this.userRepo
    .createQueryBuilder('user')
    .innerJoin('user.role', 'role')
    .where('LOWER(role.role_name) = :role', { role: 'agent' })
    .andWhere('LOWER(user.status) = :status', { status: 'active' })
    .orderBy('user.full_name', 'ASC')
    .getMany();

   return agents.map((agent) => ({
    user_id: agent.user_id,
    full_name: agent.full_name,
    team_id: agent.team_id,
  }));
  }
  

  /**
   * Sinh mã Ticket duy nhất dạng TK-xxxx.
   * Có thể sử dụng Repository thuộc transaction.
   */
  private async generateUniqueTicketCode(
    manager?: EntityManager,
  ): Promise<string> {
    const ticketRepo = manager
      ? manager.getRepository(Ticket)
      : this.ticketRepo;

    for (let attempts = 0; attempts < 10; attempts++) {
      const randomNum = Math.floor(
        1000 + Math.random() * 9000,
      );

      const code = `TK-${randomNum}`;

      const found = await ticketRepo.findOne({
        where: { ticket_code: code },
      });

      if (!found) {
        return code;
      }
    }

    throw new ConflictException(
      'Không thể sinh mã Ticket duy nhất',
    );
  }

  /**
   * Tìm hoặc tạo vai trò khách hàng.
   */
  private async getOrCreateRole(
    roleName: string,
    manager?: EntityManager,
  ): Promise<Role> {
    const roleRepo = manager
      ? manager.getRepository(Role)
      : this.roleRepo;

    let role = await roleRepo.findOne({
      where: { role_name: roleName },
    });

    if (!role) {
      role = roleRepo.create({
        role_name: roleName,
      });

      role = await roleRepo.save(role);
    }

    return role;
  }

  /**
   * Tìm hoặc tạo kênh tiếp nhận.
   */
  private async getOrCreateChannel(
    channelType: string,
    manager?: EntityManager,
  ): Promise<Channel> {
    const channelRepo = manager
      ? manager.getRepository(Channel)
      : this.channelRepo;

    let channel = await channelRepo.findOne({
      where: { channel_type: channelType },
    });

    if (!channel) {
      const channelNameMap: Record<string, string> = {
        web: 'Web Form',
        email: 'Email Support',
        telegram: 'Telegram Bot',
      };

      channel = channelRepo.create({
        channel_name:
          channelNameMap[channelType] ||
          channelType.toUpperCase(),
        channel_type: channelType,
      });

      channel = await channelRepo.save(channel);
    }

    return channel;
  }

  /**
   * TASK 2.1 - Tạo Ticket từ Web Form.
   *
   * Khi manager không được truyền:
   * Sử dụng các Repository hiện tại.
   *
   * Khi manager được truyền:
   * Sử dụng các Repository thuộc transaction.
   */
  async createFromWebForm(
    dto: CreateTicketDto,
    manager?: EntityManager,
    telegramCustomerId?: string,
  ): Promise<Ticket> {
    const userRepo = manager
      ? manager.getRepository(User)
      : this.userRepo;

    const ticketRepo = manager
      ? manager.getRepository(Ticket)
      : this.ticketRepo;

    const messageRepo = manager
      ? manager.getRepository(TicketMessage)
      : this.messageRepo;

    const statusHistoryRepo = manager
      ? manager.getRepository(TicketStatusHistory)
      : this.statusHistoryRepo;

    this.logger.log(
      `Tiếp nhận yêu cầu từ: ${dto.customer_email} - Tiêu đề: ${dto.subject}`,
    );

    // 1. Xác định khách hàng theo kênh.
    let customer: User;

    if (dto.channel_type === 'telegram') {
      if (!manager || !telegramCustomerId) {
        throw new ConflictException(
          'Telegram phải xác định khách hàng trong transaction trước khi tạo ticket',
        );
      }

      const telegramCustomer = await userRepo.findOne({
        where: { user_id: telegramCustomerId },
      });

      if (
        !telegramCustomer ||
        !telegramCustomer.telegram_user_id ||
        telegramCustomer.status !== 'active'
      ) {
        throw new ConflictException(
          'Khách hàng Telegram không tồn tại hoặc không hoạt động',
        );
      }

      // Không tìm bằng email, không ghi đè hồ sơ tài khoản.
      customer = telegramCustomer;
    } else {
      const existingCustomer = await userRepo.findOne({
        where: { email: dto.customer_email },
      });

      if (!existingCustomer) {
        const customerRole = await this.getOrCreateRole(
          'customer',
          manager,
        );

        customer = userRepo.create({
          full_name: dto.customer_name,
          email: dto.customer_email,
          phone: dto.customer_phone || null,
          role_id: customerRole.role_id,
          status: 'active',
        });

        customer = await userRepo.save(customer);
      } else {
        customer = existingCustomer;

        if (
          dto.customer_name &&
          customer.full_name !== dto.customer_name
        ) {
          customer.full_name = dto.customer_name;

          if (dto.customer_phone) {
            customer.phone = dto.customer_phone;
          }

          await userRepo.save(customer);
        }
      }
    }

    // 2. Tìm hoặc tạo kênh tiếp nhận
    const channelType = dto.channel_type || 'web';

    const channel = await this.getOrCreateChannel(
      channelType,
      manager,
    );

    // 3. Sinh mã Ticket
    const ticketCode =
      await this.generateUniqueTicketCode(manager);

    // 4. Tạo Ticket
    const ticket = ticketRepo.create({
      ticket_code: ticketCode,
      customer_id: customer.user_id,
      channel_id: channel.channel_id,
      subject: dto.subject,
      status: 'new',
      priority: dto.priority || 'medium',
      is_urgent_bumped: false,
    });

    const savedTicket = await ticketRepo.save(ticket);

    // 5. Lưu tin nhắn đầu tiên
    const initialMessage = messageRepo.create({
      ticket_id: savedTicket.ticket_id,
      sender_id: customer.user_id,
      sender_type: 'customer',
      content: dto.description,
      attachments: dto.attachment_url || null,
      is_ai_draft: false,
    });

    await messageRepo.save(initialMessage);

    // 6. Lưu lịch sử trạng thái
    const statusHistory = statusHistoryRepo.create({
      ticket_id: savedTicket.ticket_id,
      old_status: null,
      new_status: 'new',
      changed_by: customer.user_id,
    });

    await statusHistoryRepo.save(statusHistory);
    // Task 4.4 - Tự động phân công Ticket mới theo Round-robin.
    // Nếu không có Agent, Ticket vẫn được tạo để chờ phân công.
  try {
    await this.roundRobinService.assignNextAgent(
    savedTicket.ticket_id,
    manager,
  );
} catch (error) {
  if (
    error instanceof ConflictException &&
    error.message === 'Không có Agent đang hoạt động để phân công'
  ) {
    this.logger.warn(
      `Ticket ${savedTicket.ticket_code} đang chờ Agent phù hợp`,
    );
  } else {
    throw error;
  }
}

    this.logger.log(
      `Tạo Ticket thành công: ${savedTicket.ticket_code} - ${savedTicket.ticket_id}`,
    );

    // 7. Đọc lại Ticket bằng Repository cùng transaction
    const created = await this.findById(savedTicket.ticket_id, manager);
    // Channel adapters publish after their enclosing transaction commits.
    if (!manager) this.publishCreatedTicket(created);
    return created;
  }

  publishCreatedTicket(ticket: Ticket): void {
    this.publishTicketUpdated(ticket);
    for (const message of ticket.messages ?? []) {
      this.gateway.emitNewMessage({
        message_id: message.message_id,
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        sender_type: message.sender_type,
        content: message.content,
        created_at: message.created_at,
        is_ai_draft: message.is_ai_draft,
      });
    }
  }

  private publishTicketUpdated(ticket: Ticket): void {
    this.gateway.emitTicketUpdated({
      ticket_id: ticket.ticket_id,
      ticket_code: ticket.ticket_code,
      status: ticket.status,
      priority: ticket.priority,
      is_urgent_bumped: ticket.is_urgent_bumped,
      assigned_agent_id: ticket.assigned_agent_id,
    });
  }

  /**
   * TASK 2.2 - Danh sách Ticket có lọc và phân trang.
   */
  async findAll(query: QueryTicketDto): Promise<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    data: Ticket[];
  }> {
    const page =
      query.page && query.page > 0
        ? Number(query.page)
        : 1;

    const limit =
      query.limit && query.limit > 0
        ? Number(query.limit)
        : 10;

    const skip = (page - 1) * limit;

    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect(
        'ticket.assigned_agent',
        'assigned_agent',
      )
      .leftJoinAndSelect('ticket.channel', 'channel')
      .leftJoinAndSelect('ticket.messages', 'messages');

    if (query.status) {
      qb.andWhere('ticket.status = :status', {
        status: query.status,
      });
    }

    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', {
        priority: query.priority,
      });
    }

    if (query.channel_type) {
      qb.andWhere(
        'channel.channel_type = :channel_type',
        { channel_type: query.channel_type },
      );
    }

    if (query.sentiment_label) {
      qb.andWhere(
        'ticket.sentiment_label = :sentiment_label',
        { sentiment_label: query.sentiment_label },
      );
    }

    if (query.is_urgent_bumped !== undefined) {
      const isBumped =
        query.is_urgent_bumped === 'true' ||
        query.is_urgent_bumped === '1';

      qb.andWhere(
        'ticket.is_urgent_bumped = :isBumped',
        { isBumped },
      );
    }

    if (query.search) {
      qb.andWhere(
        `(
          ticket.ticket_code ILIKE :search
          OR ticket.subject ILIKE :search
          OR customer.full_name ILIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('ticket.is_urgent_bumped', 'DESC')
      .addOrderBy('ticket.created_at', 'DESC')
      .addOrderBy('ticket.ticket_id', 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async update(
    identifier: string,
    dto: UpdateTicketDto,
    changedBy: string | null = null,
  ): Promise<Ticket> {
    if (dto.status === undefined && dto.priority === undefined) {
      throw new BadRequestException(
        'Cần cung cấp status hoặc priority để cập nhật',
      );
    }

    const updated = await this.ticketRepo.manager.transaction(async (manager) => {
      const ticketRepo = manager.getRepository(Ticket);
      const historyRepo = manager.getRepository(TicketStatusHistory);

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          identifier,
        );

      const ticket = await ticketRepo.findOne({
        where: isUuid
          ? { ticket_id: identifier }
          : { ticket_code: identifier },
        lock: { mode: 'pessimistic_write' },
      });

      if (!ticket) {
        throw new NotFoundException(
          `Không tìm thấy yêu cầu hỗ trợ với mã/ID: ${identifier}`,
        );
      }

      const oldStatus = ticket.status;
      const statusChanged =
        dto.status !== undefined && dto.status !== oldStatus;
      const priorityChanged =
        dto.priority !== undefined && dto.priority !== ticket.priority;

      if (statusChanged) {
        ticket.status = dto.status!;
        ticket.closed_at =
          dto.status === 'closed' ? new Date() : null;
      }

      if (priorityChanged) {
        ticket.priority = dto.priority!;

        // Hạ priority thủ công phải gỡ cờ đẩy đầu hàng đợi.
        if (dto.priority !== 'urgent') {
          ticket.is_urgent_bumped = false;
        }
      }

      if (statusChanged || priorityChanged) {
        await ticketRepo.save(ticket);
      }

      if (statusChanged) {
        await historyRepo.save(
          historyRepo.create({
            ticket_id: ticket.ticket_id,
            old_status: oldStatus,
            new_status: ticket.status,
            changed_by: changedBy,
          }),
        );
      }

      return this.findById(ticket.ticket_id, manager);
    });
    this.publishTicketUpdated(updated);
    return updated;
  }

  /**
   * TASK 2.2 - Xem chi tiết Ticket theo UUID hoặc mã Ticket.
   *
   * manager tùy chọn giúp đọc Ticket ngay trong transaction.
   */
  async findById(
    identifier: string,
    manager?: EntityManager,
  ): Promise<Ticket> {
    const ticketRepo = manager
      ? manager.getRepository(Ticket)
      : this.ticketRepo;

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const qb = ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect(
        'ticket.assigned_agent',
        'assigned_agent',
      )
      .leftJoinAndSelect('ticket.team', 'team')
      .leftJoinAndSelect('ticket.channel', 'channel')
      .leftJoinAndSelect('ticket.sla', 'sla')
      .leftJoinAndSelect('ticket.messages', 'messages')
      .leftJoinAndSelect('messages.sender', 'sender')
      .leftJoinAndSelect(
        'ticket.status_history',
        'status_history',
      )
      .leftJoinAndSelect(
        'status_history.changer',
        'changer',
      );

    if (isUuid) {
      qb.where('ticket.ticket_id = :identifier', {
        identifier,
      });
    } else {
      qb.where('ticket.ticket_code = :identifier', {
        identifier,
      });
    }

    qb.orderBy('messages.created_at', 'ASC');

    const ticket = await qb.getOne();

    if (!ticket) {
      throw new NotFoundException(
        `Không tìm thấy yêu cầu hỗ trợ với mã/ID: ${identifier}`,
      );
    }

    return ticket;
  }
  
async assignTicket(ticketId: string, agentId: string): Promise<Ticket> {
  const assigned = await this.ticketRepo.manager.transaction(async (manager) => {
    const ticketRepo = manager.getRepository(Ticket);
    const userRepo = manager.getRepository(User);

    // Tìm Ticket thật trong PostgreSQL và khóa bản ghi
    // để tránh hai yêu cầu phân công đồng thời ghi đè nhau.
    const ticket = await ticketRepo
      .createQueryBuilder('ticket')
      .setLock('pessimistic_write')
      .where('ticket.ticket_id::text = :id OR ticket.ticket_code = :id', {
        id: ticketId,
      })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy Ticket');
    }

    // Kiểm tra Agent tồn tại, có vai trò Agent và đang hoạt động.
    const agent = await userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.user_id = :agentId', { agentId })
      .andWhere('LOWER(role.role_name) = :roleName', {
        roleName: 'agent',
      })
      .andWhere('LOWER(user.status) = :status', {
        status: 'active',
      })
      .getOne();

    if (!agent) {
      throw new BadRequestException(
        'Agent không tồn tại, không có vai trò Agent hoặc không hoạt động',
      );
    }

    ticket.assigned_agent_id = agent.user_id;

    await ticketRepo.save(ticket);

    this.logger.log(
      `Đã phân công Ticket ${ticket.ticket_code} cho Agent ${agent.user_id}`,
    );

    return this.findById(ticket.ticket_id, manager);
  });
  this.publishTicketUpdated(assigned);
  return assigned;
}

/**
 * Task 4.7 & 4.4 - Phân công Ticket tự động theo Round-robin từ Modal.
 * Tích hợp kiểm tra quyền RBAC (chỉ Admin và Manager).
 * Gọi lại RoundRobinAssignmentService và trả về Ticket đầy đủ relations.
 */
async assignTicketRoundRobin(ticketId: string): Promise<Ticket> {
  const assignedTicket = await this.roundRobinService.assignNextAgent(ticketId);
  this.logger.log(
    `Đã phân công tự động Ticket ${assignedTicket.ticket_code} cho Agent ${assignedTicket.assigned_agent_id}`,
  );
  const ticket = await this.findById(assignedTicket.ticket_id);
  this.publishTicketUpdated(ticket);
  return ticket;
}
//Tạo API Conversation đầu tiên//
async getConversation(
  identifier: string,
  page = 1,
  limit = 20,
) {
  const ticket = await this.findById(identifier);

  const allMessages = [...(ticket.messages ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime(),
  );

  const total = allMessages.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;

  const messages = allMessages.slice(start, start + limit).map((message) => ({
    message_id: message.message_id,
    sender_type: message.sender_type,
    sender_name: message.sender?.full_name ?? null,
    content: message.content,
    attachments: message.attachments ?? null,
    created_at: message.created_at,
    is_ai_draft: message.is_ai_draft,
  }));

  return {
    ticket_id: ticket.ticket_id,
    ticket_code: ticket.ticket_code,
    subject: ticket.subject,
    channel: ticket.channel?.channel_type ?? null,
    status: ticket.status,
    priority: ticket.priority,
    sentiment_label: ticket.sentiment_label,
    is_urgent_bumped: ticket.is_urgent_bumped,
    messages,
    page: safePage,
    limit,
    total,
    totalPages,
  };
  }
}
