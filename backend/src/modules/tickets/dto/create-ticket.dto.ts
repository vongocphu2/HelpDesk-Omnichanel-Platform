import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Validate } from 'class-validator';
import { AttachmentValidator } from './attachment.validator.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
    @ApiProperty({ description: 'Họ và tên khách hàng gửi yêu cầu', example: 'Alex Morgan' })
    @IsString()
    @IsNotEmpty({ message: 'Họ và tên khách hàng không được để trống' })
    @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
    customer_name: string;

    @ApiProperty({ description: 'Email liên hệ của khách hàng', example: 'alex.morgan@techcorp.io' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    customer_email: string;

    @ApiPropertyOptional({ description: 'Số điện thoại của khách hàng', example: '+84901234567' })
    @IsOptional()
    @IsString()
    customer_phone?: string;

    @ApiProperty({ description: 'Tiêu đề tóm tắt yêu cầu hỗ trợ', example: 'Lỗi trừ tiền 2 lần khi thanh toán gói Premium 6 tháng' })
    @IsString()
    @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
    @MinLength(5, { message: 'Tiêu đề phải có ít nhất 5 ký tự' })
    subject: string;

    @ApiProperty({ description: 'Nội dung chi tiết yêu cầu hỗ trợ', example: 'Tôi vừa thực hiện thanh toán gói dịch vụ nhưng tài khoản bị trừ 2 lần...' })
    @IsString()
    @IsNotEmpty({ message: 'Nội dung mô tả không được để trống' })
    @MinLength(10, { message: 'Nội dung mô tả phải có ít nhất 10 ký tự' })
    description: string;

    @ApiPropertyOptional({ description: 'Kênh tiếp nhận (web, email, telegram)', example: 'web', default: 'web' })
    @IsOptional()
    @IsString()
    channel_type?: string;

    @ApiPropertyOptional({ description: 'Mức độ ưu tiên ban đầu (low, medium, high, urgent)', example: 'medium', default: 'medium' })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: 'Đường dẫn tệp đính kèm (URL hoặc file path)', example: 'https://storage.helpdesk.io/receipt_duplicate.png' })
    @IsOptional()
    @IsString()
    @Validate(AttachmentValidator)
    attachment_url?: string;
}
