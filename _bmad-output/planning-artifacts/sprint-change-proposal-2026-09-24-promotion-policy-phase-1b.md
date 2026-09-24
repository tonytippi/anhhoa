---
title: "Sprint Change Proposal - Uu dai theo khoan thu Pha 1b"
status: approved
created: 2026-09-24
sources:
  - prds/prd-passionedu-2026-09-04/prd.md
  - specs/spec-passionedu/SPEC.md
  - architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - epics-passionedu.md
  - sprint-change-proposal-2026-09-10.md
  - ux-designs/ux-passionedu-2026-09-04/
---

# Sprint Change Proposal: Uu dai theo khoan thu Pha 1b

## 1. Quyet dinh

Sau Stories 5.9-5.11, Finance co mot Pha 1b de van hanh uu dai giam tru theo tung `Receivable`. Pha nay su dung model da duoc phe duyet ngay 2026-09-10: `PromotionPolicy`, `PromotionPolicyVersion`, `PromotionPolicyTarget`, `StudentPromotionAssignment` va immutable `InvoicePromotionApplication`.

`Receivable` giu gia co so. Target cua policy chi dinh Receivable nao duoc giam; assignment gan version cho Student theo effective interval, reason va audit. API danh gia policy tai preview/generate, danh gia lai trong transaction Issue, va snapshot gross, policy/version/target, discount, net, priority va assignment provenance tren Invoice line/issued obligation. Browser chi render ket qua server tra ve.

## 2. Quy tac va pham vi

- Target, assignment, application, Invoice, audit va Operation deu School-scoped; API re-authorize trong transaction va khong tin UUID, School context hay browser state.
- Version co effective interval; target chi tham chieu Receivable cung School. Fixed VND ap dung truoc percentage, sau do priority va stable server tie-breaker; exclusivity chi giu policy hop le co priority cao nhat trong group; tong giam cap tai gross cua tung target.
- Preview fingerprint stale khi template/catalog, policy/version/target, assignment hoac fact eligibility lien quan thay doi. Generate va Issue khong dung evaluation stale; Issue tra review-required thay vi silently issue theo ket qua cu.
- Catalog/policy/version/assignment thay doi sau Issue khong rewrite snapshot. Student them sau `GENERATED` van dung immutable run template snapshot.
- Finance co destination `Ưu đãi` rieng de quan ly policy/version/target/assignment. `Khoản thu` van la catalog gia co so; preview va Invoice review chi hien application server-derived theo line.

## 3. Loai tru

Pha 1b khong bao gom `PREPAID_COVERAGE`, future receivable-period fact, `StudentPromotionalCoverage`, Receipt, `EXACT|SHORTFALL|OVERPAYMENT`, `SettlementDifference`, carry, reversal/refund, debt, ledger/report, Parent/Teacher route, Class/service/attendance auto-eligibility, free-form formula hay client-calculated VND.

`PREPAID_COVERAGE` van la fulfillment mode rieng cua policy trong Epic 6. Chi Epic 6 duoc tao coverage sau actual Receipt `EXACT` va xu ly refund/ledger.

## 4. Backlog va release gate

- Story 5.12: policy/version/target lifecycle va Student assignment.
- Story 5.13: server-authoritative evaluation trong preview/generate va stale fingerprint.
- Story 5.14: recheck Issue va immutable per-line application snapshot.
- Story 5.15: PostgreSQL/API/E2E release gate Pha 1b.

Stories 5.1-5.11 la evidence Finance Admin MVP/template da tach scope; khong sua acceptance historical de coi nhu da co promotion. Epic 6 chi phu thuoc policy fulfillment `PREPAID_COVERAGE`, khong coi normal Invoice discount la settlement capability.

## 5. Tieu chi thanh cong

1. Uu dai chi giam dung Receivable target cua dung Student/School va khong tao dong am hay balance chung.
2. Preview, generate va Issue co cung server evaluator; stale/cross-School/retry/concurrency deu an toan.
3. Invoice issued giu immutable policy application provenance.
4. Mockup va release gate khong hien Receipt, carry, coverage, refund hay Parent action trong Pha 1b.
