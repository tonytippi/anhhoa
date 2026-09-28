import { HttpException, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiErrorFilter } from './api-error.filter.js';

describe('ApiErrorFilter', () => {
  it('logs only an allowlisted non-HTTP exception record and returns a safe 500', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const json = vi.fn();
    const filter = new ApiErrorFilter();
    const error = new Error('error-message-secret');
    filter.catch(error, {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/app/schools/id/finance?query-secret',
          headers: {
            'x-request-id': 'request-id',
            cookie: 'cookie-secret',
            authorization: 'authorization-secret',
            'x-csrf-token': 'csrf-secret',
            'idempotency-key': 'idempotency-secret',
            'x-operation-id': 'operation-secret',
          },
          body: { secret: 'body-secret' },
        }),
        getResponse: () => ({ status: vi.fn(() => ({ json })) }),
      }),
    } as never);

    expect(json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Lỗi máy chủ nội bộ.' } });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'unhandled_exception', code: 'UNHANDLED_EXCEPTION', method: 'POST', pathname: '/api/app/schools/id/finance', 'x-request-id': 'request-id', message: 'Unhandled non-HTTP exception.', stack: expect.any(String) }));
    const output = JSON.stringify(log.mock.calls);
    for (const secret of ['cookie-secret', 'authorization-secret', 'csrf-secret', 'idempotency-secret', 'operation-secret', 'body-secret', 'query-secret', 'error-message-secret']) expect(output).not.toContain(secret);
    log.mockRestore();
  });

  it('does not log handled HTTP exceptions', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const json = vi.fn();
    new ApiErrorFilter().catch(new HttpException({ code: 'EXPECTED', message: 'Expected' }, 400), {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({ status: vi.fn(() => ({ json })) }),
      }),
    } as never);

    expect(log).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ error: { code: 'EXPECTED', message: 'Expected' } });
    log.mockRestore();
  });
});
