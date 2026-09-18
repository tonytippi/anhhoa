import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { ParentsService } from './parents.service.js';

@Module({ imports: [forwardRef(() => AuthorizationModule)], providers: [ParentsService, PrismaService], exports: [ParentsService] })
export class ParentsModule {}
