---
title: 'Mockup báo cáo Finance đối soát ledger'
type: 'feature'
created: '2026-09-16'
status: 'blocked'
baseline_commit: '65adf97423d259f878c21ceb97555c33438c1ffd'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Finance reporting đã có contract `asOf`, bốn workspace và CSV an toàn, nhưng chưa có mockup Admin diễn đạt các contract đó nhất quán với các mockup Finance hiện hữu. Thiếu bề mặt này làm implementation dễ quay về bảng tổng hợp chung, dùng state browser hoặc lộ export không được kiểm soát.

**Approach:** Tạo một mockup báo cáo Finance read-only dùng chung Admin shell và Finance visual language hiện có. Mockup minh họa overview làm trạng thái mặc định, chuyển được bốn workspace, filter/context server-returned, drill-down nguồn hợp lệ, CSV lifecycle và các safe state; inventory và test mockup được cập nhật cùng lúc.

## Boundaries & Constraints

**Always:** Giữ selected School rõ ràng; Finance Manager/School Admin là actor fixture duy nhất có destination; render chỉ dùng VND integer server-returned; hiển thị `asOf`, generated time, `Asia/Ho_Chi_Minh`, normalized filter và definition version; dùng `prototype.css`, `finance-style.css`, `admin-shell.js` và pattern Finance hiện hữu; bảng có caption, điều khiển bàn phím và VND right-aligned; School switch hoặc export revoke/expiry xóa result cũ và về safe state.

**Ask First:** Hỏi trước khi thêm API, schema, shared component runtime, thay đổi Finance lifecycle, hoặc thêm scope period close/reopen, scheduled/custom report, PDF/XLSX hay Payroll reporting.

**Never:** Không tính/aggregate tiền hoặc tạo CSV trong browser; không tin `schoolId`/filter browser là authorization; không thêm Parent data/action, mutation Finance, direct object URL, PDF/XLSX, custom dashboard hay report Payroll; không sửa mockup legacy ngoài integration shell/navigation cần thiết.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Overview result | Finance actor mở report với filter hợp lệ | Overview hiện gross, discount, refund, net billed, actual receipt và outstanding cùng metadata server | Không suy diễn total ở browser |
| Workspace switch | Actor chọn run reconciliation, debt hoặc cash ledger | URL/state đổi workspace, giữ School/context hợp lệ và chỉ hiện rows/drill-down Finance được phép | Route không hợp lệ về overview an toàn |
| Empty result | Server không trả ledger activity theo filter/asOf | Giữ School/filter/metadata và nói không có activity khớp | Không nói “0 đã thu” khi không có `asOf` |
| CSV unavailable | Export bị expired hoặc actor bị revoke | Result/export cũ bị xóa, hiện safe state và hướng dẫn tải lại report | Không retry/giả lập file local |
| School switch | Actor đổi School khi đang xem result | Xóa filter/result cũ trước khi render context mới | Không để data School cũ xuất hiện |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- Finance Admin page/header/filter/table markup và inline interaction gần nhất với workspace mới.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html` -- Finance deep-destination, immutable source and operation-safe state copy.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-style.css` -- Reuse Finance cards, metrics, filters, badges, table and responsive layout; tránh tạo visual system mới.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- Shared Admin sidebar/context shell; add authorized `Báo cáo` route without changing unrelated destinations.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Canonical mockup inventory requiring a reporting row.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- Existing static rendered-contract assertions; extend for report path/forbidden features.
- `_bmad-output/implementation-artifacts/test-finance-report-ux.mjs` -- New JSDOM behavioral contract test for workspace state, School reset, metadata, CSV and safe states.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-report.html` -- Add the responsive Finance reporting destination with four read-only workspace tabs, server-result metadata/filter context, summary/table/drill-down samples, and loading/error/empty/expired-export safe states -- makes Story 6.5 reviewable without implying browser authority.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- Add the authorized Finance `Báo cáo` navigation destination and active route support -- makes the new mockup reachable through the same shell as other Finance workspaces.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Add the report mockup inventory and contract boundary -- preserves mockup traceability.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- Assert report route, server-result metadata, four workspaces, CSV-only boundary and forbidden capabilities -- protects static contract alignment.
- [x] `_bmad-output/implementation-artifacts/test-finance-report-ux.mjs` -- Add JSDOM behavior assertions for workspace navigation, query/context retention, no-data copy, CSV expiry/revoke and School-switch clear -- protects safe interaction behavior.

**Acceptance Criteria:**
- Given an authorized Finance fixture opens Báo cáo, when the report loads, then all four read-only workspaces are discoverable and only ledger-derived VND values, `asOf`, generated time, timezone, normalized filter and definition version are presented.
- Given the actor changes a workspace or valid filter, when the result refreshes, then the URL/context remains explainable and rows preserve the appropriate billing-month or posting-time meaning with authorized Finance drill-down only.
- Given CSV is available, when the actor requests it, then the mockup describes export of the exact authorized result and metadata; PDF/XLSX, local CSV generation and direct object links are absent.
- Given no matching result, expired export, revoked access or School change, when the state occurs, then stale result/export data is cleared and the page preserves only safe current context with accessible explanation.
- Given existing Finance mockups define the Admin visual language, when this screen renders on desktop or mobile, then it reuses their shell, tokens, table/card responsiveness, focusable controls and status conventions.

## Design Notes

The default overview should prioritize reconciliation, not a decorative dashboard: a compact metric row followed by a source-linked table. Workspace tabs are views over server-returned data, not client-side financial calculations. Keep the route under Finance and visibly label the selected School, so the screen never suggests global reporting authority.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: report static contract assertions pass.
- `node _bmad-output/implementation-artifacts/test-finance-report-ux.mjs` -- expected: workspace, context, CSV and safe-state assertions pass.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-report.html` -- expected: valid static HTML.

