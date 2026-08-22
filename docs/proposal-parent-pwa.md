# Proposal: Parent PWA xem hoa don va thanh toan chuyen khoan

**Trang thai:** De xuat - dau vao cho PRD tiep theo
**Ngay:** 2026-08-21
**Pham vi:** Mo rong san pham hien tai bang mot PWA rieng cho phu huynh. Khong sua doi cac planning artifact da `final`.

## 1. De xuat va quyet dinh can chot

Tao **Parent PWA** rieng, mobile-first, cho phep phu huynh da duoc uy quyen xem hoa don cua hoc sinh va lay huong dan chuyen khoan. Parent PWA khong chia se frontend, router, session, hay endpoint nghiep vu voi Admin PWA.

Giai doan 1 khong tu dong doi soat giao dich ngan hang. Admin van la nguoi duy nhat chuyen hoa don tu `PENDING` sang `COMPLETED` sau khi kiem tra da nhan du tien.

| Chu de | Cau hoi can quyet dinh | De xuat khoi dau |
| --- | --- | --- |
| Product boundary | Parent PWA co la initiative mo rong hay MVP moi co PRD rieng? | PRD mo rong lien ket voi Admin MVP |
| Domain | Ten mien/subdomain production cua Admin va Parent? | Tach `admin` va `phuhuynh` subdomain |
| Parent identity | Chi email Google hay co them OTP/phone fallback? | Chi dung email Google trong giai doan 1 |
| Guardian model | Mot hoc sinh co bao nhieu Parent; quan he co role khong? | Nhieu-nhieu, khong role trong giai doan 1 |
| Quyen du lieu | Parent xem `DRAFT`, `PENDING`, `COMPLETED` nhu the nao? | Xem tat ca; `DRAFT` phai hien thi la chua san sang thanh toan |
| Visibility | Parent co xem invoice `CASH` va dong phi chi tiet khong? | Xem day du dong phi; khong hien thi payment action cho `CASH` |
| Lich su quyen | Parent moi duoc cap hoac vua bi thu hoi quyen xem invoice nao? | Authorization tai thoi diem request; thu hoi quyen ap dung ngay ca voi invoice da tung xem |
| QR generation | Tu sinh/host QR hay dung dich vu anh VietQR? | Tu sinh trong he thong tu payload snapshot |
| Transfer content | Ma tham chieu va quy tac bao mat/noi dung? | Ma invoice on dinh, khong dung ten hoc sinh |
| Deep links | Ngan hang uu tien, nguon URI template va device matrix? | Chon theo danh sach ngan hang da kiem thu; VietQR la fallback bat buoc |
| Payment action | Co nut `Toi da chuyen tien` hay upload bien lai? | Khong o giai doan 1 |
| Privacy | Retention, audit, xu ly email sai va su co du lieu? | Status-based revoke, audit toi thieu, khong xoa cung quan he |

Ten mien va OAuth redirect boundary phai duoc chot trong PRD va deployment design. Tach subdomain giup tach PWA manifest, service worker, cookie host va OAuth redirect boundary.

## 2. Van de can giai quyet

He thong hien tai la dashboard noi bo chi danh cho Admin. Admin tao va khoa hoa don, hien thi VietQR, sau do tu xac nhan khi da nhan tien. Phu huynh chua co tai khoan, giao dien hay API de tu xem hoa don.

Parent PWA can cung cap trai nghiem doc lap de phu huynh co the:

- Dang nhap bang tai khoan Google da duoc nha truong gan cho hoc sinh.
- Xem thong tin hoc sinh ma minh duoc uy quyen xem.
- Xem hoa don va trang thai thanh toan.
- Nhan huong dan chuyen khoan dung voi hoa don `PENDING` + `TRANSFER`, tai VietQR, sao chep thong tin va thu mo ung dung ngan hang.

## 3. Pham vi Parent PWA de xuat

### 3.1 Trong pham vi

- Dang nhap/dang xuat Google cho Parent.
- Trang chao va danh sach hoc sinh ma Parent co quyen xem.
- Danh sach hoa don cua cac hoc sinh do, co loc theo hoc sinh, thang va trang thai neu can theo UX duoc chot.
- Chi tiet hoa don read-only: hoc sinh, thang hoa don, cac dong phi, tong tien, phuong thuc va trang thai.
- Huong dan thanh toan cho hoa don `PENDING` co phuong thuc `TRANSFER`.
- VietQR tu payment snapshot, tai anh QR va sao chep so tien, so tai khoan, ten chu tai khoan, noi dung chuyen khoan.
- Thu mo app ngan hang qua deep link theo tung ngan hang da duoc xac nhan ho tro.
- PWA manifest va service worker rieng; thiet ke mobile-first.

### 3.2 Ngoai pham vi giai doan nay

