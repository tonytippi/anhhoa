import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_CONFIG } from '../../common/config/config.module.js';
import type { AuthConfig } from '../../common/config/auth-config.js';
import { AdminsModule } from '../admins/admins.module.js';
import { AuthController } from './auth.controller.js';
import { GoogleAuthGuard } from './google-auth.guard.js';
import { GoogleStrategy } from './google.strategy.js';

@Module({
  imports: [AdminsModule, PassportModule, JwtModule.registerAsync({ inject: [AUTH_CONFIG], useFactory: (config: AuthConfig) => ({ secret: config.jwtSecret, signOptions: { expiresIn: config.jwtExpiresIn } as JwtSignOptions }) })],
  controllers: [AuthController], providers: [GoogleStrategy, GoogleAuthGuard],
})
export class AuthModule {}
