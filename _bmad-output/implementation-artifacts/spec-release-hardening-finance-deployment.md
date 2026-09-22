---
title: 'Release hardening: Finance finality va deployment readiness'
type: 'bugfix'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6e80a527b979fe0f69e9aaf14ec21bbeb92d88ce'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/specs/spec-passionedu/SPEC.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Release review found that a valid issued-Invoice revision makes its CollectionRun impossible to close, a normal DRAFT Invoice can be issued after its SchoolYear closes, and the documented Compose deployment cannot supply the API's required auth configuration. The root deployment instructions also describe a removed topology.

**Approach:** Align service and PostgreSQL finality rules with the issued-revision contract, reject normal issue against closed run/year boundaries, then make the Compose environment contract and root runbook match the deployed Caddy topology. Add regression evidence at database and configuration-documentation boundaries.

## Boundaries & Constraints

**Always:** Preserve School-scoped authorization, transaction reauthorization, idempotency, audit, VND `BIGINT`, immutable issued snapshots, and forward-only Prisma migration policy. `ISSUED` and valid revision-source `CANCELLED` are the only terminal Invoice states accepted for closing a generated CollectionRun. A closed SchoolYear or CollectionRun must prevent normal DRAFT-to-ISSUED transitions in both service and PostgreSQL direct-write paths. Deployment examples must contain placeholders only; production API must receive every required audience/auth variable and still fail fast when it is absent.

**Ask First:** Stop if fixing the discovered paths requires changing Invoice lifecycle semantics beyond terminal `ISSUED`/`CANCELLED`, changing the public hostnames, adding cloud/Tunnel infrastructure, or modifying deployed secrets.

