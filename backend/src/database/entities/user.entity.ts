import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Role } from './role.entity.js';
import { Team } from './team.entity.js';
import { Ticket } from './ticket.entity.js';
import { TicketMessage } from './ticket-message.entity.js';
import { TicketStatusHistory } from './ticket-status-history.entity.js';
import { AuditLog } from './audit-log.entity.js';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    user_id: string;

    @Column({ type: 'varchar', length: 255 })
    full_name: string;

    @Column({
        type: 'varchar',
        length: 255,
        unique: true,
        nullable: true,
    })
    email: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    password_hash: string | null; // Nullable cho khách vãng lai qua Telegram/Email

    @Column({ type: 'uuid' })
    role_id: string;

    @Column({ type: 'uuid', nullable: true })
    team_id: string | null;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    telegram_chat_id: string | null;

    @Column({
        type: 'varchar',
        length: 50,
        nullable: true,
        unique: true,
    })
    telegram_user_id: string | null;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    telegram_contact_email: string | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @ManyToOne(() => Role, (role) => role.users, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'role_id' })
    role: Relation<Role>;

    @ManyToOne(() => Team, (team) => team.members, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'team_id' })
    team: Relation<Team> | null;

    @OneToMany(() => Ticket, (ticket) => ticket.customer)
    created_tickets: Relation<Ticket>[];

    @OneToMany(() => Ticket, (ticket) => ticket.assigned_agent)
    assigned_tickets: Relation<Ticket>[];

    @OneToMany(() => TicketMessage, (message) => message.sender)
    messages: Relation<TicketMessage>[];

    @OneToMany(() => TicketStatusHistory, (history) => history.changer)
    status_changes: Relation<TicketStatusHistory>[];

    @OneToMany(() => AuditLog, (log) => log.user)
    audit_logs: Relation<AuditLog>[];
}
