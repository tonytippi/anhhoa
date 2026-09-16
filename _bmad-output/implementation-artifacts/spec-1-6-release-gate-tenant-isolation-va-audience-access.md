---
title: 'Story 1.6: Release gate về tenant isolation và audience access'
type: 'feature'
created: '2026-09-16'
status: 'draft'
review_loop_iteration: 0
followup_review_recommended: false
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

- `apps/api/src/integration/membership.integration.test.ts:14-98` -- PostgreSQL proof hiện hữu cho membership A/B, tenant graph, idempotency partial index, audit/Operation scope; tái dùng fixture/pattern cho gate API.
- `apps/api/src/integration/ops.provision.integration.test.ts:12-42` -- lifecycle, suspension và typed audit/Operation provenance proof hiện hữu.
- `apps/api/src/integration/auth.persistence.integration.test.ts:50-120` -- persistence/session fixture để mở rộng matrix audience qua HTTP boundary thay vì service-only.
- `apps/api/src/modules/{auth,authorization,memberships,ops}/*.controller.ts` -- các REST surface hợp lệ cho audience cookie, chooser/context, membership command/Operation và School lifecycle.
- `apps/api/src/modules/auth/auth.controller.test.ts:14-69` -- unit coverage CORS, host-only cookie, wrong-audience rejection và Parent callback fail-closed; giữ regression và nâng phần gate cần HTTP/DB.
- `apps/api/prisma/schema.prisma:40-162` -- tenant graph hiện có; chưa có ParentProfile, Student hoặc StudentParent, là read-only evidence cho dependency Story 2.3.
- `apps/web/src/school-context.test.tsx:8-29`, `apps/teacher-web/src/school-context.test.tsx:5-8`, `apps/ops-web/src/shell.test.tsx:27-36`, `apps/parent-web/src/auth-session.test.ts:4-10` -- portal regression cho clear state, dirty/timeout, restricted navigation và Parent safe state.
- `apps/web/playwright.config.ts:3-11`, `apps/web/package.json:6-12`, `package.json:5-12`, `turbo.json:3-9` -- Admin Playwright config chưa có spec/script và workspace gate chưa chạy E2E; cần khai báo task release gate rõ ràng.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-16-tenant-isolation-gate.md` -- quyết định đã phê duyệt: Epic 1 kiểm Parent fail-closed; Story 2.3 sở hữu proof Parent-link/cross-School.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:17-24` -- chỉ chuyển Story 1.6/epic-1 sau khi toàn bộ E1 release gate pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/release-gate.integration.test.ts` cùng fixture/helper integration hiện hữu -- thêm PostgreSQL + HTTP release suite cho two-School membership, crafted route/UUID/header/filter context, scoped uniqueness, audit/Operation provenance, revoke/suspend next request và four-audience cookie rejection; chỉ dùng route/domain đã tồn tại.
- `apps/api/src/modules/{auth,authorization,memberships,ops}/*.controller.test.ts` -- giữ/củng cố boundary regression rằng reject xảy ra trước transition và không trả protected DTO/audit/Operation.
- `apps/{web,teacher-web,ops-web,parent-web}/src/**/*test.*` -- mở rộng regression portal cho deep-link/revoke safe state, visible context, dirty switch, focus và timeout reconciliation; Parent chỉ chứng minh signed-out safe state trong Epic 1.
- `apps/web/e2e/release-gate.spec.ts`, `apps/web/package.json`, `package.json`, `turbo.json` -- thêm browser gate chạy được bằng script/Turbo với API + PostgreSQL fixture thật, hoặc dừng blocked nếu topology hiện hữu không thể khởi tạo four audience portals mà không tạo domain mới; đảm bảo workspace gate gọi suite này.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển `1-6` và `epic-1` sang `done` sau review và tất cả lệnh E1 gate pass; Parent-link proof được theo dõi/verify tại Story 2.3.

**Acceptance Criteria:**
- Given fixture PostgreSQL hai School và identity/membership audience hiện hữu, when release suite gửi crafted context vào mọi REST surface Epic 1 hiện có, then UUID/route/header context cross-School bị từ chối, scoped uniqueness và audit/Operation provenance được chứng minh tự động.
- Given membership hoặc School A revoke/suspend trong khi identity còn context B, when request tiếp theo và portal deep-link/foreground chạy, then A bị deny, protected state bị xóa về chooser/safe state, và B còn dùng được.
- Given browser gate chạy các switch clean, dirty và timeout trên các portal có surface Epic 1, when user đổi School/audience, then visible context, guard/focus state, audience isolation và Operation reconciliation pass; script gate lỗi làm CI/Turbo task lỗi.
- Given Parent audience chưa có active Parent-Student link domain, when session/callback hoặc protected access được thử, then server và portal fail-closed không lộ data; suite không tuyên bố coverage Parent cross-School link trước Story 2.3.

## Design Notes

Release gate là aggregation layer, không phải authorization implementation khác. Browser runner phải khởi tạo API với database riêng và fixture server-authoritative; `vite preview` đơn lẻ chỉ cho confidence giả vì không chứng minh cookie, origin và resolver chain.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: Prisma client/migrations thành công.
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- expected: release-gate PostgreSQL/HTTP suite và integration hiện hữu pass trên database riêng.
- `pnpm --filter @passionedu/admin-web test && pnpm --filter @passionedu/teacher-web test && pnpm --filter @passionedu/parent-web test && pnpm --filter @passionedu/ops-web test` -- expected: portal safe-state regressions pass.
- `pnpm test:e2e` -- expected: browser release gate chạy API/PostgreSQL fixture thật và fail process khi tenant/audience assertion lỗi.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && git diff --check` -- expected: workspace quality, test và build pass, không whitespace error.

## Auto Run Result

Status: draft

Blocking condition đã được giải quyết bằng proposal được Tony phê duyệt ngày 2026-09-16: Story 1.6 chỉ gate contract Epic 1 và Parent fail-closed; Story 2.3 sở hữu proof `StudentParent` đa School, revoke và chooser. Sprint status giữ nguyên cho đến khi E1 release gate được triển khai, review và pass.
