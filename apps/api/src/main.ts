import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { loadAuthConfig, parsePort } from './common/config/auth-config.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';

export { parsePort };
export const apiEnvPath = resolve(import.meta.dirname, '../.env');

loadDotenv({ path: apiEnvPath });

export async function bootstrap(): Promise<void> {
  const config = loadAuthConfig();
  const port = config.port;
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: [config.webOrigin, config.parentWebOrigin], credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(port);
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
