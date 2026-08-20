import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/filters/api-exception.filter.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

const reports = { monthly: vi.fn() };
@Module({ controllers: [ReportsController], providers: [{ provide: ReportsService, useValue: reports }] })
class ReportsControllerTestModule {}

describe('ReportsController HTTP contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  beforeAll(async () => { app = await NestFactory.create(ReportsControllerTestModule, { logger: false }); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); app.useGlobalFilters(new ApiExceptionFilter()); await app.listen(0, '127.0.0.1'); });
  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => { await app.close(); });

  it('delegates a valid monthly query', async () => {
    reports.monthly.mockResolvedValue({ data: { billingMonth: '2026-08' } });
    const response = await fetch(`${await app.getUrl()}/reports/monthly?billingMonth=2026-08`);
    expect(response.status).toBe(200); expect(reports.monthly).toHaveBeenCalledWith({ billingMonth: '2026-08' });
  });

  it('rejects missing, malformed, and extra query values before delegating', async () => {
    const baseUrl = await app.getUrl();
    for (const url of [`${baseUrl}/reports/monthly`, `${baseUrl}/reports/monthly?billingMonth=2026-13`, `${baseUrl}/reports/monthly?billingMonth=2026-08&extra=true`]) {
      const response = await fetch(url); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST', message: 'Validation failed.' } });
    }
    expect(reports.monthly).not.toHaveBeenCalled();
  });
});
