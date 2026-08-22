---
title: "PRD mo rong - Parent PWA xem hoa don va thanh toan chuyen khoan"
status: final
created: 2026-08-22
updated: 2026-08-22
---

# PRD mo rong: Parent PWA cua truong mam non Anh Hoa

## 0. Muc dich tai lieu

PRD nay xac dinh Parent PWA mobile-first la release mo rong rieng sau Admin MVP duoc quy dinh trong `../prd-anhhoa-2026-08-18/prd.md`. Release nay thay the pham vi loai tru Parent tai PRD Admin, phien ban MVP 2026-08-18, nhung khong sua doi artifact da `final`. Tai lieu la nguon yeu cau cho UX, architecture, epics/stories va trien khai Parent PWA; architecture spine phai duoc cap nhat va chot truoc khi scaffold. `docs/proposal-parent-pwa.md` la dau vao goc; chi tiet thuc thi nhu API, OAuth, cookie, schema va VietQR payload duoc luu trong `addendum.md` de UX va architecture quyet dinh.

## 1. Tam nhin

Parent PWA giup phu huynh da duoc nha truong uy quyen tu xem hoa don da san sang thanh toan hoac da hoan tat cua hoc sinh va nhan dung huong dan chuyen khoan. Phu huynh co the kiem tra hoa don tren dien thoai, quet hoac tai VietQR, sao chep thong tin chuyen tien va mo app ngan hang khi co ho tro.

San pham bo sung kenh tu phuc vu cho phu huynh ma khong thay doi quyen kiem soat thu tien cua Admin. Chuyen khoan, quet QR, tai QR hay mo app ngan hang khong phai bang chung thanh toan; chi Admin duoc xac nhan hoa don da thu du va chuyen hoa don sang `COMPLETED`.

## 2. Nguoi dung muc tieu

### 2.1 Cong viec can hoan thanh

- Phu huynh can dang nhap an toan bang tai khoan Google da duoc nha truong gan quyen.
- Phu huynh can biet nhung hoc sinh nao minh duoc xem va xem dung hoa don cua tung em.
- Phu huynh can kiem tra trang thai va cac dong phi truoc khi chuyen tien.
- Phu huynh can co du thong tin thanh toan cua hoa don chuyen khoan de thanh toan khong nham tai khoan, so tien hay noi dung.
- Admin can cap va thu hoi quyen xem phu huynh ma khong lam lo du lieu cua hoc sinh khac.
- Admin can tiep tuc la nguoi duy nhat xac nhan da thu tien nhu quy trinh hien tai.

### 2.2 Khong phai nguoi dung giai doan 1

- Giao vien, hoc sinh va ben thu ba khong co giao dien hay quyen truy cap Parent PWA.
- Phu huynh khong co quyen sua hoc sinh, lop, hoa don, tai khoan nhan tien hay trang thai hoa don.
- Phu huynh khong xac nhan, doi soat hay chung minh thanh toan trong he thong.

### 2.3 Hanh trinh chinh

- **UJ-1. Mai xem hoa don cua con.** Mai da duoc Admin gan email Google vao hoc sinh, lien ket co hieu luc ngay. Mai mo Parent PWA tren dien thoai, dang nhap Google, thay danh sach cac con duoc uy quyen va mo hoa don thang can xem. Mai xem duoc cac dong phi, tong tien, phuong thuc va trang thai cua dung hoc sinh do.
- **UJ-2. Mai chuyen khoan cho hoa don dang cho thanh toan.** Tu hoa don `PENDING` co phuong thuc `TRANSFER`, Mai chon chuyen tien. PWA hien VietQR, so tien, tai khoan nhan, ten chu tai khoan va noi dung chuyen khoan da khoa. Mai quet QR hoac sao chep thong tin; sau do PWA hien ro hoa don van dang cho nha truong xac nhan.
- **UJ-3. Mai mat quyen truy cap.** Sau khi Admin thu hoi lien ket, Mai quay lai PWA hoac mo mot invoice URL da biet. He thong khong hien thi du lieu cu, xoa phien/dieu huong phu hop va khong cho truy cap bat ky hoc sinh hay hoa don nao da bi thu hoi quyen.

## 3. Thuat ngu

