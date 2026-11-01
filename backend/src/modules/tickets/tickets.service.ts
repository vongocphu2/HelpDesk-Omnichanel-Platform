
import { Injectable, NotFoundException, ConflictException, Logger, } from '@nestjs/common';
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
  ) { }

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

    this.logger.log(
      `Tạo Ticket thành công: ${savedTicket.ticket_code} - ${savedTicket.ticket_id}`,
    );

    // 7. Đọc lại Ticket bằng Repository cùng transaction
    return this.findById(savedTicket.ticket_id, manager);
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
      .leftJoinAndSelect('ticket.channel', 'channel');

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
}
