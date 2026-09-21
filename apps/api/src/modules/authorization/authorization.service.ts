import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../identity/prisma.service.js';

export const capabilityCatalog = [
  'SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE',
  'CLASS_LEAVE_READ', 'LEAVE_REQUEST_DECIDE', 'ATTENDANCE_WRITE', 'DAILY_JOURNAL_WRITE', 'HANDOVER_WRITE',
  'WORKFORCE_MANAGE', 'TIMEKEEPING_IMPORT', 'TIMEKEEPING_REVIEW', 'LATE_CARE_MANAGE',
  'PAYROLL_PREPARE', 'PAYROLL_RECONCILE', 'PAYROLL_APPROVE', 'PAYROLL_REOPEN',
  'PAYROLL_PAYOUT_CONFIRM', 'PAYROLL_REPORT_READ',
] as const;
export type Capability = typeof capabilityCatalog[number];
export type SchoolAudience = 'app' | 'teacher';
export type SchoolContext = { schoolId: string; schoolName: string; membershipId: string; staffProfileId: string; capabilities: Capability[]; navigation: Array<{ id: string; label: string }> };

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  private capabilities(grants: Array<{ capability: string }>, audience: SchoolAudience): Capability[] {
    const allowed = new Set(capabilityCatalog);
    const values = grants.map((grant) => grant.capability).filter((value): value is Capability => allowed.has(value as Capability));
    if (audience === 'teacher') return values.filter((value) => ['SCHOOL_CONTEXT_READ', 'CLASS_LEAVE_READ', 'ATTENDANCE_WRITE', 'DAILY_JOURNAL_WRITE', 'HANDOVER_WRITE'].includes(value));
    return values;
  }

  private navigation(capabilities: Capability[]) {
    const navigation = [{ id: 'overview', label: 'Tổng quan' }];
    if (capabilities.includes('ATTENDANCE_WRITE')) navigation.push({ id: 'attendance', label: 'Điểm danh' });
    if (capabilities.includes('HANDOVER_WRITE')) navigation.push({ id: 'handover', label: 'Bàn giao' });
    if (capabilities.includes('LEAVE_REQUEST_DECIDE')) navigation.push({ id: 'leave-review', label: 'Duyệt đơn nghỉ' });
    if (capabilities.includes('ACCESS_MANAGE')) navigation.push({ id: 'access', label: 'Quản lý truy cập' });
    if (capabilities.includes('ROSTER_MANAGE')) navigation.push({ id: 'roster', label: 'Danh bộ' });
    if (capabilities.includes('SETTINGS_MANAGE')) navigation.push({ id: 'settings', label: 'Cấu hình trường' });
    return navigation;
  }

  async chooser(identityId: string, audience: SchoolAudience) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: { userIdentityId: identityId, status: 'ACTIVE', school: { status: 'ACTIVE' }, boundStaffProfile: { employmentStatus: 'ACTIVE', primaryPosition: { status: 'ACTIVE' } } },
      include: { school: true, boundStaffProfile: { include: { primaryPosition: { include: { grants: true } } } } }, orderBy: { school: { name: 'asc' } },
    });
    return memberships.flatMap((membership) => {
      const capabilities = this.capabilities(membership.boundStaffProfile!.primaryPosition.grants, audience);
      return capabilities.includes('SCHOOL_CONTEXT_READ') ? [{ schoolId: membership.schoolId, schoolName: membership.school.name }] : [];
    });
  }

  async resolve(identityId: string, schoolId: string, audience: SchoolAudience, required: Capability = 'SCHOOL_CONTEXT_READ'): Promise<SchoolContext> {
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { schoolId, userIdentityId: identityId, status: 'ACTIVE', school: { status: 'ACTIVE' }, boundStaffProfile: { employmentStatus: 'ACTIVE', primaryPosition: { status: 'ACTIVE' } } },
      include: { school: true, boundStaffProfile: { include: { primaryPosition: { include: { grants: true } } } } },
    });
    if (!membership?.boundStaffProfile) throw new NotFoundException({ code: 'SCHOOL_CONTEXT_DENIED', message: 'Không thể truy cập ngữ cảnh trường này.' });
    const capabilities = this.capabilities(membership.boundStaffProfile.primaryPosition.grants, audience);
    if (!capabilities.includes(required)) throw new ForbiddenException({ code: 'CAPABILITY_DENIED', message: 'Bạn không có quyền thực hiện thao tác này.' });
    return { schoolId, schoolName: membership.school.name, membershipId: membership.id, staffProfileId: membership.boundStaffProfile.id, capabilities, navigation: this.navigation(capabilities) };
  }
}