- Dong bo giao dich ngan hang, webhook, virtual account va tu dong chuyen `PENDING -> COMPLETED`.
- Xu ly thu thieu, thu thua, tra gop, hoan tien hay mo lai hoa don `COMPLETED`.
- Parent sua hoa don, sua hoc sinh/lop, chon tai khoan nhan tien hay thay doi trang thai hoa don.
- Thong bao email, SMS, Zalo, tai PDF, upload bien lai va chat/ho tro thanh toan.
- Mot deep link ngan hang dung chung, dam bao chay voi moi ngan hang va moi thiet bi.

## 4. Vong doi hoa don va luong thanh toan

Vong doi hien tai duoc giu nguyen:

```text
DRAFT -> PENDING -> COMPLETED
```

- Neu PRD cho phep Parent xem `DRAFT`, hien thi ro rang `Chua san sang thanh toan` va an payment action de tranh gui nham.
- Parent chi nhan payment action voi invoice `PENDING` + `TRANSFER`.
- Admin kiem tra giao dich ben ngoai he thong va la nguoi duy nhat xac nhan `PENDING -> COMPLETED`.
- `COMPLETED` read-only. Parent khong tao lai QR/deep link, tru khi PRD chot day la che do xem lich su khong phai loi moi thanh toan.
- Mo QR, tai QR, sao chep hay mo deep link khong lam invoice tu dong thanh `COMPLETED`.
- Giao dien phai noi ro `Dang cho nha truong xac nhan`; chuyen khoan khong phai bang chung thanh toan thanh cong.

### 4.1 Luong mac dinh: VietQR

VietQR la luong phai hoat dong tren moi thiet bi:

1. Parent mo invoice `PENDING` co phuong thuc `TRANSFER`.
2. Parent chon `Chuyen tien`.
3. Parent PWA hien thi payment sheet voi VietQR, tong tien VND, ngan hang nhan, so tai khoan, ten chu tai khoan va noi dung chuyen khoan.
4. Parent co the tai VietQR PNG va sao chep tung truong thanh toan.
5. Parent quet QR trong app ngan hang hoac nhap/copy thu cong.

QR, noi dung chuyen khoan va tai khoan nhan phai duoc lay tu payment snapshot da khoa khi invoice chuyen sang `PENDING`. Khong duoc dung du lieu tai khoan ngan hang hien tai, de hoa don lich su khong bi thay doi sau khi Admin sua hoac ngung dung tai khoan nguon.

De xuat dung ma tham chieu ngan, on dinh thay cho noi dung chuyen khoan hien tai va khong tiet lo thong tin tre qua lich su giao dich, vi du `AH-202608-<invoiceShortId>`. PRD phai chot dinh dang, gioi han do dai va cach xu ly giao dich partial, excess, duplicate va unmatched.

### 4.2 Tai VietQR

- Nut `Tai ma QR` tai ve anh PNG duoc sinh tu payload snapshot, co ten file xac dinh, vi du `anh-hoa-<invoiceCode>.png`.
- Giao dien van hien thi cac truong text de Parent co the thanh toan neu app ngan hang khong quet QR tu thu vien anh.
- API phai tra ve trang thai loi ro rang khi khong the tao QR hoac khi payment snapshot khong hop le; giao dien giu cac truong thanh toan co the sao chep lam fallback.
- Payload phai duoc validate va version tai chuyen doi `DRAFT -> PENDING`: bank code, so tai khoan, ten chu tai khoan, so tien va ma tham chieu phai tao duoc VietQR hop le truoc khi khoa invoice.
- Uu tien sinh QR trong he thong de tranh lo thong tin thanh toan cho ben thu ba va giam phu thuoc availability. Can co test vector voi cac app ngan hang muc tieu va quy trinh cap nhat dependency QR.

### 4.3 Deep link tung ngan hang

Deep link la fallback cai thien trai nghiem, khong phai bang chung thanh toan va khong duoc la luong bat buoc.

1. Parent chon `Mo app ngan hang`.
2. Parent chon ngan hang trong danh sach da ho tro, hoac he thong dung lua chon gan nhat tren thiet bi.
3. Parent PWA tao deep link tu payload payment snapshot va thu mo app.
4. Neu app chua cai, deep link bi chan, bi tu choi hoac quay lai PWA, giao dien van giu QR va cac nut sao chep.

Neu khong co template tuong thich voi ngan hang hay thiet bi, Parent PWA chi hien thi QR va copy fields. Viec chon nut deep link khong lam thay doi invoice; event neu duoc ghi chi phuc vu ho tro, khong la xac nhan tien da den.

## 5. Technical approach

```text
apps/
  api/                         # Mo rong auth, parent, student-parent, parent invoices
  web/                         # Admin PWA hien tai, giu nguyen boundary
  parent-web/                  # Parent PWA moi (React + Vite + PWA)
```

