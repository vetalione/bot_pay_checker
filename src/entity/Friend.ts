import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('friends')
export class Friend {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', unique: true })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', nullable: true })
  username?: string;

  @Column({ type: 'varchar', nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', nullable: true })
  lastName?: string;

  @CreateDateColumn()
  addedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
