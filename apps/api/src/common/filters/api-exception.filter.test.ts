import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('uses the standard JSON error contract', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new ForbiddenException('Invalid request origin or CSRF token.'), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token.' } });
  });
});