## Suggested Review Order

**Report Contract**

- Bốn workspace chỉ render fixture đã được server cấp quyền.
  [`finance-report.html:13`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-report.html#L13)

- Query/filter mới luôn vào loading, không dựng lại ledger result trong browser.
  [`finance-report.html:43`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-report.html#L43)

- Safe states xóa metadata cũ và CSV chỉ hồi phục từ fixture mới.
  [`finance-report.html:40`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-report.html#L40)

**Shell And Traceability**

- Báo cáo chỉ xuất hiện trong fixture đã được cấp quyền Finance.
  [`admin-shell.js:11`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L11)

- Inventory mô tả filter, provenance và state của mockup mới.
  [`MOCKUP-COVERAGE.md:21`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L21)

**Verification**

- Test JSDOM bao phủ query, workspace, provenance và safe-state recovery.
  [`test-finance-report-ux.mjs:14`](test-finance-report-ux.mjs#L14)

- Test mockup được đưa vào một script pnpm có thể chạy lặp lại.
  [`package.json:5`](../../package.json#L5)

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 1 (high 1)
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 18 (high 4, medium 11, low 3)
- addressed_findings:
  - none

## Auto Run Result

Status: blocked

Blocking condition: intent gap

- Tóm tắt: Lượt review xác nhận artifact này chỉ là mockup UX cho Finance report. Canonical Story 6.5 trong `epics-passionedu.md` vẫn yêu cầu API server-authoritative, authorization theo School, ledger aggregation/as-of, CSV opaque expiring có re-authorization và audit, integration/E2E proof. Tracker hiện ghi `6-5-bao-cao-finance-reconcile-tu-ledger: backlog`.
- Patch đã lưu: `_bmad-output/implementation-artifacts/story-6-5-intent-gap-2026-09-25.patch`. Patch chỉ ghi nhận chuyển trạng thái review tạm thời của lượt auto-run và đã được khôi phục bằng trạng thái blocked.
- Review findings: 0 patch; 0 deferred; 18 rejected vì thuộc mockup slice hoặc không thể tự sửa mà không thay đổi phạm vi/captured intent. Các vấn đề đáng chú ý gồm direct URL authorization, kết thúc loading khi đổi workspace/filter, bảo toàn context khi CSV expiry/revoke, drill-down destination, và test runtime độc lập package-manager.
- Verification: chưa chạy lại các command mockup vì workflow dừng tại intent gap trước khi có phạm vi implementation hợp lệ.
- Rủi ro còn lại: Không được cập nhật sprint status thành done hoặc tạo completion commit cho Story 6.5 khi chưa có production implementation và release proof theo epic contract.
