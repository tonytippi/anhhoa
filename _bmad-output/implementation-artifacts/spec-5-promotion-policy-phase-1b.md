---
title: 'Pha 1b: Uu dai theo khoan thu'
type: 'feature'
created: '2026-09-24'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '93152204accfb9b65bd6f0bb91df6c34e794a468'
context:
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md'
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Finance Admin MVP da tao Invoice DRAFT tu template chung nhung chua co cach cau hinh va ap dung uu dai truy vet duoc theo tung khoan thu. Dua control giam gia tro lai ma khong co policy version, assignment va snapshot se lam Invoice da phat hanh khong the doi soat.

**Approach:** Tao Pha 1b sau Stories 5.9-5.11: Finance quan ly `PromotionPolicy` versioned va target `Receivable`, gan cho Student, va API tu danh gia uu dai tren tung Invoice line khi preview/generate va ngay trong transaction Issue. Portal chi hien thi projection do server tra ve; policy application duoc snapshot bat bien khi Issue.

## Boundaries & Constraints

**Always:** `PromotionPolicy`, version, target, Student assignment, application, Invoice, audit va Operation deu scope theo School; API re-authorize trong transaction. Target chi tham chieu Receivable cung School. VND la PostgreSQL `BIGINT` va JSON-safe integer; browser khong gui/tinh discount, amount, total, eligibility hay stacking result. Version va assignment co effective interval, reason/audit; fixed VND ap dung truoc percentage, sau priority va stable server tie-breaker; tong giam cap tai gross tung target, khong tao Invoice line am, credit hay balance chung. Preview fingerprint stale khi policy/version/target/assignment hay Receivable fact lien quan doi; Issue re-evaluate trong transaction va snapshot version, target, outcome, discount va assignment provenance. Template run da GENERATED van la snapshot bat bien.

**Ask First:** Thay doi quy tac stacking/exclusivity da chot, loai discount moi, automatic eligibility tu Class/service/attendance, hoac cho phep Finance sua tay discount server-derived.

