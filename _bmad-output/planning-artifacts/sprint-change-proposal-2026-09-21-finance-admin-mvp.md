---
name: Finance Admin MVP before Teacher and Parent portals
status: approved
date: 2026-09-21
trigger: Business owner needs an earlier release for tuition calculation using only the Admin/Finance portal. Student attendance and late-care information may be entered manually; Teacher, Parent, and all staff-payroll work are not release requirements.
mode: incremental
---

# Sprint Change Proposal - Finance Admin MVP before Teacher and Parent portals

## 1. Issue summary

The current release sequence makes Epic 5 dependent on Epic 4. That dependency requires the Teacher portal, staff capability/class-assignment authorization, attendance/handover evidence, and operational queues before a School can configure receivables, create a monthly CollectionRun, review DRAFT Invoices, and issue tuition obligations. Parent portal work is also planned before the initiative has an earlier Finance-only release boundary.

The business needs an Admin/Finance release sooner. It needs only School-scoped receivables and ChargeRules, monthly CollectionRuns, server-authoritative Invoice DRAFT generation/review/issue, and a manually entered explanation for student attendance or late-care when Finance adds a manual Invoice line. It does not need Teacher, Parent, service enrollment, promotion coverage, settlement, ledger, revision, Payroll, or staff timekeeping.

This is a strategic MVP resequencing and scope reduction, not a technical defect or rollback request.

## 2. Approved product decisions

1. Finance Admin MVP is released after Epics 1, 2, and 3. Epic 4 is no longer a dependency for Epic 5's MVP slice.
2. A Finance Manager or School Admin may enter student attendance/late-care reference values while adding a `MANUAL` Invoice DRAFT line. Supported reference values are service date, attendance status, picked-up time, and/or late-care minutes. They are Finance-source data, not an attendance or handover aggregate.
3. The API snapshots those manual reference values, actor, time, provenance, and a required reason on the financial line. It validates School, StudentEnrollment, Invoice DRAFT state, business date, whole-VND price/quantity, and authorization.
4. The API must not derive quantity, unit price, fee, discount, or total from manual attendance/late-care values. The browser cannot set Invoice total or settlement status. Issued, closed, or cancelled Invoice data remains immutable.
5. Teacher attendance/handover built later remains a separate operational domain. It must not overwrite, backfill, or re-price an issued manual Finance-source snapshot.
6. Finance Admin MVP contains only receivable catalog/ChargeRule, CollectionRun preview/generation, DRAFT review/manual financial source, Invoice issue, and its release gate.
7. Service catalog/enrollment, leave-meal adjustment materialization, PromotionPolicy/prepaid coverage, CollectionRun close, issued-Invoice revision, actual receipts, carry, ledger/reports, Teacher portal, Parent portal, and Payroll are deferred, not removed.

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD | Release sequence changes from `E4 -> E5 -> E6 -> E7` to a Finance Admin MVP after E1/E2/E3, then settlement, then operational inputs, then Parent. FR-13's no-auto-fee rule remains; MVP adds Finance-owned manual reference snapshots. |
| Architecture Spine | Finance must explicitly own the manual Finance-source snapshot on a DRAFT line. It must not import or expose `teacher-web`, `parent-web`, attendance, service, promotion, or Payroll dependencies for this release. Existing tenant isolation, `BIGINT`, idempotency, audit, snapshot, and immutable issue boundaries remain mandatory. |
| Epic 4 | Stories 4.1-4.5 remain completed work but are not Finance MVP gates. Stories 4.6-4.10 stay backlog and follow the Finance settlement release. Teacher operational records later remain the authoritative operational source, without rewriting Finance history. |
| Epic 5 | The dependency changes to E1/E2/E3. Stories 5.1-5.6 are narrowed to the Finance Admin MVP. Stories 5.7-5.8 move with settlement work. |
| Epic 6 | Remains deferred to the Finance settlement release after the MVP. No Receipt, carry, refund, debt, ledger, report, or CSV behavior is part of the early release. |
| Epic 7 | Parent portal remains deferred until both E4 operational data and E6 effective Invoice/settlement projection exist. |
| Epic 8-11 | Payroll and all staff timekeeping/late-care work are unaffected and remain deferred. Student late-care references must not be confused with staff late-care/payroll records. |
| UX | Finance screens are Admin portal only. They need explicit manual-reference fields, required audit reason, server result/error states, and a clear label that values are not an automatic fee calculation. Teacher and Parent screens are not MVP deliverables. |
| Verification | The release gate must prove no cross-School access, no client total/status injection, no duplicate generate/issue after retry, immutable issued manual snapshots, and no module/route/bundle dependency on Teacher, Parent, attendance, service enrollment, promotion, or Payroll. |

