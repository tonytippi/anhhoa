import { Body, Controller, Get, Headers, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { audienceConfig } from '../auth/auth.config.js';
import { OpsService } from './ops.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/ops')
export class OpsController {
  constructor(private readonly auth: AuthService, private readonly ops: OpsService) {}
  private identity(request: RequestLike) { const config = audienceConfig('ops'); return this.auth.session('ops', cookie(request, config.cookieName)).userIdentityId; }
  private mutation(request: RequestLike, key: string | undefined) { const config = audienceConfig('ops'); if (request.headers.origin !== config.origin || !request.headers['x-csrf-token'] || request.headers['x-csrf-token'] !== cookie(request, config.csrfCookieName)) throw new UnauthorizedException({ code: 'CSRF_INVALID', message: 'CSRF không hợp lệ.' }); return key ?? ''; }
  @Get('schools') async list(@Req() request: RequestLike) { return { data: await this.ops.list(this.identity(request)), meta: {} }; }
  @Post('schools') async provision(@Req() request: RequestLike, @Headers('idempotency-key') key: string | undefined, @Headers('x-operation-id') operationId: string | undefined, @Body() body: unknown) { return { data: await this.ops.provision(this.identity(request), this.mutation(request, key), operationId ?? '', body as object) }; }
  @Post('schools/:schoolId/suspend') async suspend(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string | undefined, @Headers('x-operation-id') operationId: string | undefined) { return { data: await this.ops.lifecycle(this.identity(request), schoolId, 'SUSPENDED', this.mutation(request, key), operationId ?? '') }; }
  @Post('schools/:schoolId/reactivate') async reactivate(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string | undefined, @Headers('x-operation-id') operationId: string | undefined) { return { data: await this.ops.lifecycle(this.identity(request), schoolId, 'ACTIVE', this.mutation(request, key), operationId ?? '') }; }
  @Get('operations/:operationId') async operation(@Req() request: RequestLike, @Param('operationId') id: string) { return { data: await this.ops.operation(this.identity(request), id) }; }
}
