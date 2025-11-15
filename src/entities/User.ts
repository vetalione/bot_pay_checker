import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserAction } from './UserAction';

@Entity('users')
export class User {
  @PrimaryColumn('bigint')
  userId: number;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({
    type: 'varchar',
    default: 'start'
  })
  currentStep: 'start' | 'want_button' | 'video1' | 'continue_button' | 'video2' | 'ready_button' | 'video3' | 'advantage_button' | 'payment_choice' | 'waiting_receipt' | 'completed';

  @Column({ type: 'varchar', nullable: true })
  currency?: 'RUB' | 'UAH' | 'EUR';

  @Column({ type: 'boolean', default: false })
  hasPaid: boolean;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  paymentChoiceShownAt?: Date;

  @Column({ type: 'boolean', default: false })
  paymentReminderSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  waitingReceiptSince?: Date;

  @Column({ type: 'boolean', default: false })
  receiptReminderSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  video1ShownAt?: Date;

  @Column({ type: 'boolean', default: false })
  video1ReminderSent: boolean;

  @Column({ type: 'boolean', default: false })
  warmupVideo1Sent: boolean;

  // Новая система напоминаний - 3 уровня для START
  @Column({ type: 'boolean', default: false })
  reminderLevel1Start: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel2Start: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel3Start: boolean;

  // Новая система напоминаний - 3 уровня для VIDEO1
  @Column({ type: 'boolean', default: false })
  reminderLevel1Video1: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel2Video1: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel3Video1: boolean;

  // Новая система напоминаний - 3 уровня для VIDEO2
  @Column({ type: 'boolean', default: false })
  reminderLevel1Video2: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel2Video2: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel3Video2: boolean;

  // Новая система напоминаний - 3 уровня для VIDEO3
  @Column({ type: 'boolean', default: false })
  reminderLevel1Video3: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel2Video3: boolean;

  @Column({ type: 'boolean', default: false })
  reminderLevel3Video3: boolean;

  // Timestamp когда пользователь перешел на текущий currentStep
  @Column({ type: 'timestamp', nullable: true })
  currentStepChangedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связь с действиями пользователя
  @OneToMany(() => UserAction, action => action.user)
  actions: UserAction[];
}
