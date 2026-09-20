import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({ imports: [AuthModule, AuthorizationModule], controllers: [AttendanceController], providers: [AttendanceService, PrismaService] })
export class AttendanceModule {}
