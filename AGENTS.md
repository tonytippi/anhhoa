<!-- bmad:context -->
<!-- Verified 2026-08-18 against 2cbf3a1. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Anh Hoa

Dashboard nội bộ quản lý học sinh, lớp và hóa đơn trường mầm non. Dự án dùng BMad Method để quản lý planning artifact và workflow; PRD là nguồn tham khảo chính cho yêu cầu/phạm vi. UX specification và architecture spine quy định lần lượt trải nghiệm và các invariant kỹ thuật. Code sẽ là pnpm/Turborepo với React/Vite PWA ở `apps/web` và NestJS/Prisma ở `apps/api`.

## Policy

- Không đưa secret vào repository; chỉ dùng `.env` cục bộ và giữ `.env.example` không có giá trị thật.
- Không sửa các artifact đã `final` trong `_bmad-output/planning-artifacts/` để thay đổi yêu cầu; tạo/cập nhật artifact qua workflow phù hợp.
- Khi bắt đầu scaffold, tuân theo `ARCHITECTURE-SPINE.md`; không thay đổi AD đã chốt nếu chưa cập nhật architecture spine.

## Where things are

- **Nguồn yêu cầu chính:** `_bmad-output/planning-artifacts/prds/prd-anhhoa-2026-08-18/prd.md`
- UI behavior and visual system: `_bmad-output/planning-artifacts/ux-designs/ux-anhhoa-2026-08-18/`
- Architecture invariants: `_bmad-output/planning-artifacts/architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md`
- Khi tái sử dụng Google OAuth hoặc VietQR, chỉ tham khảo chọn lọc `../grapeseed`; không sao chép mô hình campus, giáo viên, phụ huynh, khóa học hoặc multi-role.

## Conventions that differ from defaults

- Đặt quy tắc hóa đơn, snapshot, audit, QR và báo cáo trong `apps/api`; `apps/web` chỉ gọi REST API.
- Lưu tiền VND nguyên bằng PostgreSQL `BIGINT`; không dùng số thực và không tin tổng tiền do client gửi.
- Không xóa cứng Lớp, Học sinh hoặc Tài khoản nhận tiền; dùng trạng thái và giữ snapshot trên Hóa đơn.
- Hóa đơn chỉ đi theo `DRAFT -> PENDING -> COMPLETED`; `COMPLETED` chỉ xem.
- Bảo vệ mutation cookie-auth bằng origin validation, double-submit CSRF và idempotency UUID cho tạo hóa đơn hàng loạt, chuyển cả lớp và xác nhận thanh toán.

## Known pitfalls

- Chưa có command build/test đã xác minh. Sau khi scaffold, refresh `AGENTS.md` để ghi command thực tế và các caveat từ CI/test.
- Sau timeout của mutation có idempotency, đối soát `GET /operations/:operationId` trước khi cho gửi lại; không coi timeout là thao tác thất bại.
<!-- /bmad:context -->
