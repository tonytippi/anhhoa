import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';

@Module({ imports: [AuthModule, AuthorizationModule], controllers: [RosterController], providers: [RosterService, PrismaService] })
export class RosterModule {}
