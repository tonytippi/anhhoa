---
name: Anh Hoa Parent PWA
status: final
sources:
  - ../../prds/prd-anhhoa-parent-pwa-2026-08-22/prd.md
  - ../../architecture/architecture-anhhoa-parent-pwa-2026-08-22/ARCHITECTURE-SPINE.md
design: DESIGN.md
created: 2026-08-22
updated: 2026-08-22
---

# Anh Hoa Parent PWA - Experience Spine

## Foundation

Parent PWA la be mat consumer, mobile-first cho Parent da dang nhap Google va dang duoc uy quyen. `DESIGN.md` la nguon nhan dien; shadcn/ui tren Base UI la component foundation. App chi doc du lieu qua Parent REST boundary va khong cache protected response trong service worker.

Muc tieu cua Home la tra loi ngay: `Hom nay toi can thanh toan Hoa don nao cho con?` Hoa don `PENDING` luon xuat hien truoc; `COMPLETED` la lich su phu. Parent co nhieu con khong can doi context truoc khi thay Hoa don can xu ly.

## Information Architecture

| Surface | Di tu | Muc dich |
| --- | --- | --- |
| Dang nhap | URL chua xac thuc, session het han | Dang nhap Google; thong bao an toan neu email/identity/uy quyen khong hop le. |
| Home - Can thanh toan | App mo sau dang nhap, tab `Trang chu` | Hien ngay Hoa don `PENDING`, nhom theo Hoc sinh, dua `Chuyen tien` vao tam diem. |
| Chi tiet Hoa don | Pending card, completed row, deep link | Xem cac dong phi, tong tien, phuong thuc va trang thai cua mot Hoa don da uy quyen. |
| Payment sheet | CTA `Chuyen tien` | Xem VietQR, copy/tai thong tin chuyen khoan va mo deep link duoc ho tro. |
| Lich su | Tab `Lich su` | Xem Hoa don `COMPLETED`, loc theo Hoc sinh va thang. |
| Tai khoan | Header menu | Xem email dang nhap, dang xuat va thong tin tro giup ngan. |

Bottom navigation co `Trang chu` va `Lich su`; menu tai khoan o header. `Trang chu` luon mo sau login va sau khi Parent vao lai PWA. Khong co man hinh danh sach Hoc sinh doc lap trong phase nay: Student switcher tren Home/Lich su du cho Parent co nhieu con.

## Voice and Tone

Giong dieu ro rang, binh tinh va ton trong. Khong dung ngon ngu dam bao giao dich da thanh cong khi Parent chi moi xem huong dan. Dung ten hoc sinh de dinh huong, khong dung biet danh mo ho.

| Nen dung | Khong dung |
| --- | --- |
| `Can thanh toan cho Be An` | `Ban co 1 viec can lam` |
| `Chuyen tien` | `Thanh toan ngay` |
| `Dang cho nha truong xac nhan` | `Da thanh toan thanh cong` |
| `Khong con Hoa don can thanh toan` | `Tuyet voi!` |
| `Khong the mo app ngan hang. Ban van co the quet ma QR hoac sao chep thong tin.` | `Da xay ra loi` |

## Component Patterns

| Pattern | Be mat | Quy tac hanh vi |
| --- | --- | --- |
| Student switcher | Home, Lich su | Chi hien khi Parent co >= 2 Hoc sinh. `Tat ca` mac dinh. Chon mot hoc sinh loc dong tai cho va cap nhat URL/query state; khong xoa cac Hoa don dang tai. |
| Pending groups | Home | Chi render Hoc sinh co it nhat mot Hoa don `PENDING`. Moi group co card `PENDING` sap theo billing month moi nhat truoc; group sap theo Hoa don `PENDING` moi nhat, hoa dung ten Hoc sinh. Hoc sinh khong co `PENDING` chi co trong Student switcher va Lich su. |
| Pending invoice card | Home | Toan card mo Chi tiet Hoa don. CTA `Chuyen tien` chi hien khi phuong thuc `TRANSFER` va payment snapshot hop le; neu `CASH`, card chi mo chi tiet va nhac lien he nha truong de thanh toan. |
| Invoice detail | Chi tiet Hoa don | Read-only. Hien dong phi, tong, phuong thuc, trang thai va Hoc sinh snapshot. `PENDING` + `TRANSFER` co CTA `Chuyen tien`; `COMPLETED` khong co CTA thanh toan. |
| Payment sheet | Chi tiet/Home | Bottom sheet. Chi mo sau API eligibility check. Hien VietQR, tong tien, tai khoan nhan, chu tai khoan va noi dung chuyen khoan tu snapshot; tung truong copy duoc. Dong sheet khong lam thay doi Hoa don. |
| QR download and deep link | Payment sheet | `Tai ma QR` tai PNG. `Mo app ngan hang` chi hien neu server tra cau hinh ho tro; failure/return tu app giu sheet mo voi QR va copy fields. |
| History list | Lich su | Chi `COMPLETED`; phan trang, sap theo billing month/thoi diem cap nhat moi nhat truoc. Moi row mo chi tiet read-only. |
| Logout | Tai khoan | Xac nhan ngay khong can modal. Clear protected UI truoc khi route ve Dang nhap. |

