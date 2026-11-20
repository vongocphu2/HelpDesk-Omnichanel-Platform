
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({
    description: 'UUID của nhân viên Agent được phân công',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({
    message: 'Agent ID không được để trống',
  })
  @IsUUID('4', {
    message: 'Agent ID phải là UUID hợp lệ',
  })
  agent_id!: string;
}
