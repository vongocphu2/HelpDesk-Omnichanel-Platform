import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramIdentity1793462400000
    implements MigrationInterface {
    name = 'AddTelegramIdentity1793462400000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE public.users
      ALTER COLUMN email DROP NOT NULL
    `);

        await queryRunner.query(`
      ALTER TABLE public.users
      ADD COLUMN telegram_user_id varchar(50),
      ADD COLUMN telegram_contact_email varchar(255),
      ADD CONSTRAINT uq_users_telegram_user_id
        UNIQUE (telegram_user_id)
    `);

        await queryRunner.query(`
      CREATE TABLE public.telegram_processed_updates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        update_id bigint NOT NULL,
        chat_id bigint NOT NULL,
        message_id bigint NOT NULL,
        ticket_id uuid,
        status varchar(20) NOT NULL DEFAULT 'processing',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

        await queryRunner.query(`
      CREATE UNIQUE INDEX uq_telegram_processed_update_id
      ON public.telegram_processed_updates (update_id)
    `);
    }

    async down(_queryRunner: QueryRunner): Promise<void> {
        throw new Error(
            'Migration này cần kế hoạch rollback dữ liệu riêng: ' +
            'khách Telegram có thể có email NULL và bảng chống trùng ' +
            'có thể đã chứa dữ liệu. Không tự động xóa các dữ liệu này.',
        );
    }
}