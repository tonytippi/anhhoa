import { describe, expect, it } from 'vitest';
import { AuthorizationService } from './authorization.service.js';

describe('AuthorizationService audience projection', () => {
  it('does not expose access capability or navigation to teacher even for School Admin', async () => {
    const prisma = { schoolMembership: { findFirst: async () => ({ id: 'membership', schoolId: 'school', school: { name: 'Trường A' }, roleGrants: [{ role: 'SCHOOL_ADMIN' }] }) } } as any;
    const service = new AuthorizationService(prisma);
    await expect(service.resolve('identity', 'school', 'teacher')).resolves.toEqual({ schoolId: 'school', schoolName: 'Trường A', membershipId: 'membership', capabilities: ['SCHOOL_CONTEXT_READ'], navigation: [{ id: 'overview', label: 'Tổng quan' }] });
    await expect(service.resolve('identity', 'school', 'app')).resolves.toMatchObject({ capabilities: ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE'], navigation: [{ id: 'overview' }, { id: 'access' }, { id: 'roster' }, { id: 'settings' }] });
  });
});
