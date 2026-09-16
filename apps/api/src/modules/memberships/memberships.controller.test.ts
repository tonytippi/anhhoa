import { describe, expect, it, vi } from 'vitest';
import { MembershipsController } from './memberships.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
describe('MembershipsController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const memberships = { create: vi.fn(), revoke: vi.fn(), replaceRoles: vi.fn(), list: vi.fn(), operation: vi.fn() };
  it('rejects missing or wrong origin and double-submit CSRF before service execution', async () => {
    const controller = new MembershipsController(auth as never, memberships as never);
    await expect(controller.create(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.create(request({ origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'wrong' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(memberships.create).not.toHaveBeenCalled();
  });
  it('passes the authenticated identity and only valid browser mutation proof to service', async () => {
    const controller = new MembershipsController(auth as never, memberships as never); memberships.create.mockResolvedValue({ id: 'operation' });
    await expect(controller.create(request({ origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', { email: 'a@example.com', roles: ['CLASS_TEACHER'] })).resolves.toEqual({ data: { id: 'operation' } });
    expect(memberships.create).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', { email: 'a@example.com', roles: ['CLASS_TEACHER'] });
  });
});
