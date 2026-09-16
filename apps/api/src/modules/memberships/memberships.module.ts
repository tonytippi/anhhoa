import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { MembershipsController } from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
@Module({ imports: [AuthModule, AuthorizationModule], controllers: [MembershipsController], providers: [MembershipsService, PrismaService] })
export class MembershipsModule {}
