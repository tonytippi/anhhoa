import { describe, expect, it, vi } from 'vitest';
import { AdminsService } from './admins.service.js';

describe('AdminsService', () => {
  it('normalizes email and refreshes the Google profile during upsert', async () => {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = new AdminsService({ admin: { create, findUnique } } as never);
    await service.upsertGoogleAdmin({ googleId: 'google-id', email: ' Admin@EXAMPLE.com ', displayName: 'New name', avatarUrl: 'https://example.com/avatar' });
    expect(create).toHaveBeenCalledWith({ data: { email: 'admin@example.com', googleId: 'google-id', displayName: 'New name', avatarUrl: 'https://example.com/avatar' } });
  });
  it('rejects an existing email owned by another immutable Google subject', async () => {
    const service = new AdminsService({ admin: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'other', googleId: 'other' }) } } as never);
    await expect(service.upsertGoogleAdmin({ googleId: 'google-id', email: 'admin@example.com', displayName: 'Admin' })).rejects.toThrow('Unable to link this account.');
  });
  it('updates a permitted email change for the existing Google subject', async () => {
    const update = vi.fn().mockResolvedValue({});
    const service = new AdminsService({ admin: { findUnique: vi.fn().mockResolvedValueOnce({ id: 'same', googleId: 'google-id' }).mockResolvedValueOnce(null), update } } as never);
    await service.upsertGoogleAdmin({ googleId: 'google-id', email: 'new@example.com', displayName: 'New name' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'same' }, data: { email: 'new@example.com', displayName: 'New name', avatarUrl: undefined } });
  });
});
