import { ConflictException, Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator.js';
import { Public } from '../../common/auth/public.decorator.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { Admin } from '@prisma/client';
import { AdminsService, type GoogleAdminProfile } from '../admins/admins.service.js';
import { GoogleAuthGuard } from './google-auth.guard.js';
import { oauthDeniedRedirect } from './oauth-denied-redirect.js';
import { sessionCookieOptions } from '../../common/auth/session-cookie.js';

function safeAdmin(admin: Admin) { return { id: admin.id, email: admin.email, displayName: admin.displayName, avatarUrl: admin.avatarUrl, createdAt: admin.createdAt.toISOString(), updatedAt: admin.updatedAt.toISOString() }; }

@Controller('auth')
export class AuthController {
  constructor(private readonly admins: AdminsService, private readonly jwt: JwtService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = randomBytes(32).toString('base64url');
    response.cookie(this.config.csrfCookieName, token, { secure: true, sameSite: 'lax', httpOnly: false, path: '/' });
    return { data: { csrfToken: token } };
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google(): void {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const profile = request.user as GoogleAdminProfile;
    let admin: Admin;
    try {
      admin = await this.admins.upsertGoogleAdmin(profile);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      response.clearCookie(this.config.oauthStateCookieName, { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google' });
      response.redirect(oauthDeniedRedirect(this.config.oauthDeniedRedirectUrl));
      return;
    }
    const session = await this.jwt.signAsync({ sub: admin.id });
    response.clearCookie(this.config.oauthStateCookieName, { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google' });
    response.cookie('session', session, sessionCookieOptions(this.config));
    response.redirect(request.oauthRedirect!);
  }

  @Get('me')
  me(@CurrentAdmin() admin: Admin) { return { data: safeAdmin(admin) }; }
}
