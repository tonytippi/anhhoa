import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../identity/prisma.service.js';
import { AppAuthorizationController, TeacherAuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
@Module({ imports: [forwardRef(() => AuthModule)], controllers: [AppAuthorizationController, TeacherAuthorizationController], providers: [AuthorizationService, PrismaService], exports: [AuthorizationService] })
export class AuthorizationModule {}
