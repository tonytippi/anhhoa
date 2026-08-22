---
name: Anh Hoa Parent PWA
description: Mobile-first payment inbox for authorized parents.
status: final
sources:
  - ../../prds/prd-anhhoa-parent-pwa-2026-08-22/prd.md
  - ../../architecture/architecture-anhhoa-parent-pwa-2026-08-22/ARCHITECTURE-SPINE.md
  - ../ux-anhhoa-2026-08-18/DESIGN.md
created: 2026-08-22
updated: 2026-08-22
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
  status-pending: '#245FA6'
  status-pending-bg: '#E6F0FF'
  status-completed: '#287443'
  status-completed-bg: '#E5F4E9'
  danger: '#B42318'
  danger-bg: '#FEEBE8'
typography:
  body:
    fontFamily: Inter, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter, sans-serif
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0.01em
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
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
  DEFAULT: 12px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  page-gutter: 20px
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
  pending-card:
    background: '{colors.surface-raised}'
    border: '{colors.status-pending}'
    radius: '{rounded.lg}'
  payment-sheet:
    background: '{colors.surface-raised}'
    radius: '{rounded.xl}'
  status-pending:
    background: '{colors.status-pending-bg}'
    foreground: '{colors.status-pending}'
  status-completed:
    background: '{colors.status-completed-bg}'
    foreground: '{colors.status-completed}'
  focus-ring:
    color: '{colors.brand}'
---

# Anh Hoa Parent PWA - Design Spine

## Brand & Style

Parent PWA la cong cu tu phuc vu tren dien thoai: am ap, de tin va khong gay ap luc khi phu huynh dang xem khoan can thanh toan. No ke thua nen kem, xanh la va diem vang hoa huong duong cua Anh Hoa, nhung dung xanh duong `PENDING` de lam ro trang thai can xu ly. Giao dien uu tien mot viec o mot thoi diem, khong co dashboard KPI, bang du lieu hay hieu ung marketing.

`DESIGN.md` nay la nguon visual identity cho Parent PWA. Shadcn/ui tren Base UI la primitive; khi mockup hoac default thu vien xung dot voi token/qui tac tai day, tai lieu nay thang.

## Colors

- `{colors.surface-base}` la nen app; `{colors.surface-raised}` la card Hoa don va payment sheet.
- `{colors.brand}` chi danh cho CTA thanh toan, focus va trang thai da chon. Mot man hinh chi co mot CTA brand noi bat.
- `{colors.status-pending}` va `{components.pending-card}` danh cho Hoa don can thanh toan; luon kem nhan `Can thanh toan`, khong chi dung mau.
- `{colors.status-completed}` danh cho lich su `Da hoan tat`, khong dung de tao CTA.
- `{colors.accent}` chi cho logo/callout nhe; khong dung lam nen card Hoa don hoac nut thanh toan.

## Typography

Inter la font mac dinh va uu tien kha nang doc tren dien thoai. Clash Grotesk chi dung cho `h1` va section heading. Tong tien dung `{typography.money}`, viet day du phan tach hang nghin va hau to `d`; khong lam tong tien nho hon ten hoc sinh hoac CTA thanh toan.

## Layout & Spacing

Man hinh mobile dung mot cot, page gutter `{spacing.page-gutter}`, vung cham toi thieu 44x44px va thanh dieu huong duoi khi da dang nhap. Home dat section `Can thanh toan` truoc, ngay sau header; card `PENDING` khong nam sau statistics, carousel hay student profile. Khi co nhieu con, Home chi hien group co Hoa don `PENDING`; group sap theo Hoa don `PENDING` moi nhat, hoa dung ten hoc sinh, va card trong group cung sap moi nhat truoc.

Payment sheet mo dang bottom sheet tren mobile, toi da 92vh, co sticky payment action/copy controls khi noi dung cuon. Tren tablet/desktop, sheet can giua va co max-width 480px; khong chuyen thanh bang hay sidebar nhu Admin PWA.

## Elevation & Depth

Card mac dinh dung vien `{colors.border-subtle}` va khong dung shadow nang. Card `PENDING` co border xanh duong de tao su uu tien ro rang, khong dung animation. Bottom sheet dung shadow mem de phan tach khoi Home va backdrop mo nhe; QR giu khoang trang rong xung quanh.

## Shapes

Button va input dung `{rounded.md}`; Hoa don card dung `{rounded.lg}`; payment sheet dung `{rounded.xl}`. Student filter dung chip `{rounded.full}`. Khong dung pill cho CTA chinh, card noi dung hoac toan bo navigation.

## Components

- **App header:** logo hoa nho, `Anh Hoa`, loi chao ngan va menu tai khoan. Khong hien thi sidebar hoac dashboard breadcrumb tren mobile.
- **Student switcher:** chip scroll ngang ngay duoi header khi Parent co tu hai hoc sinh tro len. Chip `Tat ca` mac dinh; chip khong thay the cac card can thanh toan tren Home.
- **Pending invoice card:** ten hoc sinh, thang Hoa don, badge `Can thanh toan`, tong tien va CTA `Chuyen tien`. Toan card mo chi tiet; CTA khong bi an trong menu.
- **Completed invoice row:** compact, co ten hoc sinh, thang, tong tien va badge `Da hoan tat`; khong co CTA brand.
- **Payment sheet:** header co ten hoc sinh/thang va badge; tong tien o gan dau; VietQR; cac truong ngan hang, so tai khoan, chu tai khoan, noi dung chuyen khoan voi nut copy rieng; `Tai ma QR` va deep link neu duoc ho tro. Footer hien `Dang cho nha truong xac nhan` va khong co nut xac nhan thanh toan.
- **Status and feedback:** skeleton theo card; inline error gan section loi; toast ngan chi xac nhan copy/download, khong thay cho thong tin trang thai Hoa don.

## Do's and Don'ts

**Nen:** dua tong tien va CTA thanh toan len truoc; dung tu don gian `Can thanh toan`, `Chuyen tien`, `Da hoan tat`; nhom theo ten hoc sinh; giu thong tin chuyen khoan co the copy tung truong.

**Khong nen:** dung bang, KPI, carousel Hoa don, gamification, countdown gay ap luc, nut `Toi da chuyen tien`, hay thong bao thanh toan thanh cong truoc khi Admin xac nhan. Khong hien thi `DRAFT`, thong tin audit Admin hoac Hoa don cua hoc sinh khong duoc uy quyen.
