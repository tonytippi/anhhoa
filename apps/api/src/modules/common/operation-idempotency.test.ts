import { describe, expect, it } from 'vitest';
import { isOperationIdempotencyCollision } from './operation-idempotency.js';

describe('isOperationIdempotencyCollision', () => {
  it('accepts only known partial Operation index targets across Prisma PostgreSQL error shapes', () => {
    expect(isOperationIdempotencyCollision({ code: 'P2002', meta: { target: 'Operation_school_idempotency_scope_key' } })).toBe(true);
    expect(isOperationIdempotencyCollision({ code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { fields: ['"platformOperatorGrantId"', '"actorType"', '"actorReference"', 'route', '"idempotencyKey"'] } } } } })).toBe(true);
  });

  it('rejects Operation primary-key and business unique violations', () => {
    expect(isOperationIdempotencyCollision({ code: 'P2002', meta: { target: ['id'] } })).toBe(false);
    expect(isOperationIdempotencyCollision({ code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { fields: ['"schoolId"', '"userIdentityId"'] } } } } })).toBe(false);
    expect(isOperationIdempotencyCollision({ code: 'P2002', meta: { target: 'School_slug_key' } })).toBe(false);
  });
});
