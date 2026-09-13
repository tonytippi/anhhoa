---
title: 'Bỏ tab truy cập phụ huynh'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '26eb9f0ca08d28aa0493cc2ed35390f3996cde33'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tab `Truy cập phụ huynh` đưa ParentAccessPolicy vào School settings như một điều có thể cấu hình, nhưng những quyền Parent hiện có là baseline product: Parent được xem nội dung đã được authorize, nhận event phù hợp, gửi leave request khi được phép và xem obligation/payment instruction được authorize. Checkbox sẽ gợi ý School Admin có thể tắt các baseline authorization rules.

**Approach:** Bỏ hoàn toàn tab `Truy cập phụ huynh`, policy row/form proposal và deep-link hash của nó khỏi mockup Settings. Giữ Parent authorization, revoke, active StudentParent recheck, operational retention và finance retention là server-enforced defaults theo canonical contracts, không có UI toggle/configuration trong release này.

## Boundaries & Constraints

**Always:** Parent access tiếp tục authorize server-side theo active StudentParent, ParentSchoolContext, retention/revoke và minimum DTO. Parent không nhận Staff/class/evidence/internal data; Parent portal không tự tính access/retention. Tất cả Settings tab còn lại và BankAccount query/hash behavior vẫn hoạt động.

**Ask First:** Hỏi trước khi đưa Parent-specific access/retention/support path policy trở lại UI, thêm Parent checkbox, thay Parent authorization, session/revoke, retention hay Parent API DTO.

**Never:** Không thay baseline Parent capability bằng School Admin checkbox; không để `#parent-access` là hash hợp lệ; không sửa backend/schema/API; không sửa final historical artifacts để đổi requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở Settings | Không có hash | Bốn tab còn lại; Thông tin trường active | N/A |
| Deep link cũ | `school-settings.html#parent-access` | Fallback an toàn về `#school-information` | Không render policy/toggle cũ |
| Tab còn lại | Hash valid khác | Chỉ panel tương ứng visible, focus heading | N/A |
| Parent access runtime | Parent dùng portal | Authorization/revoke/retention server-enforced như trước | Không bị ảnh hưởng bởi Settings UI |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:16-21,68-72` -- remove Parent tab and its policy panel/form.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:290-302,359-371` -- Settings tab selection will naturally fall back once panel/hash is removed; retain generic valid-panel selection.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs:22-25,106-124` -- remove Parent policy lifecycle test, assert old hash fallback and remaining tab behavior.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:125-152` -- remove Parent tab/policy assertion and add negative hash/panel checks.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:26,84-85,144-147` -- Parent authorization contract remains canonical, but Settings IA should no longer imply configurable Parent access.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:11` -- update Settings inventory from five to four tabs.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/school-settings.html` -- remove Truy cập phụ huynh tab and Parent policy UI -- avoid a false configurable-access affordance.
- [x] `EXPERIENCE.md` and `MOCKUP-COVERAGE.md` -- state four Settings tabs and Parent access as server-enforced baseline, not a School toggle -- align UX contract/inventory.
- [x] `test-school-settings-ux.mjs` -- remove Parent form lifecycle fixture and verify old `#parent-access` falls back safely -- protect IA change.
- [x] `test-rendered-mockup-contracts.mjs` -- update Settings tab expectations and assert no Parent access panel/form remains -- prevent reintroduction.

**Acceptance Criteria:**
- Given School Admin opens Cấu hình trường, when tabs render, then exactly four configuration tasks are available and no Parent access configuration/toggle appears.
- Given user opens obsolete `#parent-access`, when Settings initializes, then it routes/falls back to `#school-information` with only profile panel visible.
- Given Parent uses existing portal flows, when this mockup refactor ships, then canonical server-enforced authorization/revoke/retention behavior is unchanged and no client-side settings option affects it.
- Given Settings mockup contracts run, when tabs and old hash are checked, then all remaining Settings/Profile/Calendar/Finance/Attendance behavior passes.

## Design Notes

Four Settings tabs remain: `Thông tin trường`, `Lịch hoạt động`, `Tài chính & thanh toán`, and `Điểm danh & bàn giao`. This page configures School-owned operational facts. Parent access is an authorization boundary, not a daily School preference.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: four-tab Settings and legacy hash fallback pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: no Parent access panel/form contract remains.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: no whitespace error.

## Suggested Review Order

**Settings Information Architecture**

- Four remaining School-owned configuration tasks appear in the tab navigation.
  [`school-settings.html:16`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L16)

- Parent authorization remains a server-enforced baseline, not Settings configuration.
  [`EXPERIENCE.md:26`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L26)

**Regression Protection**

- Settings behavioral test proves obsolete Parent hash safely falls back to profile.
  [`test-school-settings-ux.mjs:73`](test-school-settings-ux.mjs#L73)

- Static contract rejects Parent tab, panel, form and policy-row reintroduction.
  [`test-rendered-mockup-contracts.mjs:125`](test-rendered-mockup-contracts.mjs#L125)
