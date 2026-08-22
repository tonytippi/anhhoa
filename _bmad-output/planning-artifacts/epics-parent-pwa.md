---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-anhhoa-parent-pwa-2026-08-22/prd.md
  - prds/prd-anhhoa-parent-pwa-2026-08-22/addendum.md
  - architecture/architecture-anhhoa-parent-pwa-2026-08-22/ARCHITECTURE-SPINE.md
  - ux-designs/ux-anhhoa-parent-pwa-2026-08-22/DESIGN.md
  - ux-designs/ux-anhhoa-parent-pwa-2026-08-22/EXPERIENCE.md
  - ../../docs/proposal-parent-pwa.md
---

# Anh Hoa Parent PWA - Epic Breakdown

## Overview

Tai lieu nay phan ra Parent PWA thanh epics va stories co the trien khai. PRD, architecture spine va UX spines `final` la nguon quyet dinh; `docs/proposal-parent-pwa.md` chi giu boi canh va y tuong ban dau khi co khac biet.

## Requirements Inventory

### Functional Requirements

FR-1: Admin cap va thu hoi Lien ket Parent-Hoc sinh cho mot hoac nhieu email Parent; lien ket co hieu luc ngay, duoc giu lich su va co hieu luc theo tung hoc sinh.

FR-2: Parent chi xem Hoc sinh va Hoa don duoc uy quyen tai thoi diem request; Parent khong truy cap du lieu bang UUID, filter hay URL cua hoc sinh khac; client xoa du lieu khi session/revoke yeu cau.

FR-3: Parent dang nhap/dang xuat qua Google email da verified, voi Google subject bind lan dau va Parent session rieng; identity khong hop le khong duoc cap partial session.

FR-4: Parent xem danh sach Hoc sinh duoc uy quyen va Hoa don `PENDING`/`COMPLETED`, phan trang, sap xep on dinh va loc theo Hoc sinh/Thang/trang thai hop le; `DRAFT` khong xuat hien.

FR-5: Parent xem chi tiet Hoa don read-only, gom Hoc sinh, Thang hoa don, dong phi, tong tien, phuong thuc va trang thai; `COMPLETED` khong co payment action.

FR-6: Parent mo payment sheet cua Hoa don `PENDING` + `TRANSFER` du dieu kien, xem VietQR va thong tin payment snapshot, sao chep tung truong va hieu rang nha truong chua xac nhan.

FR-7: Parent tai VietQR PNG va mo deep link ngan hang khi server xac nhan ho tro; QR/copy fields la fallback khi download/deep link loi.

### NonFunctional Requirements

NFR-1: Parent PWA la mobile-first PWA rieng, co subdomain, OAuth callback, session cookie, manifest, service worker va REST client tach biet voi Admin PWA.

NFR-2: API kiem tra Parent va Lien ket Parent-Hoc sinh `ACTIVE` tai moi request; UUID khong thay the authorization; Parent DTO toi thieu va khong lo audit Admin/du lieu noi bo.

NFR-3: Parent PWA khong cache protected REST response trong service worker, chi giu protected data trong memory, xoa state khi logout/401, va revalidate khi focus, foreground va truoc protected view.

NFR-4: Google OAuth state random, browser/callback-bound, single-use va expiring; cookie chi duoc phat sau cac kiem tra identity/active link thanh cong.

NFR-5: Parent va StudentParent dung relation nhieu-nhieu retained; PostgreSQL enforce unique `(parentId, studentId)` va StudentParent chi `ACTIVE` hoac `REVOKED`.

NFR-6: Payment data, VietQR, PNG va deep link chi dung locked invoice payment snapshot; lifecycle ke thua cho phep `DRAFT -> PENDING`, `PENDING -> DRAFT` hoac `PENDING -> COMPLETED`; `DRAFT -> PENDING` cho `TRANSFER` validate day du snapshot truoc khi khoa.

NFR-7: Cookie-auth mutation grant/revoke dung origin validation, double-submit CSRF va idempotency UUID cho thao tac retryable/bulk; timeout duoc doi soat bang operation ID.

NFR-8: Parent PWA dap ung WCAG 2.2 AA, touch target toi thieu 44x44px, status co nhan chu, dialog focus management, QR co text thay the va copy fields khong phu thuoc QR.

### Additional Requirements

