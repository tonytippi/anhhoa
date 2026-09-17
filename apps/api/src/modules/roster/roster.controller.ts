import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { audienceConfig } from '../auth/auth.config.js';
import { AuthService } from '../auth/auth.service.js';
import { assertCookieMutation } from '../common/mutation-protection.js';
import { RosterService } from './roster.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/app/schools/:schoolId/roster')
export class RosterController {
  constructor(private readonly auth: AuthService, private readonly roster: RosterService) {}
  private identity(request: RequestLike) { return this.auth.session('app', cookie(request, audienceConfig('app').cookieName)).userIdentityId; }
  private mutation(request: RequestLike, key?: string) { const config = audienceConfig('app'); return assertCookieMutation(request, config.origin, config.csrfCookieName, key); }
  @Get('school-years') async schoolYears(@Req() request: RequestLike, @Param('schoolId') schoolId: string) { return { data: await this.roster.schoolYears(this.identity(request), schoolId), meta: {} }; }
  @Post('school-years') async createSchoolYear(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.roster.createSchoolYear(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Get('school-years/:schoolYearId/classes') async classes(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('schoolYearId') schoolYearId: string) { return { data: await this.roster.classes(this.identity(request), schoolId, schoolYearId), meta: {} }; }
  @Post('school-years/:schoolYearId/classes') async createClass(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('schoolYearId') schoolYearId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.roster.createClass(this.identity(request), schoolId, schoolYearId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('classes/:classId/name') async renameClass(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('classId') classId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.roster.renameClass(this.identity(request), schoolId, classId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('classes/:classId/archive') async archiveClass(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('classId') classId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string) { return { data: await this.roster.archiveClass(this.identity(request), schoolId, classId, this.mutation(request, key), operationId ?? '') }; }
  @Get('school-years/:schoolYearId/students') async students(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('schoolYearId') schoolYearId: string, @Query('classId') classId?: string) { return { data: await this.roster.students(this.identity(request), schoolId, schoolYearId, classId), meta: {} }; }
  @Get('students/:studentId') async student(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('studentId') studentId: string) { return { data: await this.roster.student(this.identity(request), schoolId, studentId) }; }
  @Post('students') async createStudent(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.roster.createStudent(this.identity(request), schoolId, this.mutation(request, key), operationId ?? '', body) }; }
  @Post('enrollments/:enrollmentId/lifecycle') async lifecycle(@Req() request: RequestLike, @Param('schoolId') schoolId: string, @Param('enrollmentId') enrollmentId: string, @Headers('idempotency-key') key: string, @Headers('x-operation-id') operationId: string, @Body() body: unknown) { return { data: await this.roster.changeLifecycle(this.identity(request), schoolId, enrollmentId, this.mutation(request, key), operationId ?? '', body) }; }
}
