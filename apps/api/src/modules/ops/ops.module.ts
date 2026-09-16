import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { OpsController } from './ops.controller.js';
import { OpsService } from './ops.service.js';

@Module({ imports: [AuthModule], controllers: [OpsController], providers: [OpsService, PrismaService] })
export class OpsModule {}
