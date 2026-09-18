import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({ imports: [AuthModule, AuthorizationModule], controllers: [SettingsController], providers: [SettingsService, PrismaService] })
export class SettingsModule {}