- Mo rong pnpm/Turborepo voi `apps/parent-web`; khong import `apps/web`, khong chia se router, service worker, session hay Admin business endpoint.
- Them Nest modules `parents`, `parent-auth`, `parent-portal`; `parents` so huu Parent/StudentParent, `parent-auth` so huu Parent OAuth/session, `parent-portal` chi so huu read DTO da authorize va khong goi controller domain khac.
- Them Prisma migration Parent/StudentParent, relation/status retained va unique database constraint; Admin grant/revoke delegate vao `parents` service.
- Parent REST chi nam duoi `/api/parent`: `/me`, `/students`, `/invoices`, `/invoices/:invoiceId`, `/invoices/:invoiceId/payment`; list dung `{ data, meta }`, DTO mutation/error ke thua convention API hien co.
- Parent invoice API chi tra `PENDING`/`COMPLETED`; payment API chi tra snapshot cua `PENDING` + `TRANSFER` duoc authorize va hop le.
- Revoke mot StudentParent link chi xoa du lieu cua hoc sinh do o client; Parent con link `ACTIVE` voi hoc sinh khac van giu session. Chi sign out neu session khong hop le hoac khong con link active.
- Parent payment sheet dong/xoa payload neu invoice thanh `DRAFT`/`COMPLETED`, doi khoi `TRANSFER`, snapshot invalid hoac mat authorization.
- Bank deep-link templates la server configuration co version; chua enable bank nao khi chua co support matrix da kiem thu. VietQR/copy fields la luong bat buoc.
- Kiem thu API unit/integration PostgreSQL cho identity, authorization, grant/revoke, snapshot eligibility va mutation security; Playwright E2E cho login, multi-child, revoke, payment state va QR/deep-link fallback.

### UX Design Requirements

UX-DR1: Xay dung Parent PWA mobile-first theo token Anh Hoa: nen kem, card trang, Inter/Clash Grotesk, CTA xanh la, trang thai `PENDING` xanh duong va `COMPLETED` xanh la; khong dung dashboard KPI/bang/carousel.

UX-DR2: Home la inbox `Hoa don can thanh toan`, mo ngay sau login va hien `PENDING` trong vung nhin thay dau tien; chi group hoc sinh co PENDING, sap group/card moi nhat truoc voi tie-breaker ten hoc sinh.

UX-DR3: Cung cap student switcher scroll ngang voi `Tat ca` mac dinh cho Parent co tu hai hoc sinh; tren `Tat ca`, moi card/row luon hien ten hoc sinh.

UX-DR4: Cung cap pending invoice card va invoice detail read-only; `PENDING` + `TRANSFER` co `Chuyen tien`, `PENDING` + `CASH` chi huong dan thanh toan tien mat, `COMPLETED` chi la lich su khong co CTA thanh toan.

UX-DR5: Cung cap payment bottom sheet co VietQR, tong tien, bank/account/holder/transfer content copyable, tai PNG, deep link co ho tro va thong diep `Dang cho nha truong xac nhan`; khong co nut Parent xac nhan da chuyen tien.

UX-DR6: Cung cap tab `Lich su` chi co `COMPLETED`, phan trang, filter Hoc sinh/Thang va row mo chi tiet read-only.

UX-DR7: Xu ly loading, empty, offline, QR/download/deep-link failure va payment ineligibility voi skeleton/inline fallback cu the; khong coi payment action la completion.

UX-DR8: Xu ly revoke theo tung hoc sinh, session `401` toan cuc va protected-state clearing dung theo UX spine; khong hien du lieu cu sau khi quyen bi tu choi.

UX-DR9: Cung cap keyboard/touch/dialog/live-region/QR-alt-text behavior va responsive layout mot cot, bottom navigation, bottom sheet tren mobile; khong co push notification, upload bien lai, PDF hay chat trong phase nay.

### FR Coverage Map

FR-1: Epic 5 - Admin quan ly quyen xem cua phu huynh.

FR-2: Epic 5 - Admin quan ly quyen xem cua phu huynh; Epic 6 - Phu huynh dang nhap va xem Hoa don can thanh toan.

FR-3: Epic 6 - Phu huynh dang nhap va xem Hoa don can thanh toan.

FR-4: Epic 6 - Phu huynh dang nhap va xem Hoa don can thanh toan.

FR-5: Epic 6 - Phu huynh dang nhap va xem Hoa don can thanh toan.

FR-6: Epic 7 - Phu huynh nhan huong dan chuyen khoan an toan.

FR-7: Epic 7 - Phu huynh nhan huong dan chuyen khoan an toan.

## Epic List

### Epic 5: Admin quan ly quyen xem cua phu huynh

Admin co the gan hoac thu hoi email Parent cho tung Hoc sinh, de phu huynh chi duoc phep truy cap du lieu cua cac con dang duoc lien ket.

**FRs covered:** FR-1, FR-2

### Epic 6: Phu huynh dang nhap va xem Hoa don can thanh toan

Parent duoc phep co the dang nhap Google an toan, vao Home mobile-first va thay ngay Hoa don `PENDING` cua mot hoac nhieu con; Parent co the xem chi tiet read-only va lich su `COMPLETED`.

**FRs covered:** FR-2, FR-3, FR-4, FR-5

