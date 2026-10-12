export const schoolKinds = ['PRESCHOOL', 'LANGUAGE_CENTER'] as const;
export type SchoolKind = typeof schoolKinds[number];
export type CollectionRunScope = 'SCHOOL' | 'CLASS';
export type SchoolFeatures = { usesSchoolYears: boolean; collectionRunScope: CollectionRunScope; dailyJournal: boolean; handover: boolean };

// Sprint change 2026-10-12: the kind only selects this map; modules read a feature and never compare the kind.
const featuresByKind: Record<SchoolKind, SchoolFeatures> = {
  PRESCHOOL: { usesSchoolYears: true, collectionRunScope: 'SCHOOL', dailyJournal: true, handover: true },
  LANGUAGE_CENTER: { usesSchoolYears: false, collectionRunScope: 'CLASS', dailyJournal: false, handover: false },
};

export const schoolFeatures = (kind: SchoolKind): SchoolFeatures => featuresByKind[kind];
export const isSchoolKind = (value: unknown): value is SchoolKind => schoolKinds.includes(value as SchoolKind);
