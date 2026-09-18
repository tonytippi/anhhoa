---
title: 'Story 2.3: Liên kết Parent pending và revoke theo từng học sinh'
type: 'feature'
created: '2026-09-17'
status: 'done'
baseline_revision: 'e39ec6702785a677dfa5759bfdac123576caa0ed'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-16-tenant-isolation-gate.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/student-parent-links.html'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School Admin chưa thể tạo và quản lý liên kết Parent-Học sinh, trong khi Parent callback bị fail-closed hoàn toàn và không có nguồn authorization theo từng trẻ để cấp hoặc thu hồi Parent access an toàn.

**Approach:** Thêm ParentProfile platform-global và StudentParent School-scoped có lịch sử; Admin quản lý link từ Danh bộ; Parent Google callback bind atomically và Parent context chỉ dựa trên active link được recheck server-side, với proof PostgreSQL/E2E cho multi-School và revoke từng trẻ.

## Boundaries & Constraints

**Always:** School là tenant root cho StudentParent query/write, audit và Admin Operation; resolve Admin `ROSTER_MANAGE` trước Student/link lookup. Pending command cần normalized email, full name và phone; không tạo Parent login, membership hoặc role. `ParentProfile` global chỉ đến School qua `StudentParent` ACTIVE, có `schoolId` và composite FK tới Student cùng School; revoke giữ history/audit. Admin cookie mutations phải exact Origin, double-submit CSRF, UUID `Idempotency-Key` và `X-Operation-Id`, replay cùng fingerprint và reconcile timeout. Parent callback dùng verified normalized Google email, bind identity và recheck active link trong một transaction trước cookie issue; mọi Parent context/protected request recheck active link + School ACTIVE, không tin URL/UUID/filter/cookie state. Revoke có hiệu lực request kế tiếp cho đúng child/School, nhưng không xóa quyền của active link khác.

**Block If:** PostgreSQL migration hoặc transaction boundaries hiện hữu không thể bảo đảm composite tenant graph, atomic callback binding/active-link recheck, hoặc revoke-next-request mà không làm yếu contract đã duyệt.

