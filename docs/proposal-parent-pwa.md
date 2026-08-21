# Proposal: Parent PWA xem hoa don va thanh toan chuyen khoan

**Trang thai:** De xuat - dau vao cho PRD tiep theo
**Ngay:** 2026-08-21
**Pham vi:** Mo rong san pham hien tai bang mot PWA rieng cho phu huynh. Khong sua doi cac planning artifact da `final`.

## 1. Van de can giai quyet

He thong hien tai la dashboard noi bo chi danh cho Admin. Admin tao va khoa hoa don, hien thi VietQR, sau do tu xac nhan khi da nhan tien. Phu huynh chua co tai khoan, giao dien, hay API de tu xem hoa don.

Can cung cap mot trai nghiem doc lap de phu huynh co the:

- Dang nhap bang tai khoan Google da duoc nha truong gan cho hoc sinh.
- Xem thong tin hoc sinh ma minh duoc uy quyen xem.
- Xem hoa don va trang thai thanh toan.
- Nhan huong dan chuyen khoan dung voi hoa don `PENDING`, tai VietQR, sao chep thong tin, va thu mo ung dung ngan hang.

Giai doan nay khong tu dong doi soat giao dich ngan hang. Admin van la nguoi duy nhat chuyen hoa don tu `PENDING` sang `COMPLETED` sau khi kiem tra da nhan du tien.

## 2. De xuat san pham

Tao mot **Parent PWA** rieng, mobile-first, khong dung chung frontend, router, session, hay endpoint nghiep vu voi Admin PWA.

| Khu vuc | Admin | Parent |
| --- | --- | --- |
| PWA | Dashboard noi bo hien tai | Ung dung moi danh cho phu huynh |
| Dang nhap | Google OAuth Admin | Google OAuth Parent |
| Dieu kien cap quyen | Email trong `ADMIN_EMAILS` | Email Google duoc gan cho it nhat mot hoc sinh dang co quyen truy cap |
| API | `/api/...` noi bo hien tai | `/api/parent/...` read-only |
| Session cookie | Cookie Admin hien tai | Cookie Parent ten va pham vi rieng |
| Giao dien | Desktop-first, quan tri | Mobile-first, xem hoa don va thanh toan |

Ten mien du kien can chot trong PRD va deployment design. Phuong an uu tien la tach subdomain, vi du `admin.<domain>` va `phuhuynh.<domain>`, de tach PWA manifest, service worker, cookie host, va OAuth redirect boundary.

## 3. Xac thuc va phan quyen

### 3.1 Google OAuth rieng cho Parent

Parent PWA dung cac entry point OAuth rieng:

- `GET /auth/parent/google`
- `GET /auth/parent/google/callback`
- `GET /auth/parent/me`
- `POST /auth/parent/logout`

Sau callback, API phai chi cap Parent session khi email Google duoc xac minh va co it nhat mot lien ket Parent-Student dang hieu luc. Email khong duoc gan phai nhan thong bao tu choi ro rang, khong duoc truy cap bat ky du lieu van hanh nao.

Khuyen nghi dung OAuth client Google rieng cho Parent va Admin trong production. Neu dung chung client trong giai doan dau, hai flow van phai co callback, redirect allowlist, state, session cookie va authorization rule doc lap.

### 3.2 Mo hinh du lieu de xuat

Khong luu mot truong `parentEmail` don le tren `Student`. Dung quan he nhieu-nhieu de xu ly mot phu huynh co nhieu con va mot hoc sinh co nhieu nguoi giam ho.

| Entity | Du lieu can thiet | Muc dich |
| --- | --- | --- |
| `Parent` | `id`, `emailNormalized` unique, `displayName`, `status`, metadata dang nhap gan nhat neu can | Dinh danh phu huynh bang email Google |
| `StudentParent` | `studentId`, `parentId`, `status`, `createdAt`, `revokedAt`/`revokedBy` neu can | Cap hoac thu hoi quyen xem hoc sinh |

Admin nhap mot hoac nhieu email nguoi giam ho trong man hinh hoc sinh. Backend chuan hoa email (`trim`, lowercase), tao/tai su dung `Parent`, va tao lien ket dang hieu luc. Viec thu hoi quyen phai vo hieu hoa lien ket, khong xoa cung du lieu lich su.

### 3.3 Ranh gioi bao mat bat buoc

