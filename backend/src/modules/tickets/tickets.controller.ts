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
//// Task 4.2 - DTO phân công Ticket thủ công (Lộc)
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
//Task 4.1 - DTO cập nhật trạng thái và độ ưu tiên (Phú)
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
// Task 4.3 - Xác thực JWT và phân quyền RBAC (Phú)
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';


@ApiTags('Tickets (Quản lý Yêu cầu Hỗ trợ)')
@Controller('tickets')
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

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

}