**Never:** Không hard-delete/revoke toàn bộ Parent session một cách mù quáng; không tạo password/default role/SchoolMembership cho Parent pending; không dùng ParentProfile global như bằng chứng School authorization; không trả Parent DTO rộng hơn chooser/context tối thiểu; không cache authenticated Parent response; không auto-replay Admin mutation; không triển khai Parent operational domain (attendance, finance, journal) trong story này.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo hoặc tái kích hoạt link | Admin ROSTER_MANAGE, Student cùng School, email/name/phone hợp lệ | ParentProfile pending được create/reuse và StudentParent ACTIVE được create/reactivate, audit + completed Operation School-scoped | DTO server-confirmed; không tạo login/role |
| Input/tenant sai | Email/name/phone không hợp lệ, Student/link UUID foreign, School/membership inactive | Không có durable Parent/link/audit/Operation thành công và không lộ aggregate foreign | Field errors hoặc denied/not-found chuẩn |
| Parent bind | Google verified email khớp pending profile có ACTIVE link | Transaction bind one-to-one identity, recheck active link rồi issue Parent cookie | Subject mismatch, email reassigned hoặc final link revoked bị deny, không cookie |
| Context/revoke multi-link | Parent có active/revoked links qua >=2 School; một link bị revoke | Route/filter/UUID child/school ngoài active graph bị deny trước protected query; affected state về chooser hoặc signed-out, link khác vẫn truy cập được | Minimum DTO, no stale/cached protected state |
| Timeout/retry Admin | Kết quả create/revoke chưa chắc chắn | Portal giữ input/Operation ID và GET Operation trước submit khác | Không POST lại tự động |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Student` đã có `(schoolId,id)` composite unique; thêm ParentProfile global, `StudentParent`, status/history fields và UserIdentity relation mà không biến ParentProfile thành tenant aggregate.
- `apps/api/prisma/migrations/20260917000001_student_enrollment_history/migration.sql` -- mẫu graph roster composite; migration Parent mới phải mang `schoolId` cùng FK `(schoolId,studentId)` tới Student và retained link uniqueness.
- `apps/api/src/modules/roster/roster.service.ts` -- `actor()`, `mutate()`, `student()` và audit/Operation transaction là mẫu Admin command tenant-safe cần tái dùng hoặc trích xuất tối thiểu.
- `apps/api/src/modules/roster/roster.controller.ts` -- boundary `/api/app/schools/:schoolId/roster`, `assertCookieMutation()` và header contract cho Admin link endpoints.
- `apps/api/src/modules/auth/auth.service.ts` -- `callback()` hiện deny Parent ở nhánh audience Parent; giữ OAuth/Google identity collision guard, thay nhánh Parent bằng Parent service atomic admission.
- `apps/api/src/modules/auth/auth.controller.ts` và `auth.config.ts` -- cookie audience riêng và `/api/parent/auth/session`; session endpoint phải revalidate Parent authority để revoke áp dụng request kế tiếp.
- `apps/api/src/modules/authorization/authorization.service.ts` -- chooser app/teacher hiện hữu chỉ là tham chiếu; Parent phải có resolver DTO tối thiểu dựa hoàn toàn trên active `StudentParent`.
- `apps/api/src/modules/common/mutation-protection.ts`, `audit.ts`, `operation-idempotency.ts` và `modules/memberships/memberships.service.ts` -- tái sử dụng Origin/CSRF/fingerprint, audit provenance, Operation replay/conflict, School lock và actor recheck.
- `apps/api/src/app.module.ts` và `apps/api/src/main.ts` -- đăng ký Parent module; CORS đã cho phép `/api/parent/(auth|schools|operations)` nhưng route mới vẫn phải giữ exact parent origin.
- `apps/web/src/roster/roster-workspace.tsx` và `roster-workspace.test.tsx` -- surface Admin Student/link, existing field error, dirty School guard và Operation reconciliation; thêm table/form/revoke theo Student, không optimistic.
- `apps/parent-web/src/auth-session.ts`, `main.tsx`, `shell.test.tsx`, `vite.config.ts` -- bootstrap cookie, shell safe-state và PWA no-runtime-cache; triển khai chooser/direct/signed-out state tối thiểu, clear affected protected state.
- `apps/api/src/integration/auth.persistence.integration.test.ts`, `roster.integration.test.ts`, `release-gate.integration.test.ts` -- mở rộng fixture/matrix PostgreSQL; thay blanket Parent deny bằng pending/no-link denial và active-link authorization/revoke proof.
- `apps/web/e2e/release-gate.spec.ts` và `apps/web/playwright.config.ts` -- browser release gate hiện có, cần fixture two-School/multi-link, actual Parent callback/chooser/revoke proof.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration PostgreSQL mới -- thêm global ParentProfile, retained StudentParent ACTIVE/REVOKED graph, normalized contact/binding constraints, School-scoped composite Student FK và indexes -- database chặn tenant graph sai và giữ lịch sử revoke.
- `apps/api/src/modules/parents/*`, `apps/api/src/app.module.ts`, `auth.service.ts`, `auth.controller.ts` -- tạo owner Parent cho Admin link command, Parent admission/session/context resolver và minimum DTO -- dùng persistent active-link recheck trước cookie/protected data, không ghép authorization vào browser state.
- `apps/api/src/modules/roster/roster.controller.ts` và service/module liên quan -- expose link list/create/revoke tại roster surface, tái dùng `ROSTER_MANAGE`, mutation protection, School lock, audit và Operation reconciliation semantics.
- `apps/api/src/integration/*.integration.test.ts` cùng auth/unit/controller tests -- chứng minh normalized pending create/reuse/reactivate, tenant graph, atomic bind, mismatch/reassigned denial, Operation idempotency/audit, request-next revoke, two-School/multi-child authorization và minimum Parent context.
- `apps/web/src/roster/roster-workspace.tsx`, tests và CSS tối thiểu -- thêm accessible Parent-link form/list/revoke per Student, server field errors/focus, input retention, switch guard và uncertain Operation reconciliation.
- `apps/parent-web/src/*` và tests -- render loading, direct one-School, multi-School chooser và signed-out/revoked safe state từ Parent server context; clear only affected child/school and retain active alternatives; giữ no-cache policy.
- `apps/web/e2e/release-gate.spec.ts` cùng E2E fixture/seed cần thiết -- thay blanket Parent denial bằng browser proof pending/no-link denied, active Parent multi-School chooser, forged context denial và per-link revoke safe state; gate phải pass trước Parent protected-domain release.

**Acceptance Criteria:**
- Given a Student in the selected active School, when an authorized School Admin creates or reactivates a valid Parent link, then the server persistently creates/reuses a global pending ParentProfile and an ACTIVE School-scoped StudentParent with audit and an actor-scoped Operation, without a Parent login or role.
- Given invalid contact input, foreign Student/link context, revoked Admin membership or suspended School, when an Admin Parent-link command runs, then it is denied before durable mutation/data disclosure and the Admin UI retains input with accessible server field errors when applicable.
- Given a verified Google Parent callback for a pending profile, when the email/subject binding is valid and an ACTIVE StudentParent still exists, then identity bind, active-link recheck and Parent cookie issuance occur atomically; no-link, revoked, subject-mismatch or reassigned-email cases issue no Parent session.
- Given a bound Parent with active/revoked links across two Schools and multiple Students, when requesting a route, UUID, filter, chooser or child context outside its active links, then the server denies before protected reads and the portal never renders/caches foreign DTOs.
- Given one StudentParent is revoked, when the Parent makes its next protected request, then only the affected child/School state is cleared to chooser or signed-out safe state, retained audit shows revoke, and another active child/School remains usable.
- Given delayed Admin create/revoke or a School switch, when reconciliation completes, then the portal does not issue a duplicate mutation or display link rows for the previous School.
- Given the two-School, multi-link fixture, when PostgreSQL integration and real browser release-gate tests run, then pending admission, active-link session recheck, forged context denial and per-Student revoke behavior pass as a prerequisite for protected Parent-domain release.

## Design Notes

Parent session authentication proves only `UserIdentity`; every Parent authorization decision is a current database traversal `UserIdentity -> ParentProfile -> StudentParent ACTIVE -> Student/School ACTIVE`. A cookie therefore never embeds School or Student authority. The callback transaction rechecks that graph immediately before signing a session, while later context endpoints repeat it so a revoke takes effect on the next request.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Parent graph client generation succeeds.
- `pnpm --filter @passionedu/api test` -- expected: auth, parent and roster unit/controller tests pass.
- `pnpm --filter @passionedu/admin-web test && pnpm --filter @passionedu/parent-web test` -- expected: accessible Admin and Parent safe-state suites pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: clean PostgreSQL Parent-link matrix passes when target database is configured.
- `pnpm test:e2e` -- expected: two-School Parent admission/chooser/revoke browser gate passes when E2E database is configured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace quality gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Đã triển khai graph `ParentProfile`/`StudentParent`, Admin API/UI tạo-revoke theo Student với Operation/audit/idempotency, Parent callback admission atomic, Parent session/context recheck và chooser safe state. Cả hai target database đã được reset theo phê duyệt và Prisma đã apply clean-break migration chain.

Đã sửa release-gate blocker: generic route `api/:audience/schools` bắt nhầm `api/ops/schools` và trả `INVALID_AUDIENCE`. App/Teacher School context hiện dùng controllers explicit, nên Ops route do `OpsController` sở hữu. Thêm regression test cho authenticated Ops bootstrap.

Verification passed: `pnpm --filter @passionedu/api prisma:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (API 11 files/44 tests; Admin 4 files/27 tests; Parent 3 files/4 tests), `pnpm build`, `git diff --check`, `pnpm --filter @passionedu/api test:integration` (6 files/43 tests), và `pnpm test:release-gate` (Admin 27, Teacher 3, Parent 4, Ops 6 unit tests; Playwright 5/5).
