import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AuthConfig } from '../config/auth-config.js';
import { AUTH_CONFIG } from '../config/config.module.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  use(request: Request, _response: Response, next: NextFunction): void {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();
    const origin = request.get('origin');
    const isParentRoute = (request.path ?? request.originalUrl ?? '').startsWith('/parent/');
    const sessionCookie = isParentRoute ? this.config.parentSessionCookieName : 'session';
    if (!request.cookies?.[sessionCookie]) return next();
    const csrfCookie = request.cookies?.[isParentRoute ? this.config.parentCsrfCookieName : this.config.csrfCookieName];
    const csrfHeader = request.get('x-csrf-token');
    if (origin !== (isParentRoute ? this.config.parentWebOrigin : this.config.webOrigin) || !csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid request origin or CSRF token.');
    }
    next();
  }
}
