---
title: 'Đưa ngữ cảnh trường và trang Admin vào URL'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: '973e0e348f428f9dec1d0ac58e65a77aaa6b9eca'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin hiện giữ trường đang làm việc và trang đang mở hoàn toàn trong React state. Reload, bookmark, copy URL và Back/Forward không quay lại đúng workspace; trang luôn về Danh bộ dù browser đã nhớ trường.

**Approach:** Đưa School selector và destination Admin cấp cao nhất vào path URL để một URL có thể khôi phục đúng workspace. URL chỉ là selector không tin cậy: API vẫn xác nhận School context và server-projected navigation/capability trước khi render bất kỳ dữ liệu School nào.

## Boundaries & Constraints

**Always:** Chuẩn hóa chooser là `/` và workspace là `/schools/:schoolId/:page`; hỗ trợ các page hiện hữu `students`, `parents`, `staff`, `classes`, `years`, `positions`, `settings`, `leave-review`, `finance`. Khởi động, reload, direct link, Back/Forward và chọn trường đều lấy School/page từ URL. Chỉ sau `GET /api/app/schools/:schoolId` thành công mới render heading, navigation hoặc workspace School. Server context vẫn quyết định membership, School status, capability và navigation; không tin URL/localStorage làm authorization. Chọn trường thành công chuyển tới page mặc định được cấp quyền; chuyển page trong cùng School cập nhật URL/history và active navigation. Một path page không thuộc navigation/capability server trả về không được render protected state và phải replace tới destination an toàn được cấp quyền trong cùng School, hoặc chooser khi không còn School hợp lệ. `401`/`403`/`404` khi resolve context/workspace xóa protected state, quên UX hint khi phù hợp, rồi replace chooser sau khi refresh danh sách. Giữ guard đổi trường hiện hữu cho dirty, pending và reconciliation; direct history/navigation đổi School không được bypass guard. Route change focus `h1` như UX spine.

**Ask First:** Đưa filter, date, phân trang, modal, selected row hay wizard state vào URL; thay đổi API/session/Prisma/authorization; đổi visual layout hoặc bổ sung URL contract khác mockup đã duyệt; thay server/deployment configuration để history fallback production.

**Never:** Không truyền hay sử dụng School/page từ URL như bằng chứng quyền; không render data School cũ trong lúc URL mới chưa được server xác nhận; không lưu capability/navigation trong browser; không tự khôi phục URL page bị revoked; không chuyển route trái với pending/dirty guard mà không có xác nhận rõ ràng.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Deep link hợp lệ | `/schools/a/staff`, context A cấp `ROSTER_MANAGE` | Resolve A rồi mở Nhân viên, nav active và URL giữ nguyên | Không render nội dung A trước context success |
| Reload đúng workspace | URL hợp lệ đang ở Finance/Settings/Danh bộ | Sau bootstrap mở lại cùng School và page URL | API denial xóa content rồi fallback an toàn |
| Chọn trường | Chooser hoặc switcher chọn B | Qua guard nếu cần, update URL B với page default authorized rồi resolve B | Failure giữ chooser/error, không ghi state authorization local |
| Page không được cấp | URL page không có trong context/navigation mới | Không mount workspace/page cũ; replace destination authorized của School | Không có destination thì chooser |
| School revoked/stale | URL School không còn list hoặc context trả 401/403/404 | Xóa context, dialog/protected state và refresh chooser | Không global logout trừ khi list trả 401 |
| History đổi School khi dirty/pending | Back/Forward đi từ A sang B trong form dirty hoặc mutation pending | Guard cho ở lại/discard/reconcile trước khi context B load | Ở lại phục hồi URL A, pending không được discard |

</frozen-after-approval>

## Code Map