API la noi duy nhat xu ly Prisma schema, tinh tien, invoice snapshot, QR payload va authorization. Parent PWA chi goi REST API; khong chua business rule thanh toan, tong tien hay quyen truy cap.

### 5.1 Parent auth, data va security boundary

Parent PWA dung entry point OAuth rieng:

- `GET /auth/parent/google`
- `GET /auth/parent/google/callback`
- `GET /auth/parent/me`
- `POST /auth/parent/logout`

Sau callback, API chi cap Parent session khi email Google duoc xac minh, `Parent.status` la active va co it nhat mot lien ket `StudentParent` dang hieu luc. OAuth callback phai xu ly state het han, state khong khop va loi provider bang thong bao an toan, khong tao partial session.

Khuyen nghi dung OAuth client Google rieng cho Parent va Admin trong production. Neu dung chung client trong giai doan dau, hai flow van phai co callback, redirect allowlist, state, session cookie va authorization rule doc lap. Can luu va kiem tra Google subject `sub` ben canh `emailNormalized`; neu `sub` thay doi cho cung email, can Admin xac minh lai truoc khi cap quyen.

Khong luu mot truong `parentEmail` don le tren `Student`. Dung quan he nhieu-nhieu:

| Entity | Du lieu can thiet | Muc dich |
| --- | --- | --- |
| `Parent` | `id`, `googleSubject`, `emailNormalized` unique, `displayName`, `status`, metadata dang nhap gan nhat neu can | Dinh danh phu huynh bang Google identity |
| `StudentParent` | `studentId`, `parentId`, `status`, `createdAt`, `revokedAt`, `revokedBy` | Cap hoac thu hoi quyen xem hoc sinh |

Backend chuan hoa email (`trim`, lowercase), tao/tai su dung `Parent` va tao lien ket. Lien ket moi can co trang thai cho xac nhan hoac quy trinh Admin xac minh ro rang truoc khi active. Viec thu hoi quyen phai vo hieu hoa lien ket, revoke tat ca Parent session lien quan va xoa parent data khoi client cache; khong xoa cung du lieu lich su.

- Parent session dung cookie rieng, vi du `anhhoa_parent_session`, voi `Secure`, `httpOnly`, `SameSite=Lax` va maximum session age cau hinh duoc.
- Khong dat cookie dung chung domain goc neu khong co ly do bat buoc. Deployment phai quy dinh allowlisted origins, CORS credential policy, cookie `Domain`/`Path` va API co same-origin hay khong.
- Parent API khong duoc tai su dung endpoint Admin; phan quyen phai duoc kiem soat o server, khong phai bang cach chi an nut o frontend.
- Moi truy van invoice cua Parent phai lay parent identity tu session va kiem tra `Parent.status` va quan he `StudentParent` tren server; khong tin `studentId` hay `invoiceId` tu client.
- Parent chi nhan DTO toi thieu; khong lo audit Admin, du lieu hoc sinh khac, danh sach tai khoan nguon hien tai hay thao tac noi bo.
- OAuth redirect chi duoc phep den origin Parent da cau hinh. Moi mutation hien tai va tuong lai phai dung origin validation, double-submit CSRF va idempotency khi phu hop.
- UUID khong doan duoc la bat buoc, nhung khong thay the authorization o server.

### 5.2 Parent API read model

| Endpoint | Muc dich |
| --- | --- |
| `GET /api/parent/me` | Khoi tao identity Parent va trang thai session |
| `GET /api/parent/students` | Danh sach hoc sinh Parent duoc uy quyen xem |
| `GET /api/parent/invoices` | Danh sach hoa don da authorize, phan trang va loc hop le |
| `GET /api/parent/invoices/:invoiceId` | Chi tiet read-only cua hoa don da authorize |
| `GET /api/parent/invoices/:invoiceId/payment` | Payment snapshot cua hoa don `PENDING` + `TRANSFER` |

`GET /api/parent/invoices` phai co pagination, maximum page size, stable sort order va validate schema cho filter ngay, trang thai va `studentId`; `studentId` khong duoc phep phai bi tu choi. API chi tra ve du lieu thanh toan khi invoice thuoc hoc sinh ma Parent duoc uy quyen xem, co trang thai/phuong thuc phu hop va co payment snapshot hop le.

Khi invoice doi trang thai, payment endpoint phai kiem tra eligibility tai thoi diem request. Neu invoice da `COMPLETED`, API tra ve ket qua not-eligible co current status va client refresh invoice truoc khi hien thi lai action. Parent PWA phai xu ly `401` bang cach xoa state, chuyen ve dang nhap; xu ly revoke bang cach xoa chi tiet dang mo va dieu huong an toan.

### 5.3 PWA va deep-link configuration

