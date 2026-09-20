type AuditActor = {
  identityId: string;
  type: 'SCHOOL_MEMBERSHIP' | 'PLATFORM_OPERATOR_GRANT' | 'PARENT_PROFILE';
  reference: string;
  membershipId?: string;
};

export function auditData(schoolId: string, actor: AuditActor, action: string, provenance: object, reason?: string | null) {
  return {
    schoolId,
    actorIdentityId: actor.identityId,
    actorType: actor.type,
    actorReference: actor.reference,
    membershipId: actor.membershipId ?? null,
    action,
    reason: reason ?? null,
    provenance,
  };
}