## 4. Recommended approach

Use a direct backlog adjustment with a reduced MVP, then implement the Finance slice before remaining operational and portal work. No completed code is rolled back. The approach is moderate in scope because it changes canonical product sequencing and requires aligned PRD, architecture, epic, UX, specification, and tracker updates before development starts.

### Release sequence

1. Release 3, Finance Admin MVP: E5.1-E5.6 after E1, E2, and E3.
2. Release 4, Finance settlement: E6 plus E5.7 CollectionRun close and E5.8 issued-Invoice revision.
3. Release 5, operational inputs: remaining E4 Teacher/operational work. Its later source facts do not rewrite issued Finance manual snapshots.
4. Release 6, Parent portal: E7 after E1, E2, E4, and E6.
5. Release 7, Payroll: E8-E11 unchanged.

### Alternatives considered

| Option | Verdict | Reason |
| --- | --- | --- |
| Keep E4 as a hard Finance blocker | Rejected | It delays tuition issue until Teacher portal/evidence/queue work is complete, which is outside the stated early-release need. |
| Create a minimal Admin attendance/handover domain | Rejected | It duplicates the later attendance domain, creates competing operational truth, and increases child-data/evidence/authorization scope. |
| Allow automatic fee calculation from manual data | Rejected | It violates the approved non-goal against pricing from attendance/handover and creates an unapproved pricing engine. |
| Finance manual source snapshot on Invoice DRAFT | Selected | It supports explainable manual charges while preserving server authority, audit, immutability, and the later operational domain boundary. |

## 5. Detailed change proposals

### 5.1 PRD - release order and scope

**Section:** `prd.md` section 6.2, "Thu tu phat hanh rang buoc"

**OLD:**

```md
- Release 3: E4 attendance/leave/service/handover sau E2; E5 collection runs/invoices chi sau E2, E3 va E4; E6 ledger/report sau E5.
- Release 4: E7 Parent multi-school finance portal sau E1, E2 va E6.
- Release 5: Payroll E8 ...
```

**NEW:**

```md
- Release 3 (Finance Admin MVP): E5 collection runs/invoices sau E1, E2 va E3.
  Finance Admin nhap tham chieu diem danh/trong muon thu cong tren Invoice DRAFT;
  khong yeu cau Teacher hay Parent portal.
- Release 4 (Finance settlement): E6 actual receipt, carry, revision, debt va reports sau E5.
- Release 5 (Operational inputs): E4 attendance/leave/service/handover sau E2 va E3.
  Teacher portal, evidence va operational queue khong la blocker cho Finance.
  E4 khong rewrite manual finance-source snapshot da issue.
- Release 6 (Parent portal): E7 sau E1, E2, E4 va E6.
- Release 7: Payroll E8-E11 theo dependency hien hanh.
```

**Rationale:** Finance can issue obligations without requiring operational or Parent surfaces, while Parent still waits for its required operational and settlement projections.

### 5.2 Architecture - manual Finance-source boundary

**Section:** `ARCHITECTURE-SPINE.md`, new correction under AD-7 and AD-13.

**NEW:**