- **Parent** - Nguoi dung phu huynh duoc dinh danh bang tai khoan Google va co trang thai cho phep truy cap.
- **Lien ket Parent-Hoc sinh** - Quyen de mot Parent xem du lieu cua mot Hoc sinh; mot Parent co the lien ket voi nhieu Hoc sinh va mot Hoc sinh co the lien ket voi nhieu Parent.
- **Hoa don** - Ban ghi thu tien cua mot Hoc sinh trong mot Thang hoa don, co `DRAFT`, `PENDING` hoac `COMPLETED` nhu PRD Admin.
- **Payment snapshot** - Ban chup du lieu thanh toan duoc khoa khi Hoa don chuyen sang `PENDING`, gom tong tien, tai khoan nhan va noi dung chuyen khoan co ho ten Hoc sinh, biet danh neu co va Lop.
- **VietQR** - Ma QR chuyen khoan duoc tao tu Payment snapshot.
- **Payment action** - Hanh dong Parent xem/copy/tai VietQR hoac thu mo app ngan hang; khong lam thay doi Hoa don.

## 4. Tinh nang va yeu cau chuc nang

### 4.1 Quan ly uy quyen Parent

**Mo ta:** Admin cap hoac thu hoi Lien ket Parent-Hoc sinh cho mot hoac nhieu Parent. Quyen truy cap duoc kiem tra o moi request, nen viec thu hoi co hieu luc ngay ca voi Hoa don Parent da tung xem. Realizes UJ-3.

#### FR-1: Cap va thu hoi Lien ket Parent-Hoc sinh

Admin co the gan mot hoac nhieu email Parent cho mot Hoc sinh va thu hoi tung lien ket; Lien ket Parent-Hoc sinh co hieu luc ngay khi Admin gan email.

**He qua kiem thu:**
- Email duoc chuan hoa truoc khi tao hoac tai su dung Parent.
- Cung mot Parent co the duoc gan cho nhieu Hoc sinh; cung mot Hoc sinh co the duoc gan cho nhieu Parent.
- Lien ket moi khong co trang thai cho xac minh; Parent co the dang nhap ngay neu dat cac dieu kien dang nhap khac.
- Thu hoi lien ket khong xoa cung du lieu lich su, nhung lam Parent mat quyen xem ngay lap tuc.
- Neu Parent khong con Lien ket Parent-Hoc sinh dang hieu luc, Parent khong the bat dau hoac duy tri phien Parent PWA.
- Khi quyen bi thu hoi, server tu choi request ke tiep; PWA revalidate khi tab duoc focus, app vao foreground va truoc khi hien thi protected view, sau do xoa state Parent va dieu huong an toan.

#### FR-2: Kiem soat truy cap du lieu Parent

He thong chi cho Parent xem Hoc sinh va Hoa don co Lien ket Parent-Hoc sinh dang hieu luc tai thoi diem request. Realizes UJ-1 va UJ-3.

**He qua kiem thu:**
- Parent khong the truy cap Hoa don cua Hoc sinh khac bang UUID, filter hay URL da biet.
- Parent inactive hoac Lien ket Parent-Hoc sinh revoked khong nhan du lieu Hoa don.
- Khi session het han, bi thu hoi hoac nhan `401`, PWA xoa du lieu Parent dang hien thi truoc khi dieu huong den dang nhap.
- Parent chi nhan truong du lieu can thiet de xem Hoc sinh, Hoa don va thanh toan; khong nhan audit Admin hay du lieu noi bo khac.

### 4.2 Dang nhap va phien Parent

**Mo ta:** Parent dang nhap bang Google qua entry point rieng va chi vao Parent PWA khi identity hop le, Parent active va co it nhat mot Lien ket Parent-Hoc sinh dang hieu luc. Realizes UJ-1.

#### FR-3: Dang nhap Google cua Parent

Parent co the dang nhap va dang xuat Parent PWA bang tai khoan Google da duoc uy quyen.

**He qua kiem thu:**
- Google email chua duoc gan, Parent inactive hoac Parent khong co Lien ket Parent-Hoc sinh active bi tu choi dang nhap va khong nhan partial session.
- Google phai tra ve email da xac minh. Lan dang nhap dau tien map email normalized voi Lien ket Parent-Hoc sinh do Admin gan va luu Google subject; cac lan sau Google subject phai khop.
- Neu Google subject thay doi hoac email da duoc cap lai, he thong tu choi dang nhap cho den khi Admin thu hoi va gan lai email.
- Loi OAuth nhu state khong hop le, state het han va loi provider duoc hien thi bang thong bao an toan, khong lo du lieu he thong.
- Parent session tach biet voi session Admin; Parent PWA khong dung endpoint nghiep vu Admin.
- Dang xuat xoa state Parent tren client va ket thuc session Parent.

