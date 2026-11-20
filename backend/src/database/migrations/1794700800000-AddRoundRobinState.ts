
import type { MigrationInterface, QueryRunner } from 'typeorm';

// Task 4.4 - Lưu trạng thái phân công Round-robin trong PostgreSQL.
export class AddRoundRobinState1794700800000
  implements MigrationInterface
{
  name = 'AddRoundRobinState1794700800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.round_robin_state (
        scope_key varchar(100) PRIMARY KEY,
        last_agent_id uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_round_robin_last_agent
          FOREIGN KEY (last_agent_id)
          REFERENCES public.users(user_id)
          ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Chỉ rollback khi chủ động xác nhận không cần lưu lượt phân công.
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.round_robin_state
    `);
  }
}
