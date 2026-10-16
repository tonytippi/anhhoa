import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { CommunicationsController } from './communications.controller.js';
import { CommunicationsService } from './communications.service.js';

@Module({ imports: [AuthModule], controllers: [CommunicationsController], providers: [CommunicationsService, PrismaService], exports: [CommunicationsService] })
export class CommunicationsModule {}
