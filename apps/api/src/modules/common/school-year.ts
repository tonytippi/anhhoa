// Sprint change 2026-10-12: a School that does not use school years has one SchoolYear whose endsOn is null (open-ended).
export const yearEnd = (endsOn: Date | null | undefined) => endsOn ?? new Date('9999-12-31T00:00:00.000Z');
