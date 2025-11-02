import { ViewEntity, ViewColumn, DataSource } from 'typeorm';

@ViewEntity({
  name: 'payment_stats',
  expression: (dataSource: DataSource) => dataSource
    .createQueryBuilder()
    .select('1', 'id')
    .addSelect('COUNT(DISTINCT u.userId)', 'total_users_started')
    .addSelect('COUNT(DISTINCT CASE WHEN u.hasPaid = true THEN u.userId END)', 'total_successful_payments')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currency = \'RUB\' AND u.hasPaid = true THEN u.userId END)', 'total_rub_payments')
    .addSelect('COUNT(DISTINCT CASE WHEN u.currency = \'UAH\' AND u.hasPaid = true THEN u.userId END)', 'total_uah_payments')
    .addSelect('COUNT(CASE WHEN ua.action = \'photo_rejected\' THEN 1 END)', 'total_non_receipts')
    .addSelect('COUNT(CASE WHEN ua.action = \'receipt_validation_failed\' THEN 1 END)', 'total_failed_receipts')
    .from('users', 'u')
    .leftJoin('user_actions', 'ua', 'u.userId = ua.userId')
})
export class PaymentStats {
  @ViewColumn()
  id: number;

  @ViewColumn()
  total_users_started: number;

  @ViewColumn()
  total_successful_payments: number;

  @ViewColumn()
  total_rub_payments: number;

  @ViewColumn()
  total_uah_payments: number;

  @ViewColumn()
  total_non_receipts: number;

  @ViewColumn()
  total_failed_receipts: number;
}
