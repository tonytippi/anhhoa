import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../identity/prisma.service.js';

@Module({ controllers: [AuthController], providers: [AuthService, PrismaService], exports: [AuthService] })
export class AuthModule {}
