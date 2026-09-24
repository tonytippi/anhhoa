import { describe, expect, it, vi } from 'vitest';
import { AppOperationController, RosterController } from './roster.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
describe('RosterController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const roster = { createSchoolYear: vi.fn(), createClass: vi.fn(), renameClass: vi.fn(), archiveClass: vi.fn(), createStudent: vi.fn(), uploadStudentPhoto: vi.fn(), uploadStaffPhoto: vi.fn(), staffPhoto: vi.fn(), placeWaitingEnrollment: vi.fn(), changeLifecycle: vi.fn(), createStaff: vi.fn(), updateStaff: vi.fn(), createPosition: vi.fn(), renamePosition: vi.fn(), inactivatePosition: vi.fn(), grantPositionCapability: vi.fn(), revokePositionCapability: vi.fn(), positions: vi.fn(), createAssignment: vi.fn(), changeAssignment: vi.fn(), endAssignment: vi.fn(), transitionEnrollments: vi.fn(), closeYear: vi.fn(), previewTransition: vi.fn(), previewCloseYear: vi.fn(), schoolYears: vi.fn(), classes: vi.fn(), students: vi.fn(), student: vi.fn(), staff: vi.fn(), assignments: vi.fn() };
  it('rejects every roster mutation without browser mutation proof before calling its service', async () => {
    const controller = new RosterController(auth as never, roster as never);
    const invalid = request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' });
    await expect(controller.createSchoolYear(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createClass(invalid, 'school', 'year', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.renameClass(invalid, 'school', 'class', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.archiveClass(invalid, 'school', 'class', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.createStudent(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.placeWaitingEnrollment(invalid, 'school', 'enrollment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.lifecycle(invalid, 'school', 'enrollment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createStaff(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.updateStaff(invalid, 'school', 'staff', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.uploadStaffPhoto(invalid as never, 'school', 'staff', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.renamePosition(invalid, 'school', 'position', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.inactivatePosition(invalid, 'school', 'position', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.grantPositionCapability(invalid, 'school', 'position', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.revokePositionCapability(invalid, 'school', 'position', 'ROSTER_MANAGE', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.createAssignment(invalid, 'school', 'staff', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.changeAssignment(invalid, 'school', 'assignment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.endAssignment(invalid, 'school', 'assignment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.transition(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.closeYear(invalid, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.previewTransition(invalid, 'school', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.previewCloseYear(invalid, 'school', {})).rejects.toMatchObject({ status: 401 });
    expect(roster.createSchoolYear).not.toHaveBeenCalled(); expect(roster.createClass).not.toHaveBeenCalled(); expect(roster.renameClass).not.toHaveBeenCalled(); expect(roster.archiveClass).not.toHaveBeenCalled(); expect(roster.createStudent).not.toHaveBeenCalled(); expect(roster.placeWaitingEnrollment).not.toHaveBeenCalled(); expect(roster.changeLifecycle).not.toHaveBeenCalled(); expect(roster.createStaff).not.toHaveBeenCalled(); expect(roster.updateStaff).not.toHaveBeenCalled(); expect(roster.createAssignment).not.toHaveBeenCalled(); expect(roster.changeAssignment).not.toHaveBeenCalled(); expect(roster.endAssignment).not.toHaveBeenCalled(); expect(roster.transitionEnrollments).not.toHaveBeenCalled(); expect(roster.closeYear).not.toHaveBeenCalled();
    expect(roster.previewTransition).not.toHaveBeenCalled(); expect(roster.previewCloseYear).not.toHaveBeenCalled(); expect(roster.uploadStaffPhoto).not.toHaveBeenCalled();
  });
  it('delegates Operation reconciliation with the app session identity and school scope', async () => {
    const operation = vi.fn().mockResolvedValue({ id: 'operation-id', status: 'PENDING' });
    const controller = new AppOperationController(auth as never, { operation } as never);
    await expect(controller.operation(request({ cookie: 'app_session=session' }), 'school-id', 'operation-id')).resolves.toEqual({ data: { id: 'operation-id', status: 'PENDING' } });
    expect(operation).toHaveBeenCalledWith('actor-id', 'school-id', 'operation-id');
  });
  it('forwards roster list query and preserves its data plus bounded pagination metadata', async () => {
    const students = vi.fn().mockResolvedValue({ data: [{ id: 'student' }], meta: { page: 2, pageSize: 100, totalItems: 101, totalPages: 2 } });
    const controller = new RosterController(auth as never, { students } as never);
    await expect(controller.students(request({ cookie: 'app_session=session' }), 'school', 'year', { page: '2', pageSize: '100', q: 'An' })).resolves.toEqual({ data: [{ id: 'student' }], meta: { page: 2, pageSize: 100, totalItems: 101, totalPages: 2 } });
    expect(students).toHaveBeenCalledWith('actor-id', 'school', 'year', { page: '2', pageSize: '100', q: 'An' });
  });
  it('forwards staff-list query and preserves its pagination response', async () => {
    const staff = vi.fn().mockResolvedValue({ data: [{ id: 'staff' }], meta: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 } });
    const controller = new RosterController(auth as never, { staff } as never);
    await expect(controller.staff(request({ cookie: 'app_session=session' }), 'school', { page: '2', q: 'Mai', employmentStatus: 'ACTIVE', sort: 'name' })).resolves.toEqual({ data: [{ id: 'staff' }], meta: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 } });
    expect(staff).toHaveBeenCalledWith('actor-id', 'school', { page: '2', q: 'Mai', employmentStatus: 'ACTIVE', sort: 'name' });
  });
  it('forwards the scoped parent-list query and preserves its pagination response', async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ id: 'parent' }], meta: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 } });
    const controller = new RosterController(auth as never, {} as never, { list } as never);
    await expect(controller.parentsList(request({ cookie: 'app_session=session' }), 'school', 'year', { page: '2', q: 'Mai' })).resolves.toEqual({ data: [{ id: 'parent' }], meta: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 } });
    expect(list).toHaveBeenCalledWith('actor-id', 'school', 'year', { page: '2', q: 'Mai' });
  });
  it('forwards the relationship-labelled parent command through the mutation boundary', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'operation' });
    const controller = new RosterController(auth as never, {} as never, { create } as never);
    const browser = request({ origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token', 'app_session': 'session' });
    const body = { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000', relationshipLabel: 'Mẹ' };
    await controller.createParent(browser, 'school', 'student', '123e4567-e89b-42d3-a456-426614174000', '123e4567-e89b-42d3-a456-426614174001', body);
    expect(create).toHaveBeenCalledWith('actor-id', 'school', 'student', '123e4567-e89b-42d3-a456-426614174000', '123e4567-e89b-42d3-a456-426614174001', body);
  });
});
