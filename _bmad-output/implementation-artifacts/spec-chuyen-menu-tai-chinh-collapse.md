---
title: 'Chuyển menu Tài chính thành collapse'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: 'b402c894029dd5c67f0df678f8fe82408fee3236'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Năm destination Finance đang nằm ngang cấp trong sidebar, trong khi Danh bộ và Cấu hình trường đã có cấu trúc collapse. Sidebar cần nhất quán hơn và ít chiếm chỗ hơn mà không thay đổi route hay quyền.

**Approach:** Nhóm các destination `Khoản thu`, `Ưu đãi`, `Đợt thu`, `Thu tiền`, `Báo cáo` vào toggle `Tài chính` có hành vi collapse giống hai nhóm hiện có. Nhóm tự mở khi route Finance active hoặc deep link hợp lệ được tải.

## Boundaries & Constraints

**Always:** Chỉ render nhóm và từng mục con khi `allowedPages(context)` cho phép, tức là API đã cấp navigation item tương ứng và `FINANCE_MANAGE`. Giữ nguyên paths, workspace mount, School context, dirty/pending switch guard và Operation reconciliation. Toggle chỉ thay presentation state, không navigation hoặc unmount workspace.

**Ask First:** Thay đổi API navigation/capability, tạo route `/finance` tổng hợp, đổi thứ tự hoặc nhãn các destination Finance server trả về, hay chỉnh mockup/layout ngoài sidebar nhóm này.

**Never:** Không render child từ danh sách tĩnh nếu context không cấp navigation item, không làm deep link/Back/Forward giữ submenu đóng khi Finance route active, không reset pending Operation khi collapse, và không thay đổi authorization hay Finance lifecycle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Finance authorized | Context có `FINANCE_MANAGE` và một hoặc nhiều Finance navigation items | Render toggle `Tài chính`; submenu chỉ liệt kê các destination được cấp. | Không có grant thì không render nhóm. |
| Collapse | User đang ở route Finance và click toggle | Submenu ẩn/hiện, URL và workspace hiện tại không đổi. | Không submit/reconcile/reload dữ liệu. |
| Deep link | URL là một Finance route được cấp | Toggle tự mở, child route active có `aria-current="page"`. | Route không được cấp fallback theo allow-list hiện có, không lộ menu hay data bị từ chối. |
| Pending Operation | Finance workspace đang pending rồi user toggle | Status và reconciliation handle vẫn còn nguyên. | Không replay mutation hoặc clear state. |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx:48,82-85,248-254` -- giữ state accordion, tự mở theo route và render navigation được API cấp; thêm `finance` theo pattern roster/settings.
- `apps/web/src/index.css:972-977,1576-1615` -- style chung accordion tái sử dụng được; chuyển spacing và heading `TÀI CHÍNH` từ child cũ sang group mới, giữ responsive behavior.
- `apps/web/src/school-context.test.tsx:118-176` -- coverage sidebar Finance, protected deep link, heading focus và pending reconciliation; mở rộng cho collapse và đủ năm child route.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/school-context.tsx` -- thêm accordion Finance cùng state/page-derived expansion như hai nhóm hiện có; render children theo server-authorized allow-list -- nhất quán IA mà không nới quyền hoặc thay route.
- [x] `apps/web/src/index.css` -- áp dụng spacing/heading Finance lên group collapse, tái sử dụng visual language accordion hiện có -- sidebar desktop và responsive giữ đúng bố cục.
- [x] `apps/web/src/school-context.test.tsx` -- kiểm thử toggle không đổi URL/workspace, child filtering, deep-link auto-expand và pending reconciliation -- bảo vệ access control và state regression.

**Acceptance Criteria:**
- Given context cấp ít nhất một Finance destination, when sidebar render, then một toggle `Tài chính` hiển thị và submenu chỉ có các child API đã cấp.
- Given user ở một Finance route, when context/deep link/history áp dụng page, then `Tài chính` có `aria-expanded="true"` và child hiện hành có `aria-current="page"`.
- Given user đóng hoặc mở `Tài chính`, when workspace Finance đang hiện, then pathname, rendered workspace và status pending không đổi.
- Given context không cấp destination Finance hoặc `FINANCE_MANAGE`, when sidebar render hoặc deep link, then group không lộ child không được phép và fallback hiện có vẫn được dùng.

## Design Notes

`Tài chính` trở thành cùng semantic component với `Danh bộ` và `Cấu hình trường`: `<section>` group, toggle button, `aria-controls`, `aria-expanded`, và submenu. Nhóm vẫn giữ section heading CSS `TÀI CHÍNH`, vì không còn duplicate với menu toggle trước đó.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx` -- expected: navigation, protected deep link và pending Operation regression tests pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: state/page and JSX types pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Accordion navigation**

- Reuses existing collapse semantics while preserving server-authorized Finance children.
  [`school-context.tsx:48`](../../apps/web/src/school-context.tsx#L48)

- Opens the relevant group on deep-link, history navigation, and direct route changes.
  [`school-context.tsx:82`](../../apps/web/src/school-context.tsx#L82)

- Renders `Tài chính` as a controlled group without creating an aggregate destination.
  [`school-context.tsx:253`](../../apps/web/src/school-context.tsx#L253)

**Sidebar presentation**

- Keeps Finance section heading and compact-sidebar disclosure affordance legible.
  [`index.css:1576`](../../apps/web/src/index.css#L1576)

- Prevents compact navigation from replacing collapse indicators with route icons.
  [`index.css:1612`](../../apps/web/src/index.css#L1612)

**Regression coverage**

- Verifies authorized children, collapse state, and URL/workspace preservation.
  [`school-context.test.tsx:118`](../../apps/web/src/school-context.test.tsx#L118)

- Verifies denied Finance deep links remain scoped to authorized navigation.
  [`school-context.test.tsx:147`](../../apps/web/src/school-context.test.tsx#L147)
