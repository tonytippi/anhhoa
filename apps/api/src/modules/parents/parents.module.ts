import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { ParentsService } from './parents.service.js';
import { ParentsController } from './parents.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceService } from '../finance/finance.service.js';

@Module({ imports: [forwardRef(() => AuthorizationModule), forwardRef(() => AuthModule)], controllers: [ParentsController], providers: [ParentsService, FinanceService, PrismaService], exports: [ParentsService] })
export class ParentsModule {}
