import type { CookieOptions } from 'express';
import type { AuthConfig } from '../config/auth-config.js';

const sessionCookieBaseOptions: CookieOptions = {
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

export function sessionCookieOptions(config: AuthConfig): CookieOptions {
  return { ...sessionCookieBaseOptions, maxAge: config.sessionCookieMaxAge };
}

export function clearSessionCookieOptions(): CookieOptions {
  return sessionCookieBaseOptions;
}
