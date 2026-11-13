import {
    IsEmail,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        example: 'admin@example.com',
    })
    @IsEmail()
    @MaxLength(255)
    email: string;

    @ApiProperty({
        format: 'password',
        description: 'Mật khẩu tài khoản',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(72)
    password: string;
}
