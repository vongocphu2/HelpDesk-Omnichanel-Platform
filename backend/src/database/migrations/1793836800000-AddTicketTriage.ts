import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketTriage1793836800000 implements MigrationInterface {
  name = 'AddTicketTriage1793836800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing tickets are not automatically sent to AI. Only new tickets
    // become pending after the default is changed below.
    await queryRunner.query(`
      ALTER TABLE public.tickets
        ADD COLUMN ai_status varchar(20) NOT NULL DEFAULT 'skipped',
        ADD COLUMN ai_attempts integer NOT NULL DEFAULT 0,
        ADD COLUMN ai_next_attempt_at timestamptz,
        ADD COLUMN ai_error varchar(64),
        ADD COLUMN ai_model varchar(100),
        ADD COLUMN ai_analyzed_at timestamptz,
        ADD COLUMN urgency_score numeric(4,3),
        ADD COLUMN ai_reason text,
        ADD COLUMN ai_detected_keywords jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE public.tickets ALTER COLUMN ai_status SET DEFAULT 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tickets_ai_pending ON public.tickets (created_at, ticket_id)
      WHERE ai_status IN ('pending', 'processing')
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Không tự động xóa kết quả AI. Cần kế hoạch sao lưu trước khi rollback.',
    );
  }
}
