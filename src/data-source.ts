import { DataSource } from 'typeorm';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  charset: string;
  timezone: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readYamlFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const parsed = parse(content);
  if (!isPlainObject(parsed)) throw new Error(`"${filePath}" must be a YAML object.`);
  return parsed;
}

function getDbConfig(): DbConfig {
  const env = process.env.NODE_ENV?.trim() || 'dev';
  const configRoot = join(process.cwd(), 'config');
  const base = readYamlFile(join(configRoot, 'application.yml'));
  const envCfg = readYamlFile(join(configRoot, `application.${env}.yml`));

  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(envCfg)) {
    const baseVal = isPlainObject(merged[key]) ? merged[key] : {};
    const envVal = isPlainObject(envCfg[key]) ? envCfg[key] : {};
    merged[key] = { ...baseVal, ...envVal };
  }

  const db = isPlainObject(merged['database']) ? merged['database'] : {};

  return {
    host: (process.env.DB_HOST ?? (db['host'] as string) ?? '127.0.0.1') as string,
    port: Number(process.env.DB_PORT ?? (db['port'] as number) ?? 3306),
    username: (process.env.DB_USERNAME ?? (db['username'] as string) ?? 'root') as string,
    password: (process.env.DB_PASSWORD ?? (db['password'] as string) ?? '') as string,
    name: (process.env.DB_NAME ?? (db['name'] as string) ?? 'w_server') as string,
    charset: (process.env.DB_CHARSET ?? (db['charset'] as string) ?? 'utf8mb4') as string,
    timezone: (process.env.DB_TIMEZONE ?? (db['timezone'] as string) ?? '+08:00') as string,
  };
}

const db = getDbConfig();

export default new DataSource({
  type: 'mysql',
  host: db.host,
  port: db.port,
  username: db.username,
  password: db.password,
  database: db.name,
  charset: db.charset,
  timezone: db.timezone,
  synchronize: false,
  logging: true,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
});