### Epic 7: Phu huynh nhan huong dan chuyen khoan an toan

Parent mo duoc huong dan thanh toan cho Hoa don `PENDING` + `TRANSFER`, dung VietQR/copy/download va deep link co ho tro, nhung khong the tu xac nhan da thanh toan hoac lam thay doi Hoa don.

**FRs covered:** FR-6, FR-7

## Epic 5: Admin quan ly quyen xem cua phu huynh

Admin co the gan hoac thu hoi email Parent cho tung Hoc sinh, de phu huynh chi duoc phep truy cap du lieu cua cac con dang duoc lien ket.

### Story 5.1: Luu tru lien ket Parent-Hoc sinh

As an Admin,
I want he thong luu duoc lien ket Parent-Hoc sinh co the cap lai va thu hoi,
So that quyen xem cua phu huynh duoc quan ly theo tung hoc sinh ma khong mat lich su.

**Acceptance Criteria:**

**Given** Prisma schema cua API chua co du lieu Parent
**When** migration Parent PWA duoc ap dung
**Then** schema co `Parent` luu `id`, `emailNormalized`, `googleSubject` co the chua co truoc first login, `displayName` va `status`
**And** schema co `StudentParent` luu `parentId`, `studentId`, `status`, `createdAt`, `revokedAt` va `revokedBy`, voi foreign key den Parent va Student.

**Given** cung mot Parent va Hoc sinh can duoc lien ket
**When** API tao hoac cap lai lien ket
**Then** PostgreSQL enforce unique `(parentId, studentId)`
**And** grant tao lien ket moi hoac chuyen lien ket `REVOKED` duy nhat thanh `ACTIVE`, khong tao ban ghi trung.

**Given** lien ket `ACTIVE` can bi thu hoi
**When** service revoke duoc goi
**Then** lien ket chi chuyen `ACTIVE -> REVOKED`, luu thoi diem va Admin thu hoi
**And** khong co Parent, Student hay StudentParent nao bi xoa cung.

**Given** migration va service lien ket da co
**When** API integration tests PostgreSQL chay
**Then** tests chung minh unique constraint, grant/reactivate, revoke retained va mot Parent co the co lien ket `ACTIVE` voi nhieu Hoc sinh
**And** mot Hoc sinh co the co lien ket `ACTIVE` voi nhieu Parent.

### Story 5.2: Admin cap va thu hoi quyen Parent theo tung hoc sinh

As an Admin,
I want gan hoac thu hoi email Parent tren tung Hoc sinh,
So that chi dung phu huynh duoc xem du lieu cua tung con.

**Acceptance Criteria:**

**Given** Admin mo chi tiet mot Hoc sinh
**When** be mat quan ly Parent hien thi
**Then** Admin thay cac email Parent dang lien ket cung trang thai `ACTIVE` hoac `REVOKED`
**And** UI khong hien thi du lieu Parent hoac Hoc sinh khong lien quan.

**Given** Admin nhap email Parent hop le
**When** xac nhan gan email
**Then** API chuan hoa email bang `trim` va lowercase, tao/tai su dung `Parent`, roi tao hoac reactivate `StudentParent`
**And** lien ket co hieu luc ngay, khong co buoc cho xac minh.

**Given** Admin nhap mot hoac nhieu email Parent hop le cho cung mot Hoc sinh
**When** xac nhan gan email
**Then** API xu ly toan bo danh sach trong mot transaction va tra ket qua theo tung email da tao, da reactivate hoac da lien ket `ACTIVE`
**And** email invalid lam request bi tu choi truoc khi bat ky lien ket nao trong danh sach thay doi.

**Given** Admin chon thu hoi mot lien ket `ACTIVE`
**When** xac nhan thao tac voi modal neu email Parent va Hoc sinh bi anh huong
**Then** API chi doi lien ket do thanh `REVOKED` va tra action result hien tai
**And** Parent van giu Parent session va cac lien ket `ACTIVE` voi Hoc sinh khac; request sau do cua Hoc sinh bi revoke bi tu choi tai server.

**Given** Admin gui grant, revoke hoac thao tac bulk grant/revoke
**When** request khong co origin hop le, CSRF token hop le hoac `Idempotency-Key` UUID
**Then** API tu choi request theo error shape chuan
**And** retry cung key/cung request replay ket qua da luu; reuse key voi request khac tra conflict.

**Given** request grant/revoke timeout sau khi gui
**When** UI chua biet ket qua
**Then** UI khoa trigger, hien `Dang kiem tra ket qua` va goi `GET /operations/:operationId`
**And** chi cho retry khi API xac nhan thao tac chua duoc ap dung.

### Story 5.3: Kiem tra quyen Parent theo tung request

