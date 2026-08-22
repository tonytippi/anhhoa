# Epic 6 Context: Phu huynh dang nhap va xem Hoa don can thanh toan

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic nay cung cap Parent PWA rieng de phu huynh da duoc uy quyen dang nhap Google an toan, vao ngay Home mobile-first va xem dung Hoa don `PENDING` cua mot hoac nhieu con. Parent co the xem chi tiet Hoa don va lich su `COMPLETED` theo be mat read-only, trong khi server van kiem tra quyen hien tai o moi request va client xoa du lieu ngay khi mat quyen. Dieu nay tao kenh tu phuc vu an toan ma khong mo rong quyen quan tri hay cho Parent xac nhan thanh toan.

## Stories

- Story 6.1: Khoi tao Parent PWA va Parent Google session
- Story 6.2: Cung cap Parent REST read model
- Story 6.3: Home hien thi Hoa don can thanh toan cua nhieu con
- Story 6.4: Chi tiet Hoa don va lich su thanh toan read-only

## Requirements & Constraints

- Parent chi dang nhap khi Google tra email da verified, Parent dang active, co it nhat mot lien ket `StudentParent` `ACTIVE`, va Google subject khop subject da bind; loi identity, OAuth state, provider, Parent inactive hay khong con lien ket active khong duoc tao partial session.
- Parent chi xem Hoc sinh dang duoc uy quyen va Hoa don `PENDING`/`COMPLETED`. Server phai tu choi UUID, URL va filter cua Hoc sinh/Hoa don khong duoc uy quyen ma khong tiet lo su ton tai; `DRAFT` khong duoc xuat hien o list, filter hay detail.
- Parent API phai tra DTO toi thieu, chi gom du lieu can cho xem read-only; khong tra audit Admin, danh sach Parent khac, source Bank Account mutable, payment payload hay mutation control.
- Danh sach Hoa don dung phan trang, page size gioi han, sap xep on dinh va validation filter server-side theo Hoc sinh duoc uy quyen, `billingMonth` va status hop le. Lich su chi hien `COMPLETED`; filter Hoc sinh/Thang can duoc dong bo vao URL/query state.
- Logout, session expiry, `401` va revoke phai xoa protected state truoc khi hien thi route dang nhap hay du lieu cu. Revoke mot Hoc sinh chi xoa du lieu cua Hoc sinh do; Parent van giu session neu con lien ket `ACTIVE` khac.
- Parent khong sua Hoc sinh, Hoa don, phuong thuc, tai khoan nhan tien hay trang thai. Pham vi Epic 6 khong bao gom payment eligibility, CTA `Chuyen tien`, VietQR, deep link hay Parent xac nhan da chuyen tien.
- Kiem thu API unit/PostgreSQL integration cho identity, authorization moi endpoint, filter/pagination/sort, nhieu con, revoke, `DRAFT`, UUID truc tiep va response minimization; Playwright E2E bao phu login, multi-child, revoke, Home, detail va History.

## Technical Decisions

- `apps/parent-web` la React/Vite PWA doc lap, co router, manifest, service worker, REST client va React Query cache rieng; khong import `apps/web`, chia se Admin router/session/browser state hay goi Admin business endpoint. Chi co the chia se pure TypeScript utilities/contracts tu `packages`.
- API dung NestJS modular monolith: `parents` so huu Parent/StudentParent; `parent-auth` so huu Google OAuth va Parent session; `parent-portal` so huu DTO read da authorize, chi dung Prisma va narrow query exports tu `parents`, `students`, `invoices`, khong goi controller va khong ghi invoice lifecycle.
- Parent routes nam duoi `/api/parent`: `/me`, `/students`, `/invoices`, `/invoices/:invoiceId`; list dung envelope `{ data, meta }`. JSON camelCase, UUID, `YYYY-MM`, UTC va VND `BIGINT` tuan theo convention hien co; query key protected bat dau bang `parent`.
- OAuth state phai random, browser/callback-bound, single-use va expiring. Parent dung cookie rieng `Secure`, `httpOnly`, `SameSite=Lax`, scoped Parent surface va khong bao gio duoc chap nhan nhu Admin session. API bootstrap phai validate Parent origin, callback allowlist, cookie name va scope; cau hinh thieu/invalid phai fail ro rang.
- Moi Parent request lay identity tu Parent session va kiem tra Parent `ACTIVE` cung `StudentParent` `ACTIVE` tai server. Service worker khong cache protected REST response, payment snapshot hay du lieu protected; React Query data chi o memory va bi clear khi logout/`401`.
- Invoice lifecycle duoc ke thua: Parent chi doc `PENDING` va `COMPLETED`; `COMPLETED` read-only. Parent payment endpoint va snapshot guidance la capability Epic 7, khong duoc them som vao read model Epic 6.

## UX & Interaction Patterns

- Parent PWA mobile-first mot cot, nen kem, card trang, gutter 20px, Inter cho body va Clash Grotesk cho heading; touch target toi thieu 44x44px. Su dung xanh duong kem nhan `Can thanh toan` cho `PENDING`, xanh la kem nhan `Da hoan tat` cho `COMPLETED`; khong dung dashboard KPI, bang, carousel, sidebar hay banner marketing.
- Sau login, mo tab `Trang chu` voi duy nhat `h1` `Hoa don can thanh toan`. Hien `PENDING` trong vung nhin thay dau tien; chi group Hoc sinh co Pending, group theo invoice moi nhat roi ten Hoc sinh, card theo billing month moi nhat.
- Khi Parent co tu hai Hoc sinh, hien student switcher cuon ngang voi `Tat ca` mac dinh. O `Tat ca`, tung card/row phai hien ten Hoc sinh; chon filter cap nhat tai cho va URL ma khong xoa du lieu dang tai.
- Pending card va completed row mo invoice detail bang touch/keyboard. Detail chi hien student snapshot, billing month, dong phi, tong VND, phuong thuc va badge status; `CASH` hien huong dan thanh toan tai truong, `COMPLETED` khong co CTA thanh toan.
- Bottom navigation gom `Trang chu` va `Lich su`; History chi hien `COMPLETED`, co pagination va filter. Empty Home hien `Khong con Hoa don can thanh toan` va link `Xem lich su`.
- Loading dung skeleton theo header/chips/card; refresh giu noi dung dang doc voi indicator nho; offline hien banner mot lan va khong coi du lieu cu la moi. Revalidate khi foreground, tab focus va truoc protected view; khi revoke, dong/xoa detail cua Hoc sinh do va refresh switcher.
- Tuan WCAG 2.2 AA: moi route co mot `h1`, status khong chi dung mau, tien duoc doc kem VND, card/control dung keyboard, skeleton khong duoc screen reader doc va loi/thay doi trang thai dung live region.

## Cross-Story Dependencies

- Epic 5 phai hoan thanh Parent/StudentParent persistence, Admin grant/revoke va authorization theo request truoc Parent OAuth va Parent portal cua Epic 6.
- Story 6.1 khoi tao Parent PWA va session bootstrap qua `/me`; Story 6.2 mo rong read model bang `/students`, `/invoices` va `/invoices/:invoiceId`. Story 6.3 va 6.4 bat dau sau Story 6.2.
- Epic 7 bat dau sau Story 6.2 va tich hop payment UI sau Story 6.3/6.4. Epic 6 phai giu UI read-only, khong phu thuoc payment endpoint hay payment snapshot cua Epic 7.
