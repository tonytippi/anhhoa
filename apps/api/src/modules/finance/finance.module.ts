import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({ imports: [AuthModule, AuthorizationModule], controllers: [FinanceController], providers: [FinanceService, PrismaService] })
export class FinanceModule {}