**Never:** Khong dua `PREPAID_COVERAGE`, future-period fact, `StudentPromotionalCoverage`, Receipt, close/settlement, `SettlementDifference`, carry, reversal/refund, debt, report, Parent/Teacher route hay pricing tu operational data vao Pha 1b. Khong sua historical evidence/spec cua Stories 5.1-5.11 de coi nhu da co promotion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Policy applied | Assignment, active version va Receivable target hop le | Preview/generate tra gross, policy/version, discount, net tren dung Invoice line | Browser chi render server result |
| Stale policy result | Policy target/version/assignment doi sau preview | Generate/Issue khong dung preview cu | Tra stale/review-required, giu Operation de reconcile |
| Multiple policies | Fixed va percentage stackable/exclusive cung target | Server ap dung fixed truoc, sau do percentage; cap discount tai gross | Rule conflict duoc tra reason code deterministically |
| Cross-School data | Target hay assignment UUID khac School | Khong doc/ap dung du lieu khac tenant | Authorization-safe not found/forbidden |
| Issued Invoice | Policy/catalog/assignment doi sau Issue | Invoice line va application snapshot khong doi | Bat buoc correction contract rieng neu can sua obligation |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md` -- contract da duyet cho policy/version/target/assignment, typed discount, stacking va snapshot; dung lam baseline, tach coverage ra Epic 6.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md` -- FR-7/FR-8/FR-9 dang vua mo ta evaluator vua defer promotion; can chot phase boundary moi.
- `_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md` -- AD-7/AD-8/AD-11 la invariants ownership, transaction, audit va test gate.
- `_bmad-output/specs/spec-passionedu/SPEC.md` -- CAP-4/CAP-5 can phan cap Pha 1b discount voi Epic 6 coverage/settlement.
- `_bmad-output/planning-artifacts/epics-passionedu.md` -- them Stories 5.12-5.15 sau template gate; Epic 6 chi giu coverage-specific settlement.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- theo doi Stories 5.12-5.15 backlog, khong doi evidence done hay 5.9-5.11 dang thuc hien.
- `_bmad-output/implementation-artifacts/epic-5-context.md` va `epic-6-context.md` -- regenerate sau khi canonical planning doi boundary.
- `apps/api/prisma/schema.prisma` -- chua co policy/version/target/assignment/application graph; InvoiceLine can luu gross va promotion snapshot bat bien, khong la negative client line.
- `apps/api/src/modules/finance/finance.service.ts` -- reuse preview/generate/issue pipeline cho evaluator va recheck transaction; controller hien chua co policy routes.
- `apps/web/src/finance/finance-workspace.tsx` -- render DTO server-returned, clear policy/preview state khi doi School, khong local calculator.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- giu catalog rieng, them deep surface uu dai; khong tron pricing catalog vao policy lifecycle.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` va `invoice-detail-review.html` -- hien policy application theo line, stale/recheck va issued snapshot; loai Receipt/coverage khoi Pha 1b flow.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- cap nhat assertion Pha 1b va negative assertions cho settlement/coverage.

## Tasks & Acceptance

**Execution:**
- [ ] Canonical planning artifacts -- tao approved change proposal Pha 1b; dong bo PRD, addendum, Spine va SPEC de tach discount per-Receivable khoi coverage settlement.
- [ ] Epic/backlog context -- them Stories 5.12 policy lifecycle/assignment, 5.13 evaluator preview/generate, 5.14 Issue snapshot, 5.15 release gate; cap nhat tracker va regenerate Epic 5/6 context.
- [ ] Finance schema/API -- them School-scoped relational policy graph va server evaluator; them idempotent, audited policy/assignment commands; recheck va snapshot application trong Issue transaction.
- [ ] Finance portal/mockups -- them surface `Ưu đãi` tach catalog, assignment co audit, policy result per line trong preview/review, stale state va immutable issued disclosure.
- [ ] Tests -- cover tenant graph, effective version/assignment, deterministic stacking/cap, stale preview, issue recheck, immutable snapshot, retry/concurrency va absence cua coverage/settlement dependencies.

**Acceptance Criteria:**
- Given Finance tao policy active va gan Student hop le, when preview CollectionRun co Receivable target, then API tra gia goc, discount va net server-derived tren dung line.
- Given policy/version/target/assignment thay doi sau preview, when Finance generate hoac Issue, then server khong phat hanh tu evaluation cu va yeu cau review/reconcile ket qua moi.
- Given nhieu policy cung target, when server evaluate, then fixed VND duoc ap dung truoc percentage, exclusivity/priority deterministic va discount khong vuot gross target.
- Given Invoice da Issue, when catalog/policy/version/assignment sau do thay doi, then issued snapshot khong bi rewrite.
- Given Pha 1b routes, schema va portal bundle duoc kiem tra, when release gate chay, then khong co PREPAID_COVERAGE, Receipt, settlement, carry, refund, debt/report hay Parent/Teacher dependency.

## Design Notes

`Receivable` giu gia co so; `PromotionPolicyTarget` chi dinh dong nao co the giam; `InvoicePromotionApplication` la ket qua server da snapshot. Vi du: Học phí tháng gross `1.500.000`, policy "Con cán bộ" `PERCENTAGE 10`, discount `150.000`, net `1.350.000`; Tiền ăn khong co target giu nguyen gross/net `770.000`.

## Verification

**Commands:**
- `pnpm test:mockups` -- expected: contract tests bao phu policy surface va khong leak settlement/coverage.
- `pnpm --filter api test` -- expected: Finance unit/API tests pass voi evaluator, issue recheck va tenant isolation.
- `pnpm --filter api test:integration` -- expected: PostgreSQL integration chay voi `.env.test`, prove transaction/idempotency/concurrency.
- `git diff --check` -- expected: khong co whitespace error.
