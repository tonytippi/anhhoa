import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { normalizeEmail, type AuthConfig } from '../../common/config/auth-config.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';

export interface GoogleParentProfile { subject: string; email: string; displayName: string | null; avatarUrl: string | null; }

@Injectable()
export class ParentGoogleStrategy extends PassportStrategy(Strategy, 'parent-google') {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    super({ clientID: config.googleClientId, clientSecret: config.googleClientSecret, callbackURL: config.parentGoogleCallbackUrl, scope: ['email', 'profile'] });
  }

  validate(_accessToken: string, _refreshToken: string, profile: { id: string; emails?: Array<{ value: string; verified?: boolean }>; displayName?: string; photos?: Array<{ value?: string }> }): GoogleParentProfile {
    const email = profile.emails?.find((candidate) => candidate.verified === true)?.value;
    const normalizedEmail = email ? normalizeEmail(email) : '';
    if (!profile.id?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new UnauthorizedException('Parent is not authorized.');
    const avatarUrl = profile.photos?.[0]?.value?.trim();
    return { subject: profile.id.trim(), email: normalizedEmail, displayName: profile.displayName?.trim() || null, avatarUrl: avatarUrl?.startsWith('https://') ? avatarUrl : null };
  }
}
