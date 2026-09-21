---
title: 'Story 5.6: Release gate Finance Admin MVP'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '0d23400483ca91111e7390b82e52dd41a3d066dd'
baseline_commit: '0d23400483ca91111e7390b82e52dd41a3d066dd'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-finance-admin-mvp.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-6-resumable-collection-run-generation-2026-09-21.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance Admin MVP can only release after automated evidence proves the complete catalog-to-issue flow preserves tenant isolation, server-owned VND, immutable snapshots, lifecycle safety, and retry/concurrency behavior. The required 1,000-Student generate proof additionally requires an observable server Operation progress signal.

**Approach:** Consolidate existing Finance PostgreSQL, unit, and Admin UI evidence into a release-gate suite; add the missing authenticated Finance browser fixture and E2E flow. Implement a server-authoritative progress contract for CollectionRun generate before declaring the gate complete.

## Boundaries & Constraints

**Always:** Preserve the Finance Admin MVP boundary: `FINANCE_MANAGE`, same-School graph validation, transaction reauthorization, cookie origin plus double-submit CSRF, UUID `Idempotency-Key`, actor-scoped Operation reconciliation, audit/provenance, PostgreSQL `BIGINT`, JSON-safe REST values, and no client-calculated total/status. Gate coverage must prove manual Finance-source data remains explanatory and never imports, queries, or prices from attendance, Teacher, Parent, service, promotion, or Payroll domains.

**Block If:** The durable generation job cannot preserve its enqueue-time roster snapshot, exact-once final publish and actor-scoped reconciliation under a process restart, pause/resume or tenant revoke.

**Never:** Do not mark the story or sprint tracker done from existing `PENDING -> COMPLETED` reconciliation alone. Do not weaken the acceptance criterion in tests, report client-estimated progress, add Teacher/Parent/attendance/service/promotion/Payroll dependencies, or pull receipt, settlement, close, revision, or Parent invoice work into this gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Existing database gate | Two Schools, catalog, roster, accounts, run and DRAFT Invoice | Shared preview/generate selection, integer VND, snapshots, locks, scoped uniqueness, issue snapshot and DB immutability remain proven | Cross-School, inactive/wrong account and injected state/money are rejected |
| Retry and race | Identical and changed fingerprints; concurrent generate/issue | Same request replays one actor-scoped Operation outcome; changed key conflicts; no duplicate Invoice/audit | UI reconciles the retained Operation before retry |
| Performance gate | 1,000 eligible Students in one generated run | Server exposes authoritative progress while generate completes in <= 60 seconds or a durable failure/retry-safe outcome | Never infer success from browser elapsed state |

</intent-contract>

## Code Map

