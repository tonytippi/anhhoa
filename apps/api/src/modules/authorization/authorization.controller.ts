import { Controller, Get, Param, Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { audienceConfig } from '../auth/auth.config.js';
import { AuthorizationService } from './authorization.service.js';

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

@Controller('api/app/schools')
export class AppAuthorizationController {
  constructor(private readonly auth: AuthService, private readonly authorization: AuthorizationService) {}
  private identity(request: RequestLike) { return this.auth.session('app', cookie(request, audienceConfig('app').cookieName)).userIdentityId; }
  @Get() async chooser(@Req() request: RequestLike) { return { data: await this.authorization.chooser(this.identity(request), 'app'), meta: {} }; }
  @Get(':schoolId') async context(@Param('schoolId') schoolId: string, @Req() request: RequestLike) { return { data: await this.authorization.resolve(this.identity(request), schoolId, 'app') }; }
}

@Controller('api/teacher/schools')
export class TeacherAuthorizationController {
  constructor(private readonly auth: AuthService, private readonly authorization: AuthorizationService) {}
  private identity(request: RequestLike) { return this.auth.session('teacher', cookie(request, audienceConfig('teacher').cookieName)).userIdentityId; }
  @Get() async chooser(@Req() request: RequestLike) { return { data: await this.authorization.chooser(this.identity(request), 'teacher'), meta: {} }; }
  @Get(':schoolId') async context(@Param('schoolId') schoolId: string, @Req() request: RequestLike) { return { data: await this.authorization.resolve(this.identity(request), schoolId, 'teacher') }; }
}