- Parent session dung cookie rieng, vi du `anhhoa_parent_session`, voi `Secure`, `httpOnly`, `SameSite=Lax`.
- Khong dat cookie dung chung domain goc neu khong co ly do bat buoc.
- Parent API khong duoc tai su dung endpoint Admin va chi an nut o frontend.
- Moi truy van invoice cua Parent phai lay parent identity tu session va kiem tra quan he `StudentParent` o server; khong tin `studentId` hay `invoiceId` tu client.
- Parent chi nhan DTO toi thieu; khong lo audit Admin, du lieu hoc sinh khac, danh sach tai khoan nguon hien tai, hay thao tac noi bo.
- OAuth redirect chi duoc phep den origin Parent da cau hinh; origin validation va CSRF ap dung cho cac mutation hien tai va tuong lai.
- Cac ID phai la UUID khong doan duoc, nhung UUID khong thay the authorization o server.

## 4. Pham vi Parent PWA de xuat

### 4.1 Trong pham vi

- Dang nhap/dang xuat Google cho Parent.
- Trang chao va danh sach hoc sinh ma Parent co quyen xem.
- Danh sach hoa don cua cac hoc sinh do, co loc theo hoc sinh, thang, va trang thai neu UX can.
- Chi tiet hoa don read-only: hoc sinh, thang hoa don, cac dong phi, tong tien, phuong thuc, va trang thai.
- Huong dan thanh toan cho hoa don `PENDING` co phuong thuc `TRANSFER`.
- VietQR tu du lieu snapshot, tai anh QR, va sao chep so tien/so tai khoan/noi dung chuyen khoan.
- Thu mo app ngan hang qua deep link theo tung ngan hang da duoc xac nhan ho tro.
- PWA manifest va service worker rieng; thiet ke mobile-first.

### 4.2 Ngoai pham vi giai doan nay

- Dong bo giao dich ngan hang, webhook, virtual account, va tu dong chuyen `PENDING -> COMPLETED`.
- Xu ly thu thieu, thu thua, tra gop, hoan tien, hay mo lai hoa don `COMPLETED`.
- Parent sua hoa don, sua hoc sinh/lop, chon tai khoan nhan tien, hay thay doi trang thai hoa don.
- Thong bao email, SMS, Zalo, tai PDF, upload bien lai, va chat/ho tro thanh toan.
- Mot deep link phan mem ngan hang dung chung, dam bao chay voi moi ngan hang va moi thiet bi.

## 5. Parent API de xuat

API Parent co namespace rieng, DTO rieng va chi tra du lieu duoc phep hien thi.

| Endpoint | Muc dich |
| --- | --- |
| `GET /api/parent/me` | Khoi tao identity Parent va trang thai session |
| `GET /api/parent/students` | Danh sach hoc sinh Parent duoc uy quyen xem |
| `GET /api/parent/invoices` | Danh sach hoa don da authorize |
| `GET /api/parent/invoices/:invoiceId` | Chi tiet read-only cua hoa don da authorize |
| `GET /api/parent/invoices/:invoiceId/payment` | Du lieu thanh toan snapshot cua hoa don `PENDING` + `TRANSFER` |

Endpoint payment chi duoc tra ve khi invoice thuoc hoc sinh Parent duoc uy quyen va dang o trang thai/phuong thuc phu hop. Tat ca gia tri nhu tong tien, ma ngan hang, so tai khoan va noi dung chuyen khoan phai do API tao tu invoice snapshot, khong do frontend tu lap.

## 6. Luong thanh toan VietQR va deep link

### 6.1 Luong mac dinh: VietQR

Day la luong phai hoat dong tren moi thiet bi:

1. Parent mo hoa don `PENDING` co phuong thuc `TRANSFER`.
2. Parent chon `Chuyen tien`.
3. Parent PWA hien thi payment sheet voi VietQR, tong VND, ngan hang nhan, so tai khoan, ten chu tai khoan va noi dung chuyen khoan.
4. Parent co the tai VietQR PNG va sao chep tung truong thanh toan.
5. Parent quet QR trong app ngan hang hoac nhap/copy thu cong.

QR, noi dung chuyen khoan va tai khoan nhan phai duoc lay tu payment snapshot da khoa khi invoice chuyen sang `PENDING`. Khong duoc dung du lieu tai khoan ngan hang hien tai, de hoa don lich su khong bi thay doi sau khi Admin sua hoac ngung dung tai khoan nguon.

