import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFriendsTable1730898000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'friends',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'bigint',
            isUnique: true,
          },
          {
            name: 'username',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'firstName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'addedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
            comment: 'Заметки о пользователе (например, кто дал доступ)',
          },
        ],
      }),
      true,
    );

    // Индекс для быстрого поиска по userId
    await queryRunner.createIndex(
      'friends',
      new TableIndex({
        name: 'IDX_friends_userId',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('friends');
  }
}
