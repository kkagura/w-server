import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config/config.types';
import { createRedisOptions } from '../config/redis.config';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

const logger = new Logger('RedisModule');

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService<AppConfig>,
  ): Promise<Redis | null> => {
    const redisConfig = configService.getOrThrow('redis', { infer: true });

    if (!redisConfig.enabled) {
      logger.log('Redis connection is disabled by configuration.');
      return null;
    }

    const client = new Redis(createRedisOptions(redisConfig));

    client.on('error', (error) => {
      logger.error(`Redis error: ${error.message}`, error.stack);
    });
    client.on('reconnecting', () => {
      logger.warn('Redis connection is reconnecting.');
    });
    client.on('end', () => {
      logger.warn('Redis connection has been closed.');
    });

    await client.connect();
    logger.log(
      `Redis connected to ${redisConfig.host}:${redisConfig.port}/db${redisConfig.db}.`,
    );

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider, RedisService],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
