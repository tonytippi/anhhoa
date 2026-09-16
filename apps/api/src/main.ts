import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
export const apiEnvPath = resolve(import.meta.dirname, '../.env');

loadDotenv({ path: apiEnvPath });

export function parsePort(value = process.env.PORT ?? '3000'): number {
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}

export async function createApi() {
  return NestFactory.create(AppModule);
}

export async function bootstrap(): Promise<void> {
  const app = await createApi();
  await app.listen(parsePort());
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
