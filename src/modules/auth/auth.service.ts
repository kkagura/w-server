import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { AppConfig, AuthConfig } from '../../config/config.types';
import { RedisService } from '../../redis/redis.service';
import { UserService } from '../user/user.service';
import { toPublicUser } from '../user/user.presenter';
import type { User } from '../user/user.entity';
import type {
  AuthenticatedUser,
  AuthSession,
  AuthTokenPayload,
  LoginResult,
} from './auth.types';
import { AUTH_SESSION_KEY_PREFIX } from './auth.constants';
import { hashPassword, verifyPassword } from './password.util';
import type { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, loginIp: string | null): Promise<LoginResult> {
    const username = this.normalizeCredential(dto.username, '用户名');
    const password = this.normalizeCredential(dto.password, '密码');
    const user = await this.userService.findForAuthByUsername(username);

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordMatched = await this.verifyAndUpgradePassword(user, password);

    if (!passwordMatched) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    this.ensureUserEnabled(user);

    const sessionId = randomUUID();
    const accessToken = await this.signAccessToken(user, sessionId);
    const refreshToken = await this.signRefreshToken(user, sessionId);

    await this.saveSession(user, sessionId, refreshToken);
    await this.userService.updateLoginInfo(user.id, loginIp);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAuthConfig().accessTokenExpiresIn,
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const normalizedRefreshToken = this.normalizeCredential(
      refreshToken,
      'refreshToken',
    );
    const authConfig = this.getAuthConfig();
    const payload = await this.verifyToken(normalizedRefreshToken, {
      secret: authConfig.refreshTokenSecret,
      audience: authConfig.audience,
      issuer: authConfig.issuer,
    });

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh Token 类型无效');
    }

    const userId = this.parseUserId(payload.sub);
    const session = await this.getSession(payload.sessionId);
    const sessionUserId = session
      ? this.parseUserId(String(session.userId))
      : null;

    if (
      !session ||
      sessionUserId !== userId ||
      session.refreshTokenHash !== this.hashToken(normalizedRefreshToken)
    ) {
      throw new UnauthorizedException('Refresh Token 已失效');
    }

    const user = await this.userService.findActiveById(userId);

    if (!user) {
      await this.deleteSession(payload.sessionId);
      throw new UnauthorizedException('用户不存在');
    }

    this.ensureUserEnabled(user);

    const nextAccessToken = await this.signAccessToken(user, payload.sessionId);
    const nextRefreshToken = await this.signRefreshToken(user, payload.sessionId);

    await this.saveSession(user, payload.sessionId, nextRefreshToken);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: authConfig.accessTokenExpiresIn,
      user: toPublicUser(user),
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.deleteSession(user.sessionId);
  }

  async validateAccessPayload(
    payload: AuthTokenPayload,
  ): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Access Token 类型无效');
    }

    const userId = this.parseUserId(payload.sub);
    const session = await this.getSession(payload.sessionId);
    const sessionUserId = session
      ? this.parseUserId(String(session.userId))
      : null;

    if (!session || sessionUserId !== userId) {
      throw new UnauthorizedException('登录会话不存在或已失效');
    }

    const user = await this.userService.findActiveById(userId);

    if (!user) {
      await this.deleteSession(payload.sessionId);
      throw new UnauthorizedException('用户不存在');
    }

    this.ensureUserEnabled(user);

    return {
      ...toPublicUser(user),
      sessionId: payload.sessionId,
    };
  }

  private getAuthConfig(): AuthConfig {
    return this.configService.getOrThrow('auth', { infer: true });
  }

  private getRedisClient(): Redis {
    if (!this.redisService.isEnabled()) {
      throw new ServiceUnavailableException(
        '当前环境未启用 Redis，无法使用鉴权能力',
      );
    }

    return this.redisService.getClient();
  }

  private getSessionKey(sessionId: string): string {
    return `${AUTH_SESSION_KEY_PREFIX}:${sessionId}`;
  }

  private async saveSession(
    user: User,
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const redis = this.getRedisClient();
    const authConfig = this.getAuthConfig();
    const session: AuthSession = {
      userId: this.parseUserId(String(user.id)),
      username: user.username,
      sessionId,
      refreshTokenHash: this.hashToken(refreshToken),
      createdAt: new Date().toISOString(),
    };

    await redis.set(
      this.getSessionKey(sessionId),
      JSON.stringify(session),
      'EX',
      authConfig.refreshTokenExpiresIn,
    );
  }

  private async getSession(sessionId: string): Promise<AuthSession | null> {
    const redis = this.getRedisClient();
    const rawValue = await redis.get(this.getSessionKey(sessionId));

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as AuthSession;
    } catch {
      await this.deleteSession(sessionId);
      return null;
    }
  }

  private async deleteSession(sessionId: string): Promise<void> {
    const redis = this.getRedisClient();

    await redis.del(this.getSessionKey(sessionId));
  }

  private async signAccessToken(user: User, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(
      this.createTokenPayload(user, sessionId, 'access'),
      this.getAccessTokenSignOptions(),
    );
  }

  private async signRefreshToken(
    user: User,
    sessionId: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      this.createTokenPayload(user, sessionId, 'refresh'),
      this.getRefreshTokenSignOptions(),
    );
  }

  private createTokenPayload(
    user: User,
    sessionId: string,
    type: 'access' | 'refresh',
  ): AuthTokenPayload {
    return {
      sub: String(user.id),
      username: user.username,
      sessionId,
      type,
      jti: randomUUID(),
    };
  }

  private getAccessTokenSignOptions(): JwtSignOptions {
    const authConfig = this.getAuthConfig();

    return {
      secret: authConfig.accessTokenSecret,
      expiresIn: authConfig.accessTokenExpiresIn,
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    };
  }

  private getRefreshTokenSignOptions(): JwtSignOptions {
    const authConfig = this.getAuthConfig();

    return {
      secret: authConfig.refreshTokenSecret,
      expiresIn: authConfig.refreshTokenExpiresIn,
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    };
  }

  private async verifyToken(
    token: string,
    options: {
      secret: string;
      audience: string;
      issuer: string;
    },
  ): Promise<AuthTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AuthTokenPayload>(token, options);
    } catch {
      throw new UnauthorizedException('Token 已失效或非法');
    }
  }

  private parseUserId(value: string): number {
    const userId = Number(value);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Token 用户标识无效');
    }

    return userId;
  }

  private normalizeCredential(value: string, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${fieldName}不能为空`);
    }

    return value.trim();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ensureUserEnabled(user: User): void {
    if (user.status !== 1) {
      throw new UnauthorizedException('用户已被禁用');
    }
  }

  private async verifyAndUpgradePassword(
    user: User,
    password: string,
  ): Promise<boolean> {
    const passwordMatched = await verifyPassword(
      password,
      user.salt,
      user.password,
    );

    if (passwordMatched) {
      return true;
    }

    if (user.password === password) {
      const hashedPassword = await hashPassword(password, user.salt);

      await this.userService.updatePasswordHash(user.id, hashedPassword);
      user.password = hashedPassword;

      return true;
    }

    return false;
  }
}