## State Patterns

| State | Be mat | Cach xu ly |
| --- | --- | --- |
| Dang tai lan dau | Home, Lich su | Skeleton theo header, student chips va invoice card/row; khong hien spinner toan man hinh. |
| Dang tai lai | Home, Chi tiet, payment sheet | Giu du lieu dang doc, hien indicator nho; neu server tu choi, xu ly theo `401`/revoke. |
| Khong co Hoa don `PENDING` | Home | Hien thong diep `Khong con Hoa don can thanh toan` va link thu cap `Xem lich su`; khong chen card gia. |
| Co nhieu con | Home, Lich su | Hien group heading va student switcher. `Tat ca` khong tron Hoa don mat ten hoc sinh; moi card/row van ghi ro hoc sinh. |
| `PENDING` + `TRANSFER` | Home, Chi tiet | Badge `Can thanh toan`, CTA `Chuyen tien`; payment sheet hien `Dang cho nha truong xac nhan`. |
| `PENDING` + `CASH` | Home, Chi tiet | Badge `Can thanh toan`, khong co payment sheet; hien thong tin ngan `Thanh toan tien mat tai nha truong` neu API tra phuong thuc cash. |
| `COMPLETED` | Chi tiet, Lich su | Badge `Da hoan tat`, read-only, khong co CTA thanh toan hoac QR action moi. |
| Hoa don mat payment eligibility khi dang mo payment sheet | Payment sheet | Neu revalidation tra Hoa don `COMPLETED`, `DRAFT`, khong con `TRANSFER`, snapshot khong hop le hoac khong con authorization, xoa payment payload va dong sheet ngay. Refresh Chi tiet/Home; voi `COMPLETED` hien `Nha truong da xac nhan Hoa don nay`, cac truong hop khac hien `Huong dan chuyen tien khong con kha dung`. |
| QR/download loi | Payment sheet | Giu so tien va copy fields kha dung; thong bao inline cu the, cho phep thu lai download. |
| Deep link khong ho tro/that bai | Payment sheet | Khong doi trang thai Hoa don; giu QR/copy fields va thong bao fallback. |
| Session het han hoac `401` toan cuc | Moi protected surface | Xoa toan bo protected query/cache state truoc khi hien Dang nhap. Neu dang o payment sheet/Chi tiet, dong ngay; khong hien du lieu cu sau route. |
| Revoke mot Lien ket Parent-Hoc sinh | Home, Lich su, Chi tiet, payment sheet | Xoa chi du lieu Hoc sinh/Hoa don bi revoke, dong Chi tiet/payment sheet neu dang mo cho Hoc sinh do, va refresh Student switcher. Parent giu session va cac Hoc sinh con `ACTIVE`; chi ve Dang nhap neu khong con Lien ket active nao hoac session khong hop le. |
| Offline | Moi protected surface | Hien mot banner `Ban dang ngoai tuyen. Hay ket noi mang de cap nhat Hoa don.` Khong hien du lieu cached nhu la du lieu moi va khong queue action. |

## Interaction Primitives

- Target cham toi thieu 44x44px; toan bo card co the mo bang touch/keyboard, CTA ben trong khong kich hoat card parent.
- Student switcher scroll ngang va dung native horizontal scroll; khong dung carousel tu dong.
- Copy action thong bao truong da copy, vi du `Da sao chep so tai khoan`; khong copy ca payload khi Parent khong chu dong chon.
- Payment sheet drag-to-dismiss hoac nut `Dong`; `Esc` dong sheet tren desktop. Dong sheet khong dua ra xac nhan va khong thay doi Hoa don.
- Sau copy/download/deep link return, focus giu o control da kich hoat neu van con trong PWA; khong day Parent ve Home.
- Revalidate khi app foreground, tab focus va truoc protected view. Trong khi revalidate khong hien data protected moi neu session chua duoc xac thuc.

## Accessibility Floor

