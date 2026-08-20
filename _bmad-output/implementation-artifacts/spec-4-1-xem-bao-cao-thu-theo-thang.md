---
title: 'Story 4.1: Xem báo cáo thu theo tháng'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c517bb13ab2d42a31f36d3d87a91afe54d5e493d'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Admin chưa có số liệu đối soát thu tiền theo tháng đáng tin cậy và không thể phân tích nguồn tiền mặt, chuyển khoản hay từng tài khoản nhận tiền từ dữ liệu hóa đơn đã chốt.

**Approach:** Bổ sung REST báo cáo chỉ đọc aggregate từ snapshot của Hóa đơn `COMPLETED`, rồi hiển thị Tổng quan và Báo cáo responsive cùng ngữ cảnh tháng, trạng thái và lối tắt điều hướng có ích.

## Boundaries & Constraints

**Always:** API là nguồn chân lý, chỉ aggregate `COMPLETED` theo `billingMonth` `YYYY-MM`, dùng `BIGINT` và chỉ serialize số nguyên JSON an toàn. Breakdown chuyển khoản lấy toàn bộ định danh/tên từ payment snapshot, không đọc `BankAccount` nguồn. Các route yêu cầu session auth; web gọi GET qua React Query, query key bắt đầu bằng REST resource, mặc định/thể hiện tháng hiện tại và giữ dữ liệu thấy được khi request tháng mới lỗi.

**Block If:** Prisma hoặc Hóa đơn hiện hữu không còn lưu đủ payment snapshot để nhóm báo cáo mà không đọc dữ liệu nguồn có thể thay đổi.

