import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OpsModule } from './modules/ops/ops.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { MembershipsModule } from './modules/memberships/memberships.module.js';

@Module({ imports: [HealthModule, AuthModule, OpsModule, AuthorizationModule, MembershipsModule] })
export class AppModule {}
