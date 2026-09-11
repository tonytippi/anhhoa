---
title: 'Tách tab cho cấu hình trường'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6ebfa2f476f9239640193425261b771b075f839f'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Cấu hình trường` đang gộp hồ sơ, lịch, policy tài chính, điểm danh, giờ đón, Parent access, form đề xuất và tài khoản nhận tiền vào một trang dài. Operator không thể nhanh chóng nhận biết task cấu hình hoặc mở thẳng đúng phần việc như trang `Khoản thu`.

**Approach:** Tổ chức lại toàn bộ content hiện có thành năm tab hash-direct-linkable: `Thông tin trường`, `Lịch hoạt động`, `Tài chính & thanh toán`, `Điểm danh & bàn giao`, `Truy cập phụ huynh`. Tái sử dụng pattern tabs/route-state của Khoản thu bằng một namespace Settings riêng; policy proposal nằm cạnh policy cùng domain và BankAccount giữ query URL-backed trong tab tài chính.

## Boundaries & Constraints

**Always:** Giữ typed/versioned policy, active/proposed/effective/reason/server impact/audit, conflict preservation, Operation reconciliation, School context và Finance BankAccount lifecycle hiện có. Hash chọn tab, query giữ `q/status/sort/page`; bất kỳ filter/pagination/back-forward nào cũng phải giữ hash tab. Proposal form chỉ đề xuất policy đã thuộc tab của nó; mọi date/error IDs duy nhất. Tab direct link focus heading và chỉ render panel được chọn. Teacher vẫn là audience duy nhất ghi attendance/giờ đón; Settings chỉ cấu hình policy.

**Ask First:** Hỏi trước khi thêm tab/domain/configuration không tồn tại, thay policy lifecycle/authorization, đổi BankAccount behavior, hay thêm backend/API/schema.

**Never:** Không dùng generic `.route-state` hay `data-receivable-tabs` cho Settings; không để filter/pagination xóa hash tab; không đưa attendance/handover mutation/list vào Admin; không sửa completed historical specs để đổi yêu cầu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở direct tab | `school-settings.html#attendance-handover` | Chỉ panel Điểm danh & bàn giao visible; tab active, focus `h2` | Hash không hợp lệ fallback Thông tin trường |
| Tài chính với filter | `?status=active&sort=bank&page=1#finance-payment` | Tab Tài chính active, BankAccount list render theo query | Lọc/trang mới giữ `#finance-payment` |
| Proposal lịch conflict | Ngày hiệu lực trùng | Giữ input, error summary/focus và active calendar tab | Không đổi active/proposed server fact |
| Proposal policy khác | Form policy trong tab đúng domain thành công | Chỉ row policy tương ứng update sau terminal Operation | Timeout dùng reconciliation, không optimistic update |
| Back/forward | Query/hash trước đó | Khôi phục cùng tab và BankAccount list/filter | Không render content tab khác/stale state |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:13-24` -- source content cần phân thành năm panel và proposal forms theo domain.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:20-79` -- reference pattern tabs/hash/visible panel; chỉ reuse visual and interaction pattern, không reuse selector namespace.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:245-283,344-367,451-511,657-694` -- BankAccount URL state, receivable tab reference, popstate/filter pagination and policy submit wiring to refactor for Settings namespace.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs:1-122` -- browser-like Settings harness; preserve lifecycle tests and extend tab/query/hash coverage.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:99-154` -- static mockup contract suite; add Settings tab structure regression checks.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:11,37,43` -- inventory and non-mutation boundary documentation.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/school-settings.html` -- add five named Settings tabs and isolated panels; move current profile, typed policy rows, scoped proposal forms and BankAccount table to their domain tab -- make each task direct and scannable.
- [x] `mockups/prototype.js` -- add independent Settings tab selection/focus, metadata-driven policy form submit and hash-preserving BankAccount URL updates/popstate -- preserve all existing lifecycle behavior without cross-page selector coupling.
- [x] `test-school-settings-ux.mjs` -- update existing browser harness for tab query/hash behavior; cover each direct tab, scoped proposal conflict/success, BankAccount hash retention and back/forward -- protect interaction contracts.
- [x] `test-rendered-mockup-contracts.mjs` -- assert Settings tab IDs/hash/labels and separate Settings JS namespace -- prevent regression to a long unstructured page.
- [x] `MOCKUP-COVERAGE.md` -- describe the five tab responsibilities and finance query/hash behavior -- keep review inventory aligned.

**Acceptance Criteria:**
- Given School Admin opens `Cấu hình trường`, when no hash is supplied, then `Thông tin trường` is active and exactly one Settings panel is visible.
- Given a valid Settings hash is opened, when route renders, then its panel/tab is selected, focus moves to the panel heading and other panels are hidden.
- Given operator filters or paginates BankAccounts within Tài chính & thanh toán, when URL changes, then query is updated while `#finance-payment` remains selected; back/forward restores both.
- Given operator proposes a calendar, finance, attendance/handover or Parent-access policy, when submit/conflict resolves, then only the correct scoped policy row/form updates or retains validation state after server-confirmed outcome.
- Given Settings mockup tests run, when navigation and policy/BankAccount behavior are checked, then no Admin attendance/handover record mutation/list exists and current Settings lifecycle tests remain green.

## Design Notes

Tab ownership: `Thông tin trường` contains School identity/audit disclosure; `Lịch hoạt động` contains the calendar policy; `Tài chính & thanh toán` contains FinancePolicy and BankAccount; `Điểm danh & bàn giao` contains only the two operational policy versions; `Truy cập phụ huynh` contains Parent access policy. Buttons sit beside each tab heading; tables remain the default for policy version/history and BankAccount comparison.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: Settings tabs, policy lifecycle and BankAccount URL state pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: shared rendered contracts pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: không có whitespace error.

## Suggested Review Order

**Cấu trúc Settings**

- Năm panel độc lập gom nội dung và form theo đúng domain policy.
  [`school-settings.html:16`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L16)

- Finance giữ bảng BankAccount và controls URL-backed trong cùng tab.
  [`school-settings.html:34`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L34)

**Route State Và Lifecycle**

- Namespace Settings chọn panel, cập nhật aria và focus heading khi deep link.
  [`prototype.js:285`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L285)

- Filter và pagination bảo toàn tab finance khi ghi query vào history.
  [`prototype.js:508`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L508)

- Metadata form xác định policy row sau terminal Operation, không optimistic update.
  [`prototype.js:681`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L681)

**Regression Coverage**

- Harness browser kiểm tra direct tabs, policy lifecycle, hash retention và BankAccount deactivate.
  [`test-school-settings-ux.mjs:20`](test-school-settings-ux.mjs#L20)

- Static contracts khóa namespace Settings riêng, hashes và non-mutation boundary.
  [`test-rendered-mockup-contracts.mjs:124`](test-rendered-mockup-contracts.mjs#L124)

- Inventory mô tả trách nhiệm năm tab và URL contract của finance.
  [`MOCKUP-COVERAGE.md:11`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L11)
