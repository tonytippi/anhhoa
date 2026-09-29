---
title: 'Home-only School chooser và leave guard'
type: 'feature'
created: '2026-09-29'
status: 'in-review'
baseline_commit: '548d28fb08ac6aaa38aed890f1d543f71b782699'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/decision-home-only-school-chooser-2026-09-29.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-29-home-only-school-chooser.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mutable School select trong Admin/Teacher workspace tạo một context-transition phức tạp cho form dirty, Operation bất định, stale data và focus. Đa số actor hoàn tất công việc trong một School; họ cần trở về Home để chọn School khác thay vì đổi tenant giữa một trang nghiệp vụ.

**Approach:** Admin và Teacher chỉ chọn School trên Home. Các scoped route giữ URL/direct-link đã được API tái xác thực, hiển thị tên School read-only và có hành động về Home. Một leave guard chung bảo vệ mọi điều hướng rời workspace khi draft dirty hoặc Operation pending/uncertain.

## Boundaries & Constraints

**Always:** School URL, Home state và browser state chỉ là selector; API giữ nguyên reauthorization, School scope, audit và Operation contracts. Home chỉ liệt kê School server-authorized. Scoped Admin/Teacher pages không render mutable School `<select>` và tên School luôn visible. Direct authorized URL load được; revoke/denied/suspend xóa protected state rồi về Home/safe state. Dirty input được giữ khi chọn ở lại; pending/uncertain Operation chỉ cho đối soát, không discard/retry mù. Parent chooser không đổi.

**Ask First:** Bất kỳ thay đổi API School DTO/authorization, Parent behavior, schema, Operation lifecycle hoặc browser-level unload prompt.

**Never:** Không tự chọn hoặc tự restore School từ Home; không dùng delay để ổn định E2E; không tin slug/UUID cho authorization; không để data/navigation School cũ hiển thị sau chọn context mới; không rollback multi-School/direct URL support.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Home chọn School | Actor có nhiều School authorized | Chỉ Home có chooser; chọn School mở overview scoped và focus `h1` | Không có School thì safe empty state |
| Direct scoped URL | Authorized slug/page | Resolve từ authorized list, reauthorize context, load route không cần Home | Denied/revoked/suspended clear protected state và về Home |
| Rời workspace dirty | Home/back/internal/direct destination | Leave guard giữ input khi ở lại hoặc chỉ discard trước submit | Không silent loss hoặc context load mới |
| Rời workspace pending | Operation chưa chắc kết quả | Leave guard không có discard; đối soát Operation trước khi cho rời | Không retry mutation hoặc expose stale state |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx` -- Admin route model (`pathFor`, `destinationFromPath`, route effect) và aggregate `WorkspaceStatus` đã có; đổi Home/selector/header/dialog semantics để guard mọi rời route, giữ direct slug authorization và protected-state clear.
- `apps/teacher-web/src/main.tsx`, `apps/teacher-web/src/school-context.tsx` -- Teacher hiện dùng schoolId select in-place, không router và chỉ có dirty boolean; thêm Home/scoped route model, read-only context/Home action và aggregate dirty/pending/reconcile status tương đương Admin.
- `apps/teacher-web/src/attendance/attendance-workspace.tsx`, `handover/handover-workspace.tsx`, `daily-journal/daily-journal-workspace.tsx` -- expose shell status/reconcile từ Operation state thay vì chỉ `onDirty` nếu cần để pending leave guard không mất reconciliation.
- `apps/web/src/school-context.test.tsx`, `apps/teacher-web/src/school-context.test.tsx` -- thay switch-in-place proof bằng Home chooser, direct URL, stale-clear và leave guard dirty/pending.
- `apps/web/e2e/release-gate.spec.ts`, `apps/web/e2e/finance-release-gate.spec.ts` -- giữ các uncommitted readiness assertions, chuyển all scoped select switch flows sang Home return then chooser; cover Finance School B clearing.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Finance domain path remains unchanged after Home selects A; only School transition assertions change.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/school-context.tsx`, `apps/web/src/school-context.test.tsx` -- make Admin Home the sole chooser, change header to read-only School/Home return, apply leave guard to all navigation, retain direct-route/revoke safety and add component proof.
- [x] `apps/teacher-web/src/main.tsx`, `apps/teacher-web/src/school-context.tsx`, teacher workspace status props/tests -- add parity Home/slug routing, read-only scoped context and dirty/pending reconciliation leave guard without changing Teacher API authority.
- [ ] `apps/web/e2e/release-gate.spec.ts`, `apps/web/e2e/finance-release-gate.spec.ts` -- convert retained E2E edits and old switch flows to Home-only chooser; prove scoped selector absence, direct authorization/safe fallback and School-A state clearing before School-B work.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/` -- complete Home/read-only context mock interaction details without altering Finance layout.

**Acceptance Criteria:**
- Given Admin or Teacher opens Home with multiple authorized Schools, when one is selected, then the authorized overview loads, focuses its contextual `h1`, and scoped pages contain no mutable School chooser.
- Given a valid direct Admin or Teacher School URL, when server authorization accepts it, then it renders without prior Home selection; when authorization denies/revokes/suspends it, then previous protected context is removed and the portal returns safely.
- Given a scoped workspace is dirty, when an actor attempts any leave navigation, then the guard preserves input on stay and permits an explicit pre-submit discard only.
- Given a scoped workspace has an uncertain Operation, when an actor attempts any leave navigation, then discard is unavailable and the existing Operation reconciliation runs before navigation can proceed.
- Given an actor returns Home and chooses another School, when the second School context loads, then no visible data or navigation from the first School remains and API authorization continues to decide access.

## Design Notes

Admin already separates selector authorization from slug route loading; retain that pattern. Teacher must reach equivalent route behavior rather than using a new trusted client context. “Home-only” does not mean Home auto-restores the last School: direct URLs remain deliberate navigation, while Home selection is an explicit user action.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- src/school-context.test.tsx` -- expected: Admin Home/direct-route/leave guard proof passes.
- `pnpm --filter @passionedu/teacher-web test -- src/school-context.test.tsx` -- expected: Teacher Home/direct-route/leave guard proof passes.
- `pnpm --filter @passionedu/admin-web typecheck && pnpm --filter @passionedu/teacher-web typecheck` -- expected: portal TypeScript passes.
- `pnpm test:e2e -- finance-release-gate.spec.ts` -- expected: Finance browser flow selects School only at Home and passes on `.env.test`.
- `pnpm test:e2e -- release-gate.spec.ts` -- expected: Admin/Teacher Home-only context and release-gate flow pass on `.env.test`.
- `git diff --check` -- expected: no whitespace errors.

**Residual E2E gap (2026-09-29):** Component/type verification and the targeted Teacher safe-fallback browser proof pass. The complete browser release gates start, migrate and seed `.env.test`, but Finance Invoice Issue fails with Prisma `P2039`: `@prisma/adapter-pg` sends concurrent queries through one transaction client. This dependency/runtime defect is independent of School navigation and blocks the Finance gate before its final Home-to-School-B proof; the two E2E execution tasks remain unchecked.
