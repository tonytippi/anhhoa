import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { ParentsModule } from '../parents/parents.module.js';
import { ParentAuthController } from './parent-auth.controller.js';
import { ParentGoogleGuard } from './parent-google.guard.js';
import { ParentGoogleStrategy } from './parent-google.strategy.js';
import { ParentSessionGuard } from './parent-session.guard.js';

@Module({
  imports: [ParentsModule, PassportModule, JwtModule.registerAsync({ inject: [AUTH_CONFIG], useFactory: (config: AuthConfig) => ({ secret: config.jwtSecret, signOptions: { expiresIn: config.jwtExpiresIn } as JwtSignOptions }) })],
  controllers: [ParentAuthController],
  providers: [ParentGoogleStrategy, ParentGoogleGuard, ParentSessionGuard],
  exports: [JwtModule, ParentsModule],
})
export class ParentAuthModule {}
