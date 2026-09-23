---
title: 'Khôi phục danh sách học sinh sau reload'
type: 'bugfix'
created: '2026-09-23'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '0ed00079259bf557418df2d884b13fe12c6ceca1'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sau reload hoặc browser/tab quay lại foreground, trang Học sinh đôi khi hiển thị "Chưa có học sinh trong năm học này" dù SchoolYear đã chọn có roster PeakLand. Thông báo này làm người dùng hiểu nhầm dữ liệu bị mất.

**Approach:** Bảo đảm refresh roster luôn tải students/classes/assignments theo SchoolYear vừa được chọn, không dựa vào state closure cũ. Trong thời gian request roster chưa hoàn tất, hiển thị loading state thay vì empty state; chỉ hiển thị empty state sau khi API đã trả danh sách trống thành công.

## Boundaries & Constraints

**Always:** Giữ School-scoped API paths, generation guards chống stale request, SchoolYear selection và UX roster hiện hành. Refresh do `focus`/`visibilitychange`, mount/reload và đổi năm học phải dùng cùng nguồn dữ liệu server-authoritative; response của year/school cũ không được ghi vào view hiện tại.

**Ask First:** Dừng nếu cần đổi API roster, contract DTO, lưu selection bền vững ngoài behavior hiện có, hoặc thay mockup/layout đã duyệt.

**Never:** Không sửa Prisma/seed/API vì seed và `RosterService.students` đã trả dữ liệu đúng theo SchoolYear; không che lỗi request bằng empty state, không render dữ liệu year trước trong year mới, không thay đổi semantics dialog/dirty guard của SchoolContext.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Reload/mount | SchoolYear duy nhất có học sinh | Sau khi refresh chọn year, gọi endpoint roster year đó và hiển thị học sinh trả về | Hiện loading đến khi request thành công hoặc lỗi |
| Tab quay lại foreground | SchoolContext revalidate/remount RosterWorkspace, selected year không đổi | Tải lại roster selected year và tiếp tục hiển thị học sinh | Generation guard loại response stale |
| Đổi SchoolYear | Request year mới đang pending | Không hiển thị học sinh hoặc empty copy của year cũ | Hiện trạng thái loading đúng year mới |
| Roster thật sự trống | GET students thành công trả `[]` | Hiện empty state và CTA hiện có | Không thay đổi copy/CTA đã duyệt |
| Lỗi roster | GET students lỗi | Không hiển thị empty state sai; giữ thông báo lỗi hiện có | Báo lỗi tải danh bộ |

</frozen-after-approval>

## Code Map

- `apps/web/src/roster/roster-workspace.tsx:400-521` -- `read`, `loadYear`, `refresh`; `refresh` đang so `selected` với `yearId` closure cũ trước khi gọi `loadYear`, tạo race sau remount/revalidation.
- `apps/web/src/roster/roster-workspace.tsx:583-687` -- mount reset state rồi refresh và effect tải year; cần giữ one authoritative load flow với generation guards.
- `apps/web/src/roster/roster-workspace.tsx:2442-2450` -- empty state hiện không phân biệt pending request với successful empty response.
- `apps/web/src/roster/roster-workspace.test.tsx:113-145` -- test chuyển year đã có request ordering assertion; mở rộng coverage reload/selected-year refresh và loading-vs-empty.
- `apps/web/src/school-context.tsx:143-212` -- focus/visibility revalidation set context undefined và remount roster; giữ behavior này, test end-to-end shell cho roster remount.
- `apps/web/src/school-context.test.tsx:40-68` -- fixtures roster và focus test; bổ sung regression roster có dữ liệu khi focus returns.
- `apps/api/src/modules/roster/roster.service.ts:271-319` -- bằng chứng read API đã scope `schoolId` + `schoolYearId`; read-only cho bugfix này.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/roster/roster-workspace.tsx` -- load selected SchoolYear xác định sau refresh và thêm trạng thái request roster để empty state chỉ hiện sau successful empty response.
- [x] `apps/web/src/roster/roster-workspace.test.tsx` -- regression selected year refresh/remount, delayed request, successful empty và error state.
- [x] `apps/web/src/school-context.test.tsx` -- regression focus/visibility revalidation remount roster vẫn tải và hiển thị student server trả về.

**Acceptance Criteria:**
- Given selected SchoolYear có học sinh, when người dùng reload hoặc quay lại browser/tab, then roster gọi đúng endpoint students của SchoolYear và hiển thị học sinh, không hiện empty state.
- Given chuyển SchoolYear hoặc revalidation đang tải roster, when response chưa về, then UI hiển thị loading phù hợp và không hiển thị dữ liệu/empty state của year khác.
- Given endpoint students trả `[]` thành công, when roster load xong, then empty state và CTA hiện hành xuất hiện.
- Given endpoint students lỗi, when roster load thất bại, then UI báo lỗi tải danh bộ và không nói rằng không có học sinh.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx school-context.test.tsx` -- expected: regression reload/focus, pending, empty và error pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: toàn bộ admin web tests pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: TypeScript hợp lệ.
