---
title: 'Ổn định E2E chuyển ngữ cảnh trường'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
baseline_commit: '548d28fb08ac6aaa38aed890f1d543f71b782699'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Superseded:** Story 1.7 replaces the in-page switcher with a Home-only chooser and owns the retained release-gate updates. This historical E2E stabilization spec is closed to avoid appearing as active parallel work.

**Problem:** Release-gate E2E đổi School rồi lập tức click navigation hoặc kiểm tra focus heading. Context School tải bất đồng bộ nên test có thể chạy trước khi UI sẵn sàng, làm chặn browser proof của Finance dù database test, migrate và seed đã thành công.

**Approach:** Ổn định E2E bằng cách chờ signal UI/server-authoritative của School context mới trước các thao tác tiếp theo; giữ nguyên hành vi ứng dụng, capability, focus-restoration và coverage Finance.

## Boundaries & Constraints

**Always:** Chạy bằng `.env.test`, giữ browser release fixture tuần tự, và chỉ chờ tín hiệu đã render context đúng School. Test vẫn phải chứng minh navigation `Khoản thu` khả dụng với School A, heading School A nhận focus khi contract UI yêu cầu, và không che lỗi authorization/loading bằng delay cố định.

**Ask First:** Bất kỳ thay đổi production nào trong `SchoolContext`, navigation, authorization hoặc semantics focus.

**Never:** Không thêm sleep, không nới timeout để che race, không thay fixture database, không bỏ assertion Finance hoặc kiểm tra focus.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chọn School A | Admin authenticated đổi từ chooser sang School A | Test chỉ click `Khoản thu` sau khi navigation context A render | Nếu context không sẵn sàng, assertion fail với locator chính xác |
| Focus sau chọn School | Admin chọn School A | Test đợi heading A tồn tại rồi xác nhận focus restoration | Không dùng delay hoặc focus giả |

</frozen-after-approval>

## Code Map

- `apps/web/e2e/finance-release-gate.spec.ts` -- Finance browser flow chọn `Release Gate A` ở dòng 44 rồi click `Khoản thu`; thêm readiness assertion trước click.
- `apps/web/e2e/release-gate.spec.ts` -- Shared Admin release flow kiểm tra heading/focus sau chọn School ở dòng 69-70; đồng bộ assertion với render context.
- `apps/web/src/school-context.tsx` -- Read-only evidence: select School gọi `requestDestination`, sau đó context/navigation render bất đồng bộ; không cần đổi production nếu test chờ DOM contract.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/e2e/finance-release-gate.spec.ts` -- chờ navigation Finance của `Release Gate A` sẵn sàng trước click `Khoản thu`, không thay đổi luồng Finance sau đó.
- [ ] `apps/web/e2e/release-gate.spec.ts` -- chờ heading School A render trước assertion focus, bảo toàn assertion focus.

**Acceptance Criteria:**
- Given Admin chọn `Release Gate A`, when context School đã render navigation được authorize, then Finance gate click `Khoản thu` thành công mà không cần delay.
- Given Admin chọn `Release Gate A`, when heading context đã render, then release gate vẫn xác nhận heading đó được focus.
- Given E2E chạy với `.env.test`, when Finance release gate hoàn tất, then không có failure do thao tác trước context School sẵn sàng.

## Verification

**Commands:**
- `pnpm test:e2e -- finance-release-gate.spec.ts` -- expected: Finance release-gate browser flow passes using `.env.test`.
- `pnpm test:e2e -- release-gate.spec.ts` -- expected: shared Admin School context proof passes using `.env.test`.
- `git diff --check` -- expected: no whitespace errors.
