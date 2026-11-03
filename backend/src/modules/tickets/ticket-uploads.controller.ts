import {
    BadRequestException,
    Controller,
    FileTypeValidator,
    ParseFilePipe,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

@Controller('tickets/attachments')
export class TicketUploadsController {
    @Post()
    @UseInterceptors(
        FileInterceptor('attachment', {
            limits: {
                fileSize: 5 * 1024 * 1024,
                files: 1,
                fields: 0,
            },
        }),
    )
    async upload(
        @UploadedFile(
            new ParseFilePipe({
                fileIsRequired: true,
                validators: [
                    new FileTypeValidator({
                        fileType: /^(image\/png|image\/jpeg|application\/pdf)$/,
                        overrideMimeType: true,
                        errorMessage: 'Chỉ chấp nhận tệp PNG, JPG hoặc PDF hợp lệ.',
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        const extensions: Record<string, string> = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'application/pdf': '.pdf',
        };

        const extension = extensions[file.mimetype];

        if (!extension || file.size === 0) {
            throw new BadRequestException('Tệp rỗng hoặc không hợp lệ.');
        }

        const filename = `${randomUUID()}${extension}`;
        const directory = resolve(process.cwd(), 'uploads', 'tickets');

        await mkdir(directory, { recursive: true });
        await writeFile(resolve(directory, filename), file.buffer, {
            flag: 'wx',
        });

        return {
            filename,
            size: file.size,
            content_type: file.mimetype,
        };
    }
}