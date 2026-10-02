// Decision 2026-10-02: every School has exactly these three typed groups; the kind is never inferred from the name.
export const defaultReceivableGroups = [
  { kind: 'FIXED', name: 'Khoản thu cố định' },
  { kind: 'FLEXIBLE', name: 'Khoản thu linh hoạt' },
  { kind: 'EXTRACURRICULAR', name: 'Ngoại khóa' },
] as const;
export const defaultReceivableGroupNames = defaultReceivableGroups.map((group) => group.name);

export const provisionDefaultReceivableGroupsRoute = 'POST /api/ops/schools/default-receivable-groups';
export const developmentSeedDefaultReceivableGroupsRoute = 'development-seed/default-receivable-groups';
export const developmentSeedDefaultReceivableGroupsKey = '4e1a3ac3-659a-4c01-a567-51b06f8b2feb';
export const developmentSeedDefaultReceivableGroupsFingerprint = 'peakland-default-receivable-groups-v1';

export function provisionDefaultReceivableGroupsFingerprint(schoolId: string, provisionOperationId: string) {
  return { schoolId, provisionOperationId };
}
