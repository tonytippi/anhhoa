import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { AuthConfig } from '../../common/config/auth-config.js';

interface OAuthState { redirect: string; nonce: string; }

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly jwt: JwtService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) { super(); }

  override getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.endsWith('/callback')) return { session: false };
    const response = context.switchToHttp().getResponse<Response>();
    const redirect = this.config.oauthRedirectUrls.includes(String(request.query.redirect ?? '')) ? String(request.query.redirect) : this.config.oauthRedirectUrls[0]!;
    const state = this.jwt.sign({ redirect, nonce: randomBytes(32).toString('base64url') } satisfies OAuthState, { expiresIn: '10m' });
    response.cookie(this.config.oauthStateCookieName, state, { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google', maxAge: 600_000 });
    return { session: false, state };
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (request.path.endsWith('/callback')) {
      const state = typeof request.query.state === 'string' ? request.query.state : '';
      if (!state || state !== request.cookies?.[this.config.oauthStateCookieName]) return this.deny(response);
      try {
        const payload = await this.jwt.verifyAsync<OAuthState>(state);
        if (!this.config.oauthRedirectUrls.includes(payload.redirect) || !payload.nonce) return this.deny(response);
        request.oauthRedirect = payload.redirect;
      } catch { return this.deny(response); }
    }
    try { return Boolean(await super.canActivate(context)); } catch { return this.deny(response); }
  }

  private deny(response: Response): false {
    response.clearCookie(this.config.oauthStateCookieName, { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google' });
    response.redirect(this.config.oauthDeniedRedirectUrl);
    return false;
  }
}
