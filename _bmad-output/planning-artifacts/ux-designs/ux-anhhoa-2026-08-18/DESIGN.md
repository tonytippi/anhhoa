---
name: Anh Hoa Admin
description: Minimal, calm desktop-first operations UI for kindergarten invoicing.
status: final
sources:
  - ../../prds/prd-anhhoa-2026-08-18/prd.md
created: 2026-08-18
updated: 2026-08-18
colors:
  surface-base: '#FFFDF7'
  surface-raised: '#FFFFFF'
  surface-subtle: '#F6F4EC'
  text-strong: '#24261F'
  text-muted: '#66695F'
  border-subtle: '#E4E2D8'
  brand: '#277E48'
  brand-strong: '#1D6538'
  brand-soft: '#E7F2E9'
  accent: '#F1C928'
  accent-soft: '#FFF6C8'
  status-draft: '#8A6411'
  status-draft-bg: '#FFF3C5'
  status-pending: '#245FA6'
  status-pending-bg: '#E6F0FF'
  status-completed: '#287443'
  status-completed-bg: '#E5F4E9'
  danger: '#B42318'
  danger-bg: '#FEEBE8'
typography:
  body:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0.02em
  title:
    fontFamily: Clash Grotesk, Inter, sans-serif
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.15
  section-title:
    fontFamily: Clash Grotesk, Inter, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
  money:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 18px
  full: 9999px
  DEFAULT: 8px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  page-gutter: 32px
components:
  button-primary:
    background: '{colors.brand}'
    foreground: '#FFFFFF'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.surface-raised}'
    border: '{colors.border-subtle}'
    radius: '{rounded.md}'
  card:
    background: '{colors.surface-raised}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
  table-header:
    background: '{colors.surface-subtle}'
    foreground: '{colors.text-muted}'
  focus-ring:
    color: '{colors.brand}'
  status-draft:
    background: '{colors.status-draft-bg}'
    foreground: '{colors.status-draft}'
  status-pending:
    background: '{colors.status-pending-bg}'
    foreground: '{colors.status-pending}'
  status-completed:
    background: '{colors.status-completed-bg}'
    foreground: '{colors.status-completed}'
---

# Anh Hoa Admin - Design Spine

## Brand & Style

Đây là công cụ vận hành, không phải website tuyển sinh. Giao diện gọn, bình tĩnh và đáng tin cậy khi xử lý tiền: nền kem rất nhẹ, thẻ trắng, đường viền mảnh và màu xanh lá làm tín hiệu hành động chính. Logo hoa hướng dương Ánh Hoa xuất hiện nhỏ ở màn đăng nhập và đầu sidebar; không biến thành họa tiết, minh họa lớn hay màu vàng phủ toàn trang.

Hệ thống kế thừa primitive và nhịp điệu từ shadcn/ui trên Base UI. Các token ở đây là lớp nhận diện tối thiểu; khi có xung đột, tài liệu này thắng mockup hoặc mặc định thư viện.

## Colors

- `{colors.surface-base}` là nền app, giữ danh sách và bảng dữ liệu dễ đọc trong thời gian dài.
- `{colors.surface-raised}` dành cho card, form và modal; không dùng shadow nặng để tách lớp.
- `{colors.brand}` dành cho CTA chính, trạng thái chọn và focus; không dùng như nền cho mọi vùng điều hướng.
- `{colors.accent}` là điểm nhấn hiếm, có thể xuất hiện trong logo hoặc callout nhẹ, không dùng làm màu chữ cơ bản.
- Màu trạng thái chỉ mang nghĩa nghiệp vụ: vàng cho `DRAFT`, xanh dương cho `PENDING`, xanh lá cho `COMPLETED`. Không chỉ dựa vào màu: badge luôn có nhãn chữ.

## Typography

Inter là font mặc định của bảng, form và số tiền. Số tiền căn phải, dùng `{typography.money}` và không viết tắt đơn vị VND trong dòng tổng quan trọng. Clash Grotesk chỉ dùng cho tiêu đề trang và tiêu đề card lớn; không dùng trong bảng hoặc label để giữ mật độ dữ liệu.

## Layout & Spacing

Trên desktop, app dùng sidebar cố định rộng khoảng 232px và vùng nội dung có `{spacing.page-gutter}`. Trang danh sách ưu tiên một bảng/card chính rộng, thanh công cụ nằm cùng hàng với tiêu đề khi đủ chỗ. Trang chi tiết Hóa đơn dùng hai cột: nội dung dòng tiền rộng ở trái, tóm tắt thanh toán/audit hẹp ở phải; không nhét toàn bộ vào modal.

Khoảng cách trong form là `{spacing.4}`; giữa các section card là `{spacing.6}`. Không tạo dashboard card dày đặc khi bảng dữ liệu mới là bề mặt chính.

## Elevation & Depth

Card mặc định có viền `{colors.border-subtle}`, không cần đổ bóng. Dùng bóng mềm, ngắn chỉ cho dropdown, popover và modal để biểu thị lớp nổi. Không dùng glassmorphism, gradient hoặc shadow nhiều tầng.

## Shapes

Input, button và badge dùng bo góc vừa phải theo `{rounded.md}` và `{rounded.full}`. Card dùng `{rounded.lg}`. Không dùng pill cho khối nội dung, bảng, hay mọi button; pill dành riêng cho trạng thái, filter token và avatar.

## Components

- **Sidebar:** logo nhỏ + tên trường ở đầu; mục đang chọn dùng nền `{colors.brand-soft}`, chữ xanh đậm; các mục còn lại là chữ trung tính. Mục cuối là menu tài khoản admin.
- **Data table:** header `{components.table-header}`, hàng cao tối thiểu 48px, hover có nền kem nhạt. Action phụ để ở cuối hàng; không chỉ lộ khi hover vì cần thao tác bằng cảm ứng/keyboard.
- **Status badge:** sử dụng token theo trạng thái. Hiển thị lần lượt `Nháp`, `Chờ xác nhận`, `Đã hoàn tất`.
- **Money fields:** có phân tách hàng nghìn và hậu tố `đ`; giá trị âm hiển thị dấu trừ rõ ràng. Cột tiền luôn căn phải.
- **Primary action:** mỗi vùng chỉ có một CTA xanh lá nổi bật, ví dụ `Tạo hóa đơn tháng` hoặc `Lưu hóa đơn`. Hành động phá hủy/không đảo được không dùng màu xanh.
- **Confirmation modal:** tiêu đề là động từ và đối tượng cụ thể, tóm tắt thông tin ảnh hưởng, nút xác nhận có nhãn hành động đầy đủ như `Xác nhận đã nhận 3.360.000 đ`.
- **QR card:** QR đủ khoảng trắng xung quanh, kèm số tiền, tài khoản và nội dung chuyển khoản có nút sao chép. QR không phải là hình trang trí.

## Do's and Don'ts

**Nên:** ưu tiên bảng, filter rõ ràng, tổng tiền nổi bật vừa đủ, trạng thái nghiệp vụ có nhãn, và audit dễ quét.

**Không nên:** thiết kế kiểu landing page; lạm dụng vàng hoa hướng dương; dùng emoji; giấu action quan trọng khi hover; dùng modal cho form hóa đơn dài; hoặc dùng màu đơn lẻ để truyền đạt trạng thái/validation.
