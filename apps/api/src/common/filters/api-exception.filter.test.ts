import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { DomainException, IDEMPOTENCY_CONFLICT } from '../errors/domain.exception.js';

describe('ApiExceptionFilter', () => {
  it('does not write a second response after a guard has redirected', () => {
    const status = vi.fn();
    new ApiExceptionFilter().catch(new Error('OAuth callback failed after redirect.'), { switchToHttp: () => ({ getResponse: () => ({ headersSent: true, status }) }) } as never);
    expect(status).not.toHaveBeenCalled();
  });
  it('uses the standard JSON error contract', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new ForbiddenException('Invalid request origin or CSRF token.'), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token.' } });
  });
  it('preserves the public expired-session code for login recovery', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session expired.' }), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: { code: 'SESSION_EXPIRED', message: 'Session expired.' } });
  });
  it('preserves approved domain code and safe metadata', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new DomainException('CLASS_HAS_ACTIVE_STUDENTS', 'Class has active students.', { activeStudentCount: 2 }), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(json).toHaveBeenCalledWith({ error: { code: 'CLASS_HAS_ACTIVE_STUDENTS', message: 'Class has active students.', metadata: { activeStudentCount: 2 } } });
  });
  it('preserves the archived class domain code without metadata', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new DomainException('CLASS_ARCHIVED', 'Archived classes are read-only.'), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(json).toHaveBeenCalledWith({ error: { code: 'CLASS_ARCHIVED', message: 'Archived classes are read-only.' } });
  });
  it('does not expose unapproved domain-shaped response fields', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch(new (class extends ForbiddenException { override getResponse() { return { code: 'ARBITRARY', message: 'No.', metadata: { leaked: 1 } }; } })(), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN', message: 'No.' } });
  });
  it('maps a Prisma serialization conflict to the standard 409 response', () => {
    const json = vi.fn(); const status = vi.fn().mockReturnValue({ json });
    new ApiExceptionFilter().catch({ code: 'P2034' }, { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ error: { code: 'CONFLICT', message: 'Request failed.' } });
  });
});

it('preserves IDEMPOTENCY_CONFLICT for clients', () => {
  const status = vi.fn().mockReturnThis(); const json = vi.fn();
  new ApiExceptionFilter().catch(new DomainException(IDEMPOTENCY_CONFLICT, 'Key conflict.'), { switchToHttp: () => ({ getResponse: () => ({ status, json }) }) } as never);
  expect(json).toHaveBeenCalledWith({ error: { code: IDEMPOTENCY_CONFLICT, message: 'Key conflict.' } });
});
