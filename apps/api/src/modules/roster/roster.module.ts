import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { AppOperationController, RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';
import { ParentsModule } from '../parents/parents.module.js';

@Module({ imports: [AuthModule, AuthorizationModule, ParentsModule], controllers: [RosterController, AppOperationController], providers: [RosterService, PrismaService] })
export class RosterModule {}
