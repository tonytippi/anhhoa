export type ApiResponse<T> = { data: T };
export type ApiError = { error: { code: string; message: string; fieldErrors?: Record<string, string> } };
export type Audience = 'app' | 'teacher' | 'parent' | 'ops';
export type SessionDto = { audience: Audience; userIdentityId: string; email: string; platformOperatorGrantId?: string };
export type SessionResponse = ApiResponse<SessionDto>;
export type AuthErrorCode = 'AUTHENTICATION_REQUIRED' | 'INVALID_AUDIENCE' | 'OAUTH_DENIED' | 'OAUTH_STATE_INVALID';
export type SchoolLifecycleStatus = 'ACTIVE' | 'SUSPENDED';
export type OpsSchoolDto = { id: string; name: string; slug: string; status: SchoolLifecycleStatus; ownerEmail: string; ownerBound: boolean; updatedAt: string };
export type OperationDto = { id: string; status: 'PENDING' | 'COMPLETED' | 'FAILED'; outcome: unknown };
export type ProvisionSchoolInput = { name: string; slug: string; ownerEmail: string };

export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}
