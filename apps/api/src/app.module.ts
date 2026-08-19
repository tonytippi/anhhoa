import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './common/config/config.module.js';
import { SessionAuthGuard } from './common/guards/session-auth.guard.js';
import { CsrfMiddleware } from './common/middleware/csrf.middleware.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';

@Module({ imports: [ConfigModule, PrismaModule, AuthModule, ClassesModule, StudentsModule, OperationsModule], providers: [{ provide: APP_GUARD, useClass: SessionAuthGuard }] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(CsrfMiddleware).forRoutes('*'); }
}
