import { ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

@ValidatorConstraint({ name: 'ticketAttachment', async: false })
export class AttachmentValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    // Preserve existing tickets/callers that use an uploaded filename or URL.
    if (!value.startsWith('data:')) return value.length <= 2048;
    const match =
      /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        value,
      );
    if (!match || match[2].length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4)
      return false;
    const bytes = Buffer.from(match[2], 'base64');
    if (
      bytes.length > MAX_ATTACHMENT_BYTES ||
      bytes.toString('base64') !== match[2]
    )
      return false;
    if (match[1] === 'image/png')
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (match[1] === 'image/jpeg')
      return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  defaultMessage(): string {
    return 'Tệp đính kèm phải là PNG, JPG hoặc PDF hợp lệ, tối đa 5 MB.';
  }
}
