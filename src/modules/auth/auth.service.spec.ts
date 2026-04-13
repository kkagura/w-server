import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { AppConfig, AuthConfig } from '../../config/config.types';
import { RedisService } from '../../redis/redis.service';
import type { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import type { AuthTokenPayload } from './auth.types';
import { AuthService } from './auth.service';
import { generatePasswordSalt, hashPassword } from './password.util';

function createRedisClientMock() {
  const store = new Map<string, string>();

  return {
    store,
    client: {
      set: jest.fn(
        async (key: string, value: string, _mode: string, _ttl: number) => {
          store.set(key, value);
          return 'OK';
        },
      ),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
      exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    } as unknown as Redis,
  };
}

describe('AuthService', () => {
  const authConfig: AuthConfig = {
    accessTokenSecret: 'unit-test-access-secret',
    accessTokenExpiresIn: 900,
    refreshTokenSecret: 'unit-test-refresh-secret',
    refreshTokenExpiresIn: 604800,
    issuer: 'w-server-test',
    audience: 'w-server-test-client',
  };

  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService<AppConfig>>;
  let jwtService: JwtService;
  let redisClient: ReturnType<typeof createRedisClientMock>;
  let user: User;

  beforeEach(async () => {
    const salt = generatePasswordSalt();
    const password = await hashPassword('123456', salt);

    user = {
      id: 1,
      username: 'admin',
      password,
      salt,
      nickname: '管理员',
      email: 'admin@example.com',
      mobile: '13800000000',
      avatar: '',
      status: 1,
      loginIp: null,
      loginAt: null,
      createBy: null,
      createAt: new Date(),
      updateBy: null,
      updateAt: new Date(),
      deleteAt: null,
    } as unknown as User;

    redisClient = createRedisClientMock();
    jwtService = new JwtService({});
    userService = {
      findForAuthByUsername: jest.fn().mockResolvedValue(user),
      findActiveById: jest.fn().mockResolvedValue(user),
      updateLoginInfo: jest.fn().mockResolvedValue(undefined),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UserService>;
    redisService = {
      isEnabled: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(redisClient.client),
    } as unknown as jest.Mocked<RedisService>;
    configService = {
      getOrThrow: jest.fn().mockImplementation((key: keyof AppConfig) => {
        if (key === 'auth') {
          return authConfig;
        }

        throw new Error(`Unexpected config key: ${String(key)}`);
      }),
    } as unknown as jest.Mocked<ConfigService<AppConfig>>;

    service = new AuthService(userService, redisService, configService, jwtService);
  });

  it('should login, validate access token, refresh and logout session', async () => {
    const loginResult = await service.login(
      { username: 'admin', password: '123456' },
      '127.0.0.1',
    );

    expect(loginResult.accessToken).toBeTruthy();
    expect(loginResult.refreshToken).toBeTruthy();
    expect(userService.updateLoginInfo).toHaveBeenCalledWith(1, '127.0.0.1');

    const accessPayload = await jwtService.verifyAsync<AuthTokenPayload>(
      loginResult.accessToken,
      {
        secret: authConfig.accessTokenSecret,
        audience: authConfig.audience,
        issuer: authConfig.issuer,
      },
    );
    const currentUser = await service.validateAccessPayload(accessPayload);

    expect(currentUser.id).toBe(1);
    expect(currentUser.username).toBe('admin');

    const refreshResult = await service.refresh(loginResult.refreshToken);
    expect(refreshResult.accessToken).toBeTruthy();
    expect(refreshResult.refreshToken).toBeTruthy();

    await service.logout(currentUser);

    await expect(service.validateAccessPayload(accessPayload)).rejects.toThrow(
      '登录会话不存在或已失效',
    );
  });

  it('should upgrade legacy plain-text password on successful login', async () => {
    const legacyUser = {
      ...user,
      password: 'legacy-password',
    } as User;

    userService.findForAuthByUsername.mockResolvedValueOnce(legacyUser);

    const loginResult = await service.login(
      { username: 'admin', password: 'legacy-password' },
      null,
    );

    expect(loginResult.accessToken).toBeTruthy();
    expect(userService.updatePasswordHash).toHaveBeenCalledTimes(1);
    expect(userService.updatePasswordHash).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
  });

  it('should validate access token when redis session userId is stored as string', async () => {
    const loginResult = await service.login(
      { username: 'admin', password: '123456' },
      '127.0.0.1',
    );
    const accessPayload = await jwtService.verifyAsync<AuthTokenPayload>(
      loginResult.accessToken,
      {
        secret: authConfig.accessTokenSecret,
        audience: authConfig.audience,
        issuer: authConfig.issuer,
      },
    );
    const sessionKey = `auth:session:${accessPayload.sessionId}`;
    const session = JSON.parse(redisClient.store.get(sessionKey) ?? '{}') as {
      userId?: number | string;
    };

    redisClient.store.set(
      sessionKey,
      JSON.stringify({
        ...session,
        userId: String(session.userId),
      }),
    );

    await expect(
      service.validateAccessPayload(accessPayload),
    ).resolves.toMatchObject({
      id: 1,
      username: 'admin',
      sessionId: accessPayload.sessionId,
    });
  });
});
