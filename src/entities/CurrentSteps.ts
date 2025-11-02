import { ViewEntity, ViewColumn, DataSource } from 'typeorm';

@ViewEntity({
  name: 'current_steps',
  expression: (dataSource: DataSource) => dataSource
    .createQueryBuilder()
    .select('1', 'id')
    .addSelect('COUNT(DISTINCT u.userId)', 'total_users_started')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'start\' AND u.hasPaid = false THEN u.userId END)', 'stuck_at_start')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'video1\' AND u.hasPaid = false THEN u.userId END)', 'stuck_at_video1')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'video2\' AND u.hasPaid = false THEN u.userId END)', 'stuck_at_video2')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'video3\' AND u.hasPaid = false THEN u.userId END)', 'stuck_at_video3')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'payment_choice\' AND u.hasPaid = false THEN u.userId END)', 'stuck_at_payment_choice')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currentStep = \'waiting_receipt\' AND u.hasPaid = false THEN u.userId END)', 'chose_payment_no_receipt')
    .addSelect('COUNT(CASE WHEN ua.action = \'receipt_validation_failed\' THEN 1 END)', 'receipt_rejected')
    .from('users', 'u')
    .leftJoin('user_actions', 'ua', 'u.userId = ua.userId')
})
export class CurrentSteps {
  @ViewColumn()
  id: number;

  @ViewColumn()
  total_users_started: number;

  @ViewColumn()
  stuck_at_start: number;

  @ViewColumn()
  stuck_at_video1: number;

  @ViewColumn()
  stuck_at_video2: number;

  @ViewColumn()
  stuck_at_video3: number;

  @ViewColumn()
  stuck_at_payment_choice: number;

  @ViewColumn()
  chose_payment_no_receipt: number;

  @ViewColumn()
  receipt_rejected: number;
}
