import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import { createApi } from '../../main.js';

describe('HealthController', () => {
  it('returns the target API health response', () => {
    expect(new HealthController().check()).toEqual({ data: { status: 'ok' } });
  });

  it('serves the health endpoint over HTTP', async () => {
    const app = await createApi();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    await app.close();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { status: 'ok' } });
  });
});
