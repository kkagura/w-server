import {
  Inject,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis | null,
  ) {}

  isEnabled(): boolean {
    return this.client !== null;
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error(
        'Redis connection is disabled. Set redis.enabled to true before using Redis.',
      );
    }

    return this.client;
  }

  async ping(): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    return this.client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client || this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