### 4.3 Xem Hoc sinh va Hoa don

**Mo ta:** Parent co read-only view rieng tren mobile cho Hoc sinh duoc uy quyen va Hoa don cua cac Hoc sinh do. Hoa don hien thi day du dong phi, tong tien, phuong thuc va trang thai. Realizes UJ-1.

#### FR-4: Danh sach Hoc sinh va Hoa don da uy quyen

Parent co the xem danh sach Hoc sinh duoc uy quyen va danh sach Hoa don cua cac Hoc sinh do.

**He qua kiem thu:**
- Danh sach Hoa don ho tro phan trang, sap xep on dinh va chi filter theo Hoc sinh duoc uy quyen, Thang hoa don va trang thai hop le.
- Parent chi thay Hoa don cua Hoc sinh co Lien ket Parent-Hoc sinh active.
- Parent chi xem `PENDING` va `COMPLETED`; Hoa don `DRAFT` khong xuat hien trong danh sach, filter hay trang chi tiet Parent.

#### FR-5: Chi tiet Hoa don read-only

Parent co the mo chi tiet mot Hoa don da duoc uy quyen de xem Hoc sinh, Thang hoa don, cac dong phi, tong tien, phuong thuc va trang thai.

**He qua kiem thu:**
- Parent khong co thao tac sua Hoa don, sua Hoc sinh, doi phuong thuc, doi tai khoan nhan tien hay doi trang thai.
- `COMPLETED` chi xem va khong hien thi Payment action moi.
- Neu Hoa don chuyen `COMPLETED` khi Parent dang mo huong dan thanh toan, PWA refresh trang thai va an Payment action.

### 4.4 Huong dan chuyen khoan

**Mo ta:** Payment action chi kha dung cho Hoa don `PENDING` co phuong thuc `TRANSFER`. PWA dua tren Payment snapshot da khoa de hien VietQR va cac truong thanh toan; day la huong dan thanh toan, khong la xac nhan thu tien. Realizes UJ-2.

#### FR-6: Xem va sao chep thong tin thanh toan

Parent co the mo payment sheet cua Hoa don du dieu kien va xem VietQR, so tien VND, ngan hang nhan, so tai khoan, ten chu tai khoan va noi dung chuyen khoan tu Payment snapshot.

**He qua kiem thu:**
- Payment action chi hien thi khi Hoa don la `PENDING` va `TRANSFER` co Payment snapshot hop le.
- Neu Hoa don khong du dieu kien hoac Payment snapshot khong hop le, PWA khong hien thi payment payload va thong bao trang thai ro rang.
- Parent co the sao chep tung truong thanh toan; cac truong copy van kha dung khi QR loi.
- Payment sheet hien thi ro `Dang cho nha truong xac nhan`; mo, quet QR hoac sao chep thong tin khong chuyen Hoa don sang `COMPLETED`.

#### FR-7: Tai VietQR va mo app ngan hang

Parent co the tai VietQR PNG va co the thu mo app ngan hang tu danh sach ngan hang duoc ho tro.

**He qua kiem thu:**
- VietQR PNG duoc tao tu Payment snapshot, co ten file xac dinh va khong thay doi theo tai khoan nhan tien hien tai.
- Neu tai QR hoac sinh QR loi, PWA giu cac truong thanh toan de Parent sao chep thu cong.
- Deep link ngan hang chi hien thi cho cau hinh ngan hang/thiet bi da duoc ho tro; VietQR va copy fields luon la fallback.
- Deep link khong mo duoc app, bi tu choi hoac Parent quay lai PWA khong lam thay doi Hoa don.

## 5. Yeu cau phi chuc nang va rang buoc

