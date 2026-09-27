export const defaultReceivableGroupNames = ['Khoản thu chung', 'Khoản thu đột xuất', 'Ngoại khóa'] as const;

export const provisionDefaultReceivableGroupsRoute = 'POST /api/ops/schools/default-receivable-groups';
export const developmentSeedDefaultReceivableGroupsRoute = 'development-seed/default-receivable-groups';
export const developmentSeedDefaultReceivableGroupsKey = '4e1a3ac3-659a-4c01-a567-51b06f8b2feb';
export const developmentSeedDefaultReceivableGroupsFingerprint = 'peakland-default-receivable-groups-v1';

export function provisionDefaultReceivableGroupsFingerprint(schoolId: string, provisionOperationId: string) {
  return { schoolId, provisionOperationId };
}
