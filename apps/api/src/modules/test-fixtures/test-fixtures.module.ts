import { Module } from '@nestjs/common';
import { PrismaService } from '../identity/prisma.service.js';
import { TestFixturesController } from './test-fixtures.controller.js';

@Module({ controllers: [TestFixturesController], providers: [PrismaService] })
export class TestFixturesModule {}