Nen thay noi dung chuyen khoan hien tai bang ma tham chieu ngan, on dinh, khong tiet lo thong tin tre qua lich su giao dich, vi du `AH-202608-<invoiceShortId>`. Dinh dang cu the va gioi han do dai can duoc chot trong PRD.

### 6.2 Tai VietQR

- Nut `Tai ma QR` tai anh PNG duoc sinh tu payload snapshot.
- Anh tai ve phai co ten file xac dinh, vi du `anh-hoa-<invoiceCode>.png`.
- Giao dien van hien thi cac truong text de Parent co the thanh toan neu app ngan hang khong quet QR tu thu vien anh.
- Can quyet dinh QR se duoc sinh va host boi API cua he thong hay dung dich vu anh ben thu ba. Uu tien sinh QR trong he thong de tranh lo thong tin thanh toan cho ben thu ba va giam phu thuoc availability.

### 6.3 Deep link tung ngan hang

Deep link la fallback cai thien trai nghiem, khong phai bang chung thanh toan va khong duoc la luong bat buoc.

1. Parent chon `Mo app ngan hang`.
2. Parent chon ngan hang trong danh sach da ho tro, hoac he thong dung lua chon gan nhat tren thiet bi.
3. Parent PWA tao deep link tu payload payment snapshot va thu mo app.
4. Neu app chua cai, deep link bi chan, hoac quay lai PWA, giao dien van giu QR va cac nut sao chep.

Rang buoc ky thuat:

- Khong co URI standard cong khai hoat dong chac chan cho moi app ngan hang, trinh duyet, Android va iOS.
- Chi them mot ngan hang sau khi co tai lieu public/chinh thuc hoac kiem thu thuc te tren Android Chrome, Android in-app browser, iOS Safari, va PWA installed neu can.
- Danh sach ngan hang, URI template, version da kiem thu, va cach fallback phai duoc quan ly o server/config co version; khong hard-code phan tan trong UI.
- Neu ngan hang khong ho tro prefill day du, chi hien thi QR va copy fields thay vi tao trai nghiem chuyen khoan sai.
- Binh chon nut deep link khong lam thay doi invoice. Co the ghi event phuc vu ho tro, nhung event khong la xac nhan tien da den.

## 7. Vong doi hoa don va van hanh

Vong doi hien tai duoc giu nguyen:

```text
DRAFT -> PENDING -> COMPLETED
```

- Parent chi xem `DRAFT` neu PRD cho phep hien thi hoa don chua san sang; de tranh gui nham, de xuat chi hien thi ro rang `Chua san sang thanh toan` va an payment action.
- Parent thanh toan qua QR/deep link cho invoice `PENDING` + `TRANSFER`.
- Admin kiem tra giao dich ben ngoai he thong va la nguoi duy nhat xac nhan `PENDING -> COMPLETED`.
- `COMPLETED` read-only voi thong tin da thanh toan; Parent khong the tao lai QR/deep link nhu mot loi moi thanh toan moi, tru khi PRD quy dinh ro chi la xem lich su.

Can chot trong PRD: Parent co duoc xem `DRAFT` hay khong, Parent co duoc xem hoa don `CASH` hay khong, va invoice da `COMPLETED` hien thi thong diep/truong nao.

## 8. Thay doi ky thuat du kien

```text
apps/
  api/                         # Mo rong auth, parent, student-parent, parent invoices
  web/                         # Admin PWA hien tai, giu nguyen boundary
  parent-web/                  # Parent PWA moi (React + Vite + PWA)
```

API van la chu so huu duy nhat cua Prisma schema, money calculation, invoice snapshots, QR payload va authorization. Parent PWA chi goi REST API; khong chua business rule thanh toan, tong tien, hoac quyen truy cap.

Can mo rong Nest modules theo ownership ro rang, vi du `parents` quan ly Parent va lien ket StudentParent; `parent-auth` xu ly Parent OAuth/session; `parent-portal` cung cap read model da authorize. Khong de controller Parent goi truc tiep controller Invoice/Admin.

Can bo sung migration cho `Parent` va `StudentParent`, test integration PostgreSQL cho authorization, va E2E tests cho Parent PWA.

## 9. Tieu chi chap nhan muc san pham