**Never:** Không thêm mutation, CSV/Excel, thay đổi lifecycle/snapshot hóa đơn, schema/migration không cần thiết, hay aggregate `DRAFT`/`PENDING` vào số tiền đã thu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Báo cáo tháng có dữ liệu | `GET /reports/monthly?billingMonth=2026-08`, Hóa đơn `COMPLETED` tiền mặt/chuyển khoản | `{ data }` có tổng thu, tiền mặt, chuyển khoản và từng snapshot tài khoản; các tổng là integer an toàn | Không có lỗi |
| Hóa đơn không hoàn tất | Cùng tháng có `DRAFT`/`PENDING` | Không đóng góp vào mọi tổng thu; overview vẫn trả số lượng theo từng trạng thái | Không có lỗi |
| Tài khoản nguồn thay đổi | Snapshot chuyển khoản tồn tại, `BankAccount` đã sửa/ngừng dùng | Nhóm báo cáo giữ tên, mã ngân hàng và số tài khoản snapshot | Không join/đọc nguồn |
| Tháng không hợp lệ hoặc tải lỗi | Thiếu/sai `billingMonth`, hoặc request web thất bại sau dữ liệu cũ | API validation chuẩn; UI giữ dữ liệu cũ, lỗi gần bề mặt và toast ngắn | Không xóa report đang hiển thị |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice` đã có `billingMonth`, `status`, `total` BIGINT và trường payment snapshot; index `[billingMonth, status, classId, createdAt, id]` đáp ứng truy vấn read-only, không cần migration.
- `apps/api/src/app.module.ts` -- đăng ký global session guard và cần import `ReportsModule` mới.
- `apps/api/src/modules/invoices/invoices.dto.ts` -- tái dùng quy ước validation regex `YYYY-MM` cho query DTO báo cáo.
- `apps/api/src/modules/invoices/invoices.service.ts` -- `toSafeMoney` là quy ước serialize BIGINT an toàn; aggregate báo cáo phải duy trì cùng bảo vệ biên API.
- `apps/api/src/modules/invoices/invoices.controller.ts` -- mẫu controller mỏng cho REST resource được bảo vệ toàn cục.
- `apps/api/src/modules/invoices/{invoices.service.test.ts,invoices.integration.test.ts}` -- fixtures lifecycle/snapshot và kiểu test Vitest/PostgreSQL để kiểm chứng aggregate chỉ `COMPLETED` và snapshot bền vững.
- `apps/web/src/app/app.tsx` -- pathname switch và QueryClient; thay placeholder `/` bằng overview, thêm route `/bao-cao`.
- `apps/web/src/app/routes.ts` -- navigation `/bao-cao` đã tồn tại, không đổi IA.
- `apps/web/src/app/api/client.ts` -- `getJson` credentialed là client read-only phải tái dùng.
- `apps/web/src/features/invoices/{api.ts,page.tsx}` -- parser runtime, React Query key `['invoices', ...]`, URL query `month`, month picker và format VND là mẫu trực tiếp cho report/shortcuts.
- `apps/web/src/features/overview/page.tsx` -- placeholder hiện hữu cần thay bằng bề mặt số liệu tổng quan.
- `apps/web/src/index.css` -- token/layout và `.skeleton`, `.error-state`, `.money` sẵn có; thêm layout KPI/breakdown responsive, card dưới 768px.
- `apps/web/e2e/{invoices.spec.ts,application-shell.spec.ts}` -- mock auth/API và kiểm tra navigation/responsive, mở rộng observable report/overview flow.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/reports/{reports.module.ts,reports.controller.ts,reports.dto.ts,reports.service.ts}` -- tạo resource GET báo cáo tháng và tổng quan, validate tháng, aggregate Hóa đơn/snapshot read-only, serialize tiền an toàn -- cung cấp contract REST chính thức.
- [x] `apps/api/src/app.module.ts` -- import `ReportsModule` -- đưa các endpoint đã bảo vệ vào API.
- [x] `apps/api/src/modules/reports/{reports.service.test.ts,reports.integration.test.ts}` -- kiểm chứng phân loại trạng thái, cash/transfer, grouping snapshot, số an toàn và validation trên PostgreSQL -- bảo vệ tính đúng đắn tài chính.
- [x] `apps/web/src/features/reports/{api.ts,page.tsx,api.test.ts,page.test.tsx}` -- parse contract, tải theo `month` URL và render KPI/breakdown/loading/error accessible -- tạo bề mặt Báo cáo.
- [x] `apps/web/src/features/overview/page.tsx` -- dùng contract summary để render KPI trạng thái và shortcut Hóa đơn/Báo cáo giữ month/status -- biến Tổng quan thành thao tác vận hành có ngữ cảnh.
- [x] `apps/web/src/app/app.tsx` và `apps/web/src/index.css` -- route explicit và kiểu KPI/breakdown responsive mobile -- bảo đảm navigation và UX desktop/mobile.
- [x] `apps/web/e2e/{reports.spec.ts,application-shell.spec.ts}` -- mock REST, kiểm chứng month/default/shortcut/breakdown và card mobile -- bảo vệ hành vi quan sát được trong browser.

**Acceptance Criteria:**
- Given Admin mở Tổng quan hoặc Báo cáo, when chưa chọn tháng, then month picker `MM/YYYY` dùng tháng hiện tại và tải báo cáo REST với `billingMonth` `YYYY-MM`.
- Given tháng có Hóa đơn nhiều trạng thái, when API tạo dữ liệu báo cáo, then tổng đã thu, tiền mặt, chuyển khoản và breakdown chỉ tính `COMPLETED`; Tổng quan đồng thời hiển thị đúng số lượng `Nháp`, `Chờ xác nhận`, `Đã hoàn tất`.
- Given tài khoản nguồn của Hóa đơn hoàn tất bị sửa/ngừng dùng, when xem báo cáo, then nhóm chuyển khoản hiển thị định danh/tên snapshot và tổng không thay đổi.
- Given dữ liệu Báo cáo tải xong, when Admin xem desktop hoặc mobile dưới 768px, then KPI có VND dễ đọc/accessible, desktop có breakdown rõ ràng và mobile dùng card dọc với đúng một `h1` mỗi route.
- Given Admin dùng shortcut từ Tổng quan, when mở Hóa đơn hoặc Báo cáo, then URL giữ tháng và trạng thái liên quan thay vì dẫn đến trang không ngữ cảnh.

