---
title: 'Dùng School slug cho URL Admin'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0cb32e027cab0e84b5e744557a3a37f5d12db827'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** URL Admin mới dùng UUID `schoolId`, hoạt động đúng nhưng khó đọc, khó nhớ và không thân thiện khi chia sẻ. `School.slug` đã tồn tại, unique toàn Platform và được Ops validate theo kebab-case.

**Approach:** Dùng `School.slug` làm selector trình bày trong path `/schools/:schoolSlug/:page`. Admin resolve slug qua chooser đã được API xác thực, rồi tiếp tục dùng UUID `schoolId` cho context endpoint, workspace và mọi business API. URL UUID cũ được canonicalize sang slug nếu UUID đó là School authorized.

## Boundaries & Constraints

**Always:** Chooser App trả `schoolId`, `schoolSlug`, `schoolName`; `schoolSlug` phản ánh `School.slug` unique đã có. Browser route dùng slug, gồm deep link, route construction, Back/Forward và fallback page canonicalization. Chỉ sau chooser trả School authorized khớp chính xác slug URL mới gọi `GET /api/app/schools/:schoolId`; endpoint này và toàn bộ API business tiếp tục nhận UUID. Context payload giữ `schoolId` và bổ sung `schoolSlug`; client xác nhận cả UUID và slug khớp chooser/route trước render. `localStorage` giữ UUID selection theo identity như UX hint hiện hữu; sau chooser validation, restore chuyển sang canonical slug URL. Với URL legacy `/schools/:schoolId/:page`, chỉ khi exact ID xuất hiện trong chooser server-authorized mới replace sang `/schools/:schoolSlug/:page`; URL unknown/stale không gọi context endpoint và về chooser. Ưu tiên exact authorized slug match trước UUID legacy match để không suy diễn format route. Giữ nguyên guard dirty/pending/reconcile, protected-state clearing, capability page fallback và API authorization hiện hữu.

**Ask First:** Cho phép đổi slug School, thêm lịch sử/alias redirect cho slug cũ, dùng slug trong business API/Prisma relations/Operation/audit, đổi contract Teacher/Ops, hoặc migrate localStorage từ UUID sang slug.

**Never:** Không coi slug/URL/localStorage là bằng chứng authorization; không gọi business API bằng slug; không resolve arbitrary slug trực tiếp qua database bỏ qua membership/capability; không làm hỏng bookmark UUID hiện có của School authorized; không đổi visual layout đã duyệt.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Slug deep link hợp lệ | `/schools/peakland/staff`; chooser chứa slug `peakland`, UUID A | Context fetch dùng A; render Nhân viên khi authorized; URL giữ slug | Không render trước context success |
| Legacy UUID URL | `/schools/A/students`; chooser chứa A/`peakland` | Replace `/schools/peakland/students`, sau đó resolve context bằng A | UUID không thuộc chooser về `/` và không fetch context |
| Restore selection | localStorage chứa UUID A; chooser chứa A/`peakland` | Tự vào `/schools/peakland/students` | Selection stale bị quên, chooser hiển thị |
| Context mismatch | Route slug/chooser A nhưng context trả UUID hoặc slug khác | Không render protected workspace; clear và về chooser | Không retain response payload mismatch |
| Business workspace request | URL slug `peakland` đã resolve A | Roster/settings/leave/finance tiếp tục gọi `/api/app/schools/A/...` | Không phát sinh slug API contract |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:9-17` -- `School.slug` là `@unique`; không cần migration schema.
- `apps/api/src/modules/authorization/authorization.service.ts:13,38-58` -- thêm slug vào chooser/context DTO nhưng giữ `resolve(..., schoolId, ...)` và query membership theo UUID.
- `apps/api/src/modules/authorization/authorization.controller.ts:9-15` -- App context endpoint giữ parameter UUID; Teacher controller ngoài scope.
- `packages/contracts/src/index.ts:13-14` -- shared chooser/context DTO cần bổ sung `schoolSlug` nếu contract đang được dùng.
- `apps/web/src/school-context.tsx:8-213` -- tách destination slug khỏi context UUID; map route slug qua chooser item rồi fetch context UUID; canonicalize legacy route và giữ workspace props UUID.
- `apps/web/src/school-context.test.tsx` -- fixture dùng UUID và slug khác nhau; cover slug URL, legacy redirect, stale/mismatch và UUID business API fetch.
- `apps/api/src/modules/authorization/authorization.service.test.ts` -- update projection and add chooser slug coverage.
- `apps/web/src/roster/roster-workspace.tsx`, `apps/web/src/settings/settings-workspace.tsx`, `apps/web/src/attendance/leave-review-workspace.tsx`, `apps/web/src/finance/finance-workspace.tsx` -- read-only evidence: workspace APIs must retain UUID props/paths.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/authorization/authorization.service.ts` -- project `schoolSlug` from School in App/Teacher chooser and context DTO while retaining UUID resolve -- expose a friendly selector without weakening authorization.
- [x] `packages/contracts/src/index.ts` -- align shared public chooser/context schemas with slug projection when required -- avoid DTO drift.
- [x] `apps/api/src/modules/authorization/authorization.service.test.ts` -- test slug projection and UUID-scoped resolve output -- lock API boundary.
- [x] `apps/web/src/school-context.tsx` -- map slug route to server-authorized chooser School, canonicalize authorized legacy UUID paths, preserve UUID context/workspace API calls -- separate browser identity from tenant scope identity.
- [x] `apps/web/src/school-context.test.tsx` -- use distinct UUID/slug fixtures and cover matrix cases -- prevent UUID/slug interchange regressions.