As a Parent da co lien ket voi Hoc sinh,
I want he thong chi cho toi truy cap du lieu cua cac con ma toi con duoc uy quyen,
So that du lieu hoc sinh va Hoa don khong bi lo qua URL, UUID hoac filter.

**Acceptance Criteria:**

**Given** `parents` service nhan Parent identity va request student/invoice context cua Hoc sinh A
**When** Parent co `StudentParent` `ACTIVE` voi Hoc sinh A
**Then** authorization service chap nhan context chi sau khi kiem tra `Parent.status` active va link `StudentParent` `ACTIVE` tai server
**And** khong tin `studentId` hay `invoiceId` tu client nhu bang chung ve quyen.

**Given** Parent request context cua Hoc sinh B khong co link `ACTIVE`
**When** authorization service duoc goi
**Then** service tu choi context truoc khi query/DTO Parent duoc tao
**And** contract tu choi khong yeu cau endpoint Parent da ton tai; endpoint-level response boundary duoc kiem thu o Story 6.2.

**Given** Parent co lien ket `ACTIVE` voi Hoc sinh A va B
**When** Admin thu hoi link cua A
**Then** authorization service tu choi context cua A sau do
**And** context cua cung Parent cho B van duoc chap nhan.

**Given** authorization service va Parent relation da duoc tich hop
**When** PostgreSQL integration tests chay
**Then** tests bao phu nhieu Parent, nhieu Hoc sinh, relation `REVOKED` va Parent con quyen voi mot Hoc sinh khac
**And** tests chung minh service tu choi truoc khi Parent query/DTO duoc tao.

## Epic 6: Phu huynh dang nhap va xem Hoa don can thanh toan

Parent duoc phep co the dang nhap Google an toan, vao Home mobile-first va thay ngay Hoa don `PENDING` cua mot hoac nhieu con; Parent co the xem chi tiet read-only va lich su `COMPLETED`.

### Story 6.1: Khoi tao Parent PWA va Parent Google session

As a Parent da duoc Admin gan email,
I want dang nhap Google vao Parent PWA rieng,
So that toi co phien truy cap an toan ma khong dung chung voi Admin PWA.

**Acceptance Criteria:**

**Given** repository da co Admin PWA va API
**When** Parent PWA duoc khoi tao
**Then** co `apps/parent-web` la React/Vite PWA rieng, co router, manifest, icon, service worker, REST client va React Query cache rieng
**And** Parent PWA khong import `apps/web`, khong chia se router, service worker, browser state hay Admin business endpoint.

**Given** Parent mo Parent PWA tren mobile
**When** app shell chua xac thuc hien thi
**Then** UI dung token Parent tu `DESIGN.md`: mot cot, nen kem, gutter 20px, Inter/Clash Grotesk va vung cham toi thieu 44x44px
**And** PWA co browser-native install behavior, khong ep install prompt va khong co push notification trong phase nay.

**Given** Parent bat dau Google OAuth
**When** `parent-auth` xu ly callback
**Then** OAuth state random, bound voi browser/callback, single-use va expiring duoc validate truoc khi cap session
**And** API chi phat Parent cookie `Secure`, `httpOnly`, `SameSite=Lax` rieng sau khi Google tra email verified, Google subject match hoac bind lan dau, Parent active va co it nhat mot `StudentParent` `ACTIVE`.

**Given** Google email chua duoc gan, Google subject da thay doi, OAuth state/provider loi, Parent inactive hoac Parent khong con lien ket `ACTIVE`
**When** callback duoc xu ly
**Then** API tu choi dang nhap bang thong bao an toan va khong cap partial Parent session
**And** client khong nhan du lieu Parent truoc khi bootstrap identity thanh cong.

**Given** Parent dang nhap, dang xuat, session het han hoac `GET /api/parent/me` tra `401`
**When** `apps/parent-web` xu ly thay doi session
**Then** `parent-auth` cung cap `GET /api/parent/me` toi thieu de bootstrap identity va `POST /auth/parent/logout` de invalid Parent server session
**And** app xoa protected React Query/cache state truoc khi route ve Dang nhap khi logout/`401`.

**Given** Parent da dang nhap
**When** app header va menu Tai khoan hien thi
**Then** Parent thay email dang nhap, thong tin tro giup ngan va action `Dang xuat`
**And** chon `Dang xuat` goi logout endpoint, ket thuc server session va khong can confirmation modal.

**Given** `GET /api/parent/me` da duoc them de bootstrap session
**When** Story 6.2 duoc thuc hien
**Then** Story 6.2 chi mo rong read model Parent bang `/students`, `/invoices` va `/invoices/:invoiceId`
**And** service worker khong cache Parent REST response, payment snapshot hay protected data.

