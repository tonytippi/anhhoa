---
title: 'Cải thiện sidebar điều hướng thu gọn'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: 'd07d27a3d7397bf31316aaa9fedf626c0604ca83'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sidebar thu gọn hiện thay toàn bộ navigation bằng vòng tròn CSS va chevron rời rạc, khiến destination không nhận diện được va không có cách tiếp cận submenu rõ ràng.

**Approach:** Theo UX spine, dùng icon rail tại `768–1023px`, với icon định danh cho từng destination, nhãn hover/focus và flyout cho các nhóm. Sidebar desktop đầy đủ giữ từ `1024px`; navigation dưới `768px` giữ nguyên hành vi hiện hữu.

## Boundaries & Constraints

**Always:** Derive mọi item và child từ `allowedPages(context)` va giữ nguyên `requestDestination`, School context, dirty/pending guard, route, focus heading va server authorization. Icon chỉ là presentation; mỗi control giữ accessible name bằng nhãn tiếng Việt. Nhóm rail giữ `aria-expanded`, đóng bằng Escape hoặc khi focus rời, va chỉ render children đã được server cấp.

**Ask First:** Thay đổi route, capability/API navigation, information architecture, thứ tự/nhãn destination do server trả về, hoặc thay navigation sheet dưới `768px`.

**Never:** Không dùng vòng tròn/pseudo content thay icon; không để icon hoặc màu là cách duy nhất gọi tên destination; không hiển thị item không được cấp trong tooltip/flyout; không chuyển rail sang desktop `>=1024px`; không thay đổi workspace lifecycle hay Operation reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Tablet rail | Viewport `768–1023px`, destination được cấp | Rail hiện icon có nghĩa, tooltip tên mục khi hover/focus, active có background va `aria-current`. | Nhãn semantic vẫn tồn tại khi tooltip không hiển thị. |
| Group destination | User click/focus group icon đã được cấp | Flyout chỉ có child đã được API cấp; trigger cập nhật `aria-expanded`; chọn child dùng route flow hiện hữu. | Escape hoặc focus rời đóng flyout, không đổi route/workspace. |
| Desktop/mobile | `>=1024px` hoặc `<768px` | Desktop sidebar có nhãn đầy đủ; mobile giữ navigation presentation hiện hữu. | Không để CSS rail ảnh hưởng breakpoint khác. |
| Denied/deep link | Child không có server grant hoặc route deep link bị deny | Không xuất hiện trong rail/flyout; fallback protected route hiện hữu vẫn áp dụng. | Xóa protected state theo flow có sẵn. |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx:1,42-85,160-163,248-256` -- nguồn duy nhất của capability-filtered navigation, route request va state nhóm; bổ sung icon model/presentation rail và điều khiển flyout mà không thay policy.
- `apps/web/src/index.css:44-54,125-129,1532-1633` -- shell/sidebar desktop va compact CSS hiện dùng glyph `○/●`; chuyển compact rail về breakpoint tablet, thêm visual icon/tooltip/flyout và phục hồi text desktop.
- `apps/web/src/school-context.test.tsx:103-194` -- regression navigation, Finance group, protected deep link, focus va pending reconciliation; bổ sung interaction/a11y test cho flyout rail presentation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:36-38,158-173` -- ràng buộc named navigation, heading focus, access control va responsive breakpoint.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md:141,147-149,179,186-193` -- focus ring, contrast va nhãn văn bản không được thay bằng color/icon.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/school-context.tsx` -- gắn SVG icon có nghĩa va visually-hidden accessible label vào navigation controls, đồng thời quản lý flyout group an toàn cho rail -- thay presentation mà tái sử dụng toàn bộ route/capability logic.
- [x] `apps/web/src/index.css` -- bỏ compact glyph CSS, triển khai icon rail/tooltip/flyout ở `768–1023px`, va để persistent desktop sidebar có text tại `>=1024px` -- khớp responsive contract và visual language hiện có.
- [x] `apps/web/src/school-context.test.tsx` -- kiểm thử accessible icon labels, group flyout close/selection va server-granted filtering -- ngăn regression authorization, a11y va navigation state.

**Acceptance Criteria:**
- Given viewport `768–1023px` va một destination được cấp, when navigation render, then control của destination có icon riêng, accessible Vietnamese name va tooltip hover/focus; không có `○` hoặc `●` thay icon.
- Given viewport `>=1024px`, when navigation render, then sidebar persistent giữ các nhãn destination đầy đủ va không render rail presentation.
- Given một nhóm được cấp trong rail, when user mở trigger rồi chọn child hoặc nhấn Escape/focus rời, then flyout chỉ chứa child đã cấp, route chỉ đổi khi chọn child va flyout đóng đúng lúc.
- Given deep link hoặc pending Finance workspace, when rail/flyout tương tác, then allowed route, workspace, reconciliation va heading-focus behavior hiện hữu vẫn giữ nguyên.

## Design Notes

Rail là navigation presentation, không phải một danh sách icon độc lập: text label được giữ trong DOM cho screen reader và hiển thị qua tooltip khi hover/focus. Group flyout thay affordance chevron cô lập, còn desktop vẫn dùng disclosure/submenu hiện có để bảo toàn layout mockup.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx` -- expected: navigation, authorization, flyout va workspace regressions pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: JSX/event/ref types pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Responsive navigation state**

- Khởi tạo rail đúng breakpoint và dọn flyout khi layout thay đổi.
  [`school-context.tsx:61`](../../apps/web/src/school-context.tsx#L61)

- Giữ route/capability logic, thêm focus-safe flyout behavior.
  [`school-context.tsx:271`](../../apps/web/src/school-context.tsx#L271)

- Render icon, named control và server-filtered child trong cùng navigation source.
  [`school-context.tsx:295`](../../apps/web/src/school-context.tsx#L295)

**Tablet shell**

- Chỉ dùng mobile header và navigation sheet dưới 768px.
  [`index.css:835`](../../apps/web/src/index.css#L835)

- Dựng rail, tooltip và flyout riêng cho dải tablet.
  [`index.css:1560`](../../apps/web/src/index.css#L1560)

**Regression coverage**

- Xác nhận Finance flyout chỉ lộ child được cấp và đóng đúng behavior.
  [`school-context.test.tsx:148`](../../apps/web/src/school-context.test.tsx#L148)
