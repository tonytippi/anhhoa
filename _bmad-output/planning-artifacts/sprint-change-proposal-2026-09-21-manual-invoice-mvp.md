---
name: Finance Admin MVP manual invoice lines
status: approved
date: 2026-09-21
trigger: Finance operations need to decide which receivables appear on each Student Invoice and enter a positive quantity without learning or configuring rule-engine concepts.
mode: direct-adjustment
approval: Tony, 2026-09-21
---

# Sprint Change Proposal - Finance Admin MVP manual invoice lines

## 1. Issue summary

The current Finance Admin MVP uses `ChargeRule` with `FIXED` or `MANUAL` quantity, scope precedence and automatic roster/rule generation. This exposes a calculation-engine model that does not match the accountant's task. In practice, an accountant decides which receivables belong on a Student's Invoice and the positive quantity for each line. For example, a trial student receives daily tuition but no monthly-tuition line; the absence of a line, not a zero-quantity line, expresses that decision.

The first release is only for tuition calculation. It has no trusted attendance, service-enrollment, promotion or other operational input that would justify automatic charge selection. A zero-quantity financial line is forbidden because it is ambiguous and complicates total, audit, snapshot and later settlement semantics.

## 2. Approved product decisions

1. Finance Admin MVP removes `ChargeRule`, `FIXED`, `MANUAL`, scope precedence and automatic charge selection/generation from the release scope. They are a later Finance automation enhancement and require a separate approved contract before implementation.
2. MVP Finance catalog contains active/inactive School-scoped `ReceivableGroup` and `Receivable`. A Receivable has an optional School-unique code, display name, unit label and default unit price in whole-VND `BIGINT`.
3. A monthly CollectionRun identifies SchoolYear and `billingMonth`. Finance selects eligible Students for DRAFT Invoice creation; the server validates School scope and enrollment eligibility. Creating an Invoice does not select, infer or create charge lines.
4. An Invoice DRAFT starts empty. Finance adds a line by selecting an active same-School Receivable and entering a strictly positive integer quantity. The server takes the Receivable default unit price unless Finance supplies an audited override. Finance may edit or remove a DRAFT line. The server alone derives line amount and Invoice total.
5. The absence of a line means the receivable does not apply to that Invoice. Quantity `0`, negative quantity, float quantity, zero/negative price and client-supplied line/Invoice totals are rejected.
6. A manual explanatory source may be attached to a DRAFT line when needed: service date, attendance status, picked-up time and/or late-care minutes, with mandatory reason/audit/provenance. It remains explanatory input only and never derives quantity, price, fee, discount or total. This does not create an attendance/handover dependency.
7. `FINANCE_MANAGE` is the dedicated SchoolPosition capability for Finance catalog, CollectionRun, Invoice DRAFT lines and issue. It is seeded for the School Admin and Finance Manager Positions. API authorization remains capability- and binding-based, never role-name based.
8. Receivables and DRAFT lines are immutable after Invoice issue through the existing snapshot boundary. Inactive catalog records cannot be selected for a new line but remain readable through historical snapshots.

## 3. Impact analysis

| Area | Change |
| --- | --- |
| Epic 5 | Story 5.1 becomes receivable catalog plus `FINANCE_MANAGE`; Story 5.2 configures monthly CollectionRun and Student selection; Story 5.3 creates empty DRAFT Invoices idempotently; Story 5.4 owns DRAFT line CRUD, audited price override and optional explanatory source. |
| Charge automation | `ChargeRule`, rule snapshots, `FIXED`/`MANUAL`, School/Class/Student precedence and automatic charge selection are deferred. They do not block the tuition MVP. |
| Database/API | Finance owns catalog, CollectionRun, Invoice and InvoiceLine with same-School composite relations, VND `BIGINT`, positive quantity checks, server totals, audit and Operation/idempotency. |
| UX | Finance shows catalog, run Student selection and an Invoice DRAFT line editor. Accountants see receivables, quantity, price, amount and reason where required; they do not see rule modes, scopes or zero-value lines. |
| Release gate | Proves line selection/removal, positive integer and VND validation, no client total injection, tenant isolation, retry safety, issued snapshot immutability and no Teacher/Parent/attendance/service/promotion/Payroll dependency. |
| Future Finance enhancement | ChargeRule automation may later suggest lines from School/Class/Student rules, but must not rewrite existing DRAFT/issued lines or introduce zero-quantity lines without a new contract. Promotion/coverage remains a later settlement enhancement. |

## 4. Recommended approach

Use a direct adjustment within Epic 5. No completed code is rolled back and the release sequence remains E1/E2/E3 -> Finance Admin MVP. This reduces implementation and operational risk: server authority still protects money, tenant scope, audit, idempotency and issued snapshots, while the accountant controls the facts they actually know.

Alternatives rejected:

- Retain ChargeRule but hide it in the UI: rejected because automatic inclusion/exclusion still creates an unapproved business decision with incomplete input data.
- Encode non-applicability as quantity `0`: rejected because it creates ambiguous financial history and later settlement edge cases.
- Build attendance/service inputs first: rejected because it delays the required tuition-only release and creates unnecessary cross-domain dependencies.

## 5. Detailed canonical changes

- Update PRD, SPEC and Architecture Spine to define manual positive Invoice DRAFT lines as the MVP calculation input and defer ChargeRule automation.
- Update Epic 5 Stories 5.1-5.6 and tracker titles/keys to the manual-line flow.
- Update UX Finance workspace/lifecycle language and active mockup contracts to remove rule/scope controls from MVP and make DRAFT line selection/edit/remove the accountant task.
- Preserve `PromotionPolicy` and `PREPAID_COVERAGE` as Finance settlement enhancement; mark them explicitly outside this MVP.

## 6. Delivery and handoff

**Scope classification:** Moderate backlog and canonical-contract adjustment.

**Developer:** Implement only after this proposal's canonical edits: `FINANCE_MANAGE`, Finance catalog, run/student selection, idempotent empty DRAFT Invoice generation, DRAFT line editing and release tests.

**Success criteria:** A Finance-authorized actor can produce and issue a School-scoped Invoice whose server-calculated positive lines exactly reflect selected receivables and quantities, with no zero lines, no client-calculated total and no dependency on deferred domains.

## 7. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1-1.3 Trigger, problem and evidence | [x] Done | Accountant workflow: chooses invoice receivables and quantity; trial tuition must omit monthly tuition rather than use quantity zero. |
| 2.1-2.5 Epic impact | [x] Done | Epic 5 remains viable; Stories 5.1-5.6 are reorganized, no epic order changes. |
| 3.1-3.4 Artifact impact | [x] Done | PRD, SPEC, Spine, Epic, UX/mockup contracts, tracker and Story 5.1 spec require alignment. |
| 4.1 Direct adjustment | [x] Viable | Selected; medium effort, lower operational and technical risk. |
| 4.2 Rollback | [x] Not viable | No completed Finance implementation exists. |
| 4.3 MVP review | [x] Viable | Scope is reduced by deferring automation, not core tuition calculation. |
| 5.1-5.5 Proposal and handoff | [x] Done | This proposal records approved decisions and concrete artifact updates. |
| 6.1-6.5 Review, approval, tracker and handoff | [x] Done | Approved by Tony in this conversation; canonical artifacts and tracker updated in the same change. |
