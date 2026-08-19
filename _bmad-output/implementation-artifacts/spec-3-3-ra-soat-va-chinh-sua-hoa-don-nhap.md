---
title: 'Story 3.3: Rà soát và chỉnh sửa Hóa đơn nháp'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7a95d5e4f723d4f7b06655e8d705eba24ceb4910'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Hóa đơn `DRAFT` tạo từ batch mới chỉ có summary read-only, nên Admin chưa thể kiểm tra, hiệu chỉnh các dòng thu hoặc lưu lựa chọn thanh toán trước khi chuyển trạng thái ở Story 3.4.

**Approach:** Mở rộng detail resource và thêm cập nhật `DRAFT` nguyên tử, để editor trang riêng chỉnh dòng hóa đơn và lựa chọn thanh toán với API tính tổng chính xác; các trạng thái đã khóa chỉ xem.

## Boundaries & Constraints

**Always:** Chỉ Admin đã xác thực truy cập/mutate. `PATCH /invoices/:id` chỉ chấp nhận `DRAFT`, thay đổi các line có `description`, `feeGroup` tùy chọn, `amount` VND nguyên trong `[-100_000_000, 100_000_000]`, và tự tính `total` bằng `bigint`; không nhận total client. Tiền mặt không có tài khoản; chuyển khoản chỉ chọn tài khoản `ACTIVE` tại lúc lưu. Detail trả line theo `position`, snapshot Học sinh/Lớp, payment selection và audit tạo, với `billingMonth` `YYYY-MM`, UUID/timestamp chuẩn và tiền JSON safe. Web dùng REST credentialed, chỉ invalidate sau response thành công, preview tổng tức thì, xóa dòng khác 0 phải xác nhận nhẹ, và không render control sửa khi không phải `DRAFT`.

**Block If:** Cần thay REST list contract của Story 3.1, sửa migration đã commit, hoặc persistence hiện tại không thể nhận migration forward-only cho lựa chọn payment DRAFT.

**Never:** Không transition `DRAFT -> PENDING`, trả `PENDING -> DRAFT`, snapshot payment khóa, QR, completion hay thay đổi schema API batch/idempotency. Không dùng float, không hard-delete tài khoản, không dùng dữ liệu nguồn thay thế snapshot Học sinh/Lớp/Dòng hiện có.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lưu nháp hợp lệ | `DRAFT`, danh sách line hợp lệ và cash hoặc transfer/tài khoản active | Transaction thay thế/sắp thứ tự line, tính lại total, lưu payment selection và trả detail mới | Không có lỗi |
| Giá trị line biên | Amount `-100_000_000`, `0`, `100_000_000` | API nhận và tổng là phép cộng bigint chính xác | Amount ngoài miền bị từ chối theo error chuẩn |
| Thanh toán không hợp lệ | Cash kèm account, transfer thiếu account, hoặc account inactive/không tồn tại | Không đổi invoice | API trả field/domain error; UI giữ dữ liệu nhập |
| Invoice đã khóa | `PENDING` hoặc `COMPLETED` gọi PATCH/mở detail | PATCH bị từ chối; detail chỉ đọc payment/line | Không có editor hay action chỉnh sửa ở web |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice` có snapshot header/total và relation `InvoiceItem`; thêm persistence payment selection DRAFT bằng migration mới, không sửa migration đã commit.
- `apps/api/src/modules/invoices/invoices.dto.ts` -- DTO list/detail/batch hiện có; thêm DTO PATCH line/payment và validation amount/UUID, không khai báo total client.
- `apps/api/src/modules/invoices/invoices.controller.ts` -- thêm `PATCH /invoices/:id` sau route action tĩnh, dùng guard/CSRF middleware chung và `CurrentAdmin`.
- `apps/api/src/modules/invoices/invoices.service.ts` -- tái dùng `safeMoney`/month serializer; `get` cần include lines ordered và creator, update chạy transaction, guard DRAFT, account ACTIVE và total bigint.
- `apps/api/src/modules/invoices/{invoices.dto.test.ts,invoices.service.test.ts,invoices.integration.test.ts}` -- mở rộng coverage validation, lifecycle guard, persistence line/payment và total.
- `apps/web/src/features/invoices/api.ts` -- parser summary hiện dùng cho list/detail; thêm parser detail và mutation PATCH với `requestJson`, invalidate resource/list sau thành công.
- `apps/web/src/features/invoices/detail-page.tsx` -- hiện chỉ summary read-only; thay bằng editor DRAFT hai cột responsive, confirmation xóa non-zero và view read-only state khác.
- `apps/web/src/features/bank-accounts/api.ts` -- tái dùng `useBankAccounts` với filter `ACTIVE` cho picker, không sửa UI quản trị account.
- `apps/web/src/index.css` -- tái dùng token/table/summary, thêm style editor và breakpoint stack tối thiểu.
- `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}` và `apps/web/e2e/invoices.spec.ts` -- cover parser/mutation, editor primary flow và readonly states.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_add_invoice_draft_payment/migration.sql` -- thêm payment selection có thể chỉnh khi DRAFT qua migration forward-only -- persist lựa chọn của editor.
- `apps/api/src/modules/invoices/{invoices.dto.ts,invoices.controller.ts,invoices.service.ts}` -- thêm detail đầy đủ và PATCH transaction với validation line/payment, DRAFT guard và total server-side -- cung cấp API authoritative.
- `apps/api/src/modules/invoices/{invoices.dto.test.ts,invoices.service.test.ts,invoices.integration.test.ts}` -- test matrix line, payment active, status guard và snapshot persistence -- khóa các invariant tài chính.
- `apps/web/src/features/invoices/{api.ts,detail-page.tsx,api.test.ts,detail-page.test.tsx}` -- parse/update detail và editor accessible DRAFT/read-only state -- cung cấp bề mặt Admin.
- `apps/web/src/index.css`, `apps/web/e2e/invoices.spec.ts` -- responsive two-column/stack và browser flow editor -- xác minh desktop/narrow cùng luồng chính.

