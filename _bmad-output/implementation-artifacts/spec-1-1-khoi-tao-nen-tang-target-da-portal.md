---
title: 'Story 1.1: Khởi tạo nền tảng target đa portal'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
baseline_commit: '832ed71d79a0b2d2a55eb1f49715485d19e64ce7'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repository hien tai con substrate Anh Hoa single-school, nen khong the an toan lam nen cho tenant isolation, audience session va domain PassionEdu. Thieu Teacher, Ops, shared packages, target database va deployment boundary theo Architecture Spine.

**Approach:** Thay the scaffold legacy bang pnpm/Turborepo clean-break gom API modular monolith va bon PWA doc lap, voi shared packages chi pure. Tao target Prisma migration/seed resettable va Compose pilot build tu source, route TLS tach biet cho nam host.

## Boundaries & Constraints

**Always:** Dung Node 22, pnpm 11.9, TypeScript, React/Vite, NestJS/Prisma/PostgreSQL; `School` la tenant root trong target schema; Prisma/migrations chi o `apps/api/prisma`; portal chi goi REST va khong import app khac/API internals; packages khong chua business state; secrets chi qua environment; production deployment chi dung `prisma migrate deploy`, khong `db push`; Admin shell khong co mutation destination cho attendance, handover hoac DailyJournal.

**Ask First:** Dung neu build clean-break phat hien operational database/data can duoc giu, hoac can thay doi Architecture Spine de them production backup, registry, cloud, monitoring hay destructive rollback strategy.

**Never:** Khong chay song song, convert, hay them compatibility layer cho schema/API/session/UI/seed Anh Hoa; khong commit secret; khong implement OAuth, membership/capability, School lifecycle hay tenant authorization business flow cua Story 1.2-1.6; khong copy mockup tenant data thanh runtime authority.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build workspace | Root target workspace sau scaffold | Turbo build/typecheck bao gom API, Admin, Teacher, Parent, Ops va pure packages; khong co cross-app import | Build that bai neu workspace dependency graph vi pham boundary |
| Reset development/test DB | Target migration va seed duoc chay tren database rong | Chi target multi-school baseline duoc tao; khong co Admin/template/invoice lifecycle legacy | Migration/seed that bai atomically, khong fallback schema legacy |
| Pilot deployment | Compose nhan environment secrets va TLS cert tu ben ngoai Git | Proxy route app, teacher, parent, ops, api toi container rieng; Postgres dung durable volume; migrate hoan tat truoc API | Compose fail-fast khi bien bat buoc thieu; khong expose secret trong image hay repository |

</frozen-after-approval>

## Code Map

