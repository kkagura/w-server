import type { RedisOptions } from 'ioredis';
import type { RedisConfig } from './config.types';

export function createRedisOptions(redisConfig: RedisConfig): RedisOptions {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    username: redisConfig.username || undefined,
    password: redisConfig.password || undefined,
    db: redisConfig.db,
    keyPrefix: redisConfig.keyPrefix || undefined,
    connectTimeout: redisConfig.connectTimeout,
    lazyConnect: true,
  };
}
