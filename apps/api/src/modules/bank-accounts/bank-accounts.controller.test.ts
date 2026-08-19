import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/filters/api-exception.filter.js';
import { BankAccountsController } from './bank-accounts.controller.js';
import { BankAccountsService } from './bank-accounts.service.js';

const accounts = { list: vi.fn(), get: vi.fn(), create: vi.fn(), setStatus: vi.fn() };
@Module({ controllers: [BankAccountsController], providers: [{ provide: BankAccountsService, useValue: accounts }] })
class BankAccountsControllerTestModule {}

describe('BankAccountsController HTTP contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(BankAccountsControllerTestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => { await app.close(); });

  it('delegates valid list, create, and status requests', async () => {
    accounts.list.mockResolvedValue({ data: [] }); accounts.create.mockResolvedValue({ data: {} }); accounts.setStatus.mockResolvedValue({ data: {} });
    const baseUrl = await app.getUrl();
    expect((await fetch(`${baseUrl}/bank-accounts?search=VCB&status=ACTIVE&page=2&pageSize=10`)).status).toBe(200);
    expect(accounts.list).toHaveBeenCalledWith({ search: 'VCB', status: 'ACTIVE', page: 2, pageSize: 10 });
    expect((await fetch(`${baseUrl}/bank-accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Nguyen An' }) })).status).toBe(201);
    expect(accounts.create).toHaveBeenCalledWith({ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Nguyen An' });
    expect((await fetch(`${baseUrl}/bank-accounts/a2e36687-69b4-4e89-8ec0-141ff397837f/deactivate`, { method: 'POST' })).status).toBe(201);
    expect(accounts.setStatus).toHaveBeenCalledWith('a2e36687-69b4-4e89-8ec0-141ff397837f', 'INACTIVE');
  });

  it('rejects malformed query, path, and create body before delegating', async () => {
    const baseUrl = await app.getUrl();
    for (const request of [fetch(`${baseUrl}/bank-accounts?page=0`), fetch(`${baseUrl}/bank-accounts/not-a-uuid`), fetch(`${baseUrl}/bank-accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bankCode: '', accountNumber: '123', accountHolderName: 'Nguyen An', extra: true }) })]) {
      const response = await request;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST', message: 'Validation failed.' } });
    }
    expect(accounts.list).not.toHaveBeenCalled(); expect(accounts.get).not.toHaveBeenCalled(); expect(accounts.create).not.toHaveBeenCalled();
  });
});
