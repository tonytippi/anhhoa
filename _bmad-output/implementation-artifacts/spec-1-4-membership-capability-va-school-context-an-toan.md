---
title: 'Story 1.4: Membership, capability và School context an toàn'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: '6b71dc32453f6ce4d84227853ca997270442444d'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/implementation-artifacts/decision-story-1-4-membership-capability-2026-09-16.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Nền tảng đã có global identity, audience session và bootstrap `SCHOOL_ADMIN`, nhưng chưa có server resolver cho School context, capability hay quản trị membership. Do đó Admin/Staff chưa thể chọn School, nhận navigation được cấp quyền, hoặc bị revoke ở request kế tiếp một cách có thể kiểm chứng.

**Approach:** Xây dựng authorization và membership domain server-authoritative, School chooser/context cùng Admin và Teacher shell tối thiểu, đồng thời chứng minh tenant isolation, revoke và suspension bằng PostgreSQL integration cùng portal tests.

## Boundaries & Constraints

**Always:** Cookie session chỉ xác thực identity/audience; mỗi request phải resolve active same-School membership, grant, capability và School `ACTIVE` trước mọi lookup scoped. `schoolId` trong URL chỉ là selector. Mọi access mutation phải audit School, actor identity/membership, action, reason và provenance; StaffProfile/assignment không được tự cấp login, membership hoặc role. Chỉ ba preset release đầu được cấp: `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`; không tạo permission-checkbox UI hoặc grant capability attendance/handover trước Epic 4.

**Block If:** Dừng nếu cần capability nghiệp vụ ngoài `SCHOOL_CONTEXT_READ`/`ACCESS_MANAGE`, reactivation membership, thay đổi semantics role additive/replace hoặc access mutation không idempotent. Các thay đổi đó cần decision artifact mới.

