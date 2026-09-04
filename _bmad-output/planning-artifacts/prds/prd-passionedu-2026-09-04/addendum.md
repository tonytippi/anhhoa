# Addendum: PassionEdu initiative

## Nguon va truy vet

- Approved change proposal: `../../sprint-change-proposal-2026-08-31.md`.
- Discovery inputs: `../../../../docs/kidsonline-feature-catalog.md`, `../../../../docs/multi-school-tenancy-catalog.md`, `../../../../docs/receivables-clean-break-blueprint.md`, `../../../../docs/roster-and-people-catalog.md`, `../../../../docs/school-settings-catalog.md`.
- Superseded references: `../prd-anhhoa-2026-08-18/prd.md`, `../prd-anhhoa-parent-pwa-2026-08-22/prd.md`.

## Dinh huong ky thuat da duoc proposal giu lai

- Monorepo pnpm/Turborepo; React/Vite PWA cho Admin/Staff va Parent; NestJS, Prisma, PostgreSQL va REST.
- Portal hosts: `app.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, `api.passionedu.org`; cookie host-only va session audience rieng.
- Google OAuth la canonical identity. `SUPERADMIN_EMAIL` chi bootstrap Platform capability qua environment; khong commit gia tri that.
- Tien VND dung PostgreSQL `BIGINT`; API tinh toan va snapshot; Prisma/schema/module cu la reference, khong la baseline production.
- Route business dung `/schools/:schoolId/...`; Parent scope School duoc chon va validate qua StudentParent link active.

## Invariant data model de Architecture Spine chot

- `School` la tenant root; moi business record co `schoolId` va query/update/delete match ca `id` va `schoolId` trong transaction.
- `UserIdentity`, `SchoolMembership`, `SchoolRoleGrant`; `ParentProfile` global; `StudentParent -> Student.schoolId` xac dinh Parent context.
- Invoice unique theo `(schoolId, studentId, collectionRunId)`, immutable khi issue; receipt/allocation/prepayment la ledger append-only.
- Operation/idempotency scope bao gom School va actor membership; audit luu actor identity, membership va School.

## Quy tac finance chi tiet

- ChargeRule quantity chi `FIXED` hoac `MANUAL`; attendance, handover va service enrollment la reference, khong la auto-pricing engine.
- `MONTHLY` dung `billingMonth` `YYYY-MM`; `ANNUAL`/`ONE_OFF` dung `periodKey`; cung ky co the co nhieu CollectionRun.
- Rule precedence `STUDENT` > `CLASS` > `SCHOOL`; conflict cung do dac hieu bi tu choi.
- Meal leave tao adjustment am cho Invoice `DRAFT` ke tiep; `PRESENT` conflict loai ngay do. Late pickup va Saturday hoc le la dong `MANUAL` co audit.
- Reversal mode cua School: direct hoac Finance Manager request va School Admin khac actor phe duyet.

## Verification matrix toi thieu

- Integration PostgreSQL: tenant isolation tren read/write/delete/report, revoke, unique scoped va idempotency cross-school.
- Finance: preview/generate idempotent, snapshot, partial payment, allocation, prepayment, reversal/refund, debt transfer va year-end settlement.
- E2E: chooser/switcher, pending owner bind Google, Parent multi-school, Parent revoke/cache clear, leave/attendance/handover permission states.
- Compatibility: OAuth callback/cookie/origin boundaries theo portal; Parent bank enhancement chi phat hanh sau device/browser test matrix.
