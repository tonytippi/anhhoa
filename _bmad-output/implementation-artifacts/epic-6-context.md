# Epic 6 Context: Thu tiền, đối soát công nợ và báo cáo sổ cái

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic này hoàn tất vòng đời thu tiền Finance có thể đối soát: ghi nhận số tiền thực nhận để đóng một Invoice, truy vết và carry chênh lệch có nguồn, phát hành/hoàn promotion coverage đúng điều kiện, xử lý correction, refund và prior debt không sửa lịch sử, và cung cấp báo cáo ledger theo thời điểm. Mục tiêu là bảo toàn tính đúng đắn của tiền, tenant và provenance dưới retry, concurrency và thay đổi dữ liệu cấu hình.

## Stories

- Story 6.1: Ghi actual Receipt, đóng Invoice và carry chênh lệch
- Story 6.2: Đóng exact Invoice có promotion coverage
- Story 6.3: Correction và hoàn tiền promotion coverage theo operating-day preview
- Story 6.4: Chuyển prior debt và year-end settlement an toàn
- Story 6.5: Báo cáo finance reconcile từ ledger
- Story 6.6: Release gate cho actual Receipt, carry và promotion coverage refund

## Requirements & Constraints

- Finance Manager ghi actual received VND de dong dung mot `ISSUED` Invoice. Server tu derive `EXACT`, `SHORTFALL` hoac `OVERPAYMENT`; client khong the dat outcome, difference, carry hay allocation.
- Close non-exact append dung mot `SettlementDifference` immutable, lien ket Invoice va Receipt. Chi Invoice `DRAFT` cua `MONTHLY` run ke tiep, cung Student/School/SchoolYear, du dieu kien moi materialize phan con lai thanh `SHORTFALL_CARRY` hoac `OVERPAYMENT_CARRY`. Carry am khong duoc lam Invoice am; khong co generic balance, Student prepayment, unallocated Receipt hay ap dung cheo Student, School hoac SchoolYear.
- `PREPAID_COVERAGE` nam trong normal `MONTHLY` CollectionRun. Chi source Invoice dong `EXACT` moi duoc server issue `StudentPromotionalCoverage`; coverage snapshot policy version, Receivable/period, service interval, price/discount, calendar/timezone va paid Invoice/Receipt provenance. Normal run chi skip fact da covered; overlap va fact khong co operating day hop le bi tu choi.
- Refund coverage tinh theo snapshot paid amount, service interval va calendar `Asia/Ho_Chi_Minh`, loai ngay withdrawal effective; dung floor VND, denominator duong, remaining days hop le, va khong vuot paid source con lai sau refund/reversal. Override approved amount can ly do, khong am va khong vuot limit. Refund/reversal khong sua Invoice, Receipt, Allocation hay coverage goc.
- Reversal/refund theo FinancePolicy: `DIRECT` chi post sau named confirmation cua actor duoc quyen; `SCHOOL_ADMIN_APPROVAL` yeu cau Finance Manager request va School Admin khac identity approve/refuse. Requester khong duoc self-approve.
- Debt transfer chi trong cung SchoolYear, append-only, atomic tru outstanding nguon truoc khi expose target `PRIOR_DEBT`; khong auto-carry debt sang SchoolYear moi. Write-off, adjustment va payment cuoi nam la workflow audited rieng.
- Bao cao read-only gom overview, CollectionRun reconciliation, outstanding/prior debt, va cash/adjustment ledger. Server aggregate theo School, run, period, group, class va status; tach gross, promotion discount, refund, net billed, actual receipt, settlement outcome, difference/carry, revision/cancellation, coverage va outstanding.
- Report la server snapshot voi `asOf`, `generatedAt`, timezone, normalized filters va definition version. Chi posted event khong muon hon `asOf` duoc tinh; billed group theo `billingMonth`, cash group theo posting time. Revision/cancellation giu audit lineage nhung obligation chi tinh Invoice current-effective.
- CSV la export duy nhat, tao tu dung authorized result va metadata, audit request/download, dung opaque expiring reference va re-authorize tai download. Tu choi client-side CSV, cross-School access, Parent/Payroll data, PDF/XLSX, scheduled/custom report va period close/reopen.

