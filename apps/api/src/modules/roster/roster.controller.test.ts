import { describe, expect, it, vi } from 'vitest';
import { RosterController } from './roster.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
describe('RosterController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const roster = { createSchoolYear: vi.fn(), createClass: vi.fn(), renameClass: vi.fn(), archiveClass: vi.fn(), createStudent: vi.fn(), changeLifecycle: vi.fn(), createStaff: vi.fn(), updateStaff: vi.fn(), createAssignment: vi.fn(), changeAssignment: vi.fn(), endAssignment: vi.fn(), transitionEnrollments: vi.fn(), closeYear: vi.fn(), previewTransition: vi.fn(), previewCloseYear: vi.fn(), schoolYears: vi.fn(), classes: vi.fn(), students: vi.fn(), student: vi.fn(), staff: vi.fn(), assignments: vi.fn() };
  it('rejects every roster mutation without browser mutation proof before calling its service', async () => {
    const controller = new RosterController(auth as never, roster as never);
    const invalid = request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' });
    await expect(controller.createSchoolYear(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createClass(invalid, 'school', 'year', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.renameClass(invalid, 'school', 'class', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.archiveClass(invalid, 'school', 'class', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.createStudent(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.lifecycle(invalid, 'school', 'enrollment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createStaff(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.updateStaff(invalid, 'school', 'staff', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createAssignment(invalid, 'school', 'staff', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.changeAssignment(invalid, 'school', 'assignment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.endAssignment(invalid, 'school', 'assignment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.transition(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.closeYear(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.previewTransition(invalid, 'school', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.previewCloseYear(invalid, 'school', {})).rejects.toMatchObject({ status: 401 });
    expect(roster.createSchoolYear).not.toHaveBeenCalled(); expect(roster.createClass).not.toHaveBeenCalled(); expect(roster.renameClass).not.toHaveBeenCalled(); expect(roster.archiveClass).not.toHaveBeenCalled(); expect(roster.createStudent).not.toHaveBeenCalled(); expect(roster.changeLifecycle).not.toHaveBeenCalled(); expect(roster.createStaff).not.toHaveBeenCalled(); expect(roster.updateStaff).not.toHaveBeenCalled(); expect(roster.createAssignment).not.toHaveBeenCalled(); expect(roster.changeAssignment).not.toHaveBeenCalled(); expect(roster.endAssignment).not.toHaveBeenCalled(); expect(roster.transitionEnrollments).not.toHaveBeenCalled(); expect(roster.closeYear).not.toHaveBeenCalled();
    expect(roster.previewTransition).not.toHaveBeenCalled(); expect(roster.previewCloseYear).not.toHaveBeenCalled();
  });
});
