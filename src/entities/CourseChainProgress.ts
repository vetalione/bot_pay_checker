import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Отслеживание прогресса пользователя в цепочке рассылки курса
 * "Снимите это немедленно!"
 */
@Entity('course_chain_progress')
export class CourseChainProgress {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint' })
  userId!: number;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  firstName?: string;

  // Статусы сообщений: 'pending' | 'sent' | 'clicked'
  @Column({ default: 'pending' })
  msg1Status!: string;

  @Column({ type: 'timestamp', nullable: true })
  msg1SentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  msg1ClickedAt?: Date;

  @Column({ default: 'pending' })
  msg2Status!: string;

  @Column({ type: 'timestamp', nullable: true })
  msg2SentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  msg2ClickedAt?: Date;

  @Column({ default: 'pending' })
  msg3Status!: string;

  @Column({ type: 'timestamp', nullable: true })
  msg3SentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  msg3ClickedAt?: Date;

  @Column({ default: 'pending' })
  msg4Status!: string;

  @Column({ type: 'timestamp', nullable: true })
  msg4SentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  msg4ClickedAt?: Date;

  // Забронировал ли место
  @Column({ default: false })
  reservedSpot!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reservedAt?: Date;

  // Заблокировал ли бота
  @Column({ default: false })
  blocked!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