```md
- Correction (Finance Admin MVP): Before attendance/handover release, finance may persist
  a manual Finance-source snapshot only on a same-School Student's DRAFT Invoice line.
  It contains an optional service date, attendance status, picked-up time and/or late-care
  minutes, plus mandatory actor, reason, timestamp and provenance. Finance validates the
  StudentEnrollment, DRAFT state, business date, whole-VND quantity/unit price and tenant
  graph. This snapshot is explanatory input only: it does not calculate quantity, price,
  fee, discount or Invoice total, and it becomes immutable at issue. The attendance,
  handover, Teacher and Parent modules are not dependencies of this command; later
  operational records never overwrite or re-price an issued Finance-source snapshot.
```

**Rationale:** Defines one temporary Finance-owned source without creating a second attendance authority or weakening immutable obligation history.

### 5.3 Epic 5 - dependency and Finance Admin MVP scope

**Section:** `epics-passionedu.md`, Epic 5 dependency

**OLD:**

```md
**Depends on:** Epic 1, Epic 2, Epic 3, Epic 4.
Epic 4 only delivers immutable adjustment eligibility sources;
Epic 5 owns materialization onto Invoice DRAFT.
```

**NEW:**

```md
**Depends on:** Epic 1, Epic 2, Epic 3.
Finance Admin MVP dung catalog, roster snapshot, BankAccount va manual Finance-source
snapshot tren Invoice DRAFT. Epic 4 la enhancement sau release: sau khi co immutable
short-leave source, Finance co the materialize meal adjustment source-linked ma khong
thay doi CollectionRun, Invoice hay manual snapshot da issue.
```

**Rationale:** Removes a non-essential Teacher/operational dependency while retaining the later integration path.

### 5.4 Story 5.1 - narrow catalog/rule MVP

**OLD TITLE:**

```md
Story 5.1: Quản lý receivable catalog, service enrollment, ChargeRule và chính sách ưu đãi có phiên bản
```

**NEW TITLE:**

```md
Story 5.1: Quản lý receivable catalog và ChargeRule có phiên bản
```

**NEW ACCEPTANCE CRITERIA:**

```md
Given Finance Manager hoac School Admin co capability trong selected School
When tao/inactivate ReceivableGroup, Receivable hoac ChargeRule
Then record la School-scoped, co audit/effective interval/source; catalog inactive
khong dung cho CollectionRun moi nhung van doc duoc qua Invoice snapshot lich su
And ma khoan la optional nhung unique trong School khi duoc cung cap; money persist
PostgreSQL BIGINT va REST chi tra JSON-safe integer, khong dung float.

Given ChargeRule cung Receivable ap dung o nhieu scope
When server chon rule cho Student trong CollectionRun
Then precedence la STUDENT > CLASS > SCHOOL
And conflict cung muc dac hieu bi tu choi, khong chon theo client order.

Given Finance Manager cau hinh quantity va price
When request duoc validate
Then ChargeRule chi nhan FIXED hoac MANUAL; server validate whole-VND,
effective interval va scope same-School
And ChargeRule khong tu pricing tu attendance, handover hay browser state.
```

**Deferred from this story:** service catalog/enrollment, PromotionPolicy, StudentPromotionAssignment, and PREPAID_COVERAGE.

### 5.5 Stories 5.2, 5.3, and 5.5 - remove deferred calculations

**Story 5.2:** Keep monthly CollectionRun lifecycle and shared server preview/generate selection. Remove `PREPAID_COVERAGE`, promotion evaluation, coverage skips, and prior-debt context from MVP preview.

**Story 5.3:** Keep roster/rule snapshots, idempotent Operation, scoped Invoice uniqueness, and categorized skips. Remove promotion evaluation and coverage skip behavior.

**Story 5.5:** Keep active same-School BankAccount selection, immutable Payment instruction/obligation snapshot, issue idempotency, and post-issue immutability. Remove promotion re-evaluation and coverage snapshot criteria.

### 5.6 Story 5.4 - manual Finance-source snapshot

