import { IsIn, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTicketDto {
    @ApiPropertyOptional({
        enum: ['new', 'open', 'pending', 'resolved', 'closed'],
        example: 'open',
    })
    @ValidateIf((_object, value) => value !== undefined)
    @IsIn(['new', 'open', 'pending', 'resolved', 'closed'])
    status?: string;

    @ApiPropertyOptional({
        enum: ['low', 'medium', 'high', 'urgent'],
        example: 'high',
    })
    @ValidateIf((_object, value) => value !== undefined)
    @IsIn(['low', 'medium', 'high', 'urgent'])
    priority?: string;
}