---
title: 'Story 2.1 Follow-up: Harden Class contracts and PostgreSQL verification'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: 'ee5e67323cd684581c931869768e4079e312c6ea'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-story-2-1-review-2026-08-19.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1 works, but its delivered API and web contracts differ from the approved review decisions: Class records embed Students, list ordering/paging differs, archived Classes remain editable, and PostgreSQL migration/archive behavior cannot be verified repeatably.

**Approach:** Align the Class API and page to the approved resource and lifecycle contracts, then provide an isolated Docker Compose PostgreSQL test service and scripted integration verification that applies migrations to a clean database.

## Boundaries & Constraints

**Always:** Keep `/classes` Admin-authenticated through the existing global guard and cookie CSRF/origin protection; REST remains camelCase with list `{ data, meta }` and action `{ data }`; Class returns `activeStudentCount` only, never embedded Student records; name is trimmed, nonempty and at most 100 characters while duplicates remain allowed; list order is `createdAt DESC, id DESC`; an out-of-range page returns empty `data` and valid metadata for the requested page; `ARCHIVED` Classes are read-only; archive remains idempotent and returns `CLASS_HAS_ACTIVE_STUDENTS` with `metadata.activeStudentCount`; archive retains serializable transaction semantics; client acquires CSRF before a write, never automatically replays a write, and returns control with retained form data after a bounded create/update timeout; all test database credentials are non-secret local defaults documented in `.env.example`-style configuration or Compose only.

**Ask First:** Stop if a portable PostgreSQL integration harness needs a new production deployment dependency, a CI provider/workflow, an idempotency protocol for Class create/update, or any Student assignment/activation endpoint or concurrency test beyond an archive-side lock/revalidation convention.

**Never:** Do not modify frozen final planning artifacts; do not add Student CRUD/list UI to Story 2.1; do not embed an unbounded Student list in Class responses; do not hard-delete Classes; do not auto-retry/replay writes; do not introduce real credentials, `prisma db push`, or an automated database reset that can target a non-test database.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List Class | Valid filter/page, including page beyond result count | Ordered `createdAt DESC, id DESC`; response keeps requested page and returns `{ data: [], meta }` when beyond results | Invalid status/page remains DTO validation error |
| Class resource | List/detail/create/update/archive response | Contains JSON-safe money and `activeStudentCount`; contains no Student names/array | Invalid response is rejected by web parser |
| Update archived Class | `PATCH` targets `ARCHIVED` resource | No record change | Standard state-conflict error shown while form remains open |
| Save timeout | Create/update write exceeds client deadline | Exactly one write request; dialog stays open with typed values and reconciliation guidance | Timeout is explicit; no automatic replay |
| PostgreSQL verification | Fresh Compose test database | Migrations deploy, archive succeeds with no active Students and rejects with count when present | Test setup only accepts the dedicated test database URL |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/classes/classes.dto.ts:5-17` -- reduce only Class name maximum from 120 to 100; status/page validation already exists.
- `apps/api/src/modules/classes/classes.service.ts:7-63` -- replace included Student records with filtered relation count, use approved ordering/requested page behavior, and reject archived updates without changing archive idempotency/error behavior.
- `apps/api/src/common/errors/domain.exception.ts:1-10` and `apps/api/src/common/filters/api-exception.filter.ts:1-23` -- reuse the existing domain-error envelope; add a Class archived state error only if the current public-code allowlist supports it.
- `apps/api/src/modules/classes/classes.service.test.ts:1-59` -- update mocked-service assertions for count-only serialization, ordering, page behavior, name boundary, and archived update rejection.
- `apps/api/prisma/migrations/20260819010000_add_classes_and_students/migration.sql:1-27` -- existing committed migration is the subject of clean-database deploy verification; do not alter historical SQL unless a real migration defect appears.
- `apps/api/package.json:6-15`, `apps/api/vitest.config.ts:1-11`, `apps/api/prisma.config.ts:1-13` -- add explicit migration/integration scripts and a separate test configuration/environment that cannot run against an arbitrary database URL.
- `docker-compose.test.yml` (new) -- isolated PostgreSQL test service with health check, fixed non-production local values, named volume, and a non-default host port.
- `apps/api/src/modules/classes/classes.integration.test.ts` (new) -- PostgreSQL-backed Class archive/list/resource contract tests after migrations; reuse Prisma/Nest setup patterns without a mock database.
- `apps/web/src/features/classes/api.ts:4-32` -- parse `activeStudentCount`, remove Student-array contract, and make one-write/no-retry behavior explicit in mutation configuration/tests.
- `apps/web/src/features/classes/page.tsx:17-56` -- show count only, hide edit for archived Classes, enforce 100-character name input/validation, and surface a timeout-specific reconciliation message while retaining form state.
- `apps/web/src/app/api/client.ts:21-43` -- add bounded write timeout with `AbortController`, a typed timeout error, and no replay path; keep CSRF single-flight before the write.
- `apps/web/src/features/classes/page.test.tsx` and `apps/web/src/app/api/client.test.ts` -- revise fixtures and cover archived actions, name boundary, count-only response, timeout retention, and one write request.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/classes/classes.dto.ts`, `classes.service.ts`, and Class/error tests -- align validation, deterministic list serialization, count-only resource responses, archived update guard, and unit coverage with the approved contract.
- [x] `apps/api/package.json`, `apps/api/vitest.integration.config.ts` or equivalent, `apps/api/src/modules/classes/classes.integration.test.ts`, and `docker-compose.test.yml` -- provide a dedicated Compose PostgreSQL database, migration deploy command, and integration test command that only target the test database.
- [x] `apps/web/src/app/api/client.ts` and `client.test.ts` -- add a bounded unsafe-request timeout that raises a distinguishable error after one request with no replay.
- [x] `apps/web/src/features/classes/api.ts`, `page.tsx`, and `page.test.tsx` -- consume count-only Class data, make archived rows read-only, apply name limit, and retain form values plus reconciliation guidance after a timeout.