## Technical Decisions

- `School` la tenant root: moi finance aggregate, query, unique constraint, audit va Operation scope theo School; transaction phai verify toan tenant graph, khong tin school ID, UUID hay filter do client gui.
- VND dung PostgreSQL `BIGINT` va JSON-safe integer. API la nguon duy nhat cho authorization, policy, money calculation, state transition, snapshot, audit, report va settlement projection.
- Receipt, Allocation, SettlementDifference, reversal, refund, debt transfer va settlement-transfer projection la append-only. Invoice issued snapshot bat bien; issued-content correction tao replacement va atomically `CANCELLED` source. Replacement chi revise mot same-School/Student/run source, source Receipt khong bao gio bi rewrite.
- Tat ca settlement writers dung mot finance posting boundary, transaction va consistent lock order; enforce source/remaining limits de chan double close, double carry materialization, concurrent over-application va target `CANCELLED`.
- High-impact commands, bao gom close, carry, coverage selection, correction/cancellation/transfer, reversal/refund, approval va debt transfer, bat buoc UUID `Idempotency-Key`. Operation scope School, route va actor context; identical retry replay outcome, changed fingerprint conflict, va timeout phai `GET /operations/:operationId` reconcile truoc retry.
- Finance actor authorization resolve active same-School membership/capability tren moi request. Audit luu School, actor, timestamp, provenance va reason khi bat buoc.
- PostgreSQL integration tests la bang chung cho tenant isolation, composite tenant graph, idempotency va ledger concurrency; E6 khong complete neu reconciliation/concurrency fixture fail.

## UX & Interaction Patterns

- Finance destination bao gom Thu tien, Cong no va Bao cao; UI chi hien thi capability server grant va School context hien hanh. Invoice `ISSUED` chi cho record one actual Receipt hoac prepare correction; `CLOSED` chi read va permitted refund/reversal; `CANCELLED` read-only reference.
- Settlement, correction va refund hien immutable source facts, server-returned available impact/limits, reason, required approver va server-confirmed state. Named confirmation bat buoc cho settlement, reversal va destructive action; khong optimistic local outcome, manual carry hay generic-prepayment control.
- Timeout khoa submit lap, hien trang thai reconcile va chi cho retry sau Operation result. Lifecycle conflict refresh state va giai thich action unavailable; School switch khong duoc lam mat mutation uncertain.
- Finance report hien `asOf`, generated time, timezone, filters va definition version; no-data giu context va noi khong co ledger activity, khong xac nhan "0 collected". Tables co caption, keyboard row action, VND right-align; mobile dung card/scroll giu cot nhan dien.
- CSV button chi xuat hien sau authorized result. Export failure, expiry hoac revoke giu report context va ve safe state, khong tu tao CSV trong browser hay thay bang live totals.

## Cross-Story Dependencies

- Epic 6 phu thuoc Epic 5: Invoice issued snapshots, CollectionRun lifecycle/template, same-School roster/SchoolYear facts, BankAccount snapshot va PromotionPolicy Pha 1b phai ton tai truoc settlement.
- Story 6.2 phu thuoc policy `PREPAID_COVERAGE` va monthly-run future receivable-period facts; Story 6.3 phu thuoc coverage da issued va FinancePolicy reversal mode. Story 6.4 dung cung posting boundary voi actual close/carry; Story 6.5 doc cung append-only ledger va current-effective Invoice projection.
- Epic 7 chi consume Parent minimum read model cua effective Invoice sau E6; Parent khong co settlement, coverage, correction, refund hay export action va khong nhan internal difference/transfer provenance.