- Tuan WCAG 2.2 AA. Color/contrast ke thua tu `DESIGN.md`; status luon co nhan chu va icon/van ban bo sung khi can.
- Moi route co `h1`; Home co heading `Hoa don can thanh toan`. Group theo Hoc sinh dung heading cap duoi de screen reader hieu cau truc.
- Tong tien duoc doc kem don vi VND. QR co text thay the: `Ma QR chuyen khoan cho [ten Hoc sinh], [so tien] dong`; khong xem QR la cach duy nhat de thanh toan.
- Payment sheet la dialog co ten, mo ta, focus trap va return focus ve CTA mo sheet. Nut `Dong`, copy, download va deep link co accessible name day du.
- Skeleton khong duoc doc nhu noi dung; loi inline va thay doi trang thai dung live region. Khong tu dong chuyen focus khi background refresh thanh cong.

## Responsive & Platform

| Breakpoint | Hanh vi |
| --- | --- |
| `< 768px` | Mot cot, bottom navigation, payment bottom sheet, student switcher scroll ngang. Day la be mat uu tien. |
| `768-1023px` | Mot cot rong toi da 640px, bottom navigation giu nguyen; payment sheet can giua neu du chieu ngang. |
| `>= 1024px` | Content toi da 720px can giua; van dung invoice card/row va khong them sidebar/table. |

PWA co manifest/icon rieng va co the cai dat theo co che trinh duyet, khong ep install prompt. Khong co push notification trong phase nay. Service worker khong cache Parent REST response hay payment snapshot; app khong ho tro offline data/action.

## Key Flows

### Flow 1 - Mai vao va thay Hoa don can thanh toan cua hai con

1. Mai mo Parent PWA tren dien thoai va dang nhap Google.
2. Home mo o tab `Trang chu`, hien heading `Hoa don can thanh toan` va student switcher `Tat ca`, `Be An`, `Be Binh`.
3. Ngay sau header, Mai thay group `Be An` voi card thang 08/2026, badge `Can thanh toan`, tong tien va CTA `Chuyen tien`; group `Be Binh` xuat hien tiep theo neu co Hoa don `PENDING`.
4. Mai co the chon chip `Be Binh` de chi xem Hoa don cua Be Binh, nhung khi o `Tat ca`, ten hoc sinh van hien tren tung card.
5. **Climax:** Mai biet ngay Hoa don nao can xu ly va cho ai ma khong phai mo trang danh sach hoc sinh hay loc trang thai.

### Flow 2 - Mai chuyen khoan bang VietQR

1. Mai chon `Chuyen tien` tren card Hoa don `PENDING` + `TRANSFER` cua Be An.
2. Payment sheet mo sau khi API xac nhan eligibility, hien tong tien truoc VietQR va thong tin nhan tien tu payment snapshot.
3. Mai quet QR hoac sao chep so tai khoan/noi dung; neu can, Mai chon `Tai ma QR` hoac `Mo app ngan hang` khi duoc ho tro.
4. Sheet luon hien `Dang cho nha truong xac nhan`. Mo QR, download, copy hay deep link khong doi badge Hoa don.
5. **Climax:** Mai co day du thong tin de chuyen tien dung Hoa don va hieu rang nha truong se xac nhan sau.

Loi: neu QR/download/deep link that bai, Mai van co the sao chep tung truong thanh toan. Neu Hoa don da duoc Admin chuyen `COMPLETED`, sheet dong va Home cap nhat `Da hoan tat`.

### Flow 3 - Mai xem lich su va bi thu hoi quyen

1. Mai chon tab `Lich su`, loc theo Be Binh va mo Hoa don `Da hoan tat` de xem read-only.
2. Admin thu hoi Lien ket Parent-Hoc sinh cua Be Binh trong khi Mai chuyen sang app ngan hang va quay lai.
3. Khi Parent PWA vao foreground, app revalidate; server tu choi quyen xem Be Binh nhung Mai van con quyen xem Be An.
4. **Climax:** PWA dong Chi tiet/payment sheet neu co, xoa du lieu cua Be Binh va refresh student switcher; Hoa don cua Be An van kha dung. PWA chi ve Dang nhap neu session khong hop le hoac Mai khong con quyen xem bat ky Hoc sinh nao.

## Decisions and Boundaries

- Home khong co KPI, tong thu, banner marketing hay danh sach `DRAFT`; uu tien duy nhat la Hoa don can thanh toan.
- `COMPLETED` la lich su, khong la card noi bat hoac CTA thanh toan.
- Khong co push notification, upload bien lai, nut Parent xac nhan da chuyen tien, chat/ho tro, PDF hay in Hoa don trong phase nay.
- Deep link la enhancement duoc server config; VietQR va copy fields la fallback bat buoc.
- Moi IA surface duoc dac ta bang spine; Fast path khong tao mockup HTML rieng.
