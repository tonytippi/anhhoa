import { describe, expect, it, vi } from 'vitest';
import { RosterController } from './roster.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
describe('RosterController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const roster = { createSchoolYear: vi.fn(), createClass: vi.fn(), renameClass: vi.fn(), archiveClass: vi.fn(), createStudent: vi.fn(), changeLifecycle: vi.fn(), schoolYears: vi.fn(), classes: vi.fn(), students: vi.fn(), student: vi.fn() };
  it('rejects every roster mutation without browser mutation proof before calling its service', async () => {
    const controller = new RosterController(auth as never, roster as never);
    const invalid = request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' });
    await expect(controller.createSchoolYear(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createClass(invalid, 'school', 'year', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.renameClass(invalid, 'school', 'class', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.archiveClass(invalid, 'school', 'class', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.createStudent(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.lifecycle(invalid, 'school', 'enrollment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(roster.createSchoolYear).not.toHaveBeenCalled(); expect(roster.createClass).not.toHaveBeenCalled(); expect(roster.renameClass).not.toHaveBeenCalled(); expect(roster.archiveClass).not.toHaveBeenCalled(); expect(roster.createStudent).not.toHaveBeenCalled(); expect(roster.changeLifecycle).not.toHaveBeenCalled();
  });
});