## Design Notes

Một endpoint summary có thể dùng cùng tháng để tránh web tự tính số liệu: nó trả counts cho Tổng quan và report totals/breakdown cho Báo cáo. Service phải query payment snapshot từ Invoice trực tiếp; `BankAccount` chỉ là dữ liệu cấu hình, không phải nguồn lịch sử.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: reports unit và các API test hiện có pass.
- `pnpm --filter api test:integration` -- expected: aggregate PostgreSQL/snapshot reports và integration hiện có pass.
- `pnpm --filter web test` -- expected: report/overview parser và component test pass.
- `pnpm --filter web test:e2e` -- expected: flow Báo cáo/Tổng quan browser pass.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace checks pass.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 0, medium 4, low 1)
- defer: 0
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` Dùng `billingMonth` của response retained cho KPI, thông báo tháng và mọi shortcut để không gắn số liệu cũ với tháng picker mới.
  - `[medium]` `[patch]` Thêm toast ngắn, chỉ kích hoạt một lần mỗi đợt lỗi, song song với lỗi inline khi giữ số liệu cũ.
  - `[medium]` `[patch]` Chỉ aggregate tiền khi trạng thái đúng `COMPLETED`; trạng thái khác không thể được coi là đã hoàn tất.
  - `[low]` `[patch]` Tách tiện ích định dạng/tháng thuần khỏi React page để Tổng quan không phụ thuộc module trang Báo cáo.
  - `[medium]` `[patch]` Bổ sung coverage controller validation, aggregate/snapshot, retained error/retry, overview shortcut và đổi tháng E2E.

## Auto Run Result

Status: done

Summary: Thêm báo cáo thu tháng read-only từ snapshot Hóa đơn hoàn tất, Tổng quan theo tháng có shortcut vận hành và trang Báo cáo responsive cho desktop/mobile.

Files changed:

- `apps/api/src/modules/reports/*` -- module REST, DTO, aggregate snapshot và unit/integration/controller coverage cho báo cáo tháng.
- `apps/api/src/app.module.ts` -- đăng ký `ReportsModule` dưới auth guard toàn cục.
- `apps/web/src/features/reports/*` -- REST parser, query, format utility, KPI/breakdown, error toast và tests.
- `apps/web/src/features/overview/{page.tsx,page.test.tsx}` -- thay placeholder bằng dashboard tháng, trạng thái và shortcut có ngữ cảnh.
- `apps/web/src/app/app.tsx`, `apps/web/src/index.css`, `apps/web/e2e/reports.spec.ts` -- route Báo cáo, layout responsive và flow trình duyệt.
- `_bmad-output/implementation-artifacts/{epic-4-context.md,spec-4-1-xem-bao-cao-thu-theo-thang.md,sprint-status.yaml}` -- context, trạng thái Story và sprint tracking.

Review findings: 5 patches applied (high 0, medium 4, low 1); 0 deferred; 10 rejected. Follow-up review recommendation: true (score 13).

Verification performed:

- `pnpm --filter api test` -- pass, 91 tests.
- `pnpm --filter api test:integration` -- pass, 35 PostgreSQL-backed tests with fresh migrations.
- `pnpm --filter web test` -- pass, 88 tests.
- `pnpm --filter web test:e2e` -- pass, 25 Playwright tests.
- `pnpm lint && pnpm typecheck && pnpm build` -- all pass.
- `git diff --check` -- pass.

Residual risks: Báo cáo aggregate dữ liệu tháng trong service memory, phù hợp quy mô vận hành mầm non hiện tại nhưng cần chuyển aggregate xuống PostgreSQL nếu quy mô hóa đơn tăng đáng kể. Hạ tầng integration test hiện phát cảnh báo deprecation của `pg` khi teardown concurrent query; suite vẫn pass và không do Story này tạo ra.
