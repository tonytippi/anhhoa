import { describe, expect, it, vi } from 'vitest';
import { OpsController } from './ops.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
describe('OpsController', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) }; const ops = { provision: vi.fn(), lifecycle: vi.fn(), list: vi.fn(), operation: vi.fn() };
  it('rejects mutation missing exact origin, double-submit CSRF, or idempotency key before the service', async () => {
    const controller = new OpsController(auth as never, ops as never);
    await expect(controller.provision(request({ cookie: 'ops_csrf=token', 'x-csrf-token': 'token' }), undefined, 'op', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.provision(request({ origin: 'http://localhost:5176', cookie: 'ops_csrf=token', 'x-csrf-token': 'wrong' }), 'key', 'op', {})).rejects.toMatchObject({ status: 401 });
    expect(ops.provision).not.toHaveBeenCalled();
  });
  it('passes server-resolved identity and mutation proofs to the service', async () => {
    const controller = new OpsController(auth as never, ops as never); ops.provision.mockResolvedValue({ id: 'op' });
    await expect(controller.provision(request({ origin: 'http://localhost:5176', cookie: 'ops_csrf=token', 'x-csrf-token': 'token' }), 'key', 'op', { name: 'A' })).resolves.toEqual({ data: { id: 'op' } });
    expect(ops.provision).toHaveBeenCalledWith('actor-id', 'key', 'op', { name: 'A' });
  });
  it('returns list data with the standard list metadata envelope', async () => {
    const controller = new OpsController(auth as never, ops as never); ops.list.mockResolvedValue([{ id: 'school-id' }]);
    await expect(controller.list(request({ cookie: 'ops_session=session' }))).resolves.toEqual({ data: [{ id: 'school-id' }], meta: {} });
    expect(ops.list).toHaveBeenCalledWith('actor-id');
  });
});