**Acceptance Criteria:**
- Given an authenticated Admin requests Classes, when records span multiple timestamps or the requested page has no results, then the API returns only Class data plus `activeStudentCount` ordered by `createdAt DESC, id DESC`, and preserves the requested empty page in metadata.
- Given an Admin submits a Class name, when it is whitespace-only or longer than 100 characters, then API and web validation reject it; equal normalized names remain allowed.
- Given an archived Class, when an Admin views the list or submits an update, then the web offers no edit action and the API persists no update while returning the standard state error.
- Given a Class create/update request stalls beyond the configured deadline, when the client times out, then exactly one write was sent, the dialog remains open with its values, and the Admin receives guidance to refresh/reconcile before manually resubmitting.
- Given the dedicated Compose PostgreSQL database is fresh, when the verification command runs, then committed migrations deploy and integration tests prove archive success, active-Student rejection with `activeStudentCount`, and count-only Class responses.

## Design Notes

The follow-up deliberately establishes only the archive-side transaction convention. Story 2.2 owns the counterpart mutation and the real archive-versus-assignment race test once assignment/reactivation endpoints exist. The integration harness must fail closed: its command constructs or validates a dedicated test URL instead of accepting a developer's general `DATABASE_URL`.

## Verification

**Commands:**
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: dedicated PostgreSQL test service is healthy.
- `pnpm --filter api prisma:generate` -- expected: Prisma client generation succeeds.
- `pnpm --filter api test:integration` -- expected: applies committed migrations to the dedicated clean test database and passes Class integration coverage.
- `pnpm --filter api test` -- expected: Class and existing API unit tests pass.
- `pnpm --filter web test -- src/app/api/client.test.ts src/features/classes/page.test.tsx` -- expected: count-only, read-only archived, validation, timeout retention, and no-replay tests pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: full workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: test service and test data are removed after local verification.

## Suggested Review Order

**Class Contract**

- Count-only serialization, deterministic lists, and atomic archived-state protection.
  [`classes.service.ts:16`](../../apps/api/src/modules/classes/classes.service.ts#L16)

- Public state-conflict codes remain constrained to the standard error envelope.
  [`domain.exception.ts:3`](../../apps/api/src/common/errors/domain.exception.ts#L3)

- DTO transformation enforces the normalized 100-character name boundary.
  [`classes.dto.ts:12`](../../apps/api/src/modules/classes/classes.dto.ts#L12)

**Web Mutation Safety**

- One deadline covers CSRF preparation and the write without replaying either request.
  [`client.ts:30`](../../apps/web/src/app/api/client.ts#L30)

- The Class page exposes counts, archived read-only rows, and recoverable empty pages.
  [`page.tsx:21`](../../apps/web/src/features/classes/page.tsx#L21)

- Response parsing rejects malformed resource timestamps and impossible pagination metadata.
  [`api.ts:10`](../../apps/web/src/features/classes/api.ts#L10)

**Repeatable Verification**

- The integration command provisions, migrates, tests, and tears down only its dedicated database.
  [`test-integration.ts:4`](../../apps/api/scripts/test-integration.ts#L4)

- PostgreSQL contract tests cover count-only data and archive success/blocking behavior.
  [`classes.integration.test.ts:14`](../../apps/api/src/modules/classes/classes.integration.test.ts#L14)

- Compose supplies an ephemeral isolated PostgreSQL service on the test-only port.
  [`docker-compose.test.yml:1`](../../docker-compose.test.yml#L1)
