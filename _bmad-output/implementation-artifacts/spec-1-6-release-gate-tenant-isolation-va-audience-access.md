---
title: 'Story 1.6: Release gate về tenant isolation và audience access'
type: 'feature'
created: '2026-09-16'
status: 'done'
baseline_revision: 'fa693fbad09d14475be85c788bc939f04d3ef268'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Bằng chứng tenant isolation, audience session và state an toàn hiện phân tán theo Story 1.2-1.5; chưa có release gate duy nhất bắt buộc chạy trước khi mở Epic 2. Đồng thời phạm vi Parent link đa trường được AC nêu ra chưa tồn tại trong schema hay API cho đến Story 2.3.

**Approach:** Tạo release-gate suite có thể chạy cho các contract Epic 1 hiện hữu: PostgreSQL/HTTP chứng minh tenant graph, revoke/suspend, audit/Operation và audience isolation; portal regression chứng minh chooser, clear protected state, switch guard và reconciliation. Giữ Parent audience fail-closed, không giả lập Parent link bằng client-provided School context.

## Boundaries & Constraints

**Always:** School là tenant root; mọi proof phải qua outermost API/portal surface đang tồn tại, dùng fixture PostgreSQL ít nhất hai School và không chỉ gọi service nội bộ. Cookie/mutation proof giữ exact audience origin, double-submit CSRF, capability, idempotency và actor-context Operation authorization. Gate phải thất bại rõ ràng khi bất kỳ suite isolation nào lỗi; valid context khác của cùng identity vẫn hoạt động sau revoke/suspend context A. Parent chưa có active `StudentParent` phải fail-closed, không trả protected DTO hay cache protected response.

**Block If:** Để đáp ứng gate phải tạo ParentProfile, Student, StudentParent, Parent chooser hoặc School business query/report/filter/aggregate mới; các aggregate đó thuộc Story 2.1-2.3 và không thể được thay bằng fixture hay browser state giả. Parent-link/cross-School chooser/revoke proof là release gate bắt buộc của Story 2.3 theo proposal đã phê duyệt, không phải điều kiện hoàn tất Epic 1.

**Never:** Không thêm schema/domain Epic 2, không nới authorization chỉ để test, không dùng School UUID/header/filter/browser state làm bằng chứng quyền, không coi component test mock `fetch` là browser E2E, không đánh dấu Story/Epic done nếu release-gate không chạy được hoặc còn lỗi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Tenant context bị tráo | Identity có membership A/B gửi School A UUID/Operation/membership vào context B | API từ chối trước transition/lookup bảo vệ; scoped key A/B độc lập và Operation không lộ chéo | Không có audit, Operation hay state mới cho request bị từ chối |
| Revoke hoặc suspend A | Context A bị revoke/suspend, identity còn valid context B | Request/deep-link A bị deny; portal xóa protected state và đưa chooser/safe state; B vẫn dùng được | Không render stale protected content hoặc tự retry mutation |
| Cookie khác audience | Cookie Admin/Teacher/Ops/Parent gửi endpoint audience khác | 401 và không protected DTO; Parent chưa có link vẫn fail-closed | Không phát hành/đổi session hay cache protected response |
| Dirty/timeout switch | User đổi School/audience khi form dirty hoặc Operation chưa chắc chắn | Hiện remain/discard/reconciliation, visible School context, focus hợp lệ và mutation bị khóa đến khi reconcile | Không auto-save, silent switch hoặc retry mù |

</intent-contract>

## Code Map