**Acceptance Criteria:**
- Given Admin mở DRAFT, when detail tải, then trang riêng hiển thị editor line bên trái và summary snapshot/audit/payment bên phải, đồng thời stack ở màn hẹp.
- Given Admin thêm, sửa, xóa hoặc sắp xếp line, when lưu dữ liệu hợp lệ, then UI preview tổng tức thì và API persist line ordered/tổng tính server-side mà không nhận total client.
- Given Admin chọn cash hoặc transfer, when lưu, then cash không có account và transfer chỉ lưu account active; lỗi giữ dữ liệu đã nhập.
- Given invoice PENDING hoặc COMPLETED, when Admin mở/cố update detail, then UI chỉ đọc và API từ chối mutation.

## Design Notes

Lựa chọn payment ở đây là dữ liệu chỉnh sửa của `DRAFT`, không phải snapshot lịch sử. Story 3.4 sẽ sở hữu việc khóa/snapshot dữ liệu ấy khi transition sang `PENDING`; do đó resource detail phải biểu diễn rõ selection hiện tại nhưng không triển khai action lifecycle sớm.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: DTO/service invoice tests pass.
- `pnpm --filter api test:integration` -- expected: PostgreSQL migration và draft update persistence pass.
- `pnpm --filter web test` -- expected: invoice API/detail component tests pass.
- `pnpm --filter web test:e2e` -- expected: browser invoice editor flow pass.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace checks pass.

## Review Triage Log

### 2026-08-19 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10 (high 0, medium 7, low 3)
- defer: 0
- reject: 4
- addressed_findings:
  - `[medium]` `[patch]` Reject empty/whitespace-only lines and totals outside JSON-safe range before persistence.
  - `[medium]` `[patch]` Retry serializable draft-update conflicts, matching the compact batch transaction pattern.
  - `[medium]` `[patch]` Preserve input focus with stable editor-row keys and remount only when invoice ID changes.
  - `[medium]` `[patch]` Load active accounts only for drafts and request the maximum supported picker page size.
  - `[medium]` `[patch]` Block incomplete/invalid local editor input with a direct error before submitting.
  - `[low]` `[patch]` Reflect unsaved payment selection in the detail summary and reject inconsistent payment payloads from the API.

## Auto Run Result

Status: done

Summary: Added an editable draft-invoice detail page with server-authoritative line and payment updates, while preserving read-only views for locked invoices.

Files changed:

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260819130000_add_invoice_draft_payment/migration.sql` -- persist draft payment selection.
- `apps/api/src/modules/invoices/{invoices.dto.ts,invoices.controller.ts,invoices.service.ts}` -- validate and atomically update DRAFT lines/payment, calculate total with bigint, and return complete detail resources.
- `apps/web/src/features/invoices/{api.ts,detail-page.tsx}` -- parse detail resources, submit PATCH updates, and render the responsive editor/read-only views.
- `apps/web/src/features/bank-accounts/api.ts` and `apps/web/src/index.css` -- support the active account picker and editor layout.
- `apps/api/src/modules/invoices/invoices.dto.test.ts`, `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}`, and `apps/web/e2e/invoices.spec.ts` -- cover DTO, detail parser/editor, and detail contract changes.

Review findings: 10 patches applied (medium 7, low 3); 0 deferred; 4 rejected as out of scope or not applicable. Follow-up review recommendation: true (score 24).

Verification performed:

- `pnpm --filter api test` -- pass, 82 tests.
- `pnpm --filter api test:integration` -- pass, 29 tests; fresh PostgreSQL migration including draft payment migration applied.
- `pnpm --filter web test` -- pass, 74 tests.
- `pnpm --filter web test:e2e` -- pass, 22 tests.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` -- all pass after review repair.

Residual risks: The account picker is capped at the API maximum of 100 active accounts; a deployment with more than 100 active receiving accounts needs a search-capable picker in a later focused change.
