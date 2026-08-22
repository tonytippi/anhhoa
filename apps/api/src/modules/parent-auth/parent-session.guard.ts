import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import { ParentsService } from '../parents/parents.service.js';

@Injectable()
export class ParentSessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly parents: ParentsService, @Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    try {
      const token = request.cookies?.[this.config.parentSessionCookieName];
      if (!token) throw new Error();
      const payload = await this.jwt.verifyAsync<{ sub: string; kind: string }>(token);
      if (payload.kind !== 'parent') throw new Error();
      const parent = await this.parents.activeParent(payload.sub);
      if (!parent) throw new Error();
      request.user = parent;
      return true;
    } catch { throw new UnauthorizedException('Authentication is required.'); }
  }
}
