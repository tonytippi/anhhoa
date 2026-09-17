import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../identity/prisma.service.js';

export type Capability = 'SCHOOL_CONTEXT_READ' | 'ACCESS_MANAGE' | 'ROSTER_MANAGE';
export type SchoolAudience = 'app' | 'teacher';
export type SchoolContext = { schoolId: string; schoolName: string; membershipId: string; capabilities: Capability[]; navigation: Array<{ id: string; label: string }> };

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  private capabilities(roles: string[], audience: SchoolAudience): Capability[] {
    const capabilities: Capability[] = [];
    if (roles.some((role) => ['SCHOOL_ADMIN', 'FINANCE_MANAGER', 'CLASS_TEACHER'].includes(role))) capabilities.push('SCHOOL_CONTEXT_READ');
    if (audience === 'app' && roles.includes('SCHOOL_ADMIN')) capabilities.push('ACCESS_MANAGE');
    if (audience === 'app' && roles.includes('SCHOOL_ADMIN')) capabilities.push('ROSTER_MANAGE');
    return capabilities;
  }

  async chooser(identityId: string, audience: SchoolAudience) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userIdentityId: identityId, status: 'ACTIVE', school: { status: 'ACTIVE' } },
      include: { school: true, roleGrants: true }, orderBy: { school: { name: 'asc' } },
    });
    return memberships.flatMap((membership) => {
      const capabilities = this.capabilities(membership.roleGrants.map((grant) => grant.role), audience);
      return capabilities.includes('SCHOOL_CONTEXT_READ') ? [{ schoolId: membership.schoolId, schoolName: membership.school.name }] : [];
    });
  }

  async resolve(identityId: string, schoolId: string, audience: SchoolAudience, required: Capability = 'SCHOOL_CONTEXT_READ'): Promise<SchoolContext> {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { schoolId, userIdentityId: identityId, status: 'ACTIVE', school: { status: 'ACTIVE' } },
      include: { school: true, roleGrants: true },
    });
    if (!membership) throw new NotFoundException({ code: 'SCHOOL_CONTEXT_DENIED', message: 'Không thể truy cập ngữ cảnh trường này.' });
    const capabilities = this.capabilities(membership.roleGrants.map((grant) => grant.role), audience);
    if (!capabilities.includes(required)) throw new ForbiddenException({ code: 'CAPABILITY_DENIED', message: 'Bạn không có quyền thực hiện thao tác này.' });
    const navigation = [{ id: 'overview', label: 'Tổng quan' }];
    if (capabilities.includes('ACCESS_MANAGE')) navigation.push({ id: 'access', label: 'Quản lý truy cập' });
    if (capabilities.includes('ROSTER_MANAGE')) navigation.push({ id: 'roster', label: 'Danh bộ' });
    return { schoolId, schoolName: membership.school.name, membershipId: membership.id, capabilities, navigation };
  }
}