**REMOVE:** approved-leave-source materialization, StudentServiceEnrollment/Saturday coverage validation, and PromotionPolicy/PREPAID_COVERAGE criteria from the Finance Admin MVP.

**ADD:**

```md
Given Finance Manager hoac School Admin them mot dong MANUAL trong Invoice DRAFT
When actor nhap tham chieu van hanh thu cong cho Student, ngay dich vu,
trang thai diem danh, thoi diem tra tre va/hoac so phut trong muon
Then API validate School, StudentEnrollment, Invoice DRAFT, business date,
whole-VND quantity/unit price va reason bat buoc; snapshot cac gia tri da nhap,
actor, thoi diem va provenance tren finance line
And API khong suy ra quantity, unit price, late-pickup fee, giam tru hay total
tu cac tham chieu nay; client khong the set total hoac settlement status.

Given Invoice da ISSUED, CLOSED hoac CANCELLED
When actor co sua tham chieu van hanh thu cong hay gia tri dong MANUAL
Then server tu choi; correction phai di qua workflow revision/refund co audit
And Epic 4 attendance/handover sau nay khong rewrite finance-source snapshot nay.
```

### 5.7 Story 5.6 - Finance Admin MVP release gate

**NEW TITLE:**

```md
Story 5.6: Release gate Finance Admin MVP
```

**NEW ACCEPTANCE CRITERIA:**

```md
Given fixture co nhieu School, SchoolYear, enrollment lifecycle, Receivable,
ChargeRule, BankAccount va CollectionRun
When unit/integration suite chay catalog, preview, generate, DRAFT review va issue
Then preview va generate dung cung server selection/calculation outcome;
scope/precedence/whole-VND math, roster/rule snapshot, unique Invoice
va lifecycle lock deu duoc kiem tra
And cross-School relation/query, inactive/wrong-School BankAccount, client
total/status injection va Invoice mutation after issue deu bi tu choi.

Given concurrent hoac retried generate/issue requests
When suite thuc hien timeout, identical retry va changed fingerprint cases
Then moi Student/run co toi da mot Invoice, Operation outcome duoc reconcile,
audit/provenance du va duplicate post khong xay ra
And Finance UI E2E cho preview/generate/DRAFT-review/issue hien thi server
values, switch guard, timeout reconciliation, text state, focus/error va
khong stale School data.

Given Finance Manager them manual finance-source snapshot cho diem danh
hoac trong muon tren Invoice DRAFT
When API va UI tests chay
Then School/Student/Invoice state, required reason/audit, integer VND/quantity,
immutable issued snapshot va absence cua auto-pricing deu duoc prove
And khong co route, bundle hay authorization dependency vao teacher-web,
parent-web, attendance, service enrollment, PromotionPolicy hay Payroll.
```

### 5.8 Deferred backlog

| Deferred capability | Destination |
| --- | --- |
| Service catalog and StudentServiceEnrollment | Finance enhancement after Finance Admin MVP; required for later service/Saturday coverage only. |
| Leave-meal adjustment materialization | Finance enhancement after Epic 4 immutable short-leave source is used. |
| PromotionPolicy, assignments and PREPAID_COVERAGE | Finance enhancement after the Finance Admin MVP. |
| CollectionRun close and issued-Invoice revision | Finance settlement release with Epic 6. |
| Actual Receipt, carry, reversal/refund, debt, report and CSV | Epic 6 Finance settlement release. |
| Remaining Teacher operations (4.6-4.10) | Operational-input release after Finance settlement. |
| Parent portal (Epic 7) | Parent release after E4 and E6. |
| Payroll (Epic 8-11) | Unchanged later release. |

### 5.9 Sprint tracker after approval

