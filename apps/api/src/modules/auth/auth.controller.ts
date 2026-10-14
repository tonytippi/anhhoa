import { Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Audience } from './auth.config.js';
import { randomBytes } from 'node:crypto';
import { audienceConfig, cookieSecure, sessionCookieOptions } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';
import { ParentsService } from '../parents/parents.service.js';
import { runWithImpersonation } from '../common/impersonation-context.js';

const audiences = new Set<Audience>(['app', 'teacher', 'parent', 'ops']);
function audience(value: string): Audience { if (!audiences.has(value as Audience)) throw new UnauthorizedException(); return value as Audience; }
type RequestLike = { headers: Record<string, string | undefined> };
type ResponseLike = { redirect(url: string): void; cookie(name: string, value: string, options: Record<string, unknown>): ResponseLike; clearCookie(name: string, options: Record<string, unknown>): ResponseLike; status(code: number): ResponseLike; send(): void; json?(body: unknown): void };
function cookie(request: RequestLike, name: string): string | undefined { return request.headers.cookie?.split(';').map((item: string) => item.trim().split('=')).find(([key]: string[]) => key === name)?.[1]; }

// Slides the audience session (and its CSRF pair) forward on any API request that carries a valid session.
// An impersonated session must still be active, and the request then runs in its Impersonation context.
export function sessionRefresh(auth: AuthService) {
  return async (request: RequestLike & { path?: string }, response: ResponseLike, next: () => void): Promise<void> => {
    const match = request.path?.match(/^\/api\/(app|teacher|parent|ops)\/(.*)$/);
    if (!match) return next();
    const selected = match[1] as Audience; const config = audienceConfig(selected); const token = cookie(request, config.cookieName);
    let identity: ReturnType<AuthService['session']> | undefined;
    try { identity = token ? auth.session(selected, token) : undefined; } catch { identity = undefined; }
    const impersonationId = identity?.impersonation?.id;
    if (impersonationId && !(await auth.impersonationActive(impersonationId).catch(() => false))) {
      response.clearCookie(config.cookieName, sessionCookieOptions(selected, true));
      response.status(401).json?.({ error: { code: 'IMPERSONATION_ENDED', message: 'Phiên giả lập đã kết thúc.' } });
      return;
    }
    if (!/^auth\/(?:logout|google\/|impersonate$)/.test(match[2]!)) {
      const renewed = auth.refresh(selected, token);
      if (renewed) {
        // Renewal happens at most hourly per session, which bounds how often last-seen is written.
        if (identity && !impersonationId) void auth.touchLastSeen(identity.userIdentityId);
        response.cookie(config.cookieName, renewed.cookie, sessionCookieOptions(selected, true, renewed.maxAge));
        response.cookie(config.csrfCookieName, cookie(request, config.csrfCookieName) ?? randomBytes(32).toString('base64url'), sessionCookieOptions(selected, false, renewed.maxAge));
      }
    }
    const school = /^schools\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i.exec(match[2]!);
    if (school && identity && !impersonationId && selected !== 'ops') void auth.touchSchoolAccess(selected, identity.userIdentityId, school[1]!.toLowerCase());
    if (impersonationId) return runWithImpersonation(impersonationId, next);
    next();
  };
}

@Controller('api/:audience/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly parents?: ParentsService) {}

  @Get('google/start')
  async start(@Param('audience') value: string, @Query('redirect') redirect: string | undefined, @Query('login_hint') loginHint: string | undefined, @Query('prompt') prompt: string | undefined, @Res() response: ResponseLike): Promise<void> { const selected = audience(value); const result = await this.auth.start(selected, redirect, loginHint, prompt === 'select_account'); response.cookie(audienceConfig(selected).correlationCookieName, result.correlation, { httpOnly: true, secure: cookieSecure(selected), sameSite: 'lax', path: '/' }); response.redirect(result.authorizationUrl); }

  @Get('google/callback')
  async callback(@Param('audience') value: string, @Query('state') state: string, @Query('code') code: string, @Req() request: RequestLike, @Res() response: ResponseLike): Promise<void> {
    const selected = audience(value);
    try {
      const config = audienceConfig(selected); const result = await this.auth.callback(selected, state, cookie(request, config.correlationCookieName), code);
      if (result.cookie && result.csrf) { response.cookie(config.cookieName, result.cookie, sessionCookieOptions(selected, true, result.maxAge)); response.cookie(config.csrfCookieName, result.csrf, sessionCookieOptions(selected, false, result.maxAge)); }
      response.redirect(result.redirect);
    } catch { response.redirect(audienceConfig(selected).deniedRedirect); }
  }

  // Lands a Platform Operator's single-use ticket on this portal host as an impersonated session.
  @Get('impersonate')
  async impersonate(@Param('audience') value: string, @Query('ticket') ticket: string | undefined, @Res() response: ResponseLike): Promise<void> {
    const selected = audience(value); const config = audienceConfig(selected);
    try {
      const result = await this.auth.impersonate(selected, ticket);
      response.cookie(config.cookieName, result.cookie, sessionCookieOptions(selected, true, result.maxAge));
      response.cookie(config.csrfCookieName, result.csrf, sessionCookieOptions(selected, false, result.maxAge));
      response.redirect(config.redirects[0] ?? config.origin);
    } catch { response.redirect(config.deniedRedirect); }
  }

  @Get('session')
  async session(@Param('audience') value: string, @Req() request: RequestLike) {
    const selected = audience(value); const config = audienceConfig(selected);
    const identity = this.auth.session(selected, cookie(request, config.cookieName));
    const profile = await this.auth.profile(identity.userIdentityId);
    const grant = selected === 'ops' ? await this.auth.platformOperatorGrant(identity.userIdentityId) : undefined;
    if (selected === 'ops' && !grant) throw new UnauthorizedException({ code: 'OPS_ACCESS_DENIED', message: 'Bạn không có quyền vận hành nền tảng.' });
    if (selected === 'parent') return { data: { audience: selected, ...identity, ...profile, ...(await this.parents!.context(identity.userIdentityId)) } };
    return { data: { audience: selected, ...identity, ...profile, ...(grant ? { platformOperatorGrantId: grant.id } : {}) } };
  }

  @Post('logout')
  async logout(@Param('audience') value: string, @Req() request: RequestLike, @Res() response: ResponseLike): Promise<void> {
    const selected = audience(value); const config = audienceConfig(selected);
    assertCookieMutation(request, config.origin, config.csrfCookieName);
    let impersonationId: string | undefined;
    try { impersonationId = this.auth.session(selected, cookie(request, config.cookieName)).impersonation?.id; } catch { impersonationId = undefined; }
    if (impersonationId) await this.auth.endImpersonation(impersonationId);
    response.clearCookie(config.cookieName, sessionCookieOptions(selected, true));
    response.clearCookie(config.csrfCookieName, sessionCookieOptions(selected, false)).status(204).send();
  }
}
