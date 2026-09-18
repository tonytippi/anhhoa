import { describe, expect, it, vi } from 'vitest';
import { SettingsController } from './settings.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
const valid = { origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' };

describe('SettingsController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const settings = { read: vi.fn(), createProfile: vi.fn(), createCalendar: vi.fn() };
  it('rejects missing mutation proof before profile or calendar service execution', async () => {
    const controller = new SettingsController(auth as never, settings as never);
    await expect(controller.profile(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.calendar(request({ ...valid, 'x-csrf-token': 'wrong' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(settings.createProfile).not.toHaveBeenCalled(); expect(settings.createCalendar).not.toHaveBeenCalled();
  });
  it('uses the session identity and browser mutation proof at both Settings writes', async () => {
    settings.createProfile.mockResolvedValue({ id: 'profile-op' }); settings.createCalendar.mockResolvedValue({ id: 'calendar-op' });
    const controller = new SettingsController(auth as never, settings as never);
    await expect(controller.profile(request(valid), 'school', 'key', 'operation', { schoolName: 'A' })).resolves.toEqual({ data: { id: 'profile-op' } });
    await expect(controller.calendar(request(valid), 'school', 'key', 'operation', { holidays: [] })).resolves.toEqual({ data: { id: 'calendar-op' } });
    expect(settings.createProfile).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', { schoolName: 'A' });
    expect(settings.createCalendar).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', { holidays: [] });
  });
});
