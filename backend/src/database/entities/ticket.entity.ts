import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity.js';
import { Team } from './team.entity.js';
import { Channel } from './channel.entity.js';
import { SlaPolicy } from './sla-policy.entity.js';
import { TicketMessage } from './ticket-message.entity.js';
import { TicketStatusHistory } from './ticket-status-history.entity.js';

@Entity('tickets')
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    ticket_id: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 20, unique: true })
    ticket_code: string; // VD: TK-2852

    @Column({ type: 'uuid' })
    customer_id: string;

    @Column({ type: 'uuid', nullable: true })
    assigned_agent_id: string | null;

    @Column({ type: 'uuid', nullable: true })
    team_id: string | null;

    @Column({ type: 'uuid' })
    channel_id: string;

    @Column({ type: 'uuid', nullable: true })
    sla_id: string | null;

    @Column({ type: 'varchar', length: 255 })
    subject: string;

    @Column({ type: 'varchar', length: 20, default: 'new' })
    status: string; // new, open, pending, resolved, closed

    @Column({ type: 'varchar', length: 20, default: 'medium' })
    priority: string; // low, medium, high, urgent

    // === CÁC TRƯỜNG PHỤC VỤ TÍNH NĂNG AI 1 ===
    @Column({ type: 'varchar', length: 20, nullable: true })
    sentiment_label: string | null;

    @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true })
    sentiment_score: number | null;

    @Column({ type: 'boolean', default: false })
    is_urgent_bumped: boolean;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    ai_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

    @Column({ type: 'int', default: 0 })
    ai_attempts: number;

    @Column({ type: 'timestamptz', nullable: true })
    ai_next_attempt_at: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    ai_error: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    ai_model: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    ai_analyzed_at: Date | null;

    @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true })
    urgency_score: number | null;

    @Column({ type: 'text', nullable: true })
    ai_reason: string | null;

    @Column({ type: 'jsonb', nullable: true })
    ai_detected_keywords: string[] | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    closed_at: Date | null;

    @ManyToOne(() => User, (user) => user.created_tickets, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'customer_id' })
    customer: Relation<User>;

    @ManyToOne(() => User, (user) => user.assigned_tickets, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigned_agent_id' })
    assigned_agent: Relation<User> | null;

    @ManyToOne(() => Team, (team) => team.tickets, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'team_id' })
    team: Relation<Team> | null;

    @ManyToOne(() => Channel, (channel) => channel.tickets, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'channel_id' })
    channel: Relation<Channel>;

    @ManyToOne(() => SlaPolicy, (sla) => sla.tickets, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'sla_id' })
    sla: Relation<SlaPolicy> | null;

    @OneToMany(() => TicketMessage, (message) => message.ticket)
    messages: Relation<TicketMessage>[];

    @OneToMany(() => TicketStatusHistory, (history) => history.ticket)
    status_history: Relation<TicketStatusHistory>[];
}
