import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('user_actions')
export class UserAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('bigint')
  userId: number;

  @Column('varchar')
  action: string;

  @Column('varchar')
  step: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;

  // Связь с пользователем
  @ManyToOne(() => User, user => user.actions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
