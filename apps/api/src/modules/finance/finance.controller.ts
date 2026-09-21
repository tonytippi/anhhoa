import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { audienceConfig } from '../auth/auth.config.js';
import { AuthService } from '../auth/auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';
import { FinanceService } from './finance.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/app/schools/:schoolId/finance')
export class FinanceController {
  constructor(private readonly auth: AuthService, private readonly finance: FinanceService) {}
  private identity(request: RequestLike) { return this.auth.session('app', cookie(request, audienceConfig('app').cookieName)).userIdentityId; }
  private mutation(request: RequestLike, key?: string) { const config = audienceConfig('app'); return assertCookieMutation(request, config.origin, config.csrfCookieName, key); }
  @Get('receivables') async read(@Req() request: RequestLike, @Param('schoolId') schoolId: string) { return { data: await this.finance.read(this.identity(request), schoolId) }; }
  @Get('operations/:operationId') async operation(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('operationId') operationId: string) { return { data: await this.finance.operation(this.identity(request), schoolId, operationId) }; }
  @Post('receivable-groups') async group(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.createGroup(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivables') async receivable(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.createReceivable(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivable-groups/:groupId/lifecycle') async groupLifecycle(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('groupId') groupId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.transitionGroup(this.identity(request), schoolId, groupId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivables/:receivableId/lifecycle') async receivableLifecycle(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('receivableId') receivableId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.transitionReceivable(this.identity(request), schoolId, receivableId, this.mutation(request, key), operationId ?? '', body) }; }
}
