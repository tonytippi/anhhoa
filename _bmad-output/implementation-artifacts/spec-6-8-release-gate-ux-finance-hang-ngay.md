---
title: 'Release gate UX Finance hằng ngày'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_commit: 'f372bdd49cf916138d19a63ac18fff558da9baef'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-16-finance-table-first-catalog-va-giam-tru.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-17-dot-thu-table-first-va-ra-soat-draft-tuan-tu.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-6-7-hang-doi-thu-tien-va-settlement-tuan-tu.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 5.16, 5.17 and 6.7 have focused unit/component and PostgreSQL proof, but the Finance daily-work release lacks complete cross-layer evidence. Playwright is non-hermetic because it does not load `.env.test` or explicitly set portal origins, and the release suite does not prove key menu/dialog, Draft-next, receipt timeout/next, queue cursor/tenant, and responsive cases.

**Approach:** Make E2E startup explicitly use the isolated `.env.test` database and local audience origins, then extend Finance API integration and Admin browser tests to prove daily table-first flows remain accessible, tenant-safe and reconciliation-safe under cursor, filter, timeout, concurrent and responsive conditions.

## Boundaries & Constraints

**Always:** E2E and integration use only URLs supplied by root `.env.test`; never use development `.env` database or origins. Playwright explicitly supplies `NODE_ENV=test`, `DATABASE_URL=$E2E_DATABASE_URL`, `APP_WEB_ORIGIN=http://localhost:5173` and matching local audience origins to the started API/portals. Test fixtures preserve server authority: queues remain School/cursor/filter-bound, receipt remains one Invoice and Operation reconciliation happens before retry/next. Browser assertions use real UI keyboard/focus and responsive behavior, not private component state.

**Ask First:** Changing Finance business behavior, production environment configuration, security policy outside test startup, or weakening test isolation to reuse a developer server.

**Never:** Do not change Finance money/lifecycle/authorization contracts, use development database, hardcode real credentials, bypass CSRF/Operation through test-only product paths, hide a failing gate by skipping it, or add Parent/Payroll scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| E2E startup | Root `.env.test` has E2E database URL | Migrate/seed/API/portals start against isolated E2E DB and explicit local origins | Missing required test env fails before server starts |
| Receipt queue API | Multi-School issued/closed rows, cursor/filter variants | Only authorized issued minimal rows return in stable pages | Malformed, foreign, filter-mismatched cursor and revoked capability deny safely |
| Keyboard dialogs | Finance row menu and confirmation dialog | Menu receives keyboard focus; dialog traps/restores focus | Escape/Tab/blur dismiss according to pending state |
| Draft/receipt sequence | Multiple authorized queue items | Explicit previous/next uses refreshed server queue after terminal result | Timeout/concurrent/filter/revoke blocks next until reconcile/reload |
| Responsive access | Narrow Admin viewport | Table scroll/card keeps identifying data and row/next actions reachable | No hover-only or clipped operational action |

</frozen-after-approval>

## Code Map

- `package.json` -- root E2E script currently requires inherited `E2E_DATABASE_URL`; load root `.env.test` before validation and command dispatch.
- `apps/web/playwright.config.ts` -- current web-server environment forwards only DB URL; explicitly load/validate test env and inject audience origins for hermetic API/browser startup.
- `apps/web/e2e/finance-release-gate.spec.ts` -- existing release fixture; extend browser proof for menu/dialog focus, Draft next, receipt timeout/reconcile/next and narrow viewport.
- `apps/api/src/integration/finance.integration.test.ts` -- real PostgreSQL receipt-queue fixtures; add multi-page cursor, foreign/filter cursor, cross-School/revoked capability and HTTP minimal DTO assertions.
- `apps/api/src/modules/finance/finance.service.test.ts` -- retain fast malformed cursor and filter/order boundary coverage.
- `apps/web/src/finance/finance-workspace.test.tsx`, `receipt-queue-workspace.test.tsx` -- existing component regression proof; only add coverage if E2E/API tests expose an actual missing behavior.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `apps/web/playwright.config.ts` -- make Finance browser tests load and validate root `.env.test`, use only `E2E_DATABASE_URL`, and explicitly configure local audience origins.
- [ ] `apps/api/src/integration/finance.integration.test.ts`, `apps/api/src/modules/finance/finance.service.test.ts` -- prove real queue pagination/cursor/tenant/capability/minimal DTO conditions absent from the previous stories.
- [ ] `apps/web/e2e/finance-release-gate.spec.ts` -- prove keyboard/focus row-menu/dialog behavior, Draft previous/next, receipt timeout reconciliation then explicit refreshed next, and narrow viewport action reachability.
- [ ] Relevant API/Admin tests -- run the complete Finance UX gate against `.env.test`, recording any external test-environment failure instead of marking the gate passed.

**Acceptance Criteria:**
- Given a local developer runs the documented E2E command, when `.env.test` is present, then migration, seed, API and portals use the isolated E2E database and explicit local origins without depending on API development `.env` values.
- Given multi-School queue fixtures, when cursor/filter/capability cases run through real API integration, then only authorized minimal `ISSUED` rows in stable pages are returned and malformed/foreign/mismatched cursor requests deny.
- Given a Finance keyboard user opens table actions and dialogs, when navigating with arrows, Tab and Escape, then menu/dialog focus behavior matches the approved accessibility contract.
- Given Draft or Receipt completion is uncertain or changes queue eligibility, when user attempts next, then exactly one mutation is reconciled and next becomes available only from an authorized refreshed response.
- Given a narrow Admin viewport, when Finance tables and detail actions render, then row menus, confirmation and explicit next remain reachable without hover-only interaction.

## Design Notes

The gate is intentionally test/harness work. It reuses the existing mutable single-worker release fixture, but makes its environment explicit so the result cannot depend on a developer’s local API `.env`. A browser timeout test should proxy one receipt POST through the real API then return a 504, proving the server outcome is reconciled instead of duplicated.

## Verification

**Commands:**
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: full PostgreSQL Finance suite uses `anhhoa_test` only.
- `pnpm --filter @passionedu/api typecheck` -- expected: API build passes.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx src/finance/receipt-queue-workspace.test.tsx src/school-context.test.tsx` -- expected: component regressions pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin build passes.
- `pnpm test:e2e -- finance-release-gate.spec.ts` -- expected: Playwright starts hermetically from `.env.test` and Finance UX release assertions pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Hermetic Release Harness**

- Root release command sources `.env.test` before validating isolated test databases.
  [`package.json:15`](../../package.json#L15)

- Playwright overrides ambient values and injects explicit test-only API origins and credentials.
  [`playwright.config.ts:1`](../../apps/web/playwright.config.ts#L1)

**Finance Safety Proof**

- PostgreSQL integration proves queue cursor, tenant, capability and minimal DTO behavior.
  [`finance.integration.test.ts:2115`](../../apps/api/src/integration/finance.integration.test.ts#L2115)

- Browser release flow proves Draft refresh navigation and receipt reconciliation before explicit next.
  [`finance-release-gate.spec.ts:24`](../../apps/web/e2e/finance-release-gate.spec.ts#L24)

**Release Evidence**

- Scope gate verifies the hardened queue/reconciliation evidence and release command structure.
  [`finance-release-scope.integration.test.ts:46`](../../apps/api/src/integration/finance-release-scope.integration.test.ts#L46)
