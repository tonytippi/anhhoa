import { Global, Module } from '@nestjs/common';
import { loadAuthConfig, type AuthConfig } from './auth-config.js';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

@Global()
@Module({ providers: [{ provide: AUTH_CONFIG, useFactory: (): AuthConfig => loadAuthConfig() }], exports: [AUTH_CONFIG] })
export class ConfigModule {}
