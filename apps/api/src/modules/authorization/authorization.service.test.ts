import { describe, expect, it } from 'vitest';
import { AuthorizationService } from './authorization.service.js';

describe('AuthorizationService audience projection', () => {
  it('does not expose access capability or navigation to teacher even for School Admin', async () => {
    const prisma = { schoolMembership: { findFirst: async () => ({ id: 'membership', schoolId: 'school', school: { name: 'Trường A', slug: 'truong-a' }, boundStaffProfile: { id: 'staff', primaryPosition: { grants: [{ capability: 'SCHOOL_CONTEXT_READ' }, { capability: 'ACCESS_MANAGE' }, { capability: 'ROSTER_MANAGE' }, { capability: 'SETTINGS_MANAGE' }] } } }) } } as any;
    const service = new AuthorizationService(prisma);
    await expect(service.resolve('identity', 'school', 'teacher')).resolves.toEqual({ schoolId: 'school', schoolSlug: 'truong-a', schoolName: 'Trường A', membershipId: 'membership', staffProfileId: 'staff', capabilities: ['SCHOOL_CONTEXT_READ'], navigation: [{ id: 'overview', label: 'Tổng quan' }] });
    await expect(service.resolve('identity', 'school', 'app')).resolves.toMatchObject({ capabilities: ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE'], navigation: [{ id: 'overview' }, { id: 'access' }, { id: 'roster' }, { id: 'settings' }] });
  });

  it.each(['app', 'teacher'] as const)('projects the authorized School slug in %s chooser and context results', async (audience) => {
    const prisma = { schoolMembership: { findMany: async () => [{ schoolId: 'school', school: { name: 'Trường A', slug: 'truong-a' }, boundStaffProfile: { primaryPosition: { grants: [{ capability: 'SCHOOL_CONTEXT_READ' }] } } }] } } as any;
    await expect(new AuthorizationService(prisma).chooser('identity', audience)).resolves.toEqual([{ schoolId: 'school', schoolSlug: 'truong-a', schoolName: 'Trường A' }]);
    prisma.schoolMembership.findFirst = async () => ({ id: 'membership', schoolId: 'school', school: { name: 'Trường A', slug: 'truong-a' }, boundStaffProfile: { id: 'staff', primaryPosition: { grants: [{ capability: 'SCHOOL_CONTEXT_READ' }] } } });
    await expect(new AuthorizationService(prisma).resolve('identity', 'school', audience)).resolves.toMatchObject({ schoolId: 'school', schoolSlug: 'truong-a' });
  });
});
