# Epic 6 Context: Phu huynh dang nhap va xem Hoa don can thanh toan

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Xay dung Parent PWA rieng de phu huynh da duoc uy quyen dang nhap Google an toan, vao ngay Home mobile-first de thay cac Hoa don `PENDING` cua mot hoac nhieu hoc sinh, va xem chi tiet read-only cung lich su `COMPLETED`. Epic nay tao kenh tu phuc vu ma van giu quyen kiem soat du lieu va trang thai Hoa don o phia nha truong.

## Stories

- Story 6.1: Khoi tao Parent PWA va Parent Google session
- Story 6.2: Cung cap Parent REST read model
- Story 6.3: Home hien thi Hoa don can thanh toan cua nhieu con
- Story 6.4: Chi tiet Hoa don va lich su thanh toan read-only

## Requirements & Constraints

- Chi Parent active co it nhat mot lien ket Parent-Hoc sinh `ACTIVE` moi dang nhap va duy tri duoc session. Google phai tra email verified; lan dau bind normalized email voi Google subject, cac lan sau subject phai khop. Tu choi email chua duoc gan, Parent inactive, khong con lien ket active, subject thay doi, hay OAuth loi ma khong cap partial session.
- Moi request Parent phai kiem tra session, Parent active va lien ket `StudentParent` `ACTIVE` tai server. Khong tin `studentId`, `invoiceId`, filter hay URL tu client nhu bang chung authorization; khong tiet lo su ton tai cua du lieu khong duoc phep.
- Parent chi nhan DTO toi thieu, khong co audit Admin, Parent khac, du lieu noi bo, mutable Bank Account hay mutation controls. Parent invoice surfaces chi hien `PENDING` va `COMPLETED`; `DRAFT` khong duoc xuat hien trong list, filter hay detail.
- Invoice list ho tro filter server-side hop le theo hoc sinh duoc uy quyen, thang hoa don va trang thai; dung pagination co gioi han, sap xep on dinh va response `{ data, meta }`. Detail chi co student snapshot, billing month, dong phi, tong VND, phuong thuc va trang thai.
- Parent khong the sua Hoc sinh, Hoa don, phuong thuc, tai khoan nhan tien hay trang thai. `COMPLETED` chi la lich su read-only. Payment eligibility, CTA `Chuyen tien`, VietQR va payment data la pham vi Epic 7, khong duoc la dieu kien de Epic nay hoan thanh.
- Clear protected client state truoc khi route ve Dang nhap khi logout, session expiry hoac `401`. Sau revoke cua mot hoc sinh, server tu choi ngay va client chi xoa du lieu cua hoc sinh do; giu session va du lieu cua cac lien ket active khac. Chi sign out khi session khong hop le hoac khong con lien ket active.
- Parent PWA revalidate khi app foreground, tab focus va truoc protected view. Khong cache protected REST response trong service worker va khong coi du lieu cache la du lieu moi khi offline.
- Xac minh bang API unit/PostgreSQL integration cho identity, authorization theo request, multi-child, revoked link, UUID/filter truc tiep, `DRAFT`, pagination/sort/filter va response minimization; Playwright E2E bao phu login, multi-child, revoke va cac trang thai invoice.

## Technical Decisions

- Tao `apps/parent-web` nhu React/Vite PWA doc lap, co router, manifest, service worker, REST client va React Query cache rieng. Khong import `apps/web`, khong dung chung router, session, browser state, service worker hay Admin business endpoint; chi duoc chia se pure TypeScript utilities/contracts tu `packages`.
- API la nguon quyet dinh cho Prisma, tien VND `BIGINT`, authorization va read model. Dung cac module `parents` cho lifecycle Parent/StudentParent, `parent-auth` cho Google OAuth va Parent session, va `parent-portal` cho DTO read da authorize; portal co the dung Prisma va narrow query exports, nhung khong goi controller khac hay ghi invoice lifecycle.
- Parent REST chi nam duoi `/api/parent`: `/me`, `/students`, `/invoices`, `/invoices/:invoiceId`. JSON camelCase; query keys React Query bat dau bang `parent`; protected query data chi nam trong memory. `401` la authorization-state transition, khong phai query error de retry.
- OAuth state phai random, bound voi browser va configured callback, single-use, expiring. Parent dung callback/origin va cookie rieng `Secure`, `httpOnly`, `SameSite=Lax`, khong the doc bang JavaScript va khong duoc chap nhan nhu Admin session. API bootstrap phai validate Parent origin, callback allowlist, cookie name va cookie scope; cau hinh thieu/invalid phai fail ro rang.
- Ke thua convention UUID, billing month `YYYY-MM`, UTC timestamps, DTO validation va common error envelope. Invoice lifecycle giu `DRAFT -> PENDING`, `PENDING -> DRAFT|COMPLETED`, va `COMPLETED` read-only.

## UX & Interaction Patterns

- Parent PWA mobile-first, mot cot, nen kem, card trang, gutter 20px, Inter cho body va Clash Grotesk cho heading. Dung bottom navigation `Trang chu`/`Lich su` sau login; menu tai khoan o header hien email, thong tin tro giup ngan va dang xuat khong can confirmation. Target cham toi thieu 44x44px.
- Sau login, mo `Trang chu` voi mot `h1` la `Hoa don can thanh toan`; dua `PENDING` vao vung nhin thay dau tien. Chi group hoc sinh co `PENDING`, sap group theo invoice moi nhat roi ten hoc sinh, va sap card theo billing month moi nhat. `CASH` hien huong dan thanh toan tai nha truong, khong hien payment sheet.
- Voi tu hai hoc sinh, hien student switcher scroll ngang, `Tat ca` mac dinh. O che do nay, moi card va history row phai ghi ro ten hoc sinh. Khong dung KPI, dashboard, table, carousel, sidebar hay card gia.
- Empty Home hien `Khong con Hoa don can thanh toan` va link `Xem lich su`. Loading dung skeleton theo header, chip va card/row; refresh giu du lieu dang doc voi indicator nho; offline hien banner mot lan va khong queue action.
- Detail va History deu read-only. History chi co `COMPLETED`, phan trang, filter hoc sinh/thang dong bo URL/query state; row mo detail. Detail hien snapshot, dong phi, tong VND, phuong thuc va status; `COMPLETED` khong co payment CTA.
- Status khong chi dua vao mau, tong tien phai doc kem VND, moi route co dung mot `h1`, va bottom navigation phan anh tab hien tai. Revoke/401 phai dong detail dang mo va xoa du lieu truoc khi co the hien du lieu cu.

## Cross-Story Dependencies

- Epic 5 phai cung cap Parent/StudentParent retained relation, Admin grant/revoke va authorization service truoc Parent OAuth va portal endpoints.
- Story 6.1 cung cap Parent PWA va session bootstrap; Story 6.2 mo rong read model bang students va invoices. Stories 6.3 va 6.4 bat dau sau Story 6.2.
- Epic 7 bat dau sau Story 6.2; co the tich hop UI sau Stories 6.3/6.4, nhung khong duoc keo payment endpoint hay payment guidance vao pham vi Epic 6.