- `apps/api/src/modules/finance/finance.service.ts` -- `selectionPreview()` is shared by preview/generate; `mutate()` creates a `PENDING` Operation then writes `COMPLETED` with final outcome, and `operation()` returns only `{ id, status, outcome }`; this is the unresolved progress gap.
- `apps/api/src/integration/finance.integration.test.ts` -- existing real PostgreSQL proof for catalog isolation, shared selection, roster snapshots, generate/issue idempotency and races, DRAFT lines, immutable issue snapshots, plus 1,000-Student preview/generate timing; reuse its fixture/helpers for release-gate assertions.
- `apps/api/src/modules/finance/finance.controller.ts` and `finance.controller.test.ts` -- Finance mutation boundary applies origin/CSRF guard but controller tests currently mock the service; add authenticated HTTP-level proof only after the progress contract is resolved.
- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/` -- current Operation persistence has no processed/total/phase projection; a durable progress design may require schema and migration changes.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- generic E2E fixture lacks `FINANCE_MANAGE`, FinancePolicy, BankAccounts, catalog, SchoolYear/Class/enrollment and Finance run data required for a real Finance E2E flow.
- `apps/web/e2e/release-gate.spec.ts` -- existing browser gate covers generic audience/tenant behavior, not Finance preview, generate, DRAFT review, issue, or Finance School-switch behavior.
- `apps/web/src/finance/finance-workspace.tsx` and `finance-workspace.test.tsx` -- browser already reconciles Operations and covers mocked server values, focus/errors, immutable issued view and stale-response protection; it has no server progress projection to render.
- `apps/api/scripts/test-integration.ts` -- canonical integration runner reads `TARGET_INTEGRATION_DATABASE_URL`, deploys migrations, seeds, then runs all PostgreSQL integration tests.

## Tasks & Acceptance

**Execution:**
- `_bmad-output/planning-artifacts/architecture/` or a new approved decision artifact -- select and record the authoritative generate-progress design, including atomicity, retry/reconciliation semantics, failure state, persistence and API projection -- resolves the release-blocking ambiguity before code changes.
- `apps/api/prisma/schema.prisma`, a new Finance migration, `apps/api/src/modules/finance/finance.service.ts`, and `finance.controller.ts` -- after the decision, persist and return server-authoritative generate progress/failure state without weakening scoped idempotency, audit, unique Invoice or snapshot guarantees -- fulfills the 1,000-Student progress AC.
- `apps/api/src/integration/finance.integration.test.ts` and any focused HTTP integration test -- map every Story 5.6 API/database criterion to explicit assertions, including progress updates/failure reconciliation, then retain timing proof on the configured dedicated PostgreSQL target -- makes release evidence observable at the required surface.
- `apps/api/scripts/seed-e2e-release-gate.ts` and `apps/web/e2e/finance-release-gate.spec.ts` -- seed two-School Finance graph and test preview, named generate, DRAFT review/manual source, issue, switch/revoke safe state, timeout reconciliation, text state and no stale School result through real browser/API boundaries -- closes Finance-specific E2E coverage.
- `apps/web/src/finance/finance-workspace.tsx` and `finance-workspace.test.tsx` -- render only server-returned progress and terminal Operation outcomes with accessible text state; preserve focus/error and reconciliation behavior -- no client-estimated success/progress.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- change Story 5.6 to `done` only after all release-gate commands pass and this spec reaches `done` -- tracker remains truthful.

**Acceptance Criteria:**
- Given a two-School PostgreSQL fixture with catalog, SchoolYear, enrollment lifecycle, BankAccounts, CollectionRun and Invoice, when the release suite executes catalog through issue, then shared selection, positive integer VND, snapshots, unique Invoice and lifecycle locks pass while all cross-School, inactive/wrong account, injected total/status and post-issue mutation cases are rejected.
- Given concurrent or retried generate/issue commands, when identical retry, changed fingerprint and timeout reconciliation run, then one Invoice per Student/run and one durable appropriate Operation/audit outcome result, with no duplicate post.
- Given the Admin Finance E2E fixture, when a Finance Manager previews, generates, reviews manual source data and issues an Invoice across valid, timeout and context-switch states, then it shows only server values and accessible text/focus/error/reconciliation states without stale School data or deferred-domain dependencies.
- Given 1,000 eligible Students, when generate runs, then an API-returned durable Operation reports its approved server-authoritative progress and reaches completion within 60 seconds, or exposes a retry-safe server failure outcome without client-estimated success.

## Design Notes

The existing single transaction protects generate from partial Invoice writes but cannot make intermediate durable progress observable without an approved change to its execution boundary. The decision must preserve the transaction's same-School reauthorization, `(schoolId, studentId, collectionRunId)` uniqueness, request fingerprint replay and final audit/Operation outcome; a UI-only counter would violate the API-authority invariant.

## Auto Run Result

Status: blocked

Previous blocking condition resolved: accepted decision `decision-story-5-6-resumable-collection-run-generation-2026-09-21.md` selects an asynchronous, durable, resumable generation job with a final atomic publish.

Previous blocking condition resolved: `apps/api/scripts/seed-e2e-release-gate.ts` now creates a Finance-capable two-School fixture, and `apps/web/e2e/finance-release-gate.spec.ts` covers the required browser flow.

Summary: CollectionRun generate now accepts an idempotent command as a durable `PENDING` Operation, snapshots selection facts at enqueue, stages work through a leased batch worker, exposes only server-returned progress, supports pause/resume, and atomically publishes Invoices plus `READY -> GENERATED` only after all work is staged. No partial Invoice becomes visible before final publish.

Files changed:
- `apps/api/prisma/schema.prisma` and migration `20260921000015_collection_run_async_generation` -- durable generation job/item models, statuses, scoped uniqueness and progress counter constraints.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts`, `finance.module.ts`, and `collection-run-generation.worker.ts` -- asynchronous generation, actor-scoped progress read, lease/checkpoint worker, final atomic publish and protected pause/resume routes.
- `apps/api/src/modules/finance/finance.controller.test.ts` and `apps/api/src/integration/finance.integration.test.ts` -- mutation protection, durable progress, pause/resume, restart-safe staging and 1,000-Student performance proof.
- `apps/web/src/finance/finance-workspace.tsx` and `finance-workspace.test.tsx` -- Operation polling and accessible server-authoritative generation progress.
- `_bmad-output/implementation-artifacts/decision-story-5-6-resumable-collection-run-generation-2026-09-21.md` -- accepted execution and resume contract.

Verification performed:
- `pnpm --filter @passionedu/api typecheck` -- pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- pass.
- `pnpm typecheck` -- pass.
- `pnpm --filter @passionedu/api test` -- pass.
- `pnpm --filter @passionedu/admin-web test` -- pass, 74 tests.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` from `apps/api` -- pass, 8 PostgreSQL test files / 86 tests; 42 migrations, including `20260921000015`, applied/validated.
- `git diff --check` -- pass.

Final verification performed:
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- pass, 6 browser tests including Finance catalog/preview/async progress/DRAFT review/issue/switch boundary.
- `set -a && source apps/api/.env && set +a && pnpm test:release-gate` -- pass: 8 PostgreSQL integration files / 86 tests; Admin 74 tests; Teacher 7 tests; Parent 4 tests; Ops 6 tests; browser E2E 6 tests.

Residual risks: the worker uses the API process as its executor, relying on PostgreSQL claim/lease for multi-instance safety. The existing `pg` concurrent-query deprecation warning still appears during integration and should be resolved before upgrading to pg v9.

Evidence gathered:
- `epics-passionedu.md:994-997` requires observable Operation progress and <= 60-second completion.
- `apps/api/src/modules/finance/finance.service.ts` exposes only Operation `status` and final `outcome`; the current mutation lifecycle is `PENDING` then `COMPLETED`.
- `apps/api/src/integration/finance.integration.test.ts` already proves 1,000-Student generate timing but cannot prove intermediate progress that is not persisted or returned.
- Existing Finance E2E seed and browser suite do not create a Finance-capable graph, so Finance flow E2E remains required after the progress design is selected.

## Verification

**Commands to run after the blocking decision and implementation:**
- `pnpm --filter @passionedu/api test` -- expected: Finance service/controller tests pass.
- `set -a && source apps/api/.env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` -- expected: dedicated PostgreSQL target migrates/seeds and all integration tests, including Finance release-gate proof, pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace UI tests pass.
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- expected: Finance browser release-gate fixture and E2E pass against `E2E_DATABASE_URL`.
- `set -a && source apps/api/.env && set +a && pnpm test:release-gate` -- expected: all configured integration, portal unit and browser release gates pass.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace type/tests and whitespace checks pass.
