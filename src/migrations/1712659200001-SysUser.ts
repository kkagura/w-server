import { MigrationInterface, QueryRunner } from 'typeorm';

export class SysUser1712659200001 implements MigrationInterface {
  name = 'SysUser1712659200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sys_user\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`username\` varchar(50) NOT NULL COMMENT '用户名',
        \`password\` varchar(255) NOT NULL COMMENT '密码哈希值',
        \`salt\` char(8) NOT NULL COMMENT '密码盐值',
        \`nickname\` varchar(50) DEFAULT NULL COMMENT '昵称',
        \`email\` varchar(100) DEFAULT NULL COMMENT '邮箱',
        \`mobile\` varchar(20) DEFAULT NULL COMMENT '手机号',
        \`avatar\` varchar(255) DEFAULT NULL COMMENT '头像URL',
        \`status\` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
        \`login_ip\` varchar(50) DEFAULT NULL COMMENT '最后登录IP',
        \`login_at\` datetime DEFAULT NULL COMMENT '最后登录时间',
        \`create_by\` bigint unsigned DEFAULT NULL COMMENT '创建人ID',
        \`create_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`update_by\` bigint unsigned DEFAULT NULL COMMENT '更新人ID',
        \`update_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        \`delete_at\` datetime DEFAULT NULL COMMENT '软删除时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_username\` (\`username\`),
        UNIQUE KEY \`uk_email\` (\`email\`),
        UNIQUE KEY \`uk_mobile\` (\`mobile\`),
        KEY \`idx_status\` (\`status\`),
        KEY \`idx_delete_at\` (\`delete_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`sys_user\``);
  }
}
