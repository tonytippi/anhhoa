import { Controller, Get, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Parent } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from '../../common/auth/public.decorator.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import { ParentsService } from '../parents/parents.service.js';
import { ParentGoogleGuard } from './parent-google.guard.js';
import type { GoogleParentProfile } from './parent-google.strategy.js';
import { ParentSessionGuard } from './parent-session.guard.js';

function safeParent(parent: Parent) { return { id: parent.id, email: parent.emailNormalized, displayName: parent.displayName, avatarUrl: parent.avatarUrl }; }

@Public()
@Controller('parent')
export class ParentAuthController {
  constructor(private readonly parents: ParentsService, private readonly jwt: JwtService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  @Public()
  @Get('auth/csrf')
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = randomBytes(32).toString('base64url');
    response.cookie(this.config.parentCsrfCookieName, token, { secure: true, sameSite: 'lax', httpOnly: false, path: '/' });
    return { data: { csrfToken: token } };
  }

  @Public()
  @Get('auth/google')
  @UseGuards(ParentGoogleGuard)
  google(): void {}

  @Public()
  @Get('auth/google/callback')
  @UseGuards(ParentGoogleGuard)
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    try {
      const profile = request.user as GoogleParentProfile;
      const parent = await this.parents.bindGoogleSubject(profile.email, profile.subject, profile);
      const session = await this.jwt.signAsync({ sub: parent.id, kind: 'parent' });
      response.cookie(this.config.parentSessionCookieName, session, { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
      response.redirect(request.parentOauthRedirect!);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      response.redirect(this.config.parentOauthDeniedRedirectUrl);
    }
  }

  @Get('me')
  @UseGuards(ParentSessionGuard)
  me(@Req() request: Request) { return { data: safeParent(request.user as Parent) }; }

  @Post('auth/logout')
  @UseGuards(ParentSessionGuard)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(this.config.parentSessionCookieName, { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
    response.clearCookie(this.config.parentCsrfCookieName, { secure: true, sameSite: 'lax', path: '/' });
    return { data: { loggedOut: true } };
  }
}
