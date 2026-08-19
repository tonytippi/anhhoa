import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/filters/api-exception.filter.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

const students = { create: vi.fn(), update: vi.fn() };

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

  it('passes omitted, null, and UUID classId to PATCH while rejecting malformed input', async () => {
    const url = `${await app.getUrl()}/students/a2e36687-69b4-4e89-8ec0-141ff397837f`;
    for (const body of [{ fullName: 'Bé An' }, { fullName: 'Bé An', classId: null }, { fullName: 'Bé An', classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f' }]) {
      const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      expect(response.status).toBe(200);
    }
    expect(students.update).toHaveBeenNthCalledWith(1, 'a2e36687-69b4-4e89-8ec0-141ff397837f', { fullName: 'Bé An' });
    expect(students.update).toHaveBeenNthCalledWith(2, 'a2e36687-69b4-4e89-8ec0-141ff397837f', { fullName: 'Bé An', classId: null });
    const invalid = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'Bé An', classId: 'invalid' }) });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: { fieldErrors: [expect.stringContaining('classId')] } });
  });
});
