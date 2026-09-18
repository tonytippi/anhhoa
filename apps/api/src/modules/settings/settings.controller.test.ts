import { describe, expect, it, vi } from 'vitest';
import { SettingsController } from './settings.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
const valid = { origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' };

describe('SettingsController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const settings = { read: vi.fn(), createProfile: vi.fn(), createCalendar: vi.fn(), createFinancePolicy: vi.fn(), createAttendancePolicy: vi.fn(), createHandoverPolicy: vi.fn(), createDailyJournalPolicy: vi.fn(), createBankAccount: vi.fn(), transitionBankAccount: vi.fn() };
  it('rejects missing mutation proof before profile or calendar service execution', async () => {
    const controller = new SettingsController(auth as never, settings as never);
    await expect(controller.profile(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.calendar(request({ ...valid, 'x-csrf-token': 'wrong' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(settings.createProfile).not.toHaveBeenCalled(); expect(settings.createCalendar).not.toHaveBeenCalled();
  });
  it('applies browser mutation proof to FinancePolicy and BankAccount writes', async () => {
    const controller = new SettingsController(auth as never, settings as never);
    settings.createFinancePolicy.mockResolvedValue({ id: 'policy-op' }); settings.createBankAccount.mockResolvedValue({ id: 'account-op' }); settings.transitionBankAccount.mockResolvedValue({ id: 'lifecycle-op' });
    await expect(controller.financePolicy(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'policy-op' } });
    await expect(controller.bankAccount(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'account-op' } });
    await expect(controller.bankAccountLifecycle(request(valid), 'school', 'account', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'lifecycle-op' } });
  });
  it('uses the session identity and browser mutation proof at both Settings writes', async () => {
    settings.createProfile.mockResolvedValue({ id: 'profile-op' }); settings.createCalendar.mockResolvedValue({ id: 'calendar-op' });
    const controller = new SettingsController(auth as never, settings as never);
    await expect(controller.profile(request(valid), 'school', 'key', 'operation', { schoolName: 'A' })).resolves.toEqual({ data: { id: 'profile-op' } });
    await expect(controller.calendar(request(valid), 'school', 'key', 'operation', { holidays: [] })).resolves.toEqual({ data: { id: 'calendar-op' } });
    expect(settings.createProfile).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', { schoolName: 'A' });
    expect(settings.createCalendar).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', { holidays: [] });
  });
  it('applies browser mutation proof to typed attendance and journal policy writes', async () => {
    const controller = new SettingsController(auth as never, settings as never);
    settings.createAttendancePolicy.mockResolvedValue({ id: 'attendance-op' }); settings.createHandoverPolicy.mockResolvedValue({ id: 'handover-op' }); settings.createDailyJournalPolicy.mockResolvedValue({ id: 'journal-op' });
    await expect(controller.attendancePolicy(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'attendance-op' } });
    await expect(controller.handoverPolicy(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'handover-op' } });
    await expect(controller.dailyJournalPolicy(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'journal-op' } });
  });
  it('rejects missing origin or invalid CSRF before every typed policy service call', async () => {
    const controller = new SettingsController(auth as never, settings as never);
    settings.createAttendancePolicy.mockClear(); settings.createHandoverPolicy.mockClear(); settings.createDailyJournalPolicy.mockClear();
    await expect(controller.attendancePolicy(request({ ...valid, origin: undefined }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.handoverPolicy(request({ ...valid, 'x-csrf-token': 'wrong' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.dailyJournalPolicy(request({ ...valid, cookie: 'app_csrf=wrong' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(settings.createAttendancePolicy).not.toHaveBeenCalled(); expect(settings.createHandoverPolicy).not.toHaveBeenCalled(); expect(settings.createDailyJournalPolicy).not.toHaveBeenCalled();
  });
});
