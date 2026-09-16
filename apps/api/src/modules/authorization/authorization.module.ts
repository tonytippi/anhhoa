import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
@Module({ imports: [AuthModule], controllers: [AuthorizationController], providers: [AuthorizationService, PrismaService], exports: [AuthorizationService] })
export class AuthorizationModule {}
