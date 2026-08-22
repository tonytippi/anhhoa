import { Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';

import { ParentOauthStateStore } from './parent-oauth-state.js';

const states = new ParentOauthStateStore();
const stateCookieOptions = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/parent/auth/google', maxAge: 600_000 };

@Injectable()
export class ParentGoogleGuard extends AuthGuard('parent-google') {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) { super(); }

  override getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.endsWith('/callback')) return { session: false };
    const response = context.switchToHttp().getResponse<Response>();
    const redirect = this.config.parentOauthRedirectUrls.includes(String(request.query.redirect ?? '')) ? String(request.query.redirect) : this.config.parentOauthRedirectUrls[0]!;
    const state = randomBytes(32).toString('base64url');
    states.create(state, redirect);
    response.cookie(this.config.parentOauthStateCookieName, state, stateCookieOptions);
    return { session: false, state };
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (request.path.endsWith('/callback')) {
      const state = typeof request.query.state === 'string' ? request.query.state : '';
      const saved = states.consume(state, request.cookies?.[this.config.parentOauthStateCookieName]);
      response.clearCookie(this.config.parentOauthStateCookieName, stateCookieOptions);
      if (!saved) return this.deny(response);
      request.parentOauthRedirect = saved.redirect;
    }
    try { return Boolean(await super.canActivate(context)); } catch { return this.deny(response); }
  }

  private deny(response: Response): false {
    if (!response.headersSent) response.redirect(this.config.parentOauthDeniedRedirectUrl);
    return false;
  }
}