- Admin co the gan va thu hoi mot hoac nhieu email Parent tren hoc sinh.
- Email Google chua duoc gan khong the dang nhap Parent PWA va khong nhan du lieu invoice.
- Mot Parent gan voi nhieu hoc sinh chi xem duoc nhung hoc sinh va hoa don tuong ung.
- Parent khong the truy cap invoice bang UUID cua hoc sinh khac.
- Parent xem dung tong tien, bank account snapshot va transfer content snapshot cua invoice `PENDING` + `TRANSFER`.
- Parent tai duoc VietQR PNG va sao chep duoc cac truong thanh toan.
- Deep link ngan hang da ho tro co fallback QR/copy khi khong mo duoc app.
- Mo QR, tai QR, sao chep, va mo deep link khong lam hoa don tu dong thanh `COMPLETED`.
- Admin van xac nhan thanh toan thu cong; `COMPLETED` giu tinh bat bien hien tai.

## 10. Cac quyet dinh can chot truoc khi tao PRD

| Chu de | Cau hoi can quyet dinh | De xuat khoi dau |
| --- | --- | --- |
| Product boundary | Parent PWA co la initiative mo rong hay MVP moi co PRD rieng? | PRD mo rong lien ket voi Admin MVP |
| Domain | Ten mien/subdomain production cua Admin va Parent? | Tach `admin` va `phuhuynh` subdomain |
| Parent identity | Chi email Google hay co them OTP/phone fallback? | Google email only o giai doan 1 |
| Guardian model | Mot hoc sinh co bao nhieu Parent; quan he co role khong? | Nhieu-nhieu, khong role trong giai doan 1 |
| Quyen du lieu | Parent xem DRAFT, PENDING, COMPLETED nhu the nao? | Xem tat ca; chi thanh toan PENDING + TRANSFER |
| Visibility | Parent co xem cac dong phi chi tiet hay chi tong tien? | Xem day du dong phi cua hoc sinh duoc uy quyen |
| QR generation | Tu sinh/host QR hay dung dich vu anh VietQR? | Tu sinh trong he thong tu payload snapshot |
| Transfer content | Ma tham chieu va quy tac bao mat/noi dung? | Ma invoice on dinh, khong dung ten hoc sinh |
| Deep links | Ngan hang uu tien, nguon URI template va device matrix? | Chon theo danh sach ngan hang phu huynh dang dung; VietQR la fallback bat buoc |
| Payment action | Co nut `Toi da chuyen tien` hay upload bien lai? | Khong o giai doan 1 |
| Notification | Co gui link/nhac han qua email, SMS hay Zalo? | Ngoai pham vi giai doan 1 |
| Privacy | Chinh sach thu hoi quyen, retention va xu ly email sai? | Status-based revoke, audit toi thieu, khong xoa cung quan he |

## 11. Rui ro va giam thieu

| Rui ro | Tac dong | Giam thieu |
| --- | --- | --- |
| Email Google nhap sai hoac dung chung | Lo thong tin hoa don cua tre | Admin xac nhan email; lien ket active/revoked; authorization server-side tren moi request |
| Parent share thiet bi/session | Nguoi khac xem hoa don | Cookie httpOnly, logout ro rang, session expiry va huong dan su dung thiet bi ca nhan |
| Deep link khong on dinh | Parent khong mo duoc app ngan hang | VietQR + copy fields la luong chinh; deep link chi la enhancement da kiem thu |
| QR/transfer payload thay doi theo tai khoan nguon | Chuyen nham tai khoan hoac mat lich su | Chi dung invoice snapshot sau `PENDING` |
| Parent nghi da thanh toan khi app da mo | Admin/Parent hieu sai trang thai | Ghi ro `Dang cho nha truong xac nhan`; khong doi lifecycle khi mo deep link |
| Phu thuoc dich vu QR ben thu ba | Mat dich vu/lo du lieu thanh toan | Uu tien sinh QR noi bo; neu chua lam duoc, danh gia DPA, availability va fallback |

## 12. De xuat buoc tiep theo

1. Xac nhan cac quyet dinh o muc 10, uu tien domain, visibility hoa don, transfer content va danh sach ngan hang.
2. Tao PRD mo rong Parent PWA, thay the ro rang cac muc hien tai coi Parent la ngoai pham vi.
3. Cap nhat UX specification cho Parent PWA mobile-first va payment sheet/fallback states.
4. Cap nhat architecture spine truoc khi scaffold `apps/parent-web` hay mo rong OAuth/schema, vi architecture hien tai dang chi rang buoc `apps/web` va Admin-only auth.
5. Sau khi PRD, UX va architecture da duoc chot, chia epics/stories va trien khai theo thu tu: data authorization -> Parent OAuth -> Parent read APIs -> Parent PWA -> QR download -> deep links ngan hang.
