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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TicketsService } from './tickets.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { QueryTicketDto } from './dto/query-ticket.dto.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
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

    @Get(':id')
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
    
    @Patch(':id/assign')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
      summary: 'Phân công Ticket cho Agent (Task 4.2)',
      description:
        'Phân công Ticket cho một Agent đang hoạt động, sử dụng dữ liệu thực tế trong PostgreSQL.',
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
