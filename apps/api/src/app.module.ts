import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OpsModule } from './modules/ops/ops.module.js';

@Module({ imports: [HealthModule, AuthModule, OpsModule] })
export class AppModule {}
