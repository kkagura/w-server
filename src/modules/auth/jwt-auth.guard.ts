import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AppConfig } from '../../config/config.types';
import { PUBLIC_ROUTE_KEY } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthTokenPayload } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: unknown }
    >();
    const token = this.extractBearerToken(request);
    const authConfig = this.configService.getOrThrow('auth', { infer: true });

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: authConfig.accessTokenSecret,
        audience: authConfig.audience,
        issuer: authConfig.issuer,
      });

      request.user = await this.authService.validateAccessPayload(payload);

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('缺少 Authorization 请求头');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization 请求头格式错误');
    }

    return token;
  }
}