**Acceptance Criteria:**
- Given an authorized School with slug `peakland` and UUID A, when Admin opens `/schools/peakland/staff`, then context and business requests use A while the visible browser URL remains slug-based.
- Given a bookmarked authorized UUID route, when Admin opens it, then it is replaced by the matching slug route before workspace render.
- Given an unknown slug, unauthorized UUID or mismatched context slug/ID, when the route is resolved, then no protected data renders and the app returns to chooser without resolving arbitrary School context.
- Given a persisted UUID selection, when chooser confirms it after reload, then Admin opens its canonical slug URL.

## Design Notes

`schoolSlug` is the human-facing route label; `schoolId` remains the authorization and API scope identifier. The client first matches the route selector only against the API-authorized chooser projection, then resolves context with the matched UUID. This preserves the existing two authorization gates while producing readable URLs.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- authorization.service.test.ts` -- expected: chooser/context slug projection and UUID resolve tests pass.
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx` -- expected: slug route, legacy canonicalization, mismatch and UUID workspace API assertions pass.
- `pnpm --filter @passionedu/api typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/api build && pnpm --filter @passionedu/admin-web build` -- expected: cả hai build thành công.
- `git diff --check` -- expected: không có whitespace error.

## Suggested Review Order

**Contract slug**

- Chooser/context thêm slug nhưng giữ UUID làm authorization scope.
  [`authorization.service.ts:38`](../../apps/api/src/modules/authorization/authorization.service.ts#L38)

- Shared DTO nhận đủ selector và capability projection từ API.
  [`index.ts:12`](../../packages/contracts/src/index.ts#L12)

**Resolve URL an toàn**

- Route slug được map qua chooser authorized trước context UUID fetch.
  [`school-context.tsx:156`](../../apps/web/src/school-context.tsx#L156)

- Context chỉ được render khi UUID và slug phản hồi cùng khớp chooser.
  [`school-context.tsx:111`](../../apps/web/src/school-context.tsx#L111)

- Workspace tiếp tục nhận UUID, không lan slug vào API nghiệp vụ.
  [`school-context.tsx:228`](../../apps/web/src/school-context.tsx#L228)

**Regression**

- Tests khóa slug deep link, legacy redirect, guard và UUID workspace paths.
  [`school-context.test.tsx:24`](../../apps/web/src/school-context.test.tsx#L24)

- API test khóa slug projection cho App và Teacher cùng resolve UUID.
  [`authorization.service.test.ts:4`](../../apps/api/src/modules/authorization/authorization.service.test.ts#L4)
