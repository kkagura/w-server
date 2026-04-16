import type { PublicUser } from '../user/user.presenter';

export interface AuthTokenPayload {
  sub: string;
  username: string;
  sessionId: string;
  type: 'access' | 'refresh';
  jti: string;
}

export interface AuthSession {
  userId: number | string;
  username: string;
  sessionId: string;
  refreshTokenHash: string;
  createdAt: string;
}

export interface AuthenticatedUser extends PublicUser {
  sessionId: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

export interface CaptchaResult {
  captchaId: string;
  captchaSvg: string;
  expiresIn: number;
}
