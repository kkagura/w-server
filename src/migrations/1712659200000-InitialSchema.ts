import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1712659200000 implements MigrationInterface {
  name = 'InitialSchema1712659200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`_version\` (
        \`version\` int NOT NULL DEFAULT 0,
        \`applied_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`version\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    await queryRunner.query(
      `INSERT INTO \`_version\` (\`version\`) VALUES (0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`_version\``);
  }
}
