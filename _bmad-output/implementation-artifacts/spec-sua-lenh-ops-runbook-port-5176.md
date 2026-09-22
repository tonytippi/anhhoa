---
title: 'Sửa lệnh khởi động Ops local tại port 5176'
type: 'bugfix'
created: '2026-09-22'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '75c56ba628b03dbcd1f114e2dd3e2969b0126846'
context:
  - 'docs/local-finance-admin-mvp.md'
  - 'apps/ops-web/package.json'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Lệnh Ops trong runbook có thêm `--` trước `--port 5176`. pnpm vì vậy gọi `vite -- --port 5176`; Vite nhận phần sau `--` như positional arguments thay vì option và quay về port mặc định `5173`.

**Approach:** Thay lệnh trong runbook bằng cú pháp pnpm chuyển trực tiếp option port cho script, đồng thời giải thích ngắn nguyên nhân và hướng dẫn dừng process đang chiếm port thay vì đổi origin OAuth/API cố định.

## Boundaries & Constraints

**Always:** Giữ topology Finance Admin MVP: API `3000`, Ops `5176`, Admin `5173`, và `VITE_API_URL=http://localhost:3000`. Câu lệnh phải tương thích pnpm `11.9.0` và script `dev: vite` hiện có.

**Ask First:** Hỏi trước khi sửa script package, thay đổi Vite config, OAuth origin/callback, CORS, hoặc bổ sung script khởi động mới.

**Never:** Không thay đổi code ứng dụng, port mặc định Vite, cấu hình API/OAuth, hay yêu cầu chạy Teacher/Parent chỉ để xử lý lỗi tài liệu này.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Khởi động Ops | Người dùng chạy lệnh documented, port 5176 đang rảnh | pnpm gọi `vite --port 5176`; Vite lắng nghe `http://localhost:5176` | Không có separator `--` thừa giữa script và option Vite |
| Port đã bị chiếm | `5176` có process khác lắng nghe | Vite không âm thầm dịch sang một origin khác | Runbook yêu cầu dừng process chiếm port; không đổi port/OAuth origin |

</frozen-after-approval>

## Code Map

- `docs/local-finance-admin-mvp.md:97-121` -- mục khởi động ba terminal; dòng Ops hiện dùng `dev -- --port 5176` và cần đổi thành `dev --port 5176`.
- `apps/ops-web/package.json:1` -- script `dev` là `vite`; pnpm truyền `--port 5176` trực tiếp thành `vite --port 5176`.
- `apps/ops-web/vite.config.ts` -- chỉ cấu hình plugin; không đặt server port và không nên sửa cho lỗi truyền tham số của runbook.
- `apps/web/package.json` và `docs/local-finance-admin-mvp.md:115-121` -- Admin cũng đang dùng cú pháp separator tương tự; cần kiểm tra và sửa đồng nhất để lệnh không bị Vite bỏ qua option dù port mặc định hiện trùng `5173`.

## Tasks & Acceptance

**Execution:**
- [x] `docs/local-finance-admin-mvp.md` -- thay cú pháp truyền port cho Ops và Admin từ `dev -- --port <port>` thành `dev --port <port>`; thêm ghi chú ngắn rằng `--` phụ làm Vite bỏ qua option -- bảo đảm lệnh đã chép/chạy thực sự giữ đúng origin.
- [x] `docs/local-finance-admin-mvp.md` -- đặt `--strictPort` cho Ops và Admin; Vite 8 hỗ trợ option này để fail-fast khi port topology cố định bị chiếm thay vì tự tìm port khác -- tránh OAuth/API origin sai trong manual test.

**Acceptance Criteria:**
- Given port `5176` đang rảnh, when người dùng chạy lệnh Ops trong runbook, then câu lệnh thực thi tương đương `vite --port 5176` và terminal báo local URL `http://localhost:5176`.
- Given port `5176` đã bị process khác chiếm, when người dùng chạy lệnh Ops documented, then Vite dừng với lỗi port thay vì tự dùng port khác.
- Given người dùng khởi động Admin theo runbook, when họ chạy câu lệnh documented, then câu lệnh không chứa separator `--` thừa trước option Vite và vẫn giữ port `5173`.

## Design Notes

pnpm 11 chuyển các arguments đặt sau tên script cho lệnh `vite`; thêm separator `--` trong vị trí hiện tại khiến `vite` nhận separator đó. Với CLI của Vite, mọi token sau separator không còn được parse là option. `--strictPort` thích hợp vì runbook đã tuyên bố origin OAuth/API cố định và yêu cầu dừng process chiếm port thay vì đổi port.

## Verification

**Commands:**
- `VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev --port 5176 --help` -- expected: output command là `vite --port 5176 --help`, chứng minh option tới Vite mà không có separator thừa.
- `pnpm --filter @passionedu/ops-web typecheck` -- expected: hoàn tất thành công; tài liệu không tác động TypeScript.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: hoàn tất thành công; tài liệu không tác động TypeScript.
- `git diff --check` -- expected: không có lỗi whitespace.

**Manual checks:**
- Chạy lệnh Ops mới khi `5176` rảnh và xác nhận dòng `Local` là `http://localhost:5176/`.
- Khi `5176` bị chiếm, xác nhận Vite không tự fallback sang một port khác.
