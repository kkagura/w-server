import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { AppConfig } from './config.types';

type PlainObject = Record<string, unknown>;

const DEFAULT_ENV = 'dev';
const DEFAULT_APP_NAME = 'w-server';
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_ENABLED = false;
const DEFAULT_DATABASE_HOST = '127.0.0.1';
const DEFAULT_DATABASE_PORT = 3306;
const DEFAULT_DATABASE_USERNAME = 'root';
const DEFAULT_DATABASE_PASSWORD = '';
const DEFAULT_DATABASE_NAME = 'w_server';
const DEFAULT_DATABASE_CHARSET = 'utf8mb4';
const DEFAULT_DATABASE_TIMEZONE = '+08:00';
const DEFAULT_DATABASE_LOGGING = false;
const DEFAULT_DATABASE_SYNCHRONIZE = false;
const DEFAULT_DATABASE_AUTO_LOAD_ENTITIES = true;
const CONFIG_DIR = 'config';
const BASE_CONFIG_FILE = 'application.yml';

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: PlainObject, source: PlainObject): PlainObject {
  const result: PlainObject = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const current = result[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function readYamlFile(filePath: string): PlainObject {
  if (!existsSync(filePath)) {
    return {};
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const parsed = parse(fileContent);

  if (parsed === undefined) {
    return {};
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      `Configuration file "${filePath}" must contain a YAML object at the root.`,
    );
  }

  return parsed;
}

function parsePort(value: unknown, fieldName: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid ${fieldName} value: "${String(value)}". Expected an integer between 1 and 65535.`,
    );
  }

  return port;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  throw new Error(
    `Invalid ${fieldName} value: "${String(value)}". Expected a boolean.`,
  );
}

function parseString(value: unknown, defaultValue: string): string {
  return typeof value === 'string' && value.trim() ? value : defaultValue;
}

function parsePassword(value: unknown, defaultValue: string): string {
  return typeof value === 'string' ? value : defaultValue;
}

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV?.trim() || DEFAULT_ENV;
  const configRoot = join(process.cwd(), CONFIG_DIR);
  const baseConfig = readYamlFile(join(configRoot, BASE_CONFIG_FILE));
  const envConfig = readYamlFile(join(configRoot, `application.${env}.yml`));
  const merged = deepMerge(baseConfig, envConfig);

  const rawApp = isPlainObject(merged.app) ? merged.app : {};
  const rawServer = isPlainObject(merged.server) ? merged.server : {};
  const rawDatabase = isPlainObject(merged.database) ? merged.database : {};
  const host = process.env.HOST ?? rawServer.host ?? DEFAULT_HOST;
  const port = parsePort(
    process.env.PORT ?? rawServer.port ?? DEFAULT_PORT,
    'server.port',
  );
  const databaseEnabled = parseBoolean(
    process.env.DB_ENABLED ?? rawDatabase.enabled ?? DEFAULT_DATABASE_ENABLED,
    'database.enabled',
  );
  const databasePort = parsePort(
    process.env.DB_PORT ?? rawDatabase.port ?? DEFAULT_DATABASE_PORT,
    'database.port',
  );
  const databaseLogging = parseBoolean(
    process.env.DB_LOGGING ?? rawDatabase.logging ?? DEFAULT_DATABASE_LOGGING,
    'database.logging',
  );
  const databaseSynchronize = parseBoolean(
    process.env.DB_SYNCHRONIZE ??
      rawDatabase.synchronize ??
      DEFAULT_DATABASE_SYNCHRONIZE,
    'database.synchronize',
  );
  const databaseAutoLoadEntities = parseBoolean(
    process.env.DB_AUTO_LOAD_ENTITIES ??
      rawDatabase.autoLoadEntities ??
      DEFAULT_DATABASE_AUTO_LOAD_ENTITIES,
    'database.autoLoadEntities',
  );

  return {
    app: {
      env,
      name: parseString(rawApp.name, DEFAULT_APP_NAME),
    },
    server: {
      host: parseString(host, DEFAULT_HOST),
      port,
    },
    database: {
      enabled: databaseEnabled,
      host: parseString(
        process.env.DB_HOST ?? rawDatabase.host,
        DEFAULT_DATABASE_HOST,
      ),
      port: databasePort,
      username: parseString(
        process.env.DB_USERNAME ?? rawDatabase.username,
        DEFAULT_DATABASE_USERNAME,
      ),
      password: parsePassword(
        process.env.DB_PASSWORD ?? rawDatabase.password,
        DEFAULT_DATABASE_PASSWORD,
      ),
      name: parseString(
        process.env.DB_NAME ?? rawDatabase.name,
        DEFAULT_DATABASE_NAME,
      ),
      charset: parseString(
        process.env.DB_CHARSET ?? rawDatabase.charset,
        DEFAULT_DATABASE_CHARSET,
      ),
      timezone: parseString(
        process.env.DB_TIMEZONE ?? rawDatabase.timezone,
        DEFAULT_DATABASE_TIMEZONE,
      ),
      logging: databaseLogging,
      synchronize: databaseSynchronize,
      autoLoadEntities: databaseAutoLoadEntities,
    },
  };
}

export default loadConfig;
