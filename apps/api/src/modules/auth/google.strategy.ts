import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { normalizeEmail } from '../../common/config/auth-config.js';
import type { GoogleAdminProfile } from '../admins/admins.service.js';

export class GoogleAllowlistDeniedException extends UnauthorizedException {}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    super({ clientID: config.googleClientId, clientSecret: config.googleClientSecret, callbackURL: config.googleCallbackUrl, scope: ['email', 'profile'] });
    this.config = config;
  }
  private readonly config: AuthConfig;
  validate(_accessToken: string, _refreshToken: string, profile: { id: string; emails?: Array<{ value: string; verified?: boolean }>; displayName?: string; photos?: Array<{ value: string }> }): GoogleAdminProfile {
    const emailClaim = profile.emails?.find((candidate) => candidate.verified === true);
    const email = emailClaim?.value;
    if (!email || !this.config.adminEmails.has(normalizeEmail(email))) throw new GoogleAllowlistDeniedException('This account is not authorized.');
    return { googleId: profile.id, email, displayName: profile.displayName || normalizeEmail(email), avatarUrl: profile.photos?.[0]?.value };
  }
}
