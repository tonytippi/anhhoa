import { describe, expect, it } from 'vitest';
import { createApi, parsePort } from './main.js';

describe('parsePort', () => {
  it('accepts valid ports and rejects malformed values', () => {
    expect(parsePort('3000')).toBe(3000);
    expect(() => parsePort('3000x')).toThrow('PORT must be an integer');
    expect(() => parsePort('0')).toThrow('PORT must be an integer');
  });
});

describe('Ops CORS', () => {
  it('permits the operation identifier header for an allowed Ops preflight', async () => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/schools`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5176' } });
    await app.close();
    expect(response.status).toBe(204); expect(response.headers.get('access-control-allow-headers')).toContain('x-operation-id');
  });
});