**Never:** Do not edit historical migrations, weaken DB guards, introduce receipt/settlement/Parent behavior, add secrets to Git, or claim a real VPS/OAuth/TLS smoke test without its infrastructure credentials.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Close revised run | Generated run has an `ISSUED` replacement and its valid `CANCELLED` source | Close succeeds, persists the terminal lifecycle transition and retains both immutable invoices | Any DRAFT or other nonterminal Invoice still blocks closure |
| Issue after finality | Normal DRAFT Invoice belongs to a closed SchoolYear or CollectionRun | API rejects without issue snapshot, audit transition, or completed outcome; direct database write is also rejected | Return the established finality conflict without cross-School disclosure |
| Compose startup contract | Operator supplies the tracked Compose example with real values held outside Git | API receives all strict audience, OAuth, session, and bootstrap settings after migrations | Missing required values fail Compose interpolation or API startup clearly |
| Deployment instructions | Operator follows root README | Commands target `deploy/compose/compose.yaml` and document Caddy's five hosts, TLS mount, migration-before-API, and durable volume | No legacy Nginx, Tunnel, or `.env.production.example` path remains |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.service.ts` -- `issueInvoice()` at lines 268-290 needs the existing `lockRun()`/`lockYear()` finality check already used by `issueRevision()`; `closeRun()` around lines 1288-1304 must accept the terminal revision source state.
- `apps/api/prisma/migrations/20260922000001_correct_collection_run_close_guards/migration.sql` -- existing trigger functions define the prior hard-coded close predicate; preserve this migration and supersede functions with a new forward migration.
- `apps/api/prisma/migrations/20260922000005_invoice_revision_closed_year_guard/migration.sql` -- established revision closed-year guard; do not alter its historical SQL.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL suite has revision coverage around lines 1065-1085 and close/finality coverage around lines 1467-1551; extend these seams for API and direct-write regressions.
- `deploy/compose/compose.yaml` -- API service environment at lines 26-40 currently omits strict production auth variables.
- `deploy/compose/.env.example` -- add non-secret placeholders for every API variable Compose forwards.
- `apps/api/src/main.ts` and `apps/api/src/modules/auth/auth.config.ts` -- read-only runtime authority for strict environment requirements.
- `README.md` -- replace obsolete deployment section beginning at line 62 with the tracked Compose/Caddy route.
- `deploy/compose/README.md` and `deploy/compose/Caddyfile` -- read-only canonical deployment commands and five-host topology.
- `packages/contracts/src/structure.test.ts` -- repository structure test seam for Compose env and root runbook regression assertions.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/finance/finance.service.ts` -- allow `CANCELLED` alongside `ISSUED` when closing a generated run and lock/check its CollectionRun and SchoolYear before normal issuance -- preserve revision finality and closed-year read-only boundaries.
- [x] `apps/api/prisma/migrations/20260922000006_collection_run_terminal_and_normal_issue_finality/migration.sql` -- redefine existing trigger functions using `CREATE OR REPLACE FUNCTION` so DB closure accepts only `ISSUED`/`CANCELLED` and direct `DRAFT -> ISSUED` writes reject closed SchoolYears -- keep service/DB authority aligned without historical migration edits.
- [x] `apps/api/src/integration/finance.integration.test.ts` -- prove a revised run closes, nonterminal Invoices still block it, and API/direct-write normal issue is rejected after run/year finality -- cover all matrix cases against PostgreSQL.
- [x] `deploy/compose/compose.yaml` and `deploy/compose/.env.example` -- forward and document all strict auth/audience variables with required interpolation and placeholders -- make a clean pilot deployment config-complete without tracking secrets.
- [x] `README.md` and `packages/contracts/src/structure.test.ts` -- replace legacy instructions and lock the current Compose/Caddy deployment contract by structural regression tests -- prevent future topology drift.

**Acceptance Criteria:**
- Given a valid source Invoice revision in a generated run, when its replacement is issued and the run is closed, then the run reaches `CLOSED`; a run containing any state other than `ISSUED` or `CANCELLED` remains unclosable.
- Given a normal DRAFT Invoice in a closed SchoolYear or CollectionRun, when Finance issues it through the API or an actor attempts the equivalent direct database status write, then it is rejected and the Invoice remains unissued.
- Given a deployment environment derived from `deploy/compose/.env.example`, when `docker compose -f deploy/compose/compose.yaml config` is evaluated with all required values, then the API receives its strict auth/audience configuration; each required variable is represented in both tracked files.
- Given an operator follows the root deployment guide, when preparing a pilot deployment, then it uses the current Compose/Caddy topology, all five fixed hosts, migration-before-API, TLS certificate mount, and durable PostgreSQL volume without legacy topology guidance.

## Design Notes

The `CANCELLED` state is not a generic cancellation: existing database revision guards only permit it as the immutable source of an issued replacement. It is therefore terminal for CollectionRun closure, while `DRAFT` remains blocking. The forward migration must replace functions only, preserving trigger names and current database instances.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller contracts pass.
- `set -a && source apps/api/.env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL finality and direct-write regressions pass.
- `pnpm --filter @passionedu/contracts test` -- expected: Compose/runbook structure regressions pass.
- `pnpm typecheck && pnpm test && pnpm build && git diff --check` -- expected: workspace verification passes.
- `set -a && source apps/api/.env && set +a && pnpm test:release-gate` -- expected: release gate passes on the final commit.

## Suggested Review Order

**Finance Finality**

- Align normal issue with CollectionRun and SchoolYear finality locks.
  [`finance.service.ts:268`](../../apps/api/src/modules/finance/finance.service.ts#L268)

- Permit only completed obligations or valid cancelled revision sources when closing.
  [`finance.service.ts:1288`](../../apps/api/src/modules/finance/finance.service.ts#L1288)

- Preserve database authority for terminal close and direct normal issue writes.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260922000006_collection_run_terminal_and_normal_issue_finality/migration.sql#L1)

- Prevent closing a SchoolYear into an unresolvable generated-DRAFT finance state.
  [`roster.service.ts:1502`](../../apps/api/src/modules/roster/roster.service.ts#L1502)

**Deployment Contract**

- Forward every strict API startup setting through the production service.
  [`compose.yaml:26`](../../deploy/compose/compose.yaml#L26)

- Keep non-secret pilot host and auth placeholders complete and explicit.
  [`.env.example:1`](../../deploy/compose/.env.example#L1)

- Give operators one current Caddy/Compose deployment route.
  [`README.md:62`](../../README.md#L62)

**Regression Evidence**

- Exercise revision close, closed-year, closed-run, and close-year cross-workflow boundaries.
  [`finance.integration.test.ts:1481`](../../apps/api/src/integration/finance.integration.test.ts#L1481)

- Detect deployment environment and runbook drift in repository tests.
  [`structure.test.ts:29`](../../packages/contracts/src/structure.test.ts#L29)
