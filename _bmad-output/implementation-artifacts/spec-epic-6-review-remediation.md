---
title: 'Khắc phục findings release Epic 6 Finance'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_commit: '30bd038de5a3e1c92c8ce7b2005499211fba99ca'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/decision-epic-6-review-remediation-2026-09-26.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6 release review found incorrect settlement sign/provenance, refund posting without immutable eligibility evidence, reports that overstate group-filtered totals, and Finance UI states that can leave staff without safe authorization/export feedback.

**Approach:** Correct the finance authority at its persisted boundaries, expose only authoritative report/refund states in Admin, and add PostgreSQL/browser regression proof before completing Epic 6.

## Boundaries & Constraints

**Always:** VND remains `BIGINT`/JSON strings; every read/write is School-authorized; settlement/reversal/carry/debt/ledger records stay append-only; an actual receipt closes one invoice; group reports aggregate immutable matching invoice lines only; unallocated whole-invoice event provenance is never fabricated as group allocation; refund eligibility is immutable School-scoped evidence with a server-confirmed effective date; timeout/revoke/expiry clears protected mutation/export state.

**Ask First:** Ask before adding another refund reason, allocating cash proportionally by group, or changing Parent/Payroll/report/export scope.

**Never:** Do not use free-text reason, invoice cancellation, class/year transfer, browser state, or current live enrollment as refund eligibility; do not create generic balances, client CSV, PDF/XLSX, or a retroactive ledger rewrite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Non-exact close | Actual differs from issued obligation | Shortfall persists positive, overpayment negative; only the matching source carry materializes | Concurrent/replay remains one posting |
| Coverage refund | Paid coverage plus immutable eligible event | Preview/post uses event effective date and snapshot calendar; source evidence is returned | Missing, cross-School, stale, or exhausted source is denied without posting |
| Group report | Multi-group invoice and selected group | Billed totals include only matching immutable lines; whole-invoice events are explicitly unallocated | No proportional cash allocation |
| Protected UI | Refund preview denied or export unavailable | Prior protected preview/export is cleared; current safe context and accessible explanation remain | No navigation or local fallback |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- add immutable coverage-refund eligibility records and School graph constraints.
- `apps/api/prisma/migrations/` -- forward migration and append-only guards only.
- `apps/api/src/modules/roster/roster.service.ts` -- reuse enrollment lifecycle command to record withdrawal eligibility; add explicitly authorized evidence command for the two non-enrollment grounds.
- `apps/api/src/modules/finance/finance.service.ts` -- canonical settlement sign/carry, eligibility gate, line-based group projection, source debt outstanding, and ledger provenance.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL settlement, eligibility, group-filter, outstanding, concurrency and export proof.
- `apps/web/src/finance/finance-workspace.tsx` -- safe denied preview, immutable source/evidence/result rendering and accessible dialogs.
- `apps/web/src/finance/finance-reports-workspace.tsx` -- server filter controls, tab semantics and safe export lifecycle.
- `apps/web/src/finance/*.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- Admin regression and release proof.

## Tasks & Acceptance

**Execution:**
- [x] Add immutable refund-eligibility persistence and Finance-authorized command; wire withdrawal lifecycle evidence without treating roster transfers as transfer-out.
- [x] Correct settlement/carry sign and persisted carry ID; align source-debt outstanding projection with approved decision.
- [x] Project group report billed fields from matching immutable lines and label whole-invoice events unallocated.
- [x] Implement Admin filter controls, keyboard-complete tabs, safe export/download failure state, and refund-preview authorization/provenance state.
- [x] Add integration, unit, and E2E regressions for every corrected boundary.

**Acceptance Criteria:**
- Given non-exact settlement, when it posts and later materializes, then sign, carry kind, remaining amount, ledger provenance and reports agree with the canonical contract.
- Given coverage lacks approved immutable eligibility evidence, when preview or post is requested, then the server rejects it without refund/reversal writes; qualifying evidence uses its server-held effective date.
- Given a group filter, when a report contains mixed-group invoices, then group billed totals exclude unrelated lines and every whole-invoice event remains unallocated rather than inferred.
- Given a denied preview, expired/revoked export, filter change, or School switch, when Admin renders, then it clears stale protected action state and shows an accessible server-confirmed explanation.

## Design Notes

`CoverageRefundEligibility` is an append-only authorization fact, not a replacement enrollment lifecycle. A withdrawal can create it atomically from the roster transition; transfer-out and eligible service cancellation need an explicit Finance/School Admin evidence command with operation/audit provenance.

## Verification

**Commands:**
- `set -a && source .env.test && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Finance release suite passes.
- `pnpm --filter @passionedu/admin-web test` -- expected: Admin Finance regressions pass.
- `pnpm --filter @passionedu/api typecheck && pnpm --filter @passionedu/admin-web typecheck` -- expected: both packages compile.
- `pnpm test:mockups && git diff --check` -- expected: mockup contracts and whitespace checks pass.
