import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { IS_PUBLIC } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_CONFIG } from '../config/config.module.js';
import type { AuthConfig } from '../config/auth-config.js';
import { Inject } from '@nestjs/common';
import { clearSessionCookieOptions } from '../auth/session-cookie.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const token = request.cookies?.session;
    if (!token) throw new UnauthorizedException('Authentication is required.');
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    } catch (error) {
      response.clearCookie('session', clearSessionCookieOptions());
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session expired.' });
      }
      throw new UnauthorizedException('Authentication is required.');
    }
    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
    if (!admin || !this.config.adminEmails.has(admin.email)) {
      response.clearCookie('session', clearSessionCookieOptions());
      throw new UnauthorizedException('Authentication is required.');
    }
    request.user = admin;
    return true;
  }
}
