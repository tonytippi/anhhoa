import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { audienceConfig } from '../auth/auth.config.js';
import { AuthService } from '../auth/auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';
import { AttendanceService } from './attendance.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api')
export class AttendanceController {
  constructor(private readonly auth: AuthService, private readonly attendance: AttendanceService) {}
  private identity(request: RequestLike, audience: 'app' | 'teacher' | 'parent') { return this.auth.session(audience, cookie(request, audienceConfig(audience).cookieName)).userIdentityId; }
  private mutation(request: RequestLike, audience: 'app' | 'parent', key?: string) { const config = audienceConfig(audience); return assertCookieMutation(request, config.origin, config.csrfCookieName, key); }
  @Post('parent/schools/:schoolId/leave-requests') async create(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.attendance.create(this.identity(request, 'parent'), schoolId, this.mutation(request, 'parent', key), operationId ?? '', body) }; }
  @Get('parent/schools/:schoolId/leave-requests') async parentList(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Query('studentId') studentId?: string) { return { data: await this.attendance.parentList(this.identity(request, 'parent'), schoolId, studentId), meta: {} }; }
  @Get('parent/schools/:schoolId/leave-requests/:leaveRequestId') async parentRead(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('leaveRequestId') leaveRequestId: string) { return { data: await this.attendance.parentRead(this.identity(request, 'parent'), schoolId, leaveRequestId) }; }
  @Get('parent/schools/:schoolId/operations/:operationId') async parentOperation(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('operationId') operationId: string) { return { data: await this.attendance.parentOperation(this.identity(request, 'parent'), schoolId, operationId) }; }
  @Get('teacher/schools/:schoolId/leave-requests') async teacherList(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Query('classId') classId?: string) { return { data: await this.attendance.teacherList(this.identity(request, 'teacher'), schoolId, classId), meta: {} }; }
  @Get('app/schools/:schoolId/leave-requests') async appList(@Req() request: RequestLike, @Param('schoolId') schoolId: string) { return { data: await this.attendance.appList(this.identity(request, 'app'), schoolId), meta: {} }; }
  @Post('app/schools/:schoolId/leave-requests/:leaveRequestId/approve') async approve(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('leaveRequestId') leaveRequestId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string) { return { data: await this.attendance.decide(this.identity(request, 'app'), schoolId, leaveRequestId, 'APPROVED', this.mutation(request, 'app', key), operationId ?? '', {}) }; }
  @Post('app/schools/:schoolId/leave-requests/:leaveRequestId/reject') async reject(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('leaveRequestId') leaveRequestId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.attendance.decide(this.identity(request, 'app'), schoolId, leaveRequestId, 'REJECTED', this.mutation(request, 'app', key), operationId ?? '', body) }; }
}
