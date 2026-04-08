import { existsSync } from 'node:fs';
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

const CONFIG_DIR = 'config';
const BASE_CONFIG_FILE = 'application.yml';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readYamlFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }
  const fileContent = require('fs').readFileSync(filePath, 'utf8');
  const parsed = parse(fileContent);
  if (parsed === undefined) {
    return {};
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`"${filePath}" must contain a YAML object at the root.`);
  }
  return parsed;
}

function getDbConfig(env: string): DbConfig {
  const configRoot = join(process.cwd(), CONFIG_DIR);
  const baseConfig = readYamlFile(join(configRoot, BASE_CONFIG_FILE));
  const envConfig = readYamlFile(join(configRoot, `application.${env}.yml`));

  const merged: Record<string, unknown> = { ...baseConfig };
  for (const key of Object.keys(envConfig)) {
    const base = isPlainObject(merged[key]) ? merged[key] : {};
    const env = isPlainObject(envConfig[key]) ? envConfig[key] : {};
    merged[key] = { ...base, ...env };
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

function getEnv(): string {
  const env = process.env.NODE_ENV?.trim() || 'dev';
  if (!['dev', 'test', 'prod'].includes(env)) {
    throw new Error(`Unknown environment: "${env}". Expected: dev, test, prod.`);
  }
  return env;
}

export async function runMigration(): Promise<void> {
  const env = getEnv();
  const db = getDbConfig(env);

  // Create connection to the target database (without entities)
  const { DataSource } = await import('typeorm');

  const dataSource = new DataSource({
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
  });

  try {
    await dataSource.initialize();
    console.log(`[${env}] Connected to database "${db.name}"`);

    // Run pending migrations (all in one transaction, rollback on any failure)
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    if (migrations.length === 0) {
      console.log(`[${env}] No pending migrations.`);
    } else {
      console.log(`[${env}] Ran ${migrations.length} migration(s):`);
      for (const m of migrations) {
        console.log(`  - ${m.name}`);
      }
    }

    await dataSource.destroy();
    console.log(`[${env}] Done.`);
  } catch (error) {
    console.error(`[${env}] Migration failed:`, error);
    process.exit(1);
  }
}

export async function revertMigration(): Promise<void> {
  const env = getEnv();
  const db = getDbConfig(env);

  const { DataSource } = await import('typeorm');

  const dataSource = new DataSource({
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
  });

  try {
    await dataSource.initialize();
    console.log(`[${env}] Connected to database "${db.name}"`);

    // Revert last migration
    await dataSource.undoLastMigration({ transaction: 'all' });
    console.log(`[${env}] Last migration reverted.`);

    await dataSource.destroy();
    console.log(`[${env}] Done.`);
  } catch (error) {
    console.error(`[${env}] Revert failed:`, error);
    process.exit(1);
  }
}

export async function initDatabase(): Promise<void> {
  const env = getEnv();
  const db = getDbConfig(env);

  const mysql = await import('mysql2/promise');

  try {
    // Connect without database to create it if not exists
    const connection = await mysql.createConnection({
      host: db.host,
      port: db.port,
      user: db.username,
      password: db.password,
      charset: db.charset,
    });

    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET '${db.charset.split(' ')[0]}' COLLATE '${db.charset.split(' ')[1] || 'utf8mb4_unicode_ci'}'`,
    );
    console.log(`[${env}] Database "${db.name}" is ready.`);
    await connection.end();
  } catch (error) {
    console.error(`[${env}] Failed to initialize database:`, error);
    process.exit(1);
  }
}

export async function syncSchema(): Promise<void> {
  const env = getEnv();
  const db = getDbConfig(env);

  const { DataSource } = await import('typeorm');

  const dataSource = new DataSource({
    type: 'mysql',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.name,
    charset: db.charset,
    timezone: db.timezone,
    synchronize: true,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log(`[${env}] Connected to database "${db.name}"`);
    console.log(`[${env}] Synchronizing schema (synchronize=true, will modify tables)...`);
    await dataSource.synchronize(false);
    console.log(`[${env}] Schema synchronized.`);
    await dataSource.destroy();
    console.log(`[${env}] Done.`);
  } catch (error) {
    console.error(`[${env}] Sync failed:`, error);
    process.exit(1);
  }
}

const action = process.argv[2] || 'help';

const commands: Record<string, () => Promise<void>> = {
  init: initDatabase,
  migrate: runMigration,
  revert: revertMigration,
  sync: syncSchema,
};

if (action === 'help' || !commands[action]) {
  console.log(`
Database Migration CLI

Usage: pnpm db <command> [options]

Commands:
  init     Initialize (create) the database for the current environment
  migrate  Run pending migrations
  revert   Revert the last migration
  sync     Synchronize schema (use with caution, only in dev/test)

Options:
  --env <dev|test|prod>  Set environment (default: read from NODE_ENV or "dev")

Examples:
  pnpm db init
  pnpm db migrate
  pnpm db revert
  pnpm db sync --env test
  NODE_ENV=prod pnpm db migrate
`);
  process.exit(0);
}

commands[action]();
