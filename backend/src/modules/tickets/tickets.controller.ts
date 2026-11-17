// Các decorator và công cụ xử lý HTTP của NestJS
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Patch,
  ValidationPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
//// Các decorator dùng để mô tả API trên Swagger
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
//Service xử lý nghiệp vụ Ticket
import { TicketsService } from './tickets.service.js';
//DTO kiểm tra dữ liệu đầu vào của các API Ticket
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { QueryTicketDto } from './dto/query-ticket.dto.js';
import { ConversationQueryDto } from './dto/conversation-query.dto.js';
//// Task 4.2 - DTO phân công Ticket thủ công (Lộc)
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
//Task 4.1 - DTO cập nhật trạng thái và độ ưu tiên (Phú)
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
// Task 4.3 - Xác thực JWT và phân quyền RBAC (Phú)
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
// Sprint 5 - Smart Reply + Outbound Dispatcher
import { SmartReplyService } from '../ai/smart-reply.service.js';
import { OutboundDispatcherService } from './outbound-dispatcher.service.js';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

class SendReplyBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  is_ai_draft?: boolean;
}


@ApiTags('Tickets (Quản lý Yêu cầu Hỗ trợ)')
@Controller('tickets')
export class TicketsController {
    constructor(
        private readonly ticketsService: TicketsService,
        private readonly smartReplyService: SmartReplyService,
        private readonly outboundDispatcher: OutboundDispatcherService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Tạo vé yêu cầu hỗ trợ từ Web Form (Task 2.1 - Phú)',
        description:
            'Tiếp nhận yêu cầu từ khách hàng qua Web Portal, tự động tạo khách hàng, sinh mã vé TK-xxxx, tạo tin nhắn đầu tiên và lịch sử trạng thái.',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Tạo vé thành công.',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Dữ liệu đầu vào không hợp lệ (thiếu email, họ tên, tiêu đề hoặc nội dung quá ngắn).',
    })
    async createFromWebForm(@Body() createTicketDto: CreateTicketDto) {
        const ticket = await this.ticketsService.createFromWebForm(createTicketDto);
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Tạo vé yêu cầu hỗ trợ thành công!',
            data: ticket,
        };
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @ApiOperation({
        summary: 'Xem danh sách vé hỗ trợ có bộ lọc và phân trang (Task 2.2 - Phú)',
        description:
            'Lấy danh sách vé hỗ trợ đa kênh (Web, Email, Telegram). Hỗ trợ tìm kiếm theo từ khóa, lọc theo trạng thái, mức độ ưu tiên, kênh tiếp nhận. Tự động đẩy các vé khẩn cấp do AI phát hiện lên đầu.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Lấy danh sách vé thành công.',
    })
    async findAll(@Query() query: QueryTicketDto) {
        const result = await this.ticketsService.findAll(query);
        return {
            statusCode: HttpStatus.OK,
            message: 'Lấy danh sách vé hỗ trợ thành công',
            ...result,
        };
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @ApiOperation({
        summary: 'Cập nhật trạng thái và mức độ ưu tiên ticket (Task 4.1 - Phú)',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID hoặc mã ticket',
        example: 'TK-1001',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Cập nhật ticket thành công.',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Dữ liệu cập nhật không hợp lệ.',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Không tìm thấy ticket.',
    })
    async update(
        @Param('id') id: string,
        @Body(new ValidationPipe({
            whitelist: true,
            transform: true,
        }))
        dto: UpdateTicketDto,
        @Req() request: AuthenticatedRequest,
    ) {
        const ticket = await this.ticketsService.update(
            id,
            dto,
            request.user.user_id,
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Cập nhật ticket thành công',
            data: {
                ticket_id: ticket.ticket_id,
                ticket_code: ticket.ticket_code,
                status: ticket.status,
                priority: ticket.priority,
                is_urgent_bumped: ticket.is_urgent_bumped,
                closed_at: ticket.closed_at,
                status_history: ticket.status_history.map((history) => ({
                    history_id: history.history_id,
                    old_status: history.old_status,
                    new_status: history.new_status,
                    changed_by: history.changed_by,
                    changed_at: history.changed_at,
                })),
            },
        };
    }
    /**
 * Task 4.7 - Danh sách Agent cho Assign Modal.
 */
    @Get('agents')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager')
    @ApiOperation({ summary: 'Lấy danh sách Agent đang hoạt động' })
    async getActiveAgents() {
        const agents = await this.ticketsService.getActiveAgents();

    return {
    statusCode: HttpStatus.OK,
    message: 'Lấy danh sách Agent thành công',
    data: agents,
    };
    }
    /**
    * Sprint 5.1 - Unified Conversation History (pagination + agent access)
    */
    @Get(':id/conversation')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @ApiOperation({
        summary: 'Lấy lịch sử hội thoại của Ticket (phân trang)',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID hoặc mã Ticket',
    })
    async getConversation(
        @Param('id') id: string,
        @Query(new ValidationPipe({ whitelist: true, transform: true }))
        query: ConversationQueryDto,
    ) {
        const conversation = await this.ticketsService.getConversation(
            id,
            query.page,
            query.limit,
        );

        return {
            statusCode: HttpStatus.OK,
            message: 'Lấy lịch sử hội thoại thành công',
            data: conversation,
        };
    }

    @Get(':id')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @ApiOperation({
        summary: 'Xem chi tiết 1 vé hỗ trợ và lịch sử trao đổi (Task 2.2 - Phú)',
        description:
            'Lấy toàn bộ thông tin chi tiết của vé bằng UUID hoặc mã vé (TK-xxxx), bao gồm thông tin khách hàng, nhân viên xử lý, kênh, toàn bộ tin nhắn trao đổi và lịch sử đổi trạng thái.',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID của vé (ticket_id) hoặc Mã vé duy nhất (ticket_code, VD: TK-1082)',
        example: 'TK-1082',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Lấy chi tiết vé thành công.',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Không tìm thấy vé hỗ trợ tương ứng.',
    })
    async findById(@Param('id') id: string) {
        const ticket = await this.ticketsService.findById(id);
        return {
            statusCode: HttpStatus.OK,
            message: 'Lấy chi tiết vé thành công',
            data: ticket,
        };
    }
        /**
     * Sprint 5.2 — AI Auto-Draft Smart Reply
     * GET /tickets/:id/smart-reply
     */
    @Get(':id/smart-reply')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @ApiOperation({
        summary: 'Tạo câu trả lời gợi ý AI cho Ticket (Task 5.2)',
        description: 'Gemini quét lịch sử hội thoại và sinh draft chuẩn mực. Agent xem qua rồi bấm gửi.',
    })
    @ApiParam({ name: 'id', description: 'UUID hoặc mã Ticket' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Draft AI được tạo thành công.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Không tìm thấy Ticket.' })
    async getSmartReply(@Param('id') id: string) {
        const result = await this.smartReplyService.generateDraft(id);
        return {
            statusCode: HttpStatus.OK,
            message: 'Tạo gợi ý câu trả lời AI thành công',
            data: result,
        };
    }

    /**
     * Sprint 5.4 — Outbound Multi-channel Reply Dispatcher
     * POST /tickets/:id/reply
     */
    @Post(':id/reply')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager', 'agent')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Agent gửi phản hồi ra kênh khách (Task 5.4)',
        description: 'Lưu tin nhắn vào DB và tự động gửi ra Email / Telegram / Web tương ứng với kênh của Ticket.',
    })
    @ApiParam({ name: 'id', description: 'UUID hoặc mã Ticket' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Gửi phản hồi thành công.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Không tìm thấy Ticket.' })
    async sendReply(
        @Param('id') id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: SendReplyBodyDto,
        @Req() request: AuthenticatedRequest,
    ) {
        const result = await this.outboundDispatcher.sendReply(
            id,
            request.user.user_id,
            { content: dto.content, is_ai_draft: dto.is_ai_draft },
        );
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Gửi phản hồi thành công',
            data: result,
        };
    }

    // Task 4.2 - Manual Ticket Assignment (Lộc)
    // Tích hợp JWT/RBAC từ Task 4.3 của Phú.
    // Chỉ Admin và Manager được phép phân công Ticket cho Agent.
    @Patch(':id/assign')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Phân công Ticket cho Agent ',
    })
    @ApiParam({
      name: 'id',
      description: 'UUID hoặc mã Ticket (ví dụ TK-7641)',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Phân công Ticket thành công',
  })
    @ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Agent không hợp lệ hoặc không hoạt động',
   })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Không tìm thấy Ticket',
    })
async assignTicket(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
) {
    const ticket = await this.ticketsService.assignTicket(
      id,
      dto.agent_id,
    );

  return {
    statusCode: HttpStatus.OK,
    message: 'Phân công Ticket thành công',
    data: ticket,
  };
}

    // Task 4.7 - Auto Ticket Assignment via Round-robin from Modal (Lộc)
    // Tích hợp JWT/RBAC từ Task 4.3 của Phú.
    // Chỉ Admin và Manager được phép phân công Ticket cho Agent.
    @Post(':id/assign-round-robin')
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin', 'manager')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Phân công Ticket tự động theo Round-robin (Admin/Manager)',
    })
    @ApiParam({
        name: 'id',
        description: 'UUID hoặc mã Ticket (ví dụ TK-7641)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Phân công Ticket tự động theo Round-robin thành công',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Ticket đã được phân công hoặc không có Agent đang hoạt động',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Không tìm thấy Ticket',
    })
    async assignTicketRoundRobin(
        @Param('id') id: string,
    ) {
        const ticket = await this.ticketsService.assignTicketRoundRobin(id);

        return {
            statusCode: HttpStatus.OK,
            message: 'Phân công Ticket tự động theo Round-robin thành công',
            data: ticket,
        };
    }

}