**Never:** Không nhúng School role/capability vào session; không coi UUID, header, filter, browser state hay StaffProfile là bằng chứng authorization; không để grant tham chiếu membership/identity khác School; không giữ hay render protected state School A sau revoke/switch; không làm business domain của Epic 2/4/6.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Context discovery | Identity có membership active tại nhiều School | API trả chooser/context và navigation là projection capability do server resolve | Selector School không active bị từ chối trước lookup business data |
| Revoke một School | Membership A revoked, membership B active | Request tiếp theo A bị từ chối, B vẫn dùng được với cùng global identity session | Portal xóa state A và về chooser/safe state, không sign-out B |
| Access mutation | School Admin có quyền quản trị access tại selected School | Chỉ membership/grant cùng School được thay đổi, có reason và audit | Cross-School graph, preset chưa phát hành hoặc thiếu quyền bị từ chối atomically |
| School switch | Form dirty hoặc Operation chưa chắc kết quả | Chỉ remain, discard trước submit hoặc reconcile Operation | Không auto-save, silent switch hay retry trước reconciliation |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma:29-39,90-120,122-161` -- enum preset hiện còn `STAFF`/`TEACHER`; `SchoolRoleGrant` có ba FK độc lập nên chưa ngăn cross-School membership/identity graph; AuditRecord/Operation là persistence nền cần áp dụng theo quyết định scope.
- `apps/api/prisma/migrations/20260916000003_ops_school_lifecycle/migration.sql:1-30` -- mẫu migration additive; không sửa migration baseline đã áp dụng.
- `apps/api/src/modules/auth/auth.service.ts:94-107` -- `session()` xác minh audience cookie và identity, phải là đầu vào cho resolver thay vì đưa School authorization vào session.
- `apps/api/src/modules/auth/auth.controller.ts:29-44`, `apps/api/src/modules/ops/ops.controller.ts:12-17` -- mẫu session route và exact-origin/double-submit CSRF cho cookie mutation.
- `apps/api/src/modules/ops/ops.service.ts:14-18` -- mẫu grant authorization được resolve server-side mỗi request; không tái dùng PlatformOperatorGrant cho School access.
- `apps/api/src/app.module.ts:1-7` -- cần đăng ký các domain `authorization`, `memberships` và khi cần `schools`, theo AD-2.
- `apps/api/src/main.ts:20-30` -- CORS audience routes hiện đã nhận School/Operation path; xác minh contract mới còn trong allowlist.
- `packages/contracts/src/index.ts:4-11` -- nơi thêm DTO/validator REST thuần cho chooser, context, navigation và access management; không chứa policy.
- `apps/web/src/main.tsx:5-17`, `apps/web/src/auth-session.ts:1-26` -- Admin shell placeholder và pattern bootstrap/logout/clear protected display.
- `apps/teacher-web/src/main.tsx:4`, `apps/teacher-web/src/auth-session.ts:1-7` -- Teacher shell placeholder; giữ app độc lập và chỉ gọi REST.
- `apps/ops-web/src/ops-schools.tsx:14-22` -- tham chiếu hành vi clear-safe, reconciliation timeout và dialog focus; sao chép hành vi cần thiết, không import xuyên portal.
- `apps/api/src/integration/auth.persistence.integration.test.ts:50-120`, `apps/api/src/integration/ops.provision.integration.test.ts:13-22` -- fixture/pattern PostgreSQL cho identity pending, membership bootstrap, revoke và race.
- `apps/web/src/shell.test.tsx:8-26`, `apps/teacher-web/src/shell.test.tsx:8-26` -- regression safe-state hiện có cho session/logout.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration additive dưới `apps/api/prisma/migrations/` -- thay preset legacy bằng ba preset phát hành, ràng buộc SchoolRoleGrant vào membership/identity cùng School bằng composite tenant graph, và giữ history/audit/Operation phù hợp access mutation.
- `apps/api/src/modules/authorization/`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts` -- tạo resolver School context dùng session audience hiện có, re-resolve School active/membership/grant/capability ở mọi request, và export capability/nav projection cho `app`/`teacher` mà không đưa policy vào browser.
- `apps/api/src/modules/memberships/`, `packages/contracts/src/index.ts` -- cung cấp chooser/context, Admin-only create/revoke/replace-role REST commands cùng exact-origin/CSRF, UUID idempotency/Operation replay-conflict, actor/reason/provenance audit và guard School Admin cuối cùng.
- `apps/api/src/modules/auth/` -- chỉ mở rộng điểm tích hợp session/error khi cần, không nhúng School role hay capability vào cookie/session DTO global.
- `apps/api/src/modules/{authorization,memberships}/**/*.test.ts`, `apps/api/src/integration/membership*.test.ts` -- test resolver/capability và PostgreSQL proof cho graph integrity, revoke/suspension request kế tiếp, isolation A/B, access mutation/audit/idempotency, audience boundary và pending owner.
- `apps/web/src/{main.tsx,auth-session.ts,school-context.tsx,*.css}`, tests tương ứng -- thay Admin placeholder bằng chooser/context/nav REST, access management tối thiểu, switch guard và clear protected state khi 401/403/revoke/suspend; heading luôn có School name và focus sau route/switch.
- `apps/teacher-web/src/{main.tsx,auth-session.ts,school-context.tsx,*.css}`, tests tương ứng -- thay Teacher placeholder bằng chooser/context/nav projection REST và clear-safe/switch guard, không thêm access-management UI hay capability nghiệp vụ.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 1.4 theo trạng thái workflow sau khi implementation/review hoàn tất.

**Acceptance Criteria:**
- Given UserIdentity có membership active với preset khác nhau tại hai School, when gọi chooser hoặc route `/schools/:schoolId/`, then API resolve active School/membership/grant/capability trên từng request và chỉ trả navigation server-granted, còn URL, UUID, filter, header hoặc browser state không thể chứng minh quyền.
- Given `SCHOOL_ADMIN` có `ACCESS_MANAGE` tại School A, when tạo membership, revoke hoặc replace tập preset tại A với command idempotent hợp lệ, then chỉ graph cùng School thay đổi atomically, audit lưu actor/reason/provenance và request kế tiếp dùng quyền mới; StaffProfile/assignment không thể tạo access và School B không bị ảnh hưởng.
- Given School Admin là admin cuối cùng, when tự revoke hoặc tự hạ quyền khiến School không còn `SCHOOL_ADMIN`, then API từ chối trước transition và không tạo audit/Operation state thay đổi quyền.
- Given cùng command access gửi lại với actor/route/key/fingerprint giống nhau, when timeout hoặc retry, then API replay outcome Operation đã lưu; fingerprint khác conflict và client reconcile Operation trước retry.
- Given membership A bị revoke hoặc School A suspended trong khi B vẫn active, when identity gửi request kế tiếp cho từng context, then A bị deny trước scoped lookup, B tiếp tục dùng được và portal xóa toàn bộ protected state A mà không hiển thị stale content.
- Given Admin hoặc Teacher chuyển School, when state sạch thì context đổi theo server; when form dirty thì chỉ remain hoặc discard trước submit; when mutation chưa chắc kết quả thì chỉ reconcile và retry bị khóa cho đến outcome server.
- Given Admin và Teacher viewport desktop/hẹp, when chooser/context/nav/safe state hiển thị, then selected School name có trong heading, capability không được cấp không có navigation, dialog/focus/keyboard semantics hoạt động và Teacher không có access-management surface.

