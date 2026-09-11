---
title: 'Đổi thông tin trường thành hồ sơ và branding'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c8959248bfc2256bdc27e3ddd95ae223ec03df6e'
context:
  - 'docs/school-settings-catalog.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tab `Thông tin trường` chỉ có tên, múi giờ, năm học và một card `Thông tin đối soát` chung không gắn với task/bản ghi cụ thể. School Admin cần quản lý hồ sơ nhận diện của Trường, gồm banner và logo có thể thay đổi, cùng thông tin liên hệ thực tế.

**Approach:** Thay card audit chung bằng form `Hồ sơ trường` có banner/logo preview, tên hiển thị, địa chỉ, điện thoại hỗ trợ, email hỗ trợ và timezone chỉ đọc. Mô phỏng upload chỉ preview local; form chỉ phản ánh profile được lưu sau server-confirmed Operation. Dùng original PassionEdu surface/fallback, không sao chép visual, logo, copy hay branding của ảnh tham khảo.

## Boundaries & Constraints

**Always:** School name/context luôn hiển thị độc lập với logo/banner. Profile thuộc đúng School và server là nguồn authorization, validation, persistence, audit/snapshot; browser chỉ có draft/preview. Logo/banner nhận một tệp JPEG, PNG hoặc WebP tối đa 10 MB, có label/help/error accessible; tệp không hợp lệ không thay preview. Chọn file/đổi field đánh dấu dirty và đi qua switch guard; submit dùng named confirmation, idempotent Operation/reconciliation, không optimistic save. Timezone `Asia/Ho_Chi_Minh (Việt Nam)` read-only; năm học là context, không phải profile field. Preview object URL được revoke khi thay/reset; không dùng data URL, localStorage, IndexedDB, service-worker cache hay permanent media URL.

**Ask First:** Hỏi trước khi thêm backend/API/schema/storage, có media thật/retention/virus scanning, dùng profile media trong Parent authenticated responses, thay đổi School authorization/profile snapshot semantics, hoặc thêm field ngoài name/address/support phone/support email/logo/banner.

**Never:** Không giữ card `Thông tin đối soát` chung; không copy branding/reference image; không coi `accept`/client validation là security enforcement; không hiển thị profile save success trước terminal Operation; không biến logo/banner thành định danh duy nhất.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở profile | School Admin mở tab | Banner/logo fallback nguyên bản, profile facts và form | N/A |
| Chọn media hợp lệ | Một JPEG/PNG/WebP <=10 MB | Preview local + tên tệp; form dirty, chưa nói đã lưu | Không gọi network/persist |
| Media không hợp lệ | MIME khác hoặc >10 MB | Preview cũ giữ nguyên; summary focus + lỗi cạnh field | Không gửi Operation |
| Lưu profile | Fields hợp lệ + confirmed submit | Server terminal result mới cập nhật fixture/timestamp/committed preview | Timeout giữ Operation ID, không submit lại |
| Đổi School/discard | Profile draft dirty | Guard cho phép bỏ form/preview; giải phóng local URL và xóa old context | Không giữ media/profile Trường cũ |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:24-26` -- thay School info/audit generic bằng profile form, media preview and fields.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css:7` -- shared style sheet; add compact responsive profile banner/logo layout using existing tokens.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:93-184,672-792` -- Operation/reconciliation, context discard and form binding; add narrowly scoped profile-media preview/validation without affecting calendar/policy flows.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs:20-137` -- Settings JSDOM behavior suite; extend default tab/profile media/validation/reconciliation/dirty guard coverage.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:124-152` -- static Settings contracts; protect profile media structure and ensure calendar contract remains separate.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:11` -- update Settings inventory from audit generic to profile/branding task.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/school-settings.html` -- replace generic audit card with SchoolProfile form, original banner/logo fallback, profile/contact fields, readonly timezone, upload inputs and save action -- make tab actionable and identifiable.
- [x] `mockups/prototype.css` -- add responsive profile branding layout with accessible fallback, no copied visual identity -- preserve PassionEdu visual language across desktop/mobile.
- [x] `mockups/prototype.js` -- bind local preview, MIME/size errors, object URL cleanup, dirty guard, terminal-only profile fixture update and reconciliation -- provide safe UX-only media flow.
- [x] `test-school-settings-ux.mjs` -- test profile fields, valid/invalid media, no optimistic committed state, reconciliation and discard cleanup -- cover media/profile matrix.
- [x] `test-rendered-mockup-contracts.mjs` and `MOCKUP-COVERAGE.md` -- add static profile contract and update inventory while preserving calendar/settings tab checks -- prevent regression.

**Acceptance Criteria:**
- Given School Admin opens Thông tin trường, when it renders, then it shows School name/profile/contact facts, original banner/logo fallback and no generic audit card.
- Given a valid logo or banner is selected, when preview appears, then it is explicitly local/draft and no server-confirmed save is claimed; given invalid type/size, then preview stays unchanged and accessible field error appears.
- Given School Admin saves valid profile changes, when terminal Operation returns, then server-confirmed profile/timestamp state updates; before terminal outcome no committed state changes.
- Given profile draft is dirty, when School context switches or draft is discarded, then fields/media preview clear safely and no previous School profile media remains.
- Given Settings checks run, when profile and existing tabs/calendar/BankAccount are tested, then all pass with no backend/schema/API modification.

## Design Notes

The banner is a restrained full-width identity surface in `surface-tint`, with original abstract school-mark fallback. A compact logo overlaps its lower edge only on desktop; mobile stacks preview and fields. It never becomes a marketing hero. Contact facts are direct form fields; save is beside the compact profile heading. Audit is record-specific through historical policy/holiday/BankAccount disclosures, not a generic profile card.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: profile media, Settings tabs/calendar and BankAccount lifecycle pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: shared rendered contracts pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: no whitespace error.

## Suggested Review Order

**Profile Surface**

- Generic audit becomes an actionable SchoolProfile with original branding fallback.
  [`school-settings.html:24`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L24)

- Responsive banner/logo layout remains a restrained Settings surface.
  [`prototype.css:7`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css#L7)

**Media And Persistence**

- Local preview validation, cleanup and terminal-only profile confirmation are isolated here.
  [`prototype.js:6`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L6)

- Profile submit carries draft fields only through an idempotent Operation.
  [`prototype.js:740`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L740)

**Regression Protection**

- JSDOM checks preview, invalid media, reconciliation and School discard behavior.
  [`test-school-settings-ux.mjs:26`](test-school-settings-ux.mjs#L26)
