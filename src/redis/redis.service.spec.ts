import type Redis from 'ioredis';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('should report disabled when redis client is not configured', () => {
    const service = new RedisService(null);

    expect(service.isEnabled()).toBe(false);
    expect(() => service.getClient()).toThrow(
      'Redis connection is disabled. Set redis.enabled to true before using Redis.',
    );
  });

  it('should close the redis client on application shutdown', async () => {
    const client = {
      status: 'ready',
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    } as unknown as Redis;
    const service = new RedisService(client);

    await service.onApplicationShutdown();

    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
