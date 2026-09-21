import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req } from '@nestjs/common';
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
  @Get('collection-runs') async runs(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Query('schoolYearId') schoolYearId?: string) { return { data: await this.finance.runs(this.identity(request), schoolId, schoolYearId) }; }
  @Get('collection-run-candidates') async candidates(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Query('schoolYearId') schoolYearId?: string) { return { data: await this.finance.candidates(this.identity(request), schoolId, schoolYearId) }; }
  @Get('collection-runs/:runId') async run(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('runId') runId: string) { return { data: await this.finance.run(this.identity(request), schoolId, runId) }; }
  @Get('collection-runs/:runId/preview') async preview(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('runId') runId: string) { this.mutation(request); return { data: await this.finance.preview(this.identity(request), schoolId, runId) }; }
  @Post('collection-runs') async openRun(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.openRun(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Put('collection-runs/:runId/selection') async selection(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('runId') runId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.replaceSelection(this.identity(request), schoolId, runId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('collection-runs/:runId/ready') async ready(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('runId') runId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.readyRun(this.identity(request), schoolId, runId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivable-groups') async group(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.createGroup(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivables') async receivable(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.createReceivable(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivable-groups/:groupId/lifecycle') async groupLifecycle(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('groupId') groupId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.transitionGroup(this.identity(request), schoolId, groupId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('receivables/:receivableId/lifecycle') async receivableLifecycle(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('receivableId') receivableId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.finance.transitionReceivable(this.identity(request), schoolId, receivableId, this.mutation(request, key), operationId ?? '', body) }; }
}
