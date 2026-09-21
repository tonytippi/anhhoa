import { describe, expect, it, vi } from 'vitest';
import { FinanceController } from './finance.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
const valid = { origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' };

describe('FinanceController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const finance = { read: vi.fn(), operation: vi.fn(), createGroup: vi.fn(), createReceivable: vi.fn(), transitionGroup: vi.fn(), transitionReceivable: vi.fn() };
  it('requires browser mutation proof before Finance writes', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    await expect(controller.group(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(finance.createGroup).not.toHaveBeenCalled();
  });
  it('passes session identity and mutation proof to catalog creation and lifecycle commands', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.createReceivable.mockResolvedValue({ id: 'operation' }); finance.transitionGroup.mockResolvedValue({ id: 'transition' });
    await expect(controller.receivable(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'operation' } });
    await expect(controller.groupLifecycle(request(valid), 'school', 'group', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'transition' } });
    expect(finance.createReceivable).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', {});
  });
});
