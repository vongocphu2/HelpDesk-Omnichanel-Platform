import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @UseGuards(ThrottlerGuard)
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Đăng nhập tài khoản nhân viên' })
    @ApiResponse({ status: 200, description: 'Đăng nhập thành công.' })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ.' })
    @ApiResponse({ status: 401, description: 'Đăng nhập bị từ chối.' })
    async login(@Body() dto: LoginDto) {
        const result = await this.authService.login(dto);

        return {
            statusCode: HttpStatus.OK,
            message: 'Đăng nhập thành công',
            data: result,
        };
    }

    @Get('me')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @Header('Cache-Control', 'no-store')
    @ApiOperation({ summary: 'Xem tài khoản đang đăng nhập' })
    @ApiResponse({ status: 200, description: 'Token hợp lệ.' })
    @ApiResponse({ status: 401, description: 'Thiếu hoặc sai token.' })
    me(@Req() request: AuthenticatedRequest) {
        return {
            statusCode: HttpStatus.OK,
            data: request.user,
        };
    }
}