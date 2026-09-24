import { describe, expect, it, vi } from 'vitest';
import { AttendanceController } from './attendance.controller.js';

describe('AttendanceController daily journal media', () => {
  it('uses Teacher mutation protection and writes private no-store image headers', async () => {
    const attendance = { uploadDailyJournalMedia: vi.fn().mockResolvedValue({ id: 'media' }), readDailyJournalMedia: vi.fn().mockResolvedValue({ contentType: 'image/png', blob: new Uint8Array([1]) }) };
    const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'teacher' }) };
    const controller = new AttendanceController(auth as never, attendance as never);
    const request = { headers: { cookie: 'teacher_session=session; teacher_csrf=csrf', origin: 'http://localhost:5175', 'x-csrf-token': 'csrf', 'content-type': 'image/png' }, body: Buffer.from([1]) };
    await expect(controller.dailyJournalMedia(request, 'school', crypto.randomUUID(), crypto.randomUUID(), 'class', 'student', '2026-02-09')).resolves.toEqual({ data: { id: 'media' } });
    const response = { setHeader: vi.fn(), send: vi.fn() };
    await controller.readDailyJournalMedia(request, 'school', 'media', response);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.send).toHaveBeenCalledWith(new Uint8Array([1]));
  });
  it('uses the Parent audience and applies no-store headers to protected journal bytes', async () => {
    const attendance = { parentDailyJournals: vi.fn().mockResolvedValue([]), parentDailyJournal: vi.fn().mockResolvedValue(null), readParentDailyJournalMedia: vi.fn().mockResolvedValue({ contentType: 'image/webp', blob: new Uint8Array([2]) }) };
    const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'parent' }) };
    const controller = new AttendanceController(auth as never, attendance as never);
    const request = { headers: { cookie: 'parent_session=session' } };
    await expect(controller.parentDailyJournals(request, 'school', 'student', '2026-02-09')).resolves.toEqual({ data: [], meta: {} });
    await expect(controller.parentDailyJournal(request, 'school', 'student', '2026-02-09')).resolves.toEqual({ data: null });
    const response = { setHeader: vi.fn(), send: vi.fn() };
    await controller.parentDailyJournalMedia(request, 'school', 'media', response);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.send).toHaveBeenCalledWith(new Uint8Array([2]));
  });
});
