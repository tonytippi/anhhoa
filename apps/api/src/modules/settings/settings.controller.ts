import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { audienceConfig } from '../auth/auth.config.js';
import { AuthService } from '../auth/auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';
import { SettingsService } from './settings.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/app/schools/:schoolId/settings')
export class SettingsController {
  constructor(private readonly auth: AuthService, private readonly settings: SettingsService) {}
  private identity(request: RequestLike) { return this.auth.session('app', cookie(request, audienceConfig('app').cookieName)).userIdentityId; }
  private mutation(request: RequestLike, key?: string) { const config = audienceConfig('app'); return assertCookieMutation(request, config.origin, config.csrfCookieName, key); }
  @Get() async read(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Query('asOf') asOf?: string) { return { data: await this.settings.read(this.identity(request), schoolId, asOf) }; }
  @Post('profile-versions') async profile(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.settings.createProfile(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('calendar-versions') async calendar(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.settings.createCalendar(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
}
