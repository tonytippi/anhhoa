import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../identity/prisma.service.js';
import { ParentsModule } from '../parents/parents.module.js';

@Module({ imports: [forwardRef(() => ParentsModule)], controllers: [AuthController], providers: [AuthService, PrismaService], exports: [AuthService] })
export class AuthModule {}