**Given** API khoi dong voi Parent surface duoc bat
**When** environment configuration duoc nap
**Then** API validate Parent origin, OAuth callback allowlist, Parent session-cookie name va cac gia tri cookie scope truoc khi nhan request
**And** thieu hoac invalid cau hinh lam bootstrap that bai ro rang, khong khoi dong Parent auth voi default khong an toan.

### Story 6.2: Cung cap Parent REST read model

As a Parent da dang nhap va con duoc uy quyen,
I want nhan du lieu Hoc sinh va Hoa don qua Parent API rieng,
So that Parent PWA co the hien thi dung du lieu read-only ma khong nhan du lieu quan tri noi bo.

**Acceptance Criteria:**

**Given** Parent session hop le
**When** Parent PWA goi `GET /api/parent/me` hoac `GET /api/parent/students`
**Then** API tra identity toi thieu va danh sach cac Hoc sinh co `StudentParent` `ACTIVE` theo response contract da dinh
**And** response khong chua audit Admin, danh sach Parent khac hay du lieu Hoc sinh khong duoc uy quyen.

**Given** Parent goi `GET /api/parent/invoices`
**When** request co filter hop le `studentId`, `billingMonth` hoac `status`
**Then** API chi tra Hoa don `PENDING` hoac `COMPLETED` thuoc cac Hoc sinh Parent dang duoc uy quyen
**And** list response dung `{ data, meta }`, bounded page size, stable sort va validation server-side cho filter.

**Given** Parent gui `studentId` khong duoc uy quyen, filter khong hop le hoac co truy cap `DRAFT`
**When** API xu ly invoice list hoac `GET /api/parent/invoices/:invoiceId`
**Then** API tu choi hoac khong tra ket qua theo error contract chuan
**And** khong tiet lo su ton tai cua Hoc sinh/Hoa don khong duoc phep, khong tra `DRAFT`.

**Given** Parent mo mot Hoa don `PENDING` hoac `COMPLETED` da duoc uy quyen
**When** API tra chi tiet
**Then** response chi co Hoc sinh snapshot, `billingMonth`, dong phi, tong VND, phuong thuc va trang thai can cho Parent read-only
**And** khong chua mutable source Bank Account, payment payload ngoai payment endpoint, audit Admin hoac mutation controls.

**Given** cac endpoint Parent read model da hoan thanh
**When** PostgreSQL integration tests chay
**Then** tests bao phu pagination/sort/filter, nhieu con, StudentParent `REVOKED`, invoice `DRAFT`, UUID truc tiep va response minimization
**And** tests chung minh authorization duoc danh gia tai server cho moi endpoint.

### Story 6.3: Home hien thi Hoa don can thanh toan cua nhieu con

As a Parent da dang nhap va duoc uy quyen xem nhieu Hoc sinh,
I want mo Parent PWA va thay ngay cac Hoa don can thanh toan, duoc phan theo tung con,
So that toi biet chinh xac Hoa don nao can xu ly ma khong phai tim kiem hay doi ngu canh truoc.

**Acceptance Criteria:**

**Given** Parent dang nhap thanh cong
**When** Parent PWA bootstrap identity va Home tai
**Then** app dieu huong den tab `Trang chu` voi `h1` `Hoa don can thanh toan`
**And** cac Hoa don `PENDING` xuat hien trong vung nhin thay dau tien, truoc lich su, KPI, banner hay thong tin thu cap.

**Given** Parent co tu hai Hoc sinh `ACTIVE`
**When** Home hien thi
**Then** co student switcher scroll ngang gom `Tat ca` mac dinh va tung Hoc sinh duoc uy quyen
**And** o che do `Tat ca`, moi card van hien thi ro ten Hoc sinh, khong tron Hoa don mat ngu canh.

**Given** Parent co nhieu Hoc sinh va nhieu Hoa don `PENDING`
**When** Home nhan du lieu
**Then** chi render group cua Hoc sinh co it nhat mot `PENDING`
**And** group sap theo Hoa don `PENDING` moi nhat, tie-break theo ten Hoc sinh; card trong tung group cung sap theo billing month moi nhat.

**Given** Home render mot Hoa don `PENDING`
**When** phuong thuc la `TRANSFER` va payment snapshot hop le
**Then** card the hien thang, Hoc sinh, badge `Can thanh toan`, tong tien VND va action `Xem Hoa don`
**And** toan bo card mo chi tiet bang touch/keyboard; CTA `Chuyen tien` chi duoc them o Epic 7 sau khi payment eligibility API ton tai.

**Given** Home render mot Hoa don `PENDING` phuong thuc `CASH`
**When** Parent xem card hoac chi tiet
**Then** UI hien thi badge `Can thanh toan` va thong tin `Thanh toan tien mat tai nha truong`
**And** khong hien thi CTA/payment sheet chuyen khoan.