- `package.json`, `pnpm-workspace.yaml`, `turbo.json` -- root workspace hien tai con ten/scope Anh Hoa va chi discover `apps/*`; mo rong package graph target va standard scripts.
- `apps/api/package.json`, `apps/api/Dockerfile`, `apps/api/src/` -- API legacy; thay bootstrap/module graph va image build de API la owner duy nhat cua Prisma/module target.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts` -- legacy global Admin, Class, Student, Invoice/template; reset thanh target multi-school migration va seed.
- `apps/web/`, `apps/parent-web/` -- legacy Admin/Parent shells; thay bang PWA target audience rieng, chi co safe placeholder shell va REST client boundary.
- `apps/teacher-web/`, `apps/ops-web/` -- tao PWA target doc lap; Teacher la audience duy nhat co operational placeholder, Ops khong co School business-data destination.
- `packages/contracts/`, `packages/ui/` -- tao contracts/validators pure va stateless visual primitives, khong import app hay API internals.
- `deploy/compose/`, `.env.example` -- tao pilot Compose/proxy route nam host, durable PostgreSQL, migrate-first va documented external secret contract; thay root Compose legacy deployment path.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- read-only inventory cho shell boundary; mockup HTML khong la runtime contract.

## Tasks & Acceptance

**Execution:**
- [x] Root manifests and workspace config -- rename/configure PassionEdu pnpm/Turbo graph for `apps/*` and `packages/*`, consistent build, lint, typecheck and test scripts -- make all target units independently buildable.
- [x] `apps/api/` and `apps/api/prisma/` -- replace legacy bootstrap, schema, committed migration and seed with minimal multi-school modular-monolith substrate; configure validated environment and migration-only production workflow -- establish API/database ownership without legacy lifecycle.
- [x] `apps/web/`, `apps/teacher-web/`, `apps/parent-web/`, `apps/ops-web/` -- build four independently configured React/Vite PWAs with audience identity, accessible shell, REST-only client boundary and PWA configuration -- enforce portal separation, including Teacher deployment at `teacher.passionedu.org`.
- [x] `packages/contracts/` and `packages/ui/` -- add pure REST contracts/validators and stateless UI primitives with package exports -- allow constrained reuse without shared browser authority.
- [x] `deploy/compose/`, Dockerfiles and deployment documentation -- replace legacy Compose path with source-built pilot stack, TLS reverse proxy host routes, durable Postgres volume, external secrets and migrate-before-API dependency -- make pilot deploy topology testable without promising production controls.
- [x] Workspace/API/portal deployment tests -- add automated structural, build and configuration checks covering package boundaries, target schema/seed, Teacher host, five proxy routes, secret-free tracked files and migration deployment command -- prevent regression to legacy or unsafe deployment paths.

**Acceptance Criteria:**
- Given repository o clean-break initiative, when workspace scaffold hoan tat, then `apps/api`, `apps/web`, `apps/teacher-web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui` va `deploy/compose` ton tai trong pnpm/Turborepo target, and portal khong import app khac hay API internals.
- Given Teacher PWA duoc build/deploy, when proxy nhan request `teacher.passionedu.org`, then request duoc route den Teacher container doc lap, and Admin shell khong co attendance, handover hay DailyJournal mutation destination.
- Given target API khoi dong, when committed migration va reset seed chay, then Prisma chi nam trong `apps/api/prisma` va tao multi-school baseline, and legacy single-school schema, seed, lifecycle, compatibility path hay production `db push` khong con ton tai.
- Given pilot Compose duoc cau hinh voi environment secrets ben ngoai Git, when images build tu source tren VPS, then TLS proxy route `app`, `teacher`, `parent`, `ops`, `api` den container tuong ung va PostgreSQL dung durable volume, and migration chay truoc API version can migration trong khi destructive rollback bi tu choi.

## Design Notes

Teacher la host thu nam du AC Compose liet ke bon route, vi AD-1 va AD-4 cua Architecture Spine bat buoc audience/host Teacher doc lap. Story nay chi tao shell/substrate; route protected, session cookie va operational mutation se duoc them trong Story 1.2-1.5.

## Verification

**Commands:**
- `pnpm install --frozen-lockfile` -- expected: lockfile va workspace graph hop le.
- `pnpm build` -- expected: API, bon portal va packages build thanh cong.
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: static checks va structural/unit suites pass.
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy && pnpm --filter @passionedu/api prisma:seed` -- expected: target schema migration va seed chay ma khong co legacy model.
- `docker compose --env-file deploy/compose/.env.example -f deploy/compose/compose.yaml config` -- expected: Compose topology, nam host route va durable volume validate khong can secret that.

## Suggested Review Order

**Target API and data ownership**

- Starts the clean-break modular API and validates configured runtime port.
  [`main.ts:1`](../../apps/api/src/main.ts#L1)

- Defines the tenant root plus minimal scoped Epic 1 persistence primitives.
  [`schema.prisma:1`](../../apps/api/prisma/schema.prisma#L1)

- Commits the sole target baseline schema for clean databases.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260916000000_target_multi_school_baseline/migration.sql#L1)

- Requires explicit development authorization before fixture tenant creation.
  [`seed.ts:1`](../../apps/api/prisma/seed.ts#L1)

**Portal isolation**

- Includes all target apps and pure packages in the workspace graph.
  [`pnpm-workspace.yaml:1`](../../pnpm-workspace.yaml#L1)

- Establishes the independent Teacher PWA audience shell.
  [`vite.config.ts:1`](../../apps/teacher-web/vite.config.ts#L1)

- Makes Parent caching explicit and excludes protected API/media responses.
  [`vite.config.ts:1`](../../apps/parent-web/vite.config.ts#L1)

**Pilot deployment**

- Orders clean migration, healthy services and TLS proxy startup.
  [`compose.yaml:1`](../../deploy/compose/compose.yaml#L1)

- Routes every fixed audience host to its dedicated container.
  [`Caddyfile:1`](../../deploy/compose/Caddyfile#L1)

- Provides fallback routing for future portal deep links.
  [`nginx.conf:1`](../../deploy/compose/nginx.conf#L1)

**Regression proof**

- Guards source boundaries, legacy removal and deployment topology.
  [`structure.test.ts:1`](../../packages/contracts/src/structure.test.ts#L1)

- Exercises the health endpoint through Nest's HTTP boundary.
  [`health.controller.test.ts:1`](../../apps/api/src/modules/health/health.controller.test.ts#L1)
