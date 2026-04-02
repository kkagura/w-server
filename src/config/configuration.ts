import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { AppConfig } from './config.types';

type PlainObject = Record<string, unknown>;

const DEFAULT_ENV = 'dev';
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
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
    throw new Error(`Configuration file "${filePath}" must contain a YAML object at the root.`);
  }

  return parsed;
}

function parsePort(value: unknown): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid server.port value: "${String(value)}". Expected an integer between 1 and 65535.`);
  }

  return port;
}

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV?.trim() || DEFAULT_ENV;
  const configRoot = join(process.cwd(), CONFIG_DIR);
  const baseConfig = readYamlFile(join(configRoot, BASE_CONFIG_FILE));
  const envConfig = readYamlFile(join(configRoot, `application.${env}.yml`));
  const merged = deepMerge(baseConfig, envConfig);

  const rawApp = isPlainObject(merged.app) ? merged.app : {};
  const rawServer = isPlainObject(merged.server) ? merged.server : {};
  const host = process.env.HOST ?? rawServer.host ?? DEFAULT_HOST;
  const port = parsePort(process.env.PORT ?? rawServer.port ?? DEFAULT_PORT);

  return {
    app: {
      env,
      name: typeof rawApp.name === 'string' && rawApp.name.trim() ? rawApp.name : 'w-server',
    },
    server: {
      host: typeof host === 'string' && host.trim() ? host : DEFAULT_HOST,
      port,
    },
  };
}

export default loadConfig;