- `apps/api/src/integration/{membership,ops.provision,auth.persistence}.integration.test.ts` -- fixture/pattern PostgreSQL cho two-School membership, lifecycle, provenance, canonical identity; release gate mới phải qua Nest HTTP boundary thay vì chỉ gọi service.
- `apps/api/src/{main.ts,modules/auth/auth.service.ts,modules/auth/auth.config.ts}` -- `createApi()`/CORS, callback deterministic chỉ ở `NODE_ENV=test`, audience cookie/origin defaults; runner E2E riêng phải listen API mà không thay production bootstrap.
- `apps/api/src/modules/{auth,authorization,memberships,ops}/*.controller.ts` -- REST surface cho audience session, chooser/context, membership command/Operation và lifecycle School được release suite gọi.
- `apps/api/prisma/seed.ts` -- seed development một School là read-only evidence; thêm fixture E2E riêng, không làm seed thường chứa authorization graph cho gate.
- `apps/api/prisma/schema.prisma:40-162` -- tenant graph hiện có; chưa có ParentProfile, Student hoặc StudentParent, là read-only evidence cho dependency Story 2.3.
- `apps/{web,teacher-web,ops-web,parent-web}/src/**/*test.*` -- regression cho clear state, dirty/timeout, restricted navigation và Parent signed-out safe state; add assertions only where source behavior is not already covered.
- `apps/web/{playwright.config.ts,package.json,e2e/release-gate.spec.ts}` -- Playwright hiện chỉ preview Admin trên `127.0.0.1`; chuyển sang topology `localhost` API + bốn portal và test browser thật với cookie/callback test-only.
- `{apps/api/package.json,apps/api/{src/e2e-api.ts,scripts/seed-e2e-release-gate.ts},package.json,turbo.json}` -- scripts runner/fixture và non-cached E2E/release-gate tasks; build E2E portal phải nhận `VITE_API_URL=http://localhost:3000`.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-16-tenant-isolation-gate.md` -- quyết định đã phê duyệt: Epic 1 kiểm Parent fail-closed; Story 2.3 sở hữu proof Parent-link/cross-School.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:17-24` -- chỉ chuyển Story 1.6/epic-1 sau khi toàn bộ E1 release gate pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/release-gate.integration.test.ts` -- thêm PostgreSQL + Nest HTTP release suite: two-School membership, crafted School/membership/Operation selectors, scoped uniqueness, audit/Operation provenance, reject-before-transition, revoke/suspend request tiếp theo và four-audience rejection; chỉ gọi REST E1 hiện hữu.
- `apps/api/{src/e2e-api.ts,scripts/seed-e2e-release-gate.ts}`, `apps/api/package.json` -- thêm server test-only và fixture deterministic hai School/membership/Ops grant dùng database E2E riêng; không sửa production bootstrap hoặc thêm Parent aggregate.
- `apps/{web,teacher-web,ops-web,parent-web}/src/**/*test.*` -- bổ sung regression source-anchored cho deep-link/revoke safe state, visible context, dirty switch/focus và timeout reconciliation; Parent chỉ chứng minh signed-out safe state trong Epic 1.
- `apps/web/{playwright.config.ts,package.json,e2e/release-gate.spec.ts}`, `package.json`, `turbo.json` -- thêm browser gate chạy API/PostgreSQL fixture thật trên exact `localhost` origins, login deterministic qua test OAuth callback và non-cached root/Turbo scripts `test:e2e`/`test:release-gate`; gate phải fail process khi assertion lỗi.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển `1-6` và `epic-1` sang `done` sau review và tất cả lệnh E1 gate pass; Parent-link proof được theo dõi/verify tại Story 2.3.

**Acceptance Criteria:**
- Given fixture PostgreSQL hai School và identity/membership audience hiện hữu, when release suite gửi crafted context vào mọi REST surface Epic 1 hiện có, then UUID/route/header context cross-School bị từ chối, scoped uniqueness và audit/Operation provenance được chứng minh tự động.
- Given membership hoặc School A revoke/suspend trong khi identity còn context B, when request tiếp theo và portal deep-link/foreground chạy, then A bị deny, protected state bị xóa về chooser/safe state, và B còn dùng được.
- Given browser gate chạy với API/PostgreSQL fixture thật trên Admin, Teacher, Parent và Ops, when user đổi School/audience trong trạng thái clean, dirty và timeout hoặc suspend School A, then visible context, guard/focus state, audience isolation, safe fallback và Operation reconciliation pass; script gate lỗi làm CI/Turbo task lỗi.
- Given Parent audience chưa có active Parent-Student link domain, when session/callback hoặc protected access được thử, then server và portal fail-closed không lộ data; suite không tuyên bố coverage Parent cross-School link trước Story 2.3.

## Design Notes

Release gate là aggregation layer, không phải authorization implementation khác. Browser runner giữ `NODE_ENV=test` để dùng callback OIDC deterministic có sẵn, nhưng khởi tạo `createApi()` bằng runner riêng, PostgreSQL E2E riêng và bốn Vite previews trên `localhost`; `vite preview` đơn lẻ hoặc mocked `fetch` chỉ tạo confidence giả vì không chứng minh cookie, origin và resolver chain.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: Prisma client/migrations thành công.
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- expected: release-gate PostgreSQL/HTTP suite và integration hiện hữu pass trên database riêng.
- `pnpm --filter @passionedu/admin-web test && pnpm --filter @passionedu/teacher-web test && pnpm --filter @passionedu/parent-web test && pnpm --filter @passionedu/ops-web test` -- expected: portal safe-state regressions pass.
- `E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_e2e" pnpm test:e2e` -- expected: browser release gate chạy API/PostgreSQL fixture thật và fail process khi tenant/audience assertion lỗi.
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" E2E_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_e2e" pnpm test:release-gate` -- expected: HTTP/PostgreSQL, portal regression và browser E2E mandatory gate pass tuần tự.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && git diff --check` -- expected: workspace quality, test và build pass, không whitespace error.