```yaml
epic-4: in-progress
# 4.6-4.10 remain backlog and are not Finance Admin MVP blockers.

epic-5: in-progress
5-1-quan-ly-receivable-catalog-va-chargerule-co-phien-ban: ready-for-dev
5-2-tao-collectionrun-va-server-authoritative-preview: backlog
5-3-generate-invoice-draft-idempotent-theo-snapshot-roster-rule: backlog
5-4-ra-soat-invoice-draft-va-manual-finance-source-co-audit: backlog
5-5-issue-invoice-voi-payment-instruction-snapshot-bat-bien: backlog
5-6-release-gate-finance-admin-mvp: backlog
5-7-dong-collectionrun-da-generate: backlog
5-8-revision-invoice-da-phat-hanh-va-huy-ban-cu: backlog

epic-6: backlog
epic-7: backlog
```

## 6. Delivery and risk

**Scope classification:** Moderate. No rollback is required, but Product/Architecture must apply the approved canonical changes before Developer starts Story 5.1.

**Effort:** Medium. The smaller MVP removes several complex domains but adds a narrow audited manual-source model and a dedicated release gate.

**Primary risk:** Finance manually transcribes attendance/late-care data incorrectly. Mitigation is explicit source fields, mandatory reason/audit, server validation, immutable issue snapshot, and no automatic monetary derivation.

**Primary technical risk:** A manual-source feature could accidentally become a second attendance implementation. Mitigation is no attendance record/lifecycle/evidence/Teacher authorization, no cross-module dependency, and a clear Finance-line-only ownership boundary.

## 7. Implementation handoff

| Recipient | Responsibility |
| --- | --- |
| Product Manager | Apply approved release-order and MVP scope edits to PRD; preserve all deferred capabilities as future work rather than deleting them. |
| Solution Architect | Add the Finance-source boundary to the Architecture Spine; verify that tenant, money, snapshot, authorization, audit, and Operations invariants are unchanged. |
| Product/Developer | Update Epic 5 stories, defer moved criteria explicitly, and update `sprint-status.yaml` only after canonical artifacts are aligned. |
| Developer | Start `bmad-build` for Story 5.1 only after the canonical changes and tracker update are complete. |
| QA/Developer | Implement the Finance Admin MVP release gate before declaring the lane releasable. |

## 8. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1 Triggering change | [x] Done | Business owner requested early tuition release without Teacher/Parent apps. |
| 1.2 Core problem | [x] Done | Existing E4 dependency delays required Finance Admin value. |
| 1.3 Supporting evidence | [x] Done | Explicit requirement: receivables, collection runs, and manually entered student attendance/late-care only; no staff work. |
| 2.1-2.5 Epic impact/order | [x] Done | E5 moves ahead; E4/E7 deferred; E6 follows MVP; Payroll unchanged. |
| 3.1 PRD impact | [x] Done | Release order and Finance Admin MVP boundary require update. |
| 3.2 Architecture impact | [x] Done | Finance-line manual-source ownership and module isolation require update. |
| 3.3 UX impact | [x] Done | Admin Finance-only manual-reference/reason states; no Teacher/Parent delivery. |
| 3.4 Secondary artifacts | [x] Done | Epics, implementation specs, UX contract, and sprint tracker require aligned updates after approval. |
| 4.1 Direct adjustment | [x] Viable | Selected: Medium effort and controlled risk. |
| 4.2 Rollback | [x] Not viable | No completed implementation must be undone. |
| 4.3 MVP review | [x] Viable | Selected jointly with direct backlog adjustment. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-7 record approved decisions and responsibilities. |
| 6.1-6.2 Proposal review | [x] Done | Incremental approvals recorded for four proposals. |
| 6.3 User approval | [x] Done | Tony approved the complete proposal on 2026-09-21. |
| 6.4 Tracker update | [x] Done | Epic 5 is `in-progress`; narrowed Story 5.1 is `ready-for-dev`; renamed Story 5.4 and 5.6 keys are aligned. |
| 6.5 Handoff | [x] Done | Canonical PRD, addendum, Architecture Spine, SPEC, UX, epics and tracker were updated; Developer may start Story 5.1. |

## 9. Approval request

Approved by Tony on 2026-09-21. Canonical artifacts and the sprint tracker are aligned; implementation may start with Story 5.1.
