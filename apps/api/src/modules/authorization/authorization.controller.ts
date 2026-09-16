import { Controller, Get, Param, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { audienceConfig, type Audience } from '../auth/auth.config.js';
import { AuthorizationService } from './authorization.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/:audience/schools')
export class AuthorizationController {
  constructor(private readonly auth: AuthService, private readonly authorization: AuthorizationService) {}
  private identity(audience: string, request: RequestLike) {
    if (audience !== 'app' && audience !== 'teacher') throw new UnauthorizedException({ code: 'INVALID_AUDIENCE', message: 'Audience không hợp lệ.' });
    return this.auth.session(audience as Audience, cookie(request, audienceConfig(audience as Audience).cookieName)).userIdentityId;
  }
  @Get() async chooser(@Param('audience') audience: string, @Req() request: RequestLike) { const identity = this.identity(audience, request); return { data: await this.authorization.chooser(identity, audience as 'app' | 'teacher'), meta: {} }; }
  @Get(':schoolId') async context(@Param('audience') audience: string, @Param('schoolId') schoolId: string, @Req() request: RequestLike) { const identity = this.identity(audience, request); return { data: await this.authorization.resolve(identity, schoolId, audience as 'app' | 'teacher') }; }
}