Service worker khong duoc cache response chua du lieu Parent. Parent PWA phai dung response policy phu hop, xoa du lieu khi logout va khi nhan `401`/revoke, khong hien thi du lieu cu khi session het han tren thiet bi dung chung.

Danh sach ngan hang, URI template, version da kiem thu, expiry/revalidation date va fallback phai duoc quan ly o server/config co version; khong hard-code phan tan trong UI. Chi them mot ngan hang sau khi co tai lieu public/chinh thuc hoac kiem thu thuc te tren Android Chrome, Android in-app browser, iOS Safari va PWA installed neu can. Neu ngan hang khong ho tro prefill day du, chi hien thi QR va copy fields.

Can mo rong Nest modules theo pham vi so huu ro rang, vi du `parents` quan ly Parent va `StudentParent`; `parent-auth` xu ly Parent OAuth/session; `parent-portal` cung cap read model da authorize. Khong de controller Parent goi truc tiep controller Invoice/Admin. Can bo sung migration cho `Parent` va `StudentParent`, test integration PostgreSQL cho authorization va E2E tests cho Parent PWA.

## 6. Tieu chi chap nhan muc san pham

- Admin co the gan va thu hoi mot hoac nhieu email Parent tren hoc sinh; thu hoi quyen vo hieu hoa session dang dung.
- Email Google chua duoc gan, Parent inactive hoac lien ket revoked khong the dang nhap Parent PWA va khong nhan du lieu invoice.
- Mot Parent gan voi nhieu hoc sinh chi xem duoc nhung hoc sinh va hoa don tuong ung.
- Parent khong the truy cap invoice bang UUID cua hoc sinh khac, bang UUID da biet truoc khi bi revoke, hay qua filter `studentId` khong duoc uy quyen.
- Parent xem dung tong tien, bank account snapshot va transfer content snapshot cua invoice `PENDING` + `TRANSFER`.
- Invoice khong co payment snapshot hop le khong hien thi payment payload; Parent van nhan thong bao va fallback phu hop.
- Parent tai duoc VietQR PNG va sao chep duoc cac truong thanh toan; khi QR/download loi, copy fields van kha dung.
- Deep link ngan hang da ho tro co fallback QR/copy khi khong mo duoc app, khong co config phu hop hay URI bi tu choi.
- Mo QR, tai QR, sao chep va mo deep link khong lam hoa don tu dong thanh `COMPLETED`.
- Invoice chuyen sang `COMPLETED` trong khi Parent dang xem payment sheet phai an payment action va refresh trang thai.
- Parent PWA khong luu invoice response trong service-worker cache va xoa du lieu tren logout, expiry va khi nhan `401`/revoke.
- Admin van xac nhan thanh toan thu cong; `COMPLETED` giu tinh bat bien hien tai.

## 7. Rui ro va giam thieu

| Rui ro | Tac dong | Giam thieu |
| --- | --- | --- |
| Email Google nhap sai, dung chung hoac bi reassigned | Lo thong tin hoa don cua tre | Xac minh lien ket, luu Google `sub`, active/revoked status va authorization server-side |
| Parent share thiet bi/session | Nguoi khac xem hoa don | Cookie rieng, session expiry, logout ro rang, cache policy va revoke session |
| Deep link khong on dinh | Parent khong mo duoc app ngan hang | VietQR + copy fields la luong chinh; deep link chi la enhancement da kiem thu |
| QR/transfer payload sai hoac thay doi theo tai khoan nguon | Chuyen nham tai khoan hoac mat lich su | Validate payload truoc `PENDING`; chi dung invoice snapshot sau `PENDING` |
| Parent nghi da thanh toan khi app da mo | Admin/Parent hieu sai trang thai | Hien thi `Dang cho nha truong xac nhan`; khong doi lifecycle khi mo deep link |
| Du lieu ca nhan bi truy cap sai hoac can dieu tra su co | Lo du lieu va khong truy vet duoc | PRD phai chot retention, audit event cho cap/thu hoi quyen va invoice access, log access va incident owner |

## 8. De xuat buoc tiep theo

1. Xac nhan cac quyet dinh o muc 1, uu tien domain, visibility hoa don, lich su quyen, transfer content va danh sach ngan hang.
2. Tao PRD mo rong Parent PWA va cap nhat ro rang cac muc hien tai coi Parent la ngoai pham vi.
3. Cap nhat UX specification cho Parent PWA mobile-first, payment sheet, session expiry, revoke, QR failure va fallback states.
4. Cap nhat architecture spine truoc khi scaffold `apps/parent-web` hay mo rong OAuth/schema, vi architecture hien tai dang chi rang buoc `apps/web` va Admin-only auth.
5. Sau khi PRD, UX va architecture da duoc chot, chia epics/stories va trien khai theo thu tu: data authorization -> Parent OAuth -> Parent read APIs -> Parent PWA -> QR download -> deep links ngan hang.
