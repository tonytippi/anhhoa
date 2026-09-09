# Addendum: PassionEdu initiative

## Nguon va truy vet

- Approved change proposals: `../../sprint-change-proposal-2026-08-31.md`, `../../sprint-change-proposal-2026-09-05.md`, `../../sprint-change-proposal-2026-09-07.md`.
- Discovery inputs: `../../../../docs/kidsonline-feature-catalog.md`, `../../../../docs/multi-school-tenancy-catalog.md`, `../../../../docs/receivables-clean-break-blueprint.md`, `../../../../docs/roster-and-people-catalog.md`, `../../../../docs/school-settings-catalog.md`.
- Superseded references: `../prd-anhhoa-2026-08-18/prd.md`, `../prd-anhhoa-parent-pwa-2026-08-22/prd.md`.

## Dinh huong ky thuat da duoc proposal giu lai

- Monorepo pnpm/Turborepo; React/Vite PWA doc lap cho Admin, Teacher, Parent va Ops; NestJS, Prisma, PostgreSQL va REST.
- Portal hosts: `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, `api.passionedu.org`; cookie host-only va session audience rieng.
- Google OAuth la canonical identity. `SUPERADMIN_EMAIL` chi bootstrap Platform capability qua environment; khong commit gia tri that.
- Tien VND dung PostgreSQL `BIGINT`; API tinh toan va snapshot; Prisma/schema/module cu la reference, khong la baseline production.
- Route business dung `/schools/:schoolId/...`; Parent scope School duoc chon va validate qua StudentParent link active.
- Teacher chi ghi attendance, handover va DailyJournal trong Class co StaffProfile binding, capability va Class assignment effective tai ngay thao tac. DailyJournal co text va anh JPEG/PNG/WebP toi da 10 MB moi anh, khong gioi han so anh; Parent chi doc journal/media cua Student duoc lien ket active trong 30 ngay sau `endedOn`.
- Payroll la capability opt-in theo School, co feature entitlement server-side va chi rollout `PILOT_ENABLED`/`ENABLED`; code frontend/role khong tu thay the entitlement. Payroll dung Admin PWA, khong xuat hien o Teacher/Parent portal.

## Invariant data model de Architecture Spine chot

- `School` la tenant root; moi business record co `schoolId` va query/update/delete match ca `id` va `schoolId` trong transaction.
- `UserIdentity`, `SchoolMembership`, `SchoolRoleGrant`; `ParentProfile` global; `StudentParent -> Student.schoolId` xac dinh Parent context.
- Invoice unique theo `(schoolId, studentId, collectionRunId)`, immutable khi issue; receipt/allocation/prepayment la ledger append-only.
- Operation/idempotency scope bao gom School va actor membership; audit luu actor identity, membership va School.
- `workforce` so huu EmploymentContract, compensation term, independent insurance salary base va machine identifier effective-dated; `timekeeping` so huu file batch, raw IN/OUT event append-only, correction, reviewed StaffWorkdayRecord va late-care assignment; `payroll` so huu policy, period/run version, entry/component snapshot, advance, payout va correction run.
- Payroll la accounts payable tach khoi receivables Student. VND `BIGINT`, policy typed/versioned do API code tinh va snapshot; khong luu arbitrary formula/script/SQL. Paid Payroll chi sua qua correction delta run, khong overwrite.

## Quy tac finance chi tiet

- ChargeRule quantity chi `FIXED` hoac `MANUAL`; attendance, handover va service enrollment la reference, khong la auto-pricing engine.
- `MONTHLY` dung `billingMonth` `YYYY-MM`; `ANNUAL`/`ONE_OFF` dung `periodKey`; cung ky co the co nhieu CollectionRun.
- Rule precedence `STUDENT` > `CLASS` > `SCHOOL`; conflict cung do dac hieu bi tu choi.
- Meal leave tao adjustment am cho Invoice `DRAFT` ke tiep; `PRESENT` conflict loai ngay do. Late pickup va Saturday hoc le la dong `MANUAL` co audit.
- Reversal mode cua School: direct hoac Finance Manager request va School Admin khac actor phe duyet.

## Verification matrix toi thieu

- Integration PostgreSQL: tenant isolation tren read/write/delete/report, revoke, unique scoped va idempotency cross-school.
- Finance: preview/generate idempotent, snapshot, `PrepaidPaymentPromotionProgram -> PREPAID CollectionRun -> exact-paid source Invoice -> StudentPromotionalCoverage`, reversal/refund, debt transfer va year-end settlement. Fixture tu choi partial, excess, unallocated va mixed-Student Receipt; khong co `StudentPrepayment` hoac generic balance. Coverage chi issue sau source Invoice `PAID`, cung Student, School va SchoolYear, va giu immutable fact/provenance snapshot.
- Payroll: `Ke toan`/`Accountant` la persona cua active same-School `FINANCE_MANAGER`, khong phai preset role. Entitlement khong cap role/capability; route/job/action can capability rieng. Finance Manager prepare/reconcile/submit, School Admin khac UserIdentity approve/refuse va reopen unpaid approved run, Finance Manager co `PAYROLL_PAYOUT_CONFIRM` xac nhan payout sau approve.
- E2E: chooser/switcher, pending owner bind Google, Teacher audience/Class assignment, Parent multi-school, Parent revoke/cache clear, leave/attendance/handover/journal permission states.
- Compatibility: OAuth callback/cookie/origin boundaries theo portal; Parent bank enhancement chi phat hanh sau device/browser test matrix.
- Payroll: fixture Excel anonymized doi soat input/component/output, denial School non-entitled, effective machine-code mapping, import dedupe, approved source lock, concurrent calculate/approve/payout va correction provenance.