- Parent PWA la PWA rieng, mobile-first, co manifest va service worker rieng voi Admin PWA; production dung subdomain Parent tach biet voi subdomain Admin.
- Parent PWA khong duoc cache response chua du lieu Parent trong service worker; du lieu client phai duoc xoa khi logout, session expiry, `401` hoac revoke.
- Authorization bat buoc duoc kiem tra server-side tai moi request; UUID khong thay the authorization.
- Tien su dung VND nguyen va tong tien, payment payload luon lay tu Hoa don Payment snapshot do server xac dinh, khong tin gia tri tu client.
- Payment snapshot phai duoc validate truoc khi Hoa don chuyen `PENDING`; thong tin lich su khong doi neu Hoc sinh, Lop hay Tai khoan nhan tien nguon thay doi sau do.
- Noi dung chuyen khoan theo quy tac hien tai co ho ten Hoc sinh, biet danh neu co va Lop; rui ro rieng tu tren lich su giao dich da duoc chap nhan cho giai doan 1.
- Parent PWA khong duoc chia se frontend, router, session, OAuth callback hay endpoint nghiep vu voi Admin PWA.
- Moi mutation cookie-auth lien quan Parent, bao gom cap va thu hoi Lien ket Parent-Hoc sinh, bat buoc dung origin validation, double-submit CSRF va idempotency UUID khi thao tac co the gui lai hoac xu ly hang loat.
- Release nho nay khong bo sung audit access, retention, monitoring hay incident owner rieng cho Parent PWA. Audit Hoa don cua Admin MVP van giu nguyen; day la gioi han scope da duoc chap nhan.

## 6. Khong lam trong giai doan 1

- Tu dong doi soat ngan hang, webhook, virtual account hoac tu dong chuyen `PENDING` sang `COMPLETED`.
- Parent xac nhan da chuyen tien, upload bien lai, chat/ho tro, thong bao email/SMS/Zalo, tai PDF hoac in Hoa don.
- Thu thieu, thu thua, tra gop, hoan tien, huy hoac mo lai Hoa don `COMPLETED`.
- Parent sua Hoa don, Hoc sinh, Lop, Tai khoan nhan tien hoac trang thai Hoa don.
- OTP, phone fallback va mot deep link ngan hang dung chung co cam ket chay tren moi ngan hang/thiet bi.
- Chia se session, router, frontend hay endpoint nghiep vu giua Parent PWA va Admin PWA.

## 7. Pham vi giai doan 1

### 7.1 Trong pham vi

- Quan ly Lien ket Parent-Hoc sinh: cap, thu hoi va kiem soat truy cap server-side.
- Google login/logout va session rieng cho Parent.
- Parent PWA mobile-first de xem Hoc sinh va Hoa don read-only.
- Xem Hoa don `PENDING` va `COMPLETED` voi quy tac payment action theo trang thai.
- Payment sheet cho `PENDING` + `TRANSFER`: VietQR, download PNG, copy fields va deep link ngan hang co ho tro.

### 7.2 Ngoai pham vi

- Cac muc o phan 6.

## 8. Chi so thanh cong

- **SM-1:** Parent da duoc uy quyen dang nhap va xem dung Hoc sinh/Hoa don cua minh tren Parent PWA; cac request den Hoc sinh/Hoa don khong duoc uy quyen deu bi tu choi. Xac thuc FR-2, FR-3, FR-4 va FR-5.
- **SM-2:** Parent co Hoa don `PENDING` + `TRANSFER` xem, tai hoac sao chep duoc thong tin tu Payment snapshot va duoc thong bao ro rang Hoa don dang cho nha truong xac nhan. Xac thuc FR-6 va FR-7.
- **SM-3:** Sau khi Admin thu hoi Lien ket Parent-Hoc sinh, Parent khong con truy cap du lieu cua Hoc sinh do trong phien dang dung. Xac thuc FR-1 va FR-2.
- **SM-C1:** Khong toi uu completion rate bang cach coi thao tac QR/deep link la thanh toan thanh cong; chi Admin xac nhan `PENDING -> COMPLETED`. Can bang SM-2.

## 9. Cau hoi mo

1. Gia tri cu the cua subdomain production, OAuth redirect allowlist va boundary cookie/CORS giua Admin, Parent va API la gi? Architecture phai chot truoc scaffold.
2. Quy trinh xu ly email nhap sai va email dung chung la gi? Google subject thay doi da bi tu choi cho den khi Admin thu hoi va gan lai email.
3. Danh sach ngan hang, device/browser matrix, chu ky tai kiem thu va owner cho deep-link template la gi?

## 10. Chi muc gia dinh

- Parent dung Google email-only trong giai doan 1, khong co OTP/phone fallback.
- Lien ket Parent-Hoc sinh duoc danh gia tai thoi diem request va revoke co hieu luc ngay.
