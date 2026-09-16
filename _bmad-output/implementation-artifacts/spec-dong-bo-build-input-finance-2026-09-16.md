---
title: 'Đồng bộ build input Finance theo PRD 2026-09-16'
type: 'chore'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b86c43de3bcb673c056b3a2982739b46ed5cdb79'
context:
  - '_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PRD ngay 2026-09-16 da thay doi contract Finance sang actual Receipt close, SettlementDifference/carry, Invoice revision va `PREPAID_COVERAGE` trong monthly CollectionRun. Nhieu build input canonical, tracker va specification mockup da hoan thanh van giu lifecycle, `PREPAID` run hoac policy cu, co the lam implementation bat dau tu contract sai.

**Approach:** Dong bo cac artifact canonical va tracker theo PRD/Architecture/Epics moi nhat. Xoa cac completed implementation spec Finance chi phan anh contract cu thay vi giu chung trong active implementation directory; giu nguyen mockup worktree changes cua nguoi dung.

## Boundaries & Constraints

**Always:** `prd.md`, `ARCHITECTURE-SPINE.md` va `epics-passionedu.md` la nguon hanh vi Finance hien hanh. Build input phai dung monthly CollectionRun duy nhat theo billingMonth, actual Receipt dong mot Invoice voi `EXACT|SHORTFALL|OVERPAYMENT`, source-linked carry/revision va `PREPAID_COVERAGE` trong monthly run. Tracker chi dung key trung ten Story active. Xoa chi cac completed spec Finance cu da duoc PRD thay the; khong sua mockup HTML dang dirty.

**Ask First:** Bat ky thay doi Product moi, bao gom auto late-pickup pricing, `ANNUAL`/`ONE_OFF` CollectionRun, dedicated `PREPAID` run, generic balance, StudentPrepayment hoac cap lai coverage khi Invoice close non-exact.

**Never:** Khong sua `prd.md`, khong xoa proposal/review co nhan historical, khong xoa decision draft/deferred-work, khong dua artifact Anh Hoa legacy vao build path, khong revert hoac format cac mockup HTML dang thay doi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Canonical Finance flow | Build input duoc doc truoc develop | SPEC, addendum, Experience va mockup coverage dung monthly coverage, actual close/carry/revision | Khong con dedicated PREPAID run hay Invoice PAID/VOIDED contract hien hanh |
| Tracker handoff | Sprint tracker tao story implementation | Key Epic 6/7 trung heading Story hien hanh va `last_updated` phan anh dong bo | Khong doi status backlog hay tao story moi |
| Completed stale spec | Spec Finance `status: done` chi mo ta contract cu | File bi xoa khoi active implementation artifacts | Historical proposal/review va decision draft duoc giu |
| Dirty mockup workspace | Ba HTML Finance co local modifications | Khong thay doi noi dung cua cac file nay | `git diff --check` va status xac nhan thay doi van duoc bao toan |

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/spec-passionedu/SPEC.md` -- canonical preservation-validated contract; CAP-4/CAP-5 va constraints van noi dedicated `PREPAID` run.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md` -- companion build input; finance rules va verification matrix van noi `ANNUAL`/`ONE_OFF` va source PREPAID run.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- canonical UX behavior; promotion policy/coverage va Finance flows can dong bo actual-receipt contract.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- mockup contract companion; phan Finance lifecycle can dung outcome `CLOSED`/`EXACT` moi.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- active backlog tracker; Epic 6/7 keys con theo heading Story truoc 2026-09-16.
- `_bmad-output/implementation-artifacts/spec-*.md` -- completed Finance mockup specs co contract cu; can xoa neu chi phan anh dedicated PREPAID/exact-only/PAID-VOIDED model.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/specs/spec-passionedu/SPEC.md` -- cap nhat metadata, CAP-4/CAP-5 va Finance constraints theo monthly coverage, actual close, carry va revision -- giu canonical contract khong mau thuan PRD.
- [x] `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md` -- thay finance rules/verification matrix va source proposal theo decision 2026-09-16 -- bo lifecycle/run cu khoi companion build input.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- cap nhat Finance IA, component patterns va key flows theo one-Invoice actual Receipt va monthly coverage -- ngan UX chi dan flow backend sai.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- cap nhat pham vi mo ta Finance lifecycle -- dong bo mockup contract ma khong sua HTML dang dirty.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- doi Epic 6/7 key theo heading Story active va cap nhat timestamp -- bao dam handoff story tu tracker dung.
- [x] `_bmad-output/implementation-artifacts/spec-mockup-goi-nop-truoc.md`, `spec-dong-bo-ba-contract-passionedu.md`, `spec-mockup-tai-chinh-chi-tiet.md`, `spec-bo-sidebar-chi-tiet-hoa-don.md`, `spec-mockup-danh-sach-va-tao-dot-thu.md`, `spec-hardening-rendered-html-mockups.md`, `spec-phan-chia-cau-hinh-tai-chinh.md`, `spec-thiet-ke-lai-mockup-khoan-thu.md`, `spec-tab-cau-hinh-khoan-thu.md` -- xoa completed Finance specs da duoc PRD thay the -- loai contract cu khoi active directory.

**Acceptance Criteria:**
- Given implementation agent doc README va listed build inputs, when bat dau story moi, then khong co canonical artifact nao yeu cau dedicated `PREPAID` run, `ANNUAL`/`ONE_OFF`, `PAID`/`VOIDED` Invoice lifecycle hay normal exact-only Receipt.
- Given sprint-status duoc dung de resolve Epic 6/7, when story key duoc chon, then key trung title Story actual Receipt/carry, monthly coverage, release gate va Parent effective obligation.
- Given completed Finance spec chi mo ta contract da supersede, when implementation artifacts duoc liet ke, then file do khong con trong active path trong khi proposal/review historical, decision draft va deferred work van ton tai.
- Given ba mockup HTML dang dirty truoc khi thuc hien, when dong bo ket thuc, then chang khong bi revert hay sua boi cong viec nay va `git diff --check` pass.

## Design Notes

Khong dao nguoc lich su bang cach sua proposal/review cu. Canonical input duoc viet truc tiep theo PRD hien hanh; implementation spec hoan thanh cu bi xoa khi noi dung cua no khong con la bang chung co the dung an toan de build. `deferred-work.md` va late-pickup decision draft duoc giu lam guard de tranh scope creep, khong phai Finance contract.

## Verification

**Commands:**
- `git diff --check` -- expected: khong co whitespace error.
- `rg -n 'dedicated `PREPAID`|`PREPAID` CollectionRun|`ANNUAL`|`ONE_OFF`|Invoice `DRAFT`, `ISSUED`, `PAID`, `VOIDED`' _bmad-output/specs _bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04 _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04 _bmad-output/implementation-artifacts/sprint-status.yaml` -- expected: khong co canonical match; historical artifacts neu co phai co nhan ro rang.
- `git status --short` -- expected: ba mockup HTML local changes van con va khong bi sua boi task nay.

## Spec Change Log

- 2026-09-16: Review-driven cleanup added the approved 2026-09-16 proposal source, aligned issued/cancelled adjustment outcomes and Finance flows with actual Receipt close/carry, updated the deferred monthly `PREPAID_COVERAGE` Invoice item, and removed two additional completed stale Finance specs.
