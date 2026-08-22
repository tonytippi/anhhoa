import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ParentSessionGuard } from '../parent-auth/parent-session.guard.js';
import { ParentPortalController } from './parent-portal.controller.js';
import { ParentPortalService } from './parent-portal.service.js';

const portal = { students: vi.fn().mockResolvedValue({ data: [] }), invoices: vi.fn().mockResolvedValue({ data: [], meta: {} }), invoice: vi.fn().mockResolvedValue({ data: {} }) };
const parentGuard = { canActivate: vi.fn().mockImplementation((context) => { context.switchToHttp().getRequest().user = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f' }; return true; }) };

@Module({ controllers: [ParentPortalController], providers: [{ provide: ParentPortalService, useValue: portal }, { provide: ParentSessionGuard, useValue: parentGuard }] })
class ParentPortalControllerTestModule {}

describe('ParentPortalController guard contract', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  beforeAll(async () => { app = await NestFactory.create(ParentPortalControllerTestModule, { logger: false }); await app.listen(0, '127.0.0.1'); });
  afterAll(async () => { await app.close(); });

  it('exposes every portal route through the local Parent session guard, not the Admin guard', async () => {
    const baseUrl = `${await app.getUrl()}/parent`;
    for (const path of ['/students', '/invoices?page=1&pageSize=20', '/invoices/a2e36687-69b4-4e89-8ec0-141ff397837f']) {
      expect((await fetch(`${baseUrl}${path}`)).status).toBe(200);
    }
    expect(parentGuard.canActivate).toHaveBeenCalledTimes(3);
    expect(portal.students).toHaveBeenCalledWith('a2e36687-69b4-4e89-8ec0-141ff397837f');
    expect(portal.invoices).toHaveBeenCalledWith('a2e36687-69b4-4e89-8ec0-141ff397837f', { page: 1, pageSize: 20 });
    expect(portal.invoice).toHaveBeenCalledWith('a2e36687-69b4-4e89-8ec0-141ff397837f', 'a2e36687-69b4-4e89-8ec0-141ff397837f');
  });
});