**Given** Parent khong co Hoa don `PENDING` sau filter hien tai
**When** Home tai xong
**Then** UI hien thi `Khong con Hoa don can thanh toan` cung link phu `Xem lich su`
**And** khong hien thi card gia, Hoa don `COMPLETED` hoac `DRAFT` tren Home.

**Given** Parent bi thu hoi link cua Hoc sinh A nhung van co link `ACTIVE` voi Hoc sinh B
**When** Parent PWA revalidate khi foreground, focus hoac truoc protected view
**Then** UI dong detail/payment sheet cua A neu dang mo, xoa group/card/filter cua A va refresh student switcher
**And** giu session, Home va du lieu cua B; chi chuyen ve dang nhap neu Parent mat session hoac khong con lien ket `ACTIVE` nao.

**Given** Home dang loading, refresh hoac offline
**When** trang thai thay doi
**Then** loading dung skeleton theo header, student chips va invoice cards; refresh giu du lieu dang doc voi indicator nho
**And** offline hien thi banner mot lan, khong coi cached data la moi va khong queue action.

### Story 6.4: Chi tiet Hoa don va lich su thanh toan read-only

As a Parent da duoc uy quyen,
I want xem chi tiet Hoa don va lich su cac Hoa don da hoan tat cua tung con,
So that toi kiem tra duoc cac khoan phi va trang thai thanh toan ma khong the vo tinh sua du lieu.

**Acceptance Criteria:**

**Given** Parent chon card `PENDING` hoac row `COMPLETED` duoc uy quyen
**When** route Chi tiet Hoa don tai
**Then** UI hien thi Hoc sinh snapshot, thang Hoa don, cac dong phi, tong VND, phuong thuc va badge trang thai
**And** tat ca noi dung read-only, khong hien thi audit Admin, source Bank Account mutable hoac action sua Hoc sinh/Lop/Hoa don.

**Given** Parent mo Hoa don `PENDING` + `TRANSFER`
**When** chi tiet hien thi
**Then** UI hien thi trang thai chuyen khoan read-only va khong tu dung QR hay du lieu thanh toan o client
**And** CTA `Chuyen tien` va payment eligibility la pham vi Epic 7, nen Epic 6 van hoan thanh doc Hoa don ma khong phu thuoc Epic 7.

**Given** Parent mo Hoa don `PENDING` + `CASH`
**When** chi tiet hien thi
**Then** UI hien thi `Thanh toan tien mat tai nha truong`
**And** khong hien thi CTA `Chuyen tien`, VietQR hay deep link.

**Given** Parent chon tab `Lich su`
**When** man hinh tai
**Then** API/UI chi hien thi Hoa don `COMPLETED`, phan trang va cho filter theo Hoc sinh duoc uy quyen cung thang Hoa don
**And** Student switcher co `Tat ca` mac dinh va tung Hoc sinh duoc uy quyen; filter Hoc sinh/Thang duoc dong bo vao URL/query state de quay lai van giu ngu canh.

**Given** Parent xem Lich su o che do `Tat ca`
**When** moi row hien thi
**Then** row ghi ro Hoc sinh, co the mo chi tiet read-only va khong co CTA thanh toan
**And** filter khong bao gio cho phep chon Hoc sinh Parent khong duoc uy quyen.

**Given** Parent dang mo chi tiet hoac Lich su
**When** revalidation tra session `401`, invoice khong con duoc uy quyen, hoac filter student da bi revoke
**Then** UI xoa protected state truoc khi hien thi du lieu cu
**And** session loi dua ve Dang nhap; revoke cua mot con chi dong/xoa du lieu cua con do va giu cac con `ACTIVE` khac.

**Given** Parent dung touch, keyboard hoac screen reader
**When** dieu huong giua Home, History va Invoice detail
**Then** moi route co dung mot `h1`, so tien duoc doc kem VND, status khong chi dua mau va controls co target toi thieu 44x44px
**And** Home/History/detail dung layout mot cot mobile-first, bottom navigation ro trang thai tab hien tai, khong dung bang desktop hoac sidebar.

## Epic 7: Phu huynh nhan huong dan chuyen khoan an toan

Parent mo duoc huong dan thanh toan cho Hoa don `PENDING` + `TRANSFER`, dung VietQR/copy/download va deep link co ho tro, nhung khong the tu xac nhan da thanh toan hoac lam thay doi Hoa don.

### Story 7.1: Cung cap payment snapshot va VietQR cho Parent

As a Parent da duoc uy quyen xem Hoa don chuyen khoan,
I want nhan huong dan thanh toan tu snapshot da khoa cua Hoa don,
So that toi chuyen tien dung so tien va tai khoan ma khong bi anh huong boi du lieu nguon da thay doi.

**Acceptance Criteria:**

