# Addendum: PassionEdu initiative

## Nguon va truy vet

- Approved change proposals: `../../sprint-change-proposal-2026-08-31.md`, `../../sprint-change-proposal-2026-09-05.md`, `../../sprint-change-proposal-2026-09-07.md`, `../../sprint-change-proposal-2026-09-16.md`, `../../sprint-change-proposal-2026-09-21-finance-admin-mvp.md`, `../../sprint-change-proposal-2026-09-21-manual-invoice-mvp.md`.
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

- Finance Admin MVP dung Receivable catalog va `CollectionRunTemplateLine` tren CollectionRun `DRAFT`, khong dung ChargeRule, `FIXED`/`MANUAL`, precedence hay auto-charge. Template chon moi Receivable active same-School toi da mot lan va quantity nguyen duong do Finance nhap; server dung default unit price catalog, tinh amount/total va audit mutation, reject quantity `0`, gia khong duong, float hay client total. Tiền ăn dùng đơn vị ngày với default price `35.000 VND`; quantity `22` cho amount `770.000 VND`. READY/GENERATED/CLOSED từ chối template mutation. Generate khóa/revalidate và snapshot immutable template facts/amount vào Invoice DRAFT của mỗi Student eligible; Student thêm sau GENERATED dùng đúng run snapshot dù catalog/template live đổi hoặc inactive. API chỉ trả line theo amount giảm dần, tie-breaker UUID ổn định; không có position, reorder hay browser preference. ChargeRule automation là enhancement sau MVP.
- Pha 1b sau template gate them `PromotionPolicy` School-scoped co version effective-dated, `PromotionPolicyTarget` theo Receivable va `StudentPromotionAssignment` co interval/reason/audit. API evaluate gross/discount/net theo tung Invoice line tai preview/generate, re-evaluate trong transaction Issue va snapshot application/version/target/outcome/assignment provenance bat bien. Fixed VND truoc percentage; priority/exclusivity deterministic; discount cap tai gross target. Policy fact doi lam stale preview, khong rewrite Invoice issued. `PREPAID_COVERAGE`, coverage, Receipt, settlement, carry, refund, report va automatic Class/service/attendance eligibility van thuoc enhancement rieng sau Pha 1b.
- Moi CollectionRun cua release dau la `MONTHLY`, bat buoc co `billingMonth` `YYYY-MM`; moi SchoolYear chi co mot CollectionRun cho mot billingMonth. Khong co `ANNUAL`, `ONE_OFF`, `periodKey` tu do hay run bo sung.
- Rule precedence `STUDENT` > `CLASS` > `SCHOOL`; conflict cung do dac hieu bi tu choi.
- Meal leave tao adjustment am cho Invoice `DRAFT` ke tiep; `PRESENT` conflict loai ngay do. Late pickup va Saturday hoc le la dong khoan thu co audit khi enhancement do duoc phat hanh.
- Finance Admin MVP truoc Epic 4 cho phep Finance Manager/School Admin luu tren dong Invoice `DRAFT` service date, attendance status, picked-up time va/hoac late-care minutes do actor nhap, kem reason/audit/provenance. API validate School, StudentEnrollment, business date va whole-VND quantity/unit price, snapshot input khi Issue va khong suy ra quantity, price, fee, discount hay total tu input. Day khong la attendance/handover aggregate; Teacher/attendance/Parent module khong la dependency va operational fact sau nay khong rewrite/re-price issued snapshot.
- Reversal mode cua School: direct hoac Finance Manager request va School Admin khac actor phe duyet.
- Finance report la read-only server projection theo `asOf`; chi bao gom ledger event posted khong muon hon `asOf`, dung `Asia/Ho_Chi_Minh` cho business-date/period boundary. Billed nhom theo Invoice `billingMonth`; cash nhom theo posting time cua Receipt/refund/reversal. Result luu/tra `asOf`, `generatedAt`, timezone, applied filter va report-definition version; revision/cancellation giu audit lineage nhung obligation total chi tinh current-effective Invoice server projection.
- CSV la export duy nhat cua MVP. Finance Manager/School Admin chi export result cua School da authorize; API tao file tu filter/result da xac dinh, kem metadata, audit request/download, URL het han va re-authorize download. Khong co client-side export, export Parent/Payroll, PDF/XLSX, scheduled/custom report hay accounting period close/reopen.

## Verification matrix toi thieu

- Integration PostgreSQL: tenant isolation tren read/write/delete/report, revoke, unique scoped va idempotency cross-school.
- Finance Admin MVP/Pha 1b: Receivable catalog lifecycle, DRAFT CollectionRun template lifecycle/positive quantity, monthly Student selection/preview fingerprint, populated DRAFT Invoice generate idempotent, per-Invoice DRAFT line add/edit/remove, server-owned VND totals, price-override/source audit, Policy version/target/assignment scope, deterministic per-line discount, stale evaluation, Issue recheck, immutable application snapshot, tenant isolation and no Teacher/Parent/attendance/service/coverage/settlement/Payroll dependency.
- Finance settlement enhancement: selected `PREPAID_COVERAGE` future facts trong Invoice DRAFT cua monthly run, actual-receipt close, source-linked SettlementDifference carry to next run, issued-Invoice replacement/cancellation, reversal/refund, debt transfer va year-end settlement. Normal Receipt closes one Invoice with exact/shortfall/overpayment outcome; no unallocated Receipt, `StudentPrepayment` or generic balance. Coverage chi issue sau khi Invoice chua future coverage facts dong `EXACT`, cung Student, School va SchoolYear, va giu immutable policy-version/fact/provenance snapshot.
- Report verification: cung School/filter/`asOf` phai reconcile dong nhat giua overview, CollectionRun, outstanding/debt va cash/adjustment ledger; fixture bao gom event truoc/sau `asOf`, refund/reversal, revision/cancellation, shortfall/overpayment carry, debt va coverage. Tu choi cross-School read/export, filter School gia mao, CSV object access sau expiry va download khong con authorize; CSV phai chua dung rows/metadata server result va audit request/download.
- Payroll: `Ke toan`/`Accountant` la persona cua active same-School `FINANCE_MANAGER`, khong phai preset role. Entitlement khong cap role/capability; route/job/action can capability rieng. Finance Manager prepare/reconcile/submit, School Admin khac UserIdentity approve/refuse va reopen unpaid approved run, Finance Manager co `PAYROLL_PAYOUT_CONFIRM` xac nhan payout sau approve.
- E2E: chooser/switcher, pending owner bind Google, Teacher audience/Class assignment, Parent multi-school, Parent revoke/cache clear, leave/attendance/handover/journal permission states.
- Compatibility: OAuth callback/cookie/origin boundaries theo portal; Parent bank enhancement chi phat hanh sau device/browser test matrix.
- Payroll: fixture Excel anonymized doi soat input/component/output, denial School non-entitled, effective machine-code mapping, import dedupe, approved source lock, concurrent calculate/approve/payout va correction provenance.
