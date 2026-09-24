export type ApiResponse<T> = { data: T };
export type ApiListResponse<T, Meta extends object = Record<string, never>> = { data: T; meta: Meta };
export type ApiError = { error: { code: string; message: string; fieldErrors?: Record<string, string> } };
export type Audience = 'app' | 'teacher' | 'parent' | 'ops';
export type SessionDto = { audience: Audience; userIdentityId: string; email: string; platformOperatorGrantId?: string };
export type SessionResponse = ApiResponse<SessionDto>;
export type AuthErrorCode = 'AUTHENTICATION_REQUIRED' | 'INVALID_AUDIENCE' | 'OAUTH_DENIED' | 'OAUTH_STATE_INVALID';
export type SchoolLifecycleStatus = 'ACTIVE' | 'SUSPENDED';
export type OpsSchoolDto = { id: string; name: string; slug: string; status: SchoolLifecycleStatus; ownerEmail: string; ownerBound: boolean; updatedAt: string };
export type OperationDto = { id: string; status: 'PENDING' | 'COMPLETED' | 'FAILED'; outcome: unknown };
export type ProvisionSchoolInput = { name: string; slug: string; ownerEmail: string };
export type SchoolCapability =
  | 'SCHOOL_CONTEXT_READ'
  | 'ACCESS_MANAGE'
  | 'ROSTER_MANAGE'
  | 'SETTINGS_MANAGE'
  | 'FINANCE_MANAGE'
  | 'CLASS_LEAVE_READ'
  | 'LEAVE_REQUEST_DECIDE'
  | 'ATTENDANCE_WRITE'
  | 'DAILY_JOURNAL_WRITE'
  | 'HANDOVER_WRITE'
  | 'WORKFORCE_MANAGE'
  | 'TIMEKEEPING_IMPORT'
  | 'TIMEKEEPING_REVIEW'
  | 'LATE_CARE_MANAGE'
  | 'PAYROLL_PREPARE'
  | 'PAYROLL_RECONCILE'
  | 'PAYROLL_APPROVE'
  | 'PAYROLL_REOPEN'
  | 'PAYROLL_PAYOUT_CONFIRM'
  | 'PAYROLL_REPORT_READ';
export type SchoolChooserItem = { schoolId: string; schoolSlug: string; schoolName: string };
export type SchoolContextDto = { schoolId: string; schoolSlug: string; schoolName: string; membershipId: string; capabilities: SchoolCapability[]; navigation: Array<{ id: string; label: string }> };
export type SchoolMembershipDto = { id: string; email: string; status: 'ACTIVE' | 'REVOKED'; roles: Array<'SCHOOL_ADMIN' | 'FINANCE_MANAGER' | 'CLASS_TEACHER'> };
export type RosterListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  classId?: string;
  lifecycle?: string;
  sort?: 'name' | 'class';
};
export type RosterListRow = {
  id: string;
  studentCode: string;
  fullName: string;
  hasPhoto: boolean;
  enrollment: {
    id: string;
    lifecycle: string;
    effectiveFrom: string;
    classroom: { id: string; name: string } | null;
  };
  relatives: {
    mother: string | null;
    father: string | null;
    otherRelativeCount: number;
  };
};
export type OffsetPaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
export type StaffListQuery = {
  schoolYearId?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  employmentStatus?: 'ACTIVE' | 'INACTIVE';
  primaryPositionId?: string;
  sort?: 'name' | 'position' | 'status';
};
export type StaffListRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  classNames: string[];
  staffCode: string | null;
  hasPhoto: boolean;
  employmentStatus: 'ACTIVE' | 'INACTIVE';
  primaryPositionId: string;
  primaryPosition: { id: string; code: string; name: string; status: 'ACTIVE' | 'INACTIVE' } | null;
};
export type ParentListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};
export type ParentListRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  children: Array<{
    linkId: string;
    studentName: string;
    className: string | null;
    relationshipLabel: string;
  }>;
};

export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}