**Given** Admin chuyen Hoa don `DRAFT` phuong thuc `TRANSFER` sang `PENDING`
**When** API validate transition
**Then** `invoices` validate va lock snapshot gom tong VND, bank identifier, so tai khoan, ten chu tai khoan, noi dung chuyen khoan va student/class display values
**And** thieu hoac invalid bat ky truong bat buoc nao deu tu choi transition, khong tao snapshot thanh toan mot phan.

**Given** Parent co `StudentParent` `ACTIVE` voi Hoa don `PENDING` + `TRANSFER` va snapshot hop le
**When** Parent goi `GET /api/parent/invoices/:invoiceId/payment`
**Then** API tra payment DTO toi thieu tu locked snapshot, gom tong VND, thong tin ngan hang/nguoi nhan, noi dung chuyen khoan va du lieu VietQR
**And** API khong doc mutable Bank Account, Student hay Class source de tao response.

**Given** Parent goi payment endpoint cho Hoa don `DRAFT`, `COMPLETED`, `CASH`, snapshot invalid hoac invoice khong duoc uy quyen
**When** API xu ly request
**Then** API khong tra payment payload va tra current eligibility/status theo error contract phu hop
**And** ket qua khong tiet lo du lieu cua Hoa don hoac Hoc sinh khong duoc uy quyen.

**Given** payment DTO hop le
**When** Parent goi `GET /api/parent/invoices/:invoiceId/payment` voi `Accept: image/png`
**Then** cung authorization va eligibility guard tra PNG VietQR duoc sinh trong API tu locked snapshot, voi `Content-Disposition` filename `anh-hoa-<invoiceId>.png` va `Cache-Control: no-store`
**And** viec Parent lay payment DTO, VietQR hoac PNG khong mutation Hoa don va khong the chuyen Hoa don sang `COMPLETED`.

**Given** payment endpoint va snapshot contract da hoan thanh
**When** PostgreSQL integration tests chay
**Then** tests bao phu snapshot retention khi Student/Class/Bank Account nguon thay doi hoac inactive, eligibility cho `PENDING` + `TRANSFER`, va payment endpoint denial sau khi Hoa don `PENDING -> DRAFT` hoac `PENDING -> COMPLETED`
**And** tests chung minh payment payload khong duoc tra neu authorization hoac snapshot eligibility khong hop le.

### Story 7.2: Payment sheet voi VietQR, sao chep va tai QR

As a Parent dang xem Hoa don `PENDING` + `TRANSFER`,
I want mo payment sheet va dung VietQR hoac sao chep thong tin chuyen khoan,
So that toi co the chuyen tien dung huong dan trong khi hieu nha truong van can xac nhan.

**Acceptance Criteria:**

**Given** Parent chon CTA `Chuyen tien` cua Hoa don `PENDING` + `TRANSFER`
**When** Parent PWA goi payment endpoint va API xac nhan eligibility
**Then** payment bottom sheet mo voi ten Hoc sinh/thang, badge trang thai, tong tien VND, VietQR va thong tin tu payment DTO
**And** sheet khong tu dung lai QR hoac dung du lieu account/source model tu client.

**Given** payment sheet hien thi du lieu hop le
**When** Parent xem cac truong thanh toan
**Then** so tien, ngan hang, so tai khoan, ten chu tai khoan va noi dung chuyen khoan deu co control sao chep rieng
**And** VietQR co alt text bao gom Hoc sinh va so tien; QR khong phai cach thanh toan duy nhat.

**Given** Parent chon `Tai ma QR`
**When** PNG download thanh cong
**Then** browser goi payment route da authorize voi `Accept: image/png` va tai file voi ten `anh-hoa-<invoiceId>.png`
**And** UI bao ngan viec tai thanh cong ma khong doi trang thai Hoa don.

**Given** QR hoac download loi
**When** loi duoc tra ve
**Then** payment sheet giu mo va hien thi loi inline cu the, cho phep thu lai download
**And** tat ca copy fields van kha dung lam fallback.

**Given** Parent mo, quet/tai QR hoac sao chep thong tin
**When** cac hanh dong hoan tat
**Then** sheet luon hien thi `Dang cho nha truong xac nhan`
**And** khong co nut `Toi da chuyen tien`, khong hien thi `da thanh toan thanh cong` va khong co action nao mutation Hoa don.

**Given** payment sheet dang mo
**When** revalidation/payment endpoint tra `COMPLETED`, `DRAFT`, khong con `TRANSFER`, snapshot invalid hoac Parent mat authorization
**Then** client xoa payment payload, dong sheet va refresh Home/Chi tiet Hoa don
**And** neu `COMPLETED`, hien thi `Nha truong da xac nhan Hoa don nay`; cac truong hop khac hien thi `Huong dan chuyen tien khong con kha dung`.

