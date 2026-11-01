import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('telegram_processed_updates')
@Index('uq_telegram_processed_update_id', ['updateId'], {
  unique: true,
})
export class TelegramProcessedUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'update_id', type: 'bigint' }) //Nhận diện update duy nhất từ Telegram
  updateId!: string;

  @Column({ name: 'chat_id', type: 'bigint' })
  chatId!: string;

  @Column({ name: 'message_id', type: 'bigint' })
  messageId!: string;

  @Column({
    name: 'ticket_id',
    type: 'uuid',
    nullable: true,
  })
  ticketId!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'processing',
  })
  status!: 'processing' | 'completed'; //database vẫn giữ nguyên kiểu varchar

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt!: Date;
}
