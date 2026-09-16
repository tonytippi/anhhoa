import { Controller, Get, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Audience } from './auth.config.js';
import { audienceConfig } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';

const audiences = new Set<Audience>(['app', 'teacher', 'parent', 'ops']);
function audience(value: string): Audience { if (!audiences.has(value as Audience)) throw new UnauthorizedException(); return value as Audience; }
type RequestLike = { headers: Record<string, string | undefined> };
type ResponseLike = { redirect(url: string): void; cookie(name: string, value: string, options: Record<string, unknown>): ResponseLike; clearCookie(name: string, options: Record<string, unknown>): ResponseLike; status(code: number): ResponseLike; send(): void };
function cookie(request: RequestLike, name: string): string | undefined { return request.headers.cookie?.split(';').map((item: string) => item.trim().split('=')).find(([key]: string[]) => key === name)?.[1]; }

@Controller('api/:audience/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google/start')
  async start(@Param('audience') value: string, @Query('redirect') redirect: string | undefined, @Res() response: ResponseLike): Promise<void> { const selected = audience(value); const result = await this.auth.start(selected, redirect); response.cookie(audienceConfig(selected).correlationCookieName, result.correlation, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); response.redirect(result.authorizationUrl); }

  @Get('google/callback')
  async callback(@Param('audience') value: string, @Query('state') state: string, @Query('code') code: string, @Req() request: RequestLike, @Res() response: ResponseLike): Promise<void> {
    const selected = audience(value);
    try {
      const config = audienceConfig(selected); const result = await this.auth.callback(selected, state, cookie(request, config.correlationCookieName), code);
      if (result.cookie && result.csrf) { response.cookie(config.cookieName, result.cookie, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); response.cookie(config.csrfCookieName, result.csrf, { httpOnly: false, secure: true, sameSite: 'lax', path: '/' }); }
      response.redirect(result.redirect);
    } catch { response.redirect(audienceConfig(selected).deniedRedirect); }
  }

  @Get('session')
  async session(@Param('audience') value: string, @Req() request: RequestLike) {
    const selected = audience(value); const config = audienceConfig(selected);
    const identity = this.auth.session(selected, cookie(request, config.cookieName));
    const grant = selected === 'ops' ? await this.auth.platformOperatorGrant(identity.userIdentityId) : undefined;
    if (selected === 'ops' && !grant) throw new UnauthorizedException({ code: 'OPS_ACCESS_DENIED', message: 'Bạn không có quyền vận hành nền tảng.' });
    return { data: { audience: selected, ...identity, ...(grant ? { platformOperatorGrantId: grant.id } : {}) } };
  }

  @Post('logout')
  logout(@Param('audience') value: string, @Req() request: RequestLike, @Res() response: ResponseLike): void {
    const selected = audience(value); const config = audienceConfig(selected);
    assertCookieMutation(request, config.origin, config.csrfCookieName);
    response.clearCookie(config.cookieName, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    response.clearCookie(config.csrfCookieName, { httpOnly: false, secure: true, sameSite: 'lax', path: '/' }).status(204).send();
  }
}
