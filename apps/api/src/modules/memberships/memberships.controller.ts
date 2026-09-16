import { Body, Controller, Get, Headers, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { audienceConfig } from '../auth/auth.config.js';
import { MembershipsService } from './memberships.service.js';
type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];
@Controller('api/app/schools/:schoolId')
export class MembershipsController {
  constructor(private readonly auth: AuthService, private readonly memberships: MembershipsService) {}
  private identity(request: RequestLike) { return this.auth.session('app', cookie(request, audienceConfig('app').cookieName)).userIdentityId; }
  private mutation(request: RequestLike, key?: string) { const config = audienceConfig('app'); if (request.headers.origin !== config.origin || !request.headers['x-csrf-token'] || request.headers['x-csrf-token'] !== cookie(request, config.csrfCookieName)) throw new UnauthorizedException({ code: 'CSRF_INVALID', message: 'CSRF không hợp lệ.' }); return key ?? ''; }
  @Get('memberships') async list(@Req() request: RequestLike, @Param('schoolId') schoolId: string) { return { data: await this.memberships.list(this.identity(request), schoolId), meta: {} }; }
  @Post('memberships') async create(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: any) { return { data: await this.memberships.create(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('memberships/:membershipId/revoke') async revoke(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('membershipId') membershipId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: any) { return { data: await this.memberships.revoke(this.identity(request), schoolId, membershipId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('memberships/:membershipId/roles') async roles(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('membershipId') membershipId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: any) { return { data: await this.memberships.replaceRoles(this.identity(request), schoolId, membershipId, this.mutation(request, key), operationId ?? '', body) }; }
  @Get('operations/:operationId') async operation(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('operationId') operationId: string) { return { data: await this.memberships.operation(this.identity(request), schoolId, operationId) }; }
}
