import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

export function parsePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const port = Number(value);
  if (port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

export async function bootstrap(): Promise<void> {
  const port = parsePort(process.env.PORT);
  const app = await NestFactory.create(AppModule);
  await app.listen(port);
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