- `apps/web/package.json` -- Admin là React/Vite; `react-router-dom` đã là dependency nhưng chưa được dùng.
- `apps/web/src/main.tsx:61-125` -- `AdminShell` bootstrap session và điểm đặt router/history provider, phải giữ login shell hiện hữu.
- `apps/web/src/school-context.tsx:41-372` -- source state hiện tại của `schoolId`, `view`, chooser, context API, workspace render và dirty/pending switch guard; chuyển URL thành source selector nhưng tái sử dụng API revalidation/clear logic.
- `apps/web/src/school-context.tsx:114-174` -- chooser restore và `load()` là authorization gate; localStorage tiếp tục chỉ UX hint, không thay route đã yêu cầu.
- `apps/web/src/school-context.tsx:289-332` -- nav/page mapping, `aria-current` và workspace capability gates cần map sang route page.
- `apps/web/src/school-context.test.tsx:11-182` -- regression tests hiện hữu cho context lifecycle/guard; bổ sung BrowserRouter/history deep-link coverage.
- `apps/web/src/shell.test.tsx` -- test authenticated/signed-out shell nếu router provider ảnh hưởng entry render.
- `apps/web/vite.config.ts:6-20` -- evidence cho dev/PWA only; production history fallback là deployment concern, không tự đổi trong scope này.
- `apps/api/src/modules/authorization/authorization.service.ts:38-58` -- read-only server authority: chooser và School context resolve active authorization/capability.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/main.tsx` -- khởi tạo browser routing cho Admin sau session bootstrap -- cho phép path URL được đọc và lịch sử browser hoạt động mà không đổi login flow.
- [x] `apps/web/src/school-context.tsx` -- thay state School/page bằng URL-backed selector, validate route qua context server, cập nhật chooser/switch/navigation/fallback và bảo toàn dirty-pending guard -- bảo đảm deep link không bypass authorization hoặc làm lộ state cũ.
- [x] `apps/web/src/school-context.test.tsx` -- mở rộng helpers bằng router history và test deep link/reload/navigation/page denial/history guard -- khóa matrix authorization và recovery.
- [x] `apps/web/src/shell.test.tsx` -- cập nhật test shell nếu cần router context -- đảm bảo signed-out UI không phụ thuộc protected route.

**Acceptance Criteria:**
- Given Admin đã có session và mở URL workspace hợp lệ, when tải mới hoặc bookmark URL đó, then cùng School và page hiện ra sau server context resolution.
- Given Admin chọn một page navigation được server cấp, when kích hoạt navigation, then URL đổi theo School/page, `aria-current` đúng và Back/Forward quay lại workspace đã xác thực.
- Given URL School/page bị revoke, stale hoặc không được capability cấp, when context được resolve, then protected state không xuất hiện và app replace tới fallback an toàn.
- Given form dirty hoặc Operation pending ở School A, when user dùng browser navigation để sang School B, then guard không cho bypass trạng thái chưa giải quyết.

## Design Notes

Page URL là destination cấp cao nhất, không phải mirror toàn bộ UI state. Ví dụ: `/schools/6d0.../parents` là link chia sẻ được; input tìm kiếm, dialog tạo mới và pagination tiếp tục là state workspace cho đến khi có UX contract riêng. Khi context A chỉ cho Settings, `/schools/a/students` phải resolve A trước rồi replace page settings, không render roster trong một frame.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx shell.test.tsx` -- expected: route, authorization fallback và existing context guards pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite build thành công.
- `git diff --check` -- expected: không có whitespace error.

**Manual checks:**
- Mở và reload một URL `/schools/<authorized-school-id>/staff`; xác nhận sau login/reload đang ở Nhân viên của đúng Trường.
- Chuyển page rồi dùng Back/Forward; thử deep link School/page bị revoke và đổi School trong form bẩn để xác nhận protected content/guard đúng.

## Suggested Review Order

**URL và authorization**

- Path chỉ được resolve sau chooser và context server xác nhận.
  [`school-context.tsx:78`](../../apps/web/src/school-context.tsx#L78)

- Canonical fallback xóa protected state trước khi thay URL.
  [`school-context.tsx:155`](../../apps/web/src/school-context.tsx#L155)

- Payload School phải khớp selector URL trước render workspace.
  [`school-context.tsx:108`](../../apps/web/src/school-context.tsx#L108)

**Điều hướng an toàn**

- Capability projection quyết định chính xác các page có thể mở.
  [`school-context.tsx:23`](../../apps/web/src/school-context.tsx#L23)

- Navigation và history dùng URL nhưng vẫn giữ guard unresolved work.
  [`school-context.tsx:135`](../../apps/web/src/school-context.tsx#L135)

- Dialog route-switch phân biệt discard và Operation reconciliation.
  [`school-context.tsx:196`](../../apps/web/src/school-context.tsx#L196)

**Entry và regression**

- Router chỉ bọc surface Admin đã xác thực.
  [`main.tsx:119`](../../apps/web/src/main.tsx#L119)

- Tests khóa deep-link, fallback và history guard URL-backed.
  [`school-context.test.tsx:181`](../../apps/web/src/school-context.test.tsx#L181)
