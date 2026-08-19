import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/filters/api-exception.filter.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

const students = { create: vi.fn() };

@Module({ controllers: [StudentsController], providers: [{ provide: StudentsService, useValue: students }] })
class StudentsControllerTestModule {}

describe('StudentsController HTTP contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(StudentsControllerTestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => { await app.close(); });

  it('rejects classId before the Student create handler', async () => {
    const response = await fetch(`${await app.getUrl()}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Bé An', classId: 'a2e36687-69b4-4e89-8ec0-141ff397837f' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST', message: 'Validation failed.', fieldErrors: [expect.stringContaining('classId')] } });
    expect(students.create).not.toHaveBeenCalled();
  });
});
