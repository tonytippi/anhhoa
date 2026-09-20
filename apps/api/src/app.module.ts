import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OpsModule } from './modules/ops/ops.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { RosterModule } from './modules/roster/roster.module.js';
import { ParentsModule } from './modules/parents/parents.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';

@Module({ imports: [HealthModule, AuthModule, OpsModule, AuthorizationModule, RosterModule, ParentsModule, SettingsModule, AttendanceModule] })
export class AppModule {}
