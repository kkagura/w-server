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
const DEFAULT_REDIS_ENABLED = false;
const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_USERNAME = '';
const DEFAULT_REDIS_PASSWORD = '';
const DEFAULT_REDIS_DB = 0;
const DEFAULT_REDIS_KEY_PREFIX = '';
const DEFAULT_REDIS_CONNECT_TIMEOUT = 10000;
const DEFAULT_AUTH_ACCESS_TOKEN_SECRET = 'please-change-me-access-token-secret';
const DEFAULT_AUTH_ACCESS_TOKEN_EXPIRES_IN = 900;
const DEFAULT_AUTH_REFRESH_TOKEN_SECRET =
  'please-change-me-refresh-token-secret';
const DEFAULT_AUTH_REFRESH_TOKEN_EXPIRES_IN = 604800;
const DEFAULT_AUTH_ISSUER = 'w-server';
const DEFAULT_AUTH_AUDIENCE = 'w-server-client';
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

function parseIntegerInRange(
  value: unknown,
  fieldName: string,
  min: number,
  max?: number,
): number {
  const numberValue = Number(value);
  const isOutOfRange =
    numberValue < min || (max !== undefined && numberValue > max);

  if (!Number.isInteger(numberValue) || isOutOfRange) {
    const rangeText =
      max === undefined ? `greater than or equal to ${min}` : `between ${min} and ${max}`;

    throw new Error(
      `Invalid ${fieldName} value: "${String(value)}". Expected an integer ${rangeText}.`,
    );
  }

  return numberValue;
}

function parsePort(value: unknown, fieldName: string): number {
  return parseIntegerInRange(value, fieldName, 1, 65535);
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  return parseIntegerInRange(value, fieldName, 0);
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  return parseIntegerInRange(value, fieldName, 1);
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
  const rawRedis = isPlainObject(merged.redis) ? merged.redis : {};
  const rawAuth = isPlainObject(merged.auth) ? merged.auth : {};
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
  const redisEnabled = parseBoolean(
    process.env.REDIS_ENABLED ?? rawRedis.enabled ?? DEFAULT_REDIS_ENABLED,
    'redis.enabled',
  );
  const redisPort = parsePort(
    process.env.REDIS_PORT ?? rawRedis.port ?? DEFAULT_REDIS_PORT,
    'redis.port',
  );
  const redisDb = parseNonNegativeInteger(
    process.env.REDIS_DB ?? rawRedis.db ?? DEFAULT_REDIS_DB,
    'redis.db',
  );
  const redisConnectTimeout = parsePositiveInteger(
    process.env.REDIS_CONNECT_TIMEOUT ??
      rawRedis.connectTimeout ??
      DEFAULT_REDIS_CONNECT_TIMEOUT,
    'redis.connectTimeout',
  );
  const authAccessTokenExpiresIn = parsePositiveInteger(
    process.env.AUTH_ACCESS_TOKEN_EXPIRES_IN ??
      rawAuth.accessTokenExpiresIn ??
      DEFAULT_AUTH_ACCESS_TOKEN_EXPIRES_IN,
    'auth.accessTokenExpiresIn',
  );
  const authRefreshTokenExpiresIn = parsePositiveInteger(
    process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN ??
      rawAuth.refreshTokenExpiresIn ??
      DEFAULT_AUTH_REFRESH_TOKEN_EXPIRES_IN,
    'auth.refreshTokenExpiresIn',
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
    redis: {
      enabled: redisEnabled,
      host: parseString(
        process.env.REDIS_HOST ?? rawRedis.host,
        DEFAULT_REDIS_HOST,
      ),
      port: redisPort,
      username: parsePassword(
        process.env.REDIS_USERNAME ?? rawRedis.username,
        DEFAULT_REDIS_USERNAME,
      ),
      password: parsePassword(
        process.env.REDIS_PASSWORD ?? rawRedis.password,
        DEFAULT_REDIS_PASSWORD,
      ),
      db: redisDb,
      keyPrefix: parsePassword(
        process.env.REDIS_KEY_PREFIX ?? rawRedis.keyPrefix,
        DEFAULT_REDIS_KEY_PREFIX,
      ),
      connectTimeout: redisConnectTimeout,
    },
    auth: {
      accessTokenSecret: parseString(
        process.env.AUTH_ACCESS_TOKEN_SECRET ?? rawAuth.accessTokenSecret,
        DEFAULT_AUTH_ACCESS_TOKEN_SECRET,
      ),
      accessTokenExpiresIn: authAccessTokenExpiresIn,
      refreshTokenSecret: parseString(
        process.env.AUTH_REFRESH_TOKEN_SECRET ?? rawAuth.refreshTokenSecret,
        DEFAULT_AUTH_REFRESH_TOKEN_SECRET,
      ),
      refreshTokenExpiresIn: authRefreshTokenExpiresIn,
      issuer: parseString(
        process.env.AUTH_ISSUER ?? rawAuth.issuer,
        DEFAULT_AUTH_ISSUER,
      ),
      audience: parseString(
        process.env.AUTH_AUDIENCE ?? rawAuth.audience,
        DEFAULT_AUTH_AUDIENCE,
      ),
    },
  };
}

export default loadConfig;