**Given** Parent dung touch, keyboard hoac screen reader
**When** mo, tuong tac va dong payment sheet
**Then** sheet la dialog co accessible name/mo ta, trap focus va return focus ve CTA
**And** controls copy/download/dong co target toi thieu 44x44px; `Esc` dong sheet tren desktop va dong sheet khong lam thay doi Hoa don.

### Story 7.3: Mo deep link ngan hang co fallback

As a Parent dang co payment sheet hop le,
I want thu mo app ngan hang duoc ho tro voi du lieu chuyen khoan da khoa,
So that toi co them cach thanh toan thuan tien ma van luon quay lai duoc VietQR va thong tin sao chep.

**Acceptance Criteria:**

**Given** API co cau hinh deep link hop le cho ngan hang va moi truong thiet bi dang dung
**When** Parent mo payment sheet
**Then** UI hien thi action `Mo app ngan hang` theo du lieu server tra ve
**And** client khong hard-code URI template, bank list hay payment payload.

**Given** Parent chon `Mo app ngan hang`
**When** deep link duoc tao
**Then** API/server configuration tao URI chi tu locked payment snapshot va template co version
**And** action mo app khong gui mutation, khong doi invoice status va khong duoc xem la xac nhan thanh toan.

**Given** khong co bank template tuong thich, app chua cai, URI bi chan/tu choi hoac Parent quay lai PWA
**When** deep link khong hoan tat nhu mong muon
**Then** payment sheet van hien thi VietQR va toan bo copy fields
**And** UI bao fallback ngan, cu the va khong bao payment thanh cong.

**Given** server chua co support matrix da duoc kiem thu cho mot ngan hang/device/browser
**When** Parent mo payment sheet tren moi truong do
**Then** UI khong hien thi deep-link action cho cau hinh nay
**And** chi cung cap VietQR, PNG download va copy fields.

**Given** server co bank deep-link template
**When** configuration den han expiry/revalidation hoac khong co owner/cadence kiem thu hop le
**Then** server khong tra deep-link action cho Parent cho den khi configuration duoc xac nhan lai
**And** version, expiry/revalidation date va owner/cadence cua template duoc quan ly o server configuration, khong hard-code trong UI.

**Given** API khoi dong voi bank deep-link feature duoc bat
**When** environment/server configuration duoc nap
**Then** API validate schema template, version, expiry/revalidation date va owner/cadence truoc khi tra bat ky deep-link action nao
**And** cau hinh thieu hoac invalid khong lam treo Parent PWA, ma vo hieu hoa deep link va giu VietQR/copy fields la fallback.

**Given** deep-link config va Parent payment flow da hoan thanh
**When** API integration/E2E tests chay
**Then** tests bao phu config supported, unsupported, URI rejected/return-to-PWA va khong co mutation invoice sau moi payment action
**And** tests chung minh QR/copy fields luon con kha dung khi deep link khong dung duoc.

## Decisions and Reconciliation

- Revoke `StudentParent` ap dung theo tung Hoc sinh: Parent session chi bi tu choi neu Parent khong con lien ket `ACTIVE` nao hoac session khong hop le. Quy tac nay khop PRD, architecture spine va UX spine `final`.
- `prds/prd-anhhoa-parent-pwa-2026-08-22/addendum.md` va `docs/proposal-parent-pwa.md` con noi revoke tat ca Parent session. Day la noi dung cu da bi thay the boi quyet dinh tren; khong sua artifact `final` truc tiep. Can chay workflow PRD Update neu can dong bo addendum.
- PNG VietQR dung identifier chuan `invoiceId` UUID trong filename `anh-hoa-<invoiceId>.png`; khong tao `invoiceCode` moi vi no chua co ownership, uniqueness contract hay persistence trong Admin model.

## Implementation Dependencies

- Admin Epics 1-4 la baseline da hoan thanh truoc Parent PWA. Parent Epic 5 co the bat dau tren API/Prisma platform hien co.
- Story 5.1 phai hoan thanh truoc 5.2 va 5.3; Story 5.2/5.3 hoan thanh truoc Parent OAuth va portal endpoints o Epic 6.
- Story 6.1 cung cap Parent PWA/session bootstrap; Story 6.2 cung cap Parent read model; Story 6.3 va 6.4 chi bat dau sau 6.2. Epic 7 chi bat dau sau 6.2 va co the tich hop UI sau 6.3/6.4.
- Story 7.1 phu thuoc Admin Epic 3 invoice lifecycle da co. Story nay mo rong `DRAFT -> PENDING` cua `invoices` de validate va lock payment snapshot bo sung; thay doi nay phai duoc merge, migrate va integration-test truoc Story 7.2/7.3.
- Story 7.2 phu thuoc payment endpoint/PNG contract cua 7.1. Story 7.3 phu thuoc payment sheet cua 7.2 va server deep-link configuration da duoc validate.
