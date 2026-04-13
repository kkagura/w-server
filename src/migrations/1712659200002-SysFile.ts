import { MigrationInterface, QueryRunner } from 'typeorm';

export class SysFile1712659200002 implements MigrationInterface {
  name = 'SysFile1712659200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sys_file\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`bucket\` varchar(100) NOT NULL COMMENT 'MinIO bucket 名称',
        \`object_key\` varchar(255) NOT NULL COMMENT 'MinIO 对象路径',
        \`original_name\` varchar(255) NOT NULL COMMENT '原始文件名',
        \`ext\` varchar(20) NOT NULL DEFAULT '' COMMENT '文件扩展名',
        \`mime_type\` varchar(150) NOT NULL COMMENT 'MIME 类型',
        \`size\` bigint unsigned NOT NULL COMMENT '文件大小，单位字节',
        \`etag\` varchar(64) DEFAULT NULL COMMENT '对象存储 ETag',
        \`sha256\` char(64) NOT NULL COMMENT '文件内容 SHA256 摘要',
        \`status\` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-上传中，1-可用，2-已删除，3-异常',
        \`is_public\` tinyint NOT NULL DEFAULT 0 COMMENT '是否公开访问：0-否，1-是',
        \`biz_type\` varchar(100) DEFAULT NULL COMMENT '业务类型',
        \`biz_id\` varchar(100) DEFAULT NULL COMMENT '业务主键',
        \`created_by\` bigint unsigned DEFAULT NULL COMMENT '上传人 ID',
        \`create_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`update_by\` bigint unsigned DEFAULT NULL COMMENT '更新人 ID',
        \`update_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        \`delete_at\` datetime DEFAULT NULL COMMENT '删除时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_object_key\` (\`object_key\`),
        KEY \`idx_biz\` (\`biz_type\`, \`biz_id\`),
        KEY \`idx_created_by\` (\`created_by\`),
        KEY \`idx_status_delete_at\` (\`status\`, \`delete_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件表'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`sys_file\``);
  }
}
