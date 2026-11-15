import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import {
  AttachmentValidator,
  MAX_ATTACHMENT_BYTES,
} from './attachment.validator.js';
import { CreateTicketDto } from './create-ticket.dto.js';

const validator = new AttachmentValidator();
function imageData(size: number) {
  const bytes = Buffer.alloc(size);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

describe('Customer Portal attachments', () => {
  it('accepts a 225 KB image and a file exactly at the 5 MiB limit', () => {
    expect(validator.validate(imageData(225 * 1024))).toBe(true);
    expect(validator.validate(imageData(MAX_ATTACHMENT_BYTES))).toBe(true);
  });
  it('rejects oversized or malformed inline attachments', () => {
    expect(validator.validate(imageData(MAX_ATTACHMENT_BYTES + 1))).toBe(false);
    expect(
      validator.validate(
        'data:image/jpeg;base64,' +
          Buffer.from('fake image').toString('base64'),
      ),
    ).toBe(false);
    expect(
      validator.validate('data:text/html;base64,PGgxPkhlbGxvPC9oMT4='),
    ).toBe(false);
    expect(validator.validate('data:image/png;base64,bad-padding')).toBe(false);
  });
  it('preserves existing uploaded URLs/filenames and supports inline PDF content', () => {
    expect(validator.validate('old-upload.jpg')).toBe(true);
    expect(validator.validate('https://example.com/upload.pdf')).toBe(true);
    expect(
      validator.validate(
        'data:application/pdf;base64,' +
          Buffer.from('%PDF-1.7\n%%EOF').toString('base64'),
      ),
    ).toBe(true);
  });
  it('runs through the normal ticket DTO validation entry point', async () => {
    const dto = Object.assign(new CreateTicketDto(), {
      customer_name: 'Portal Test',
      customer_email: 'portal-test@example.com',
      subject: 'Kiểm tra tệp',
      description: 'Kiểm tra gửi yêu cầu kèm tệp.',
      attachment_url: 'data:image/jpeg;base64,dGV4dA==',
    });
    expect(
      (await validate(dto)).some(
        (error) => error.property === 'attachment_url',
      ),
    ).toBe(true);
    dto.attachment_url = imageData(225 * 1024);
    expect(await validate(dto)).toEqual([]);
  });
});
