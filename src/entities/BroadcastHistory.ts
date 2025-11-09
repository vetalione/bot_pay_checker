import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('broadcast_history')
export class BroadcastHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'varchar', length: 50 })
  broadcastType!: string; // 'warmup', 'bot_restored', 'stuck_users', 'waiting_receipt', 'payment_choice'

  @Column({ type: 'int', default: 0 })
  segmentStart!: number; // сколько отправлено на start

  @Column({ type: 'int', default: 0 })
  segmentVideo1!: number; // сколько отправлено на video1

  @Column({ type: 'int', default: 0 })
  segmentVideo2!: number; // сколько отправлено на video2

  @Column({ type: 'int', default: 0 })
  segmentVideo3!: number; // сколько отправлено на video3

  @Column({ type: 'int', default: 0 })
  segmentPaymentChoice!: number; // сколько отправлено на payment_choice

  @Column({ type: 'int', default: 0 })
  segmentWaitingReceipt!: number; // сколько отправлено на waiting_receipt

  @Column({ type: 'int', default: 0 })
  totalAttempted!: number; // всего попыток

  @Column({ type: 'int', default: 0 })
  totalSent!: number; // успешно отправлено

  @Column({ type: 'int', default: 0 })
  totalFailed!: number; // ошибки

  @Column({ type: 'text', nullable: true })
  notes?: string; // дополнительные заметки
}