## Auto Run Result

Status: done

Đã thêm release gate E1 có thể chạy: PostgreSQL/Nest HTTP suite kiểm tenant selector, idempotency theo School, audit/Operation provenance, revoke, suspend, origin/CSRF và ma trận audience; browser gate chạy API cùng bốn portal trên `localhost`, deterministic OAuth cookie thật, switch guard, timeout reconcile, foreground suspension safe fallback và Parent fail-closed. Fixture E2E reset transactionally theo advisory lock, không dùng Parent domain Epic 2.

Files chính: `apps/api/src/integration/release-gate.integration.test.ts` (HTTP gate), `apps/api/src/e2e-api.ts` và `apps/api/scripts/seed-e2e-release-gate.ts` (runner/fixture), `apps/web/e2e/release-gate.spec.ts` (browser gate), `apps/web/src/school-context.tsx` (foreground revalidation và uncertain-mutation reconcile), package/Turbo scripts (mandatory gate).

Review findings: 7 patch (high 2, medium 4, low 1), 0 deferred, 0 rejected. Patches xử lý fixture deterministic, provenance/idempotency/revoke/suspend HTTP proof, full audience matrix, foreground safe fallback, và reconciliation terminal. Follow-up review recommended: true (2 high patches).

Verification pass: `prisma:generate`; `prisma:migrate:deploy`; API integration `31/31`; Admin `11/11`, Teacher `3/3`, Parent `3/3`, Ops `4/4`; browser E2E `4/4`; `pnpm test:release-gate`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `git diff --check`.

Residual risk: deterministic OAuth is available only in `NODE_ENV=test`; the production Google upstream and production HTTPS cookie transport still require deployment-environment validation. Parent multi-School active-link/chooser/revoke proof remains intentionally owned by Story 2.3.

## Review Triage Log

### 2026-09-17 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 2, medium 4, low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - [high] [patch] Revalidated an already-open School context on foreground and proved suspension clears protected Admin content before chooser fallback.
  - [high] [patch] Extended HTTP audience proof to issue Admin/Teacher/Ops sessions and reject every mismatched audience, while retaining Parent fail-closed.
  - [medium] [patch] Made the E2E fixture deterministic and isolated from stale local services; normalized the API bind host.
  - [medium] [patch] Replaced direct revoke fixture mutation with authenticated HTTP proof and asserted state, scoped idempotency, audit and Operation provenance.
  - [medium] [patch] Kept uncertain mutation input/dirty state until a real Operation terminal outcome reloads membership and unlocks controls.
  - [medium] [patch] Added Ops HTTP suspension provenance and next-request denial proof.
  - [low] [patch] Corrected implementation spec runner path and removed stale blocked-run result.
