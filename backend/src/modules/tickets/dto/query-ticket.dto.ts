import { IsOptional, IsString, IsInt, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryTicketDto {
    @ApiPropertyOptional({ description: 'Trang hiện tại', example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Số lượng vé trên mỗi trang', example: 10, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Lọc theo trạng thái vé (new, open, pending, resolved, closed)', example: 'new' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Lọc theo mức độ ưu tiên (low, medium, high, urgent)', example: 'urgent' })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: 'Lọc theo loại kênh tiếp nhận (web, email, telegram)', example: 'web' })
    @IsOptional()
    @IsString()
    channel_type?: string;

    @ApiPropertyOptional({ description: 'Tìm kiếm theo mã vé hoặc tiêu đề', example: 'TK-1082' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Lọc theo nhãn cảm xúc AI (frustrated, neutral, positive)', example: 'frustrated' })
    @IsOptional()
    @IsString()
    sentiment_label?: string;

    @ApiPropertyOptional({ description: 'Lọc các vé được AI tự động đẩy gấp (Priority Bump)', example: 'true' })
    @IsOptional()
    @IsString()
    is_urgent_bumped?: string;

    @ApiPropertyOptional({ description: 'Lọc theo UUID nhân viên phụ trách (assigned_agent_id)', example: '11111111-1111-4111-8111-111111111111' })
    @IsOptional()
    @IsUUID()
    assigned_agent_id?: string;

    @ApiPropertyOptional({ description: 'Lọc các vé chưa được phân công (true)', example: 'true' })
    @IsOptional()
    @IsString()
    unassigned?: string;
}