## Design Notes

`SCHOOL_CONTEXT_READ` là capability nền cần thiết để API trả chooser/context và navigation, không phải capability nghiệp vụ. `ACCESS_MANAGE` chỉ được expose trong Admin audience; Teacher audience không nhận access-management REST surface dù cùng UserIdentity có membership. Revoke xóa grant trong transaction để request kế tiếp không còn nguồn capability; server vẫn re-resolve context theo School selector nên access hợp lệ tại School khác không bị ảnh hưởng.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: migration tenant graph/capability hợp lệ trên PostgreSQL.
- `pnpm --filter @passionedu/api test && pnpm --filter @passionedu/api test:integration` -- expected: resolver, access mutation, audit/idempotency, tenant graph, revoke/suspension/audience proof pass.
- `pnpm --filter @passionedu/web test && pnpm --filter @passionedu/teacher-web test` -- expected: chooser/context/nav/switch guard/clear-state portal tests pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: toàn workspace pass, không có cross-app hoặc API internal import.

## Auto Run Result

Status: done

PostgreSQL integration requires an explicit empty test database target:
`TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration`.

Blocking condition đã được giải quyết bởi `decision-story-1-4-membership-capability-2026-09-16.md`.

Đã triển khai authorization School context server-authoritative, Admin-only membership management, capability projection theo audience và chooser/switcher an toàn cho Admin/Teacher. Schema/migration thay preset legacy bằng ba preset phát hành, bổ sung composite tenant graph cho grant, audit và Operation; command access dùng CSRF, origin, idempotency, audit và final-admin guard được serialize.

Review đã áp dụng 12 patch: projection Teacher không lộ `ACCESS_MANAGE`; deny context giữ global session và về chooser; final-admin serialization; composite tenant FKs cho grant/audit/Operation; School ACTIVE revalidation; reconciliation không bypass suspension; guards cho stale bootstrap/context/mutation. Final signoff: không có finding.

Verification pass: `pnpm --filter @passionedu/api prisma:generate`; `pnpm --filter @passionedu/api prisma:migrate:deploy`; PostgreSQL integration (18 tests) với `TARGET_INTEGRATION_DATABASE_URL`; portal tests; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `git diff --check`.

Residual risk: integration cố ý yêu cầu `TARGET_INTEGRATION_DATABASE_URL` để không migration/seed vào database không xác định.

## Review Triage Log

### 2026-09-16 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 7, medium 5, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - [high] [patch] Enforce app-only `ACCESS_MANAGE`/access navigation server-side; preserve chooser instead of global sign-out on denied School context.
  - [high] [patch] Serialize final-admin transitions, revalidate active School, and scope Operation reconciliation by School, actor and active lifecycle.
  - [high] [patch] Add composite tenant FKs for SchoolRoleGrant, AuditRecord and Operation membership paths with negative PostgreSQL proof.
  - [high] [patch] Prevent stale bootstrap, selected-context, mutation and reconciliation responses from restoring or overwriting protected portal state.
  - [medium] [patch] Implement additive role-set UI, named reason confirmation dialog, timeout reconciliation restore and regression coverage for portal recovery.
  - [medium] [patch] Expand controller and PostgreSQL proof for CSRF/origin/idempotency, cross-School IDs, role replacement, suspension and concurrent final-admin behavior.
