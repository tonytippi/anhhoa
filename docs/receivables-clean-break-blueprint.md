---
title: "Blueprint clean-break: Danh mục khoản thu và đợt thu"
status: discovery-proposal-expanded-finance
created: 2026-08-31
source: "Khảo sát giao diện Kidsonline /school/3139/finance/receivable"
supersedes-intent: "Mô hình một Mẫu hóa đơn chung trong Admin MVP"
---

# Blueprint Clean-Break: Danh Mục Khoản Thu Và Đợt Thu

## 1. Quyết định đề xuất

Thay thế mô hình **một Mẫu hóa đơn chung** của Ánh Hoa bằng mô hình theo cách tổ chức của Kidsonline:

1. **Danh mục khoản thu** là nguồn cấu hình có thể tái sử dụng: tên, mã, nhóm, giá, đơn vị, giá hoàn trả, đơn vị hoàn trả, khai báo thuế và trạng thái.
2. **Đợt thu** quyết định khoản nào được thu, từ ai, trong kỳ nào và theo quy tắc nào. Đợt thu là điểm khởi tạo hóa đơn hàng loạt, không dùng một template toàn trường cố định.
3. **Áp dụng khoản thu** cho toàn trường, một hay nhiều lớp hoặc từng học sinh; cấu hình áp dụng không sửa dữ liệu lịch sử.
4. Hóa đơn sao chép snapshot của đợt thu, khoản thu, đơn giá, đơn vị, số lượng và công thức tại thời điểm tạo/khóa.
5. Các khoản biến đổi như đón muộn, học lẻ thứ bảy hoặc xe theo lượt lấy số lượng từ dữ liệu vận hành do API xác định; tiền ăn tháng có deduction từ đơn nghỉ có phép hợp lệ. Admin có thể rà soát và điều chỉnh khi hóa đơn còn `DRAFT`.
6. Thanh toán được ghi thành chứng từ. Khi tạo hóa đơn mới, nợ mở của cùng học sinh được snapshot thành dòng công nợ cũ trên hóa đơn mới; tiền nộp trước là khoản trả trước gắn cố định với một học sinh, không tạo số dư credit dùng chung.

Đây là **clean-break** được chấp nhận: dữ liệu hiện tại chỉ là seed, nên không thiết kế migration tương thích hay giữ endpoint/UI cũ. PRD, UX spine và architecture spine có trạng thái `final` không bị sửa trực tiếp; blueprint này là đầu vào cho workflow thay đổi yêu cầu/kiến trúc tiếp theo.

## 2. Bằng chứng khảo sát Kidsonline

Màn `Tài chính > Danh sách khoản thu` đã quan sát trực tiếp ngày 31/08/2026 có:

- Danh sách khoản thu với tạo mới, tìm kiếm, phân trang và bộ lọc theo tên, mã, nhóm khoản thu, mức thuế suất.
- Nút `Nhóm khoản thu` riêng khỏi danh sách khoản thu.
- Các cột: tên, mã, giá/đơn vị, giá hoàn trả/đơn vị hoàn trả, nhóm khoản thu, mức thuế suất và tùy chọn.
- Mỗi khoản có ba action icon. Accessibility tree không cung cấp nhãn; hành vi quan sát chắc chắn là có sửa và ngừng/xóa, còn action biểu tượng người nhiều khả năng là gán/áp dụng khoản cho đối tượng nhưng phải xác minh trong walkthrough.
- Nhóm quan sát: `Khoản thu chung` và `Khoản thu đột xuất`.
- Đơn vị thực tế: tháng, ngày, lần, năm, combo và block `30p`.
- Giá hoàn trả độc lập với giá thu. Ví dụ: học phí theo ngày `250.000 VND/ngày` có hoàn trả cùng mức; phí bán trú `10.000 VND/ngày` có hoàn trả `0 VND/ngày`; học phí tháng có hoàn trả `0 VND/tháng`.
- Thuế hiển thị dạng `Thuế suất 0%` hoặc `Không kê khai nộp thuế`.
- Danh mục thực tế có các khoản cố định, theo ngày, theo lượt, theo năm và đột xuất: học phí, bán trú, tiền ăn, phụ phí độ tuổi, phí trông muộn, xe đưa đón, học thứ bảy, ghi danh, sự kiện, cơ sở vật chất, học phẩm.
- Phí trông muộn cụ thể: `20.000 VND / 30p`, giá hoàn trả `20.000 VND / 30p`.
- Khảo sát read-only tại school `2716` bổ sung các khoản theo tháng, ngày, lần, năm, buổi và block; ví dụ cơ sở vật chất theo năm, dã ngoại theo buổi, giữ chỗ, đồng phục, học phẩm, tiền ăn, lớp năng khiếu và phí đón muộn. Một số khoản có mã, nhiều khoản không có mã; tên `Phí Lễ hội hoa quả` xuất hiện lặp lại. Vì vậy PassionEdu không bắt buộc mã hoặc unique tên; code chỉ unique khi School nhập.
- Nút tạo khoản thu có mặt nhưng Browser MCP timeout khi mở form (`WebSocket response timeout after 30000ms`). Không thực hiện mutation và không suy diễn thêm field create form từ lần thao tác không hoàn tất.

Khảo sát bổ sung ở `Tài chính` và `Tài chính > Đợt thu & thống kê` cho thấy:

- Dashboard tài chính lấy một đợt thu hiện tại làm ngữ cảnh và hiển thị `Đã thu`, `Dự kiến thu thực tế`, `Còn thiếu`, `Còn thừa`, thời điểm thống kê và số học sinh liên quan.
- Danh sách đợt thu có: tên, khoảng thời gian, hạn cuối thu phí, số tiền đã thu/dự kiến, số học sinh đã thanh toán/tổng số và action theo đợt.
- Đợt quá khứ hiển thị `Đang khóa`; đợt chưa khóa có các action nhiều hơn. Ý nghĩa chính xác của từng action icon chưa xác minh, nhưng trạng thái khóa theo đợt là bằng chứng trực tiếp.

Khảo sát đầy đủ wizard `Tạo thông tin thu phí cho toàn trường` của một đợt đang mở cho thấy:

- Luồng gồm ba bước có thể quay lại: `Kiểm tra đợt thu`, `Kiểm tra phạm vi áp dụng`, `Xem trước thông tin thu phí dự tính`, rồi mới có CTA cuối `Đồng ý & Tạo thông tin thu phí`.
- Bước cấu hình đợt có: tên, năm học, ngày bắt đầu/kết thúc, hạn thu phí, cờ hiển thị kỳ thu phí trên app phụ huynh và cờ phân loại thuế trong thu phí.
- Đợt có hai danh sách riêng: `Các khoản phải thu` và `Các dịch vụ phải thu`. Với khoản phải thu, từng dòng có vị trí, khoản mẫu, số lượng, giá/đơn vị, thành tiền, ghi chú, xóa và nút đổi thứ tự.
- Admin có thể thêm khoản mẫu vào đợt. Danh mục tại runtime của đợt khác giá mặc định: ví dụ màn danh mục hiển thị `Tiền ăn` 50.000 VND/ngày, còn đợt thu đang xem dùng 60.000 VND/ngày. Giá đợt thu vì vậy phải là snapshot/override riêng, không đọc trực tiếp giá danh mục lúc generate.
- Bước kiểm tra phạm vi liệt kê từng khoản/dịch vụ trong đợt. Nó cũng hiển thị một khoản `Phí đón muộn Học phí tháng 7/2026`, là bằng chứng rằng một khoản hoặc credit từ kỳ trước có thể đi vào kỳ hiện tại.
- Preview là ma trận học sinh x khoản: mỗi hàng có học sinh/lớp, tổng phí và mỗi cột là một khoản. Các ô có thể dương, âm hoặc bằng 0. Preview hiển thị riêng một khoản `Phí đón muộn` có giá trị dương và `Tiền ăn` có giá trị âm trên cùng một học sinh.
- Trang thống kê đợt có bảng từng học sinh với `Ví`, `Thu`, `Đã đóng`, `Còn thiếu`, `Còn thừa`; có filter/tìm theo học sinh, lớp và trạng thái thông báo. Bảng cũng hiển thị nội dung thông báo, trạng thái đã gửi, thời điểm gửi và số lượt xem.
- Đợt có action `Gửi thông báo`, tạo QR Napas hàng loạt và in. Các action này là bằng chứng tính năng của Kidsonline, không tự động được đưa vào release Ánh Hoa vì Parent PWA hiện dùng quyền xem hóa đơn/VietQR riêng.
- Một khu tài chính cũ vẫn có entry point riêng cho `Phí đón muộn`, `Quản lý khoản giảm trừ`, `Thống kê đóng trước` và `Thông tin Ngân hàng`. Các entry point xác nhận capability tồn tại trong sản phẩm, nhưng không dùng làm bằng chứng chi tiết vì accessibility snapshot tại thời điểm khảo sát không trả dữ liệu bản ghi của chúng.

### Điều không được suy diễn từ khảo sát

- Không có bằng chứng trực tiếp về form tạo/sửa, quy tắc kiểm tra trùng mã, cách tính thuế hoặc trạng thái lifecycle của khoản thu.
- Không có bằng chứng trực tiếp action biểu tượng người gán vào học sinh, dù ý nghĩa này phù hợp với vị trí/action trong bảng.
- Không sao chép nguyên trạng quy tắc của Kidsonline. Ánh Hoa giữ các invariant cần thiết: server làm chủ tiền và snapshot, chứng từ/ledger bất biến sau post ngoại trừ void/reversal có audit, authorization server-side và idempotency.

## 3. Vì sao phải bỏ mô hình Mẫu hóa đơn chung

Mô hình hiện tại chỉ có một `InvoiceTemplate` singleton và các dòng `FIXED` hoặc `CLASS_TUITION`. Nó phù hợp khi toàn trường có cùng một hóa đơn tháng, nhưng không biểu diễn được đúng các nhu cầu đã quan sát:

| Nhu cầu | Mẫu hóa đơn chung hiện tại | Mô hình đề xuất |
| --- | --- | --- |
| Danh mục dùng lại, có mã/nhóm/đơn vị | Không có | `Receivable` và `ReceivableGroup` |
| Khoản tháng, ngày, lần, năm, block 30 phút | Chỉ là một số tiền cố định | `unit` + giá/đơn vị + loại tính số lượng |
| Khoản chung và khoản đột xuất | Không có khái niệm | `ReceivableGroup.kind` |
| Gán khoản cho phạm vi cụ thể | Toàn trường duy nhất | `ChargeRule` theo trường/lớp/học sinh |
| Tiền ăn/đón muộn từ vận hành | Admin nhập tay từng hóa đơn | nguồn số lượng server-side có trace nguồn |
| Hoàn trả theo đơn vị | Chỉ cho số âm thủ công | giá hoàn trả và credit có căn nguyên |
| Thuế/kê khai | Không có | snapshot tax treatment, không tự tính thuế khi chưa chốt pháp lý |
| Khoản thu theo năm/sự kiện | Bị ép vào hóa đơn tháng | `CollectionRun` với chu kỳ/khóa kỳ độc lập |
| Báo cáo theo loại khoản thu | Chỉ tổng hóa đơn | aggregate từ snapshot dòng hóa đơn theo khoản/nhóm |

## 4. Phạm vi release thay thế

### Trong phạm vi

- Danh mục nhóm khoản thu và khoản thu có trạng thái active/inactive.
- Đợt thu `MONTHLY`, `ANNUAL` và `ONE_OFF` ngay release đầu; mỗi đợt có phạm vi và cấu hình dòng.
- Quy tắc áp dụng khoản theo toàn trường, lớp hoặc học sinh.
- Tạo trước, xem trước và tạo hóa đơn từ một đợt thu.
- Đơn giá theo danh mục, học phí lớp hoặc override có audit; số lượng cố định hoặc nhập thủ công.
- Generate hàng loạt chỉ tạo invoice `DRAFT`; Finance Manager rà soát/điều chỉnh từng invoice, chọn tài khoản nhận tiền riêng và `ISSUE` trước khi Parent thấy hướng dẫn thanh toán.
- Kích hoạt release đầu các nguồn số lượng đã chốt: tiền ăn tháng trừ đơn nghỉ có phép hợp lệ, thứ bảy theo đăng ký dịch vụ hoặc attendance; các nguồn khác chỉ kích hoạt khi mô-đun vận hành nguồn được chốt.
- Khi nguồn vận hành chưa tồn tại hoặc chưa đủ dữ liệu, Finance Manager/SCHOOL_ADMIN nhập quantity thủ công trong invoice `DRAFT`. Khi nguồn đã tồn tại, cùng các role này vẫn có thể override quantity/giá hoặc thêm adjustment trong `DRAFT`, nhưng phải ghi chú/audit; bản ghi nguồn vẫn được giữ/snapshot, không bị sửa hoặc che mất.
- Hoàn trả theo khoản có căn nguyên, tạo số âm trên hóa đơn `DRAFT`; tiền nộp trước được theo dõi riêng theo học sinh.
- Tổng hợp báo cáo theo đợt thu, phương thức thanh toán, khoản thu và nhóm khoản thu.
- Giữ VietQR, Parent authorization, audit và các control chống thao tác trùng; thay payment lifecycle bằng ledger settlement đầy đủ.

### Ngoài phạm vi

- Tính hoặc kê khai thuế, xuất hóa đơn VAT/chứng từ thuế. Tax treatment chỉ là nhãn/snapshot.
- Xe đưa đón không thuộc release đầu. Phí đón muộn chỉ là khoản `MANUAL`/`FIXED`; handover cung cấp reference cho Finance, không có engine tự tính. Tiền ăn và dịch vụ thứ bảy theo phần 6.4 và 6.5.
- Đồng bộ giao dịch ngân hàng trực tiếp; Admin ghi nhận chứng từ thanh toán sau khi đối soát.
- Lập hóa đơn tự động không có bước Admin xem trước và duyệt.
- Mô hình ưu đãi phức tạp, bảng giá theo bậc, thuế nhiều mức hoặc công thức do người dùng lập trình. Giảm trừ phần trăm/tiền có thời hạn vẫn trong phạm vi.

## 5. Mô hình miền đề xuất

### 5.1 Nhóm khoản thu: `ReceivableGroup`

Nhóm phục vụ điều hướng, báo cáo và phân biệt khoản chung/đột xuất/dịch vụ. Không trực tiếp tạo tiền.

| Trường | Quy tắc |
| --- | --- |
| `id` | UUID |
| `name` | Bắt buộc; không bắt unique vì cùng tên có thể dùng cho khoản/giá khác nhau. UI hiển thị thêm nhóm, đơn vị, giá và mã nếu có để phân biệt |
| `kind` | `COMMON`, `AD_HOC` hoặc `SERVICE` |
| `position` | Số nguyên không âm, thứ tự hiển thị |
| `status` | `ACTIVE` hoặc `INACTIVE`; không xóa cứng |

Seed tối thiểu: `Khoản thu chung` (`COMMON`), `Khoản thu đột xuất` (`AD_HOC`) và `Khoản thu dịch vụ` (`SERVICE`). Đây là ba loại quan sát trực tiếp trong màn Kidsonline cũ. Nhóm inactive vẫn hiển thị ở snapshot/lịch sử nhưng không nhận khoản mới.

### 5.2 Danh mục khoản thu: `Receivable`

Khoản thu định nghĩa thứ mà trường có thể thu, không phải một hóa đơn hoặc lần thu cụ thể.

| Trường | Quy tắc |
| --- | --- |
| `id` | UUID |
| `code` | Tùy chọn, unique không phân biệt hoa thường khi có; Finance Manager tự nhập nếu cần mã vận hành, không bắt buộc vì trường có thể định nghĩa khoản thu không theo mã |
| `name` | Bắt buộc; ví dụ `Phí trông muộn` |
| `groupId` | Bắt buộc, nhóm active khi tạo/sửa |
| `unit` | Nhãn ngắn do Finance Manager định nghĩa/chọn trong School, ví dụ `tháng`, `ngày`, `lần`, `năm`, `năm theo ngày nhập học`, `combo`, `buổi`, `block`, `30 phút`; snapshot vào invoice để đổi nhãn sau không làm sai lịch sử |
| `defaultUnitPrice` | `BIGINT`, VND nguyên, không âm |
| `refundUnitPrice` | `BIGINT`, VND nguyên, không âm; mặc định 0 |
| `taxTreatment` | `NOT_DECLARED` hoặc `ZERO_PERCENT` trong release đầu |
| `status` | `ACTIVE` hoặc `INACTIVE`; không xóa cứng |
| `createdBy`, `updatedBy`, timestamps | Audit cấu hình |

`Receivable` chỉ giữ giá mặc định. Giá thực tế phải được snapshot vào dòng hóa đơn; sửa giá không thay hóa đơn hay đợt thu đã tạo. School tự tạo, sửa và ngừng dùng các khoản thu mong muốn, không bị giới hạn vào một catalog PassionEdu seed cố định.

### 5.3 Quy tắc áp dụng: `ChargeRule`

`ChargeRule` thay thế các dòng của template. Nó nêu khoản nào có mặt khi lập một đợt thu và đối tượng nào đủ điều kiện.

| Trường | Quy tắc |
| --- | --- |
| `id`, `collectionRunId`, `receivableId` | Một khoản có thể được dùng nhiều lần ở các đợt khác nhau |
| `scopeType` | `SCHOOL`, `CLASS`, `STUDENT` |
| `classId` / `studentId` | Bắt buộc tương ứng với scope; record phải active tại thời điểm cấu hình |
| `pricingSource` | `RECEIVABLE_DEFAULT`, `CLASS_MONTHLY_TUITION`, `OVERRIDE` |
| `overrideUnitPrice` | Bắt buộc khi `OVERRIDE`; VND nguyên không âm |
| `calculationMode` | `FIXED` hoặc `MANUAL` duy nhất; contract server-side, không có mode attendance/meal/late-pickup |
| `fixedQuantity` | Bắt buộc khi `calculationMode = FIXED`; số nguyên dương, mặc định 1 |
| `position` | Thứ tự dòng trong đợt thu/hóa đơn |
| `applyMode` | `INCLUDE` hoặc `EXCLUDE`; `EXCLUDE` dùng để loại một học sinh khỏi rule rộng hơn |
| `note` | Ghi chú tùy chọn ở mức khoản của đợt; snapshot vào dòng hóa đơn khi có |

Quy tắc rõ ràng này tốt hơn nút gán mơ hồ: Admin có thể xem vì sao một học sinh nhận một khoản, và API có thể xác định precedence mà không dựa vào UI. API chỉ có hai cách tính số lượng: `FIXED` từ rule hoặc `MANUAL` do Finance Manager/SCHOOL_ADMIN nhập trong invoice `DRAFT`. Không dùng text do School nhập, attendance, handover, service enrollment hoặc expression client để tự đổi quantity/tổng tiền.

`Cơ sở vật chất` không có behavior hệ thống riêng và không được PassionEdu define sẵn. Mỗi School có thể tự tạo khoản này như mọi `Receivable` khác, dùng unit `năm theo ngày nhập học` nếu phù hợp vận hành. CollectionRun/rule quyết định học sinh nào được đưa vào khoản; Finance Manager điều chỉnh `unitPrice` hoặc thêm adjustment trên invoice `DRAFT` cho trường hợp nhập học giữa năm. Mọi override/adjustment phải có ghi chú bắt buộc, giá/số lượng cũ-mới (nếu có), actor và timestamp trong audit.

### 5.4 Đợt thu: `CollectionRun`

Đợt thu là đơn vị vận hành để tạo một tập hóa đơn. Nó thay cho giả định "mỗi tháng tạo một bản sao template".

| Trường | Quy tắc |
| --- | --- |
| `id` | UUID |
| `schoolId`, `schoolYearId` | Bắt buộc; run thuộc đúng một School và một SchoolYear, mọi query/foreign key scope theo School |
| `name` | Ví dụ `Học phí 09/2026`, `Sự kiện năm học 2026-2027` |
| `periodType` | `MONTHLY`, `ANNUAL`, `ONE_OFF` |
| `billingMonth` | Bắt buộc khi `periodType = MONTHLY`, dạng `YYYY-MM`; dùng filter/báo cáo tháng, không unique vì có thể có run bổ sung cùng tháng |
| `periodKey` | Bắt buộc khi `ANNUAL`/`ONE_OFF`, text do kế toán nhập, ví dụ `2026-2027`, `Lễ hội mùa thu`; không dùng cho `MONTHLY`, không unique platform-wide |
| `opensOn`, `closesOn` | Ngày tùy chọn để xác định dữ liệu phát sinh thuộc kỳ nào; không dùng để thay đổi snapshot đã tạo |
| `dueOn` | Hạn cuối thu phí; bắt buộc, không trước `opensOn` hoặc sau `closesOn` khi run có khoảng thời gian |
| `status` | `DRAFT`, `READY`, `GENERATED`, `CLOSED` |
| `createdBy`, timestamps | Audit |

Một học sinh có tối đa một hóa đơn cho một `CollectionRun`: unique `(schoolId, studentId, collectionRunId)`. Nhiều run hợp lệ có thể dùng cùng `billingMonth`/năm học, ví dụ đợt chuẩn và đợt bổ sung. Báo cáo tháng aggregate các run `MONTHLY` theo `billingMonth` và cho filter theo run để đối soát; không ép khoản theo năm/sự kiện vào unique `(studentId, billingMonth)`.

`CollectionRun` tham chiếu `schoolYearId` và snapshot `schoolYearLabel` để hiển thị lịch sử. Run không giữ tài khoản nhận tiền bắt buộc: tài khoản là quyết định của từng invoice tại lúc issue.

### 5.5 Hóa đơn và dòng hóa đơn

Invoice dùng `collectionRunId` bắt buộc thay `billingMonth` đơn lẻ. Read model snapshot `periodType`, `billingMonth` hoặc `periodKey`, và `collectionRunName`. Lifecycle settlement mới được định nghĩa tại phần 7.3.

Mỗi `InvoiceItem` cần thay thế bằng snapshot đầy đủ:

| Trường snapshot | Ý nghĩa |
| --- | --- |
| `receivableId` nullable | Liên kết kỹ thuật nếu còn, không dùng để hiển thị lịch sử |
| `receivableCode` nullable, `receivableName` | Mã (nếu khoản có mã) và tên tại thời điểm tạo |
| `groupName`, `unit`, `taxTreatment` | Hiển thị/báo cáo không đọc danh mục mutable |
| `unitPrice`, `quantity` | Dữ liệu gốc tính dòng |
| `amount` | `unitPrice * quantity`, hoặc số âm của refund/adjustment; API tính |
| `pricingSource`, `calculationMode` | Giải thích nguồn giá và cách tạo quantity |
| `sourceReference` nullable | Reference Finance đã chọn, ví dụ ID handover/attendance/service enrollment; không lộ dữ liệu không cần thiết cho Parent |
| `position` | Thứ tự bất biến trong hóa đơn đã khóa |

Admin có thể thêm một `ADJUSTMENT` thủ công khi `DRAFT`, có mô tả bắt buộc, nhóm tùy chọn, số tiền âm/dương và audit. Không cho sửa trực tiếp `amount` của dòng tự động mà không chọn một trong hai hành động rõ ràng: override `unitPrice`/`quantity` với ghi chú bắt buộc, hoặc thêm adjustment. Điều này giữ được khả năng đối soát.

## 6. Quy tắc tính toán và precedence

### 6.1 Xác định rule áp dụng

Khi preview/generate cho một học sinh, API lấy các rule active trong đợt thu và áp theo thứ tự:

1. Rule `STUDENT` `EXCLUDE` loại đúng khoản trong phạm vi học sinh.
2. Rule `STUDENT` `INCLUDE` được dùng thay rule cùng khoản ở phạm vi rộng hơn.
3. Rule `CLASS` `INCLUDE` được dùng nếu học sinh thuộc lớp đó tại thời điểm preview/generate.
4. Rule `SCHOOL` `INCLUDE` dùng làm mặc định.
5. Nếu nhiều rule cùng mức đặc hiệu cho cùng khoản, API từ chối cấu hình `CHARGE_RULE_AMBIGUOUS`; không âm thầm chọn một rule.

`STUDENT` > `CLASS` > `SCHOOL`. Rule hẹp không thay đổi lịch sử rule/hoá đơn đã tạo.

### 6.2 Giảm trừ cấu hình

Kidsonline có danh mục giảm trừ riêng: tên, mức giảm theo `%` hoặc `Tiền`, loại `Giảm trừ chung` hoặc `Giảm trừ theo từng học sinh`, từ ngày/đến ngày, mô tả và các khoản thu áp dụng. Ánh Hoa cần mô hình tương đương:

| Thành phần | Quy tắc |
| --- | --- |
| `DiscountPolicy` | Tên, `PERCENT` hoặc `FIXED_AMOUNT`, giá trị, ngày hiệu lực, mô tả, trạng thái và audit |
| `scopeType` | `SCHOOL`, `CLASS` hoặc `STUDENT`; học sinh có thể nhận policy riêng |
| `DiscountPolicyReceivable` | Chỉ rõ các khoản thu mà giảm trừ được áp dụng; không mặc định giảm trên toàn hóa đơn |
| Snapshot invoice | Tên policy, loại, giá trị, khoản gốc, số tiền giảm và lý do áp dụng |

Giảm phần trăm được tính trên tổng các dòng khoản thu đủ điều kiện sau quantity/unit price, trước payment allocation. Một policy tiền cố định được phân bổ theo thứ tự dòng cấu hình nhưng không bao giờ tạo tổng dòng gốc âm; phần vượt quá được từ chối thay vì thành credit vô danh.

### 6.3 Giá và số lượng

```text
unitPrice =
  overrideUnitPrice                         khi pricingSource = OVERRIDE
  class.monthlyTuition                      khi pricingSource = CLASS_MONTHLY_TUITION
  receivable.defaultUnitPrice               khi pricingSource = RECEIVABLE_DEFAULT

quantity =
  fixedQuantity                             khi calculationMode = FIXED
  giá trị Finance Manager/SCHOOL_ADMIN nhập khi calculationMode = MANUAL

lineAmount = unitPrice x quantity
invoiceTotal = tổng lineAmount + tổng adjustment
```

- Tất cả giá trị tiền là VND nguyên `BIGINT`; quantity là số nguyên dương.
- API giới hạn `unitPrice`, `quantity`, `lineAmount` và `invoiceTotal` trong JSON-safe range; không dùng `number` float hoặc phép tính ở client làm nguồn chân lý.
- `CLASS_MONTHLY_TUITION` chỉ hợp lệ khi unit là `tháng` và scope áp dụng được resolved đến một lớp active.
- Không cho `quantity = 0` trên dòng được tạo; rule không áp dụng thì không tạo dòng. Adjustment bằng 0 cũng không có ý nghĩa và bị từ chối.
- Giảm trừ tiền ăn tháng là adjustment âm riêng từ đơn nghỉ có phép hợp lệ; nó không thay thế quantity dương của khoản tiền ăn tháng gốc hoặc thêm calculation mode mới.

### 6.4 Tiền ăn, đơn nghỉ và hoàn trả theo khoản

Giảm trừ tiền ăn tháng từ đơn nghỉ là workflow finance release đầu, không phải `ChargeRule.calculationMode` hay một `Receivable` riêng:

1. API bắt đầu từ số tiền/số lượng tiền ăn tháng đã được rule snapshot, không tính lại theo attendance thực tế từng ngày.
2. Parent tạo đơn nghỉ cho học sinh có link active, chọn effective date không trước ngày gửi. School cấu hình deadline; đơn trước deadline tự duyệt (`AUTO_APPROVED`), sau deadline chuyển `PENDING_REVIEW` để Finance Manager/SCHOOL_ADMIN duyệt. API tự loại ngày SchoolCalendar nghỉ/lễ; một đơn nhiều ngày hợp lệ chỉ áp dụng các ngày học còn lại.
3. Chỉ đơn tự duyệt hoặc được Finance Manager/SCHOOL_ADMIN duyệt mới đủ điều kiện giảm trừ. Đơn bị từ chối và ngày nghỉ không phép không tạo giảm trừ.
4. Khi Finance tạo invoice `DRAFT` cho tháng kế tiếp, API đề xuất adjustment âm từ các ngày đủ điều kiện của đơn nghỉ. Finance Manager/SCHOOL_ADMIN rà soát và xác nhận adjustment; approval/rejection, deadline policy snapshot, effective date, actor duyệt, các ngày được áp dụng và số tiền trừ phải snapshot vào invoice. `PRESENT` đã xác nhận trong ngày trùng loại ngày đó khỏi đề xuất và đánh dấu conflict. Policy/đơn đổi sau `ISSUED` không sửa hóa đơn lịch sử; dùng adjustment/refund mới có liên kết nếu cần.

Hoàn trả theo khoản có căn nguyên từ sự kiện được duyệt: nghỉ có phép, nghỉ dài hạn hoặc hủy dịch vụ. Giá hoàn trả là policy tham chiếu, không phải tự động hoàn tiền.

- Khi Admin ghi nhận một sự kiện đủ điều kiện hoàn trả trong `DRAFT`, API tạo một dòng `REFUND_ADJUSTMENT` có `amount = -(refundUnitPrice x quantity)`.
- Dòng hoàn trả snapshot `receivableCode`, `receivableName`, `unit`, `refundUnitPrice`, `quantity`, lý do, người tạo và tham chiếu nguồn bắt buộc đến approved leave request, approved long-leave request hoặc approved service cancellation khi có.
- Hoàn trả chỉ được tính/snapshot trong `DRAFT`; sau khi invoice `ISSUED`, không sửa dòng gốc. Sai sót được giải quyết bằng receipt void/reversal hoặc adjustment mới có liên kết/audit, không ghi đè lịch sử.
- Nếu `refundUnitPrice` là 0, UI không hiển thị thao tác tạo hoàn trả tự động cho khoản đó.

Finance Manager/SCHOOL_ADMIN vẫn có thể tạo `ADJUSTMENT` thủ công trong `DRAFT`, nhưng phải nêu ghi chú/lý do; manual adjustment không thay thế hoặc làm mất trace nguồn của các deduction/refund tự động.

### 6.5 Attendance có bằng chứng và dịch vụ thứ bảy

Giáo viên ghi attendance cho lớp được phân công. `AttendancePolicy.photoEvidenceMode` là cấu hình từng School: `REQUIRED` buộc giáo viên chụp/upload ảnh trước khi xác nhận `PRESENT`; `OPTIONAL` cho phép xác nhận không ảnh. API snapshot mode đã áp dụng, teacher actor, timestamp, lớp/học sinh và audit; khi có ảnh, lưu evidence gắn attendance event. Sau khi `PRESENT` được xác nhận, Parent nhận notification in-app; notification là record delivery/audit, không dùng client signal để xác nhận attendance. Parent không xem evidence ảnh trong release đầu.

Ảnh evidence attendance được giữ đúng hai tháng lịch từ timestamp confirmation, sau đó xóa blob/bản xem và không còn trả qua API. Audit metadata không nhạy cảm giữ lại: record attendance, `photoEvidenceMode` snapshot, có/không có ảnh, actor, timestamps và deletion timestamp. Chỉ Staff có capability attendance trong school scope và School Admin xem evidence trong release đầu; Parent không xem/tải/browse ảnh để tránh lộ trẻ khác trong ảnh lớp.

Không tạo/xác nhận attendance vào ngày `SchoolCalendar` đánh dấu nghỉ lễ/nghỉ học. Ngày học bù phải được School Admin cấu hình rõ trong calendar mới nhận attendance và có thể tạo source finance.

Một leave request đã duyệt không khóa attendance. Nếu trẻ vẫn đến, giáo viên xác nhận `PRESENT` theo AttendancePolicy; `PRESENT` là nguồn sự thật cho ngày đó, override deduction tiền ăn/gói thứ bảy của ngày trùng, đánh dấu `LEAVE_ATTENDANCE_CONFLICT` trên request, lưu lý do/actor/timestamp và gửi Parent notification. Không tự sửa/xóa đơn nghỉ đã duyệt. Nếu invoice đã `ISSUED`, Finance xử lý delta bằng adjustment/refund có source/audit.

School có thể định nghĩa dịch vụ `Học thứ bảy cả tháng` hoặc dịch vụ có chu kỳ tương tự. `StudentServiceEnrollment` gắn học sinh với dịch vụ, ngày hiệu lực và trạng thái; invoice snapshot trạng thái đăng ký dịch vụ đã áp dụng.

- Học sinh có đăng ký active trong kỳ nhận khoản dịch vụ cố định theo rule của dịch vụ.
- Học sinh có đăng ký active trong kỳ nhận khoản dịch vụ cố định theo rule của dịch vụ. Học lẻ thứ bảy, nếu trường có thu, là một Receivable dịch vụ `MANUAL`: kế toán tham chiếu attendance `PRESENT` và nhập số buổi vào invoice `DRAFT`; attendance không tự tạo dòng/số lượng.
- Không charge học lẻ cho một ngày đã được service enrollment active bao phủ. Attendance bị sửa sau `ISSUED` không đổi hóa đơn lịch sử; Finance xử lý bằng adjustment/refund có nguồn và audit.
- School tự tạo các dịch vụ/khoản khác theo cùng cấu trúc. Release đầu không có projection xe đưa đón; một khoản xe chỉ dùng quantity `FIXED`/`MANUAL`.
- Parent hoặc School Admin có thể tạo yêu cầu nghỉ dài hạn; chỉ `SCHOOL_ADMIN` duyệt/từ chối và xác nhận/chọn effective date không trước ngày yêu cầu. Sau approval, API dừng eligibility cho CollectionRun tương lai; invoice đã issue chỉ xử lý bằng refund/adjustment có source. Hủy dịch vụ và tạo/hủy `StudentServiceEnrollment` là thao tác `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` theo thông báo/yêu cầu Parent, với effective dates, actor và audit; Parent không có mutation service enrollment/cancellation trong release đầu.

### 6.6 Công nợ cũ và điều chỉnh cuối năm

Khi tạo preview một đợt thu, API lấy từng invoice cũ còn outstanding của cùng học sinh và tạo dòng `PRIOR_DEBT` riêng, có origin invoice bắt buộc. Khi generate, transaction snapshot dòng này vào invoice mới và tạo `DebtTransfer` cho đúng số dư nguồn; balance nguồn từ đó bị giảm bằng transfer, còn invoice mới là nghĩa vụ thu hiện hành. Không sửa tổng/dòng snapshot invoice cũ hoặc đóng giả tạo. `DebtTransfer` phải trace được invoice nguồn/đích, amount, actor, thời điểm và không được vượt outstanding nguồn; điều này ngăn cùng một khoản nợ bị đếm hoặc thu hai lần. Vì vậy, một receipt của hóa đơn mới có thể thanh toán đồng thời khoản thu kỳ mới và nợ cũ đã gộp.

Theo nguyên tắc quyết toán năm, không tự động carry nợ sang `SchoolYear` mới. Trước khi close-year, `SCHOOL_ADMIN` quyết định cho từng nợ còn mở: thu/xử lý trong năm cũ, tạo adjustment quyết toán, hoặc write-off. Mọi lựa chọn bắt buộc lý do, actor, timestamp, tham chiếu invoice gốc và audit; `FINANCE_MANAGER` không tự write-off.

Preview Kidsonline cho thấy `Tiền ăn` có thể tạo giá trị âm. Ánh Hoa biểu diễn các dòng điều chỉnh minh bạch:

- `REFUND_ADJUSTMENT`: hoàn trả/giảm trừ cho một khoản của chính kỳ này, dùng giá hoàn trả và nguồn dữ liệu như phần 6.4.
- `YEAR_END_ADJUSTMENT`: quyết toán cuối năm theo quyết định `SCHOOL_ADMIN`, luôn có origin invoice hoặc tham chiếu bên ngoài, mô tả/lý do bắt buộc và audit. Nó có thể âm hoặc dương, nhưng không được mạo nhận là số lượng tự động của khoản hiện tại.

Không có carryover tự động qua năm học. `PRIOR_DEBT` chỉ được gộp vào invoice mới khi debt và invoice mới thuộc cùng `SchoolYear`; quyết toán năm dùng workflow có audit nêu trên.

**Ranh giới module:** khoản giảm trừ/carryover là ledger entry trên invoice; attendance/handover là dữ liệu vận hành để Finance tham chiếu khi nhập dòng `MANUAL`. Chúng có thể cùng xuất hiện trên invoice, nhưng không dùng một module "giảm trừ" để ghi nhận sự kiện đón muộn hoặc dùng một danh mục khoản thu để che dấu khoản nợ kỳ trước.

### 6.7 Phí trông muộn

Phí trông muộn là Receivable `MANUAL` hoặc `FIXED`. Giáo viên/lễ tân xác nhận `pickedUpAt` thực tế trong handover; Finance Manager/SCHOOL_ADMIN tham chiếu bản ghi này khi nhập quantity hoặc thêm adjustment trong invoice `DRAFT`. School có một LatePickupPolicy chung cho cutoff, grace, block và exemption; policy hỗ trợ giáo viên xác định/trình bày lượt muộn nhưng API không tự tạo quantity hoặc fee từ handover. Invoice snapshot timestamp bàn giao, policy đã áp dụng và lý do/actor khi Finance dùng dữ liệu này.

### 6.8 Sổ thanh toán, nộp trước và công nợ

Đây là phần bắt buộc để bắt chước đúng năng lực Kidsonline. Màn `Thống kê đóng trước - hủy đóng phí` quan sát được lưu từng bản ghi theo học sinh, khoản thu, số lượng, phí, đợt thu, loại và thời gian tạo. Trang thống kê đợt lại có `Ví`, `Thu`, `Đã đóng`, `Còn thiếu`, `Còn thừa`. Không thể tạo những số liệu này chính xác chỉ bằng status hóa đơn.

Mô hình thay thế cần một ledger append-only:

| Model | Mục đích | Quy tắc |
| --- | --- | --- |
| `PaymentReceipt` | Chứng từ một lần trường nhận tiền | Học sinh, số tiền, phương thức, tài khoản nhận snapshot, mã tham chiếu, thời điểm nhận, Admin ghi nhận; `POSTED` hoặc `VOIDED` |
| `PaymentAllocation` | Phân bổ một phần chứng từ vào một invoice | Một receipt có nhiều allocation; tổng allocation không vượt receipt; một invoice có nhiều allocation |
| `StudentPrepayment` | Khoản nộp trước cố định cho một học sinh | Có nguồn receipt, số tiền, mục tiêu `CollectionRun`/khoản tùy chọn, trạng thái `OPEN`/`APPLIED`/`REFUNDED`/`VOIDED`; không chuyển cho học sinh khác |
| `PrepaymentApplication` | Áp dụng khoản nộp trước vào hóa đơn tương lai | Transactional, số áp dụng không vượt khoản nộp trước hoặc invoice còn phải thu |
| `DebtSnapshot` | Read model, không phải sổ ghi | `invoice.total - paymentAllocation - prepaymentApplication`; dùng cho "còn thiếu" |

Quy tắc nghiệp vụ:

1. Admin có thể ghi nhận một receipt thấp hơn, bằng hoặc cao hơn số phải thu. Không tự coi receipt là hoàn tất invoice.
2. Receipt của một hóa đơn được phân bổ vào chính hóa đơn đó; hóa đơn mới đã gồm các dòng `PRIOR_DEBT` cần thu. UI luôn preview kết quả trước khi post. Phân bổ thủ công nhiều invoice chỉ thêm khi có nhu cầu nghiệp vụ đã xác nhận.
3. Nộp trước được tạo qua wizard riêng, gắn cố định với một học sinh và có thể nhắm `CollectionRun`/khoản cụ thể. Nó không tạo tính năng credit balance, không được chuyển sang học sinh khác và chỉ áp dụng vào hóa đơn tương lai của chính học sinh đó.
4. Nếu học sinh nghỉ trước khi khoản nộp trước được áp dụng, `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` có thể hoàn tiền qua reversal/refund có lý do, audit và tham chiếu receipt/prepayment gốc.
5. Khi receipt hoặc nộp trước được áp dụng, API ghi audit và cập nhật balance bằng transaction. Không cho sửa số tiền gốc của receipt đã post; sai sót dùng `VOIDED` hoặc reversal có liên kết tới chứng từ gốc.
6. Invoice thành `PAID` khi `outstanding = 0`; `PARTIALLY_PAID` khi đã có payment/prepayment áp dụng nhưng còn nợ; `ISSUED` khi chưa được áp dụng. Receipt thừa ngoài một thao tác nộp trước hợp lệ bị từ chối, không âm thầm trở thành credit.
7. `COMPLETED` của mô hình cũ được thay bằng payment settlement trên invoice. Nội dung khoản thu/payment snapshot khóa khi invoice `ISSUED`; receipt/allocation là ledger mới phát sinh, không mở khóa invoice.

Luồng nộp trước cần wizard riêng: chọn học sinh, khoản thu/kỳ mục tiêu tùy chọn, số tiền nhận, phương thức/tài khoản, rồi preview record nộp trước. Hoàn tiền hoặc hủy nộp trước phải là void/reversal được audit, không xóa record.

## 7. Lifecycle và thao tác quản trị

### 7.1 Nhóm và khoản thu

- Tạo/sửa chỉ khi không làm thay đổi snapshot; mọi thay đổi lưu Admin/timestamp.
- Không xóa cứng nhóm hoặc khoản thu.
- Inactive không được dùng trong `CollectionRun`/`ChargeRule` mới; vẫn hiển thị trong run và hóa đơn lịch sử.
- Không cho inactive nhóm nếu còn khoản thu active; Admin phải ngừng dùng các khoản trước.
- Không cho inactive khoản khi nó đang được dùng bởi một `CollectionRun` `DRAFT`/`READY`; Admin phải bỏ/đổi rule trước. Khoản có run `GENERATED`/`CLOSED` vẫn có thể inactive vì history đã snapshot.

### 7.2 Đợt thu

- `DRAFT`: tạo/sửa thông tin kỳ và rule; chưa preview/generate cuối.
- `READY`: cấu hình đã hợp lệ, cho preview/generate; thay đổi rule trả về `DRAFT`.
- `GENERATED`: đã có tối thiểu một hóa đơn; không sửa rule. Finance Manager/SCHOOL_ADMIN có thể xử lý từng hóa đơn `DRAFT` và thêm một học sinh chưa có invoice vào run: API dùng snapshot rule của run để tạo đúng một invoice `DRAFT` cho học sinh đó. Không tạo invoice thứ hai cho học sinh đã có invoice trong run; trường hợp đó dùng adjustment khi vẫn `DRAFT`, hoặc run bổ sung nếu đã `ISSUED`.
- `CLOSED`: tương ứng trạng thái đợt thu bị khóa đã quan sát ở Kidsonline. Không tạo thêm hóa đơn, không sửa rule hay hóa đơn thuộc run; việc đóng phải hiển thị số hóa đơn `DRAFT`/`ISSUED`/`PARTIALLY_PAID` còn xử lý và yêu cầu xác nhận.

Không cho thay đổi một run đã `GENERATED` rồi "áp lại" cho hóa đơn cũ. Điều này tránh thay đổi âm thầm số tiền/đối tượng đã được rà soát.

### 7.3 Lifecycle invoice và settlement

Thay lifecycle cũ bằng:

- `DRAFT`: được tạo qua batch generate hoặc riêng lẻ; Finance Manager/SCHOOL_ADMIN có thể rà soát dòng, override giá/số lượng, thêm adjustment/hoàn trả và chọn tài khoản nhận tiền. Parent không thấy invoice này và chưa là nghĩa vụ phải thu.
- `ISSUED`: Finance Manager/SCHOOL_ADMIN issue sau khi tài khoản nhận tiền active đã được chọn. API khóa toàn bộ dòng, snapshot, tổng, hạn thu và hướng dẫn thanh toán; Parent có thể xem và invoice có thể nhận payment/allocation.
- `PARTIALLY_PAID`: trạng thái dẫn xuất khi invoice `ISSUED` có paid amount lớn hơn 0 nhưng outstanding lớn hơn 0.
- `PAID`: trạng thái dẫn xuất khi outstanding bằng 0. Không có action sửa khoản thu; các transaction payment vẫn xem được.
- `VOIDED`: chỉ dành cho invoice chưa có allocation/prepayment application, có lý do/audit; không xóa cứng. Invoice đã có giao dịch dùng reversal hoặc adjustment mới có liên kết tùy case, không void âm thầm.

`PaymentReceipt`, `PaymentAllocation`, `StudentPrepayment` và `PrepaymentApplication` là append-only sau khi `POSTED`. Void/reversal yêu cầu xác nhận, UUID idempotency, audit người/thời điểm/lý do và tuân theo `FinancePolicy.reversalApprovalMode`: `DIRECT` cho phép `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` post trực tiếp; `SCHOOL_ADMIN_APPROVAL` yêu cầu `FINANCE_MANAGER` tạo yêu cầu, sau đó `SCHOOL_ADMIN` duyệt trước khi post. Người tạo và người duyệt phải khác nhau trong mode hai bước. Không tự gộp receipt mới vào một invoice chỉ vì trùng học sinh/tháng.

`BankAccount` có thể có nhiều record active trong một School. Generate batch không chọn hay snapshot tài khoản nhận tiền; nó chỉ tạo invoice `DRAFT`. Khi Finance Manager đã rà soát/điều chỉnh một invoice `DRAFT` và chọn action `ISSUE`, API bắt buộc chọn một `BankAccount` active riêng cho invoice đó rồi snapshot nó vào payment instruction. Snapshot gồm tên ngân hàng, chủ tài khoản, số tài khoản và transfer content. Transfer content mặc định gồm `studentCode + className` snapshot để phù hợp vận hành hiện tại; invoice code vẫn được hiển thị như reference phụ trợ, không thay mã học sinh. Parent chỉ thấy hướng dẫn thanh toán sau `ISSUED`.

### 7.4 Tạo preview có thể rà soát

Trước lệnh generate không đảo được, UI phải hiển thị ma trận preview theo học sinh x khoản giống cấu trúc đã quan sát, với các cột:

- Học sinh, mã/biệt danh và lớp snapshot dự kiến.
- Tổng dự kiến.
- Một cột cho từng khoản/hoàn trả/nợ cũ có giá trị không phải 0; chuyển các cột 0 toàn bộ sang phần cấu hình để bảng không bị quá rộng.
- Giá trị dương/âm có nhãn văn bản `Thu`/`Giảm trừ`, không chỉ đổi màu.
- Filter theo học sinh/lớp và drill-down xem rule, service enrollment, leave adjustment đề xuất và dữ liệu vận hành tham chiếu trước khi generate.

Preview phải dùng đúng service tính toán sẽ dùng trong transaction generate. Client không tự nhân/tổng để tạo một preview khác server.

### 7.5 Generate và idempotency

- Preview là authoritative: trả học sinh đủ điều kiện, rule/dòng dự kiến và skip có lý do.
- Generate yêu cầu `Idempotency-Key`, chạy transaction, dùng unique `(studentId, collectionRunId)` và chỉ tạo invoice `DRAFT` không có payment instruction.
- Response phân biệt `created`, `skippedExistingInvoice`, `skippedInactiveStudent`, `skippedNoActiveClass`, `skippedNoApplicableRule`.
- Timeout sau submit bắt buộc đối soát `GET /operations/:operationId` trước retry.
- Khi generate, API snapshot học sinh/lớp và toàn bộ dòng. Chỉnh giá/rule/danh mục sau đó không ảnh hưởng invoice đã tạo; Finance Manager vẫn có thể điều chỉnh từng invoice trong phạm vi `DRAFT` với audit trước khi issue.

## 8. API REST đề xuất

Các route dưới đây thay thế `/invoice-template`; controller vẫn mỏng, service/API giữ toàn bộ validate, authorization và tính tiền.

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET`, `POST` | `/receivable-groups` | Danh sách/tạo nhóm |
| `PATCH` | `/receivable-groups/:id` | Sửa tên, loại, thứ tự, trạng thái |
| `GET`, `POST` | `/receivables` | Danh sách/tạo khoản thu |
| `GET`, `PATCH` | `/receivables/:id` | Chi tiết/sửa hoặc ngừng dùng |
| `GET`, `POST` | `/collection-runs` | Danh sách/tạo đợt thu |
| `GET`, `PATCH` | `/collection-runs/:id` | Chi tiết/sửa run khi cho phép |
| `POST` | `/collection-runs/:id/rules` | Thêm rule áp dụng |
| `PATCH`, `DELETE` | `/collection-runs/:id/rules/:ruleId` | Sửa/bỏ rule khi run `DRAFT` |
| `POST` | `/collection-runs/:id/ready` | Validate và chuyển `DRAFT -> READY` |
| `POST` | `/collection-runs/:id/batch-preview` | Preview dòng/skip chính thức |
| `POST` | `/collection-runs/:id/generate-invoices` | Tạo hóa đơn hàng loạt idempotent |
| `POST` | `/collection-runs/:id/invoices` | Thêm một học sinh chưa có invoice vào run `GENERATED`, tạo invoice `DRAFT` từ snapshot rule |
| `POST` | `/collection-runs/:id/close` | Đóng run có xác nhận |
| `POST` | `/invoices/:id/items/:itemId/override` | Finance Manager/SCHOOL_ADMIN override giá/số lượng `DRAFT`, có ghi chú/audit và source snapshot nếu có |
| `POST` | `/invoices/:id/adjustments` | Thêm adjustment dương/âm `DRAFT` |
| `POST` | `/invoices/:id/refund-adjustments` | Tạo hoàn trả theo khoản từ source được duyệt trong `DRAFT` |
| `POST` | `/invoices/:id/issue` | Chọn tài khoản nhận tiền active, snapshot payment instruction và issue invoice `DRAFT` |
| `POST` | `/invoices/:id/year-end-adjustments` | School Admin thêm adjustment/write-off quyết toán có nguồn/lý do |
| `GET`, `POST` | `/discount-policies` | Danh sách/tạo giảm trừ theo tiền hoặc phần trăm |
| `PATCH` | `/discount-policies/:id` | Sửa/ngừng dùng policy chưa snapshot mới |
| `GET`, `POST` | `/payment-receipts` | Lịch sử/ghi nhận tiền nhận có audit |
| `POST` | `/payment-receipts/:id/post` | Post chứng từ theo preview allocation idempotent |
| `POST` | `/payment-receipts/:id/void` | Tạo void/reversal hoặc yêu cầu duyệt theo FinancePolicy |
| `GET`, `POST` | `/students/:id/prepayments` | Lịch sử/tạo nộp trước gắn cố định học sinh |
| `POST` | `/students/:id/prepayments/:prepaymentId/apply` | Áp dụng nộp trước vào hóa đơn tương lai theo preview |
| `POST` | `/students/:id/prepayments/:prepaymentId/refund` | Hoàn tiền nộp trước khi đủ điều kiện, có audit |
| `GET` | `/students/:id/ledger` | Receipt, allocation, nộp trước, debt và lịch sử kỳ |
| `GET`, `POST`, `PATCH` | `/leave-requests` | Parent tạo/xem/hủy/sửa khi còn pending; API tự duyệt trước deadline hoặc yêu cầu School Admin/Finance Manager duyệt sau deadline |
| `GET`, `POST` | `/student-service-enrollments` | Quản lý đăng ký dịch vụ theo học sinh, gồm học thứ bảy cả tháng |
| `POST` | `/attendance/class-sessions/:id/records` | Class Teacher hoặc lễ tân được phân công ghi attendance; `PRESENT` tuân theo `AttendancePolicy.photoEvidenceMode` |
| `POST` | `/handovers/:id/complete` | Class Teacher hoặc lễ tân được phân công xác nhận `pickedUpAt` thực tế; Finance chỉ tham chiếu dữ liệu này trong invoice `DRAFT` |

Danh sách trả `{ data, meta }`; action trả `{ data }`; lỗi theo `{ error: { code, message, fieldErrors? } }`. Các POST có tác động nhiều record hoặc khó retry dùng UUID idempotency theo invariant hiện có.

## 9. UX/IA đề xuất

Thay mục sidebar `Mẫu hóa đơn` bằng **Khoản thu** với hai tab:

- `Khoản thu`: danh sách tên, mã, giá/đơn vị, giá hoàn trả/đơn vị, nhóm, tax treatment, trạng thái, action sửa/ngừng dùng.
- `Nhóm khoản thu`: nhóm, loại chung/đột xuất, trạng thái, số khoản active, action sửa/ngừng dùng.

Thêm mục sidebar **Đợt thu**:

- Danh sách có tên, loại kỳ, kỳ, trạng thái, số học sinh/hóa đơn, thời điểm cập nhật.
- Danh sách cũng có khoảng thời gian áp dụng, hạn cuối thu phí, đã thu/dự kiến, còn thiếu và số học sinh thanh toán/tổng; các chỉ số chỉ aggregate từ invoice snapshot.
- Wizard tạo run có ba bước: cấu hình đợt và các khoản/dịch vụ, kiểm tra phạm vi, preview ma trận học sinh x khoản, sau đó mới generate `DRAFT`. Không đặt CTA generate trước preview.
- Trang chi tiết `DRAFT` chia: thông tin đợt, rule khoản thu, phạm vi áp dụng và preview.
- Rule hiển thị rõ `Khoản thu`, phạm vi, nguồn giá, `FIXED`/`MANUAL`, giá/đơn vị dự kiến, thứ tự; không dùng biểu tượng không nhãn.
- `READY` hiển thị preview trước khi có CTA `Tạo hóa đơn nháp`; CTA nêu run/kỳ và số học sinh đủ điều kiện.
- `GENERATED` là read-only cho rule, dẫn Finance Manager tới danh sách invoice `DRAFT` cần rà soát. Mỗi row hiển thị tài khoản nhận tiền chưa chọn/đã chọn và CTA `Phát hành`; CTA `Thêm học sinh` chỉ cho phép chọn học sinh chưa có invoice trong run.
- Trang thống kê run có drill-down từng học sinh: phải thu, đã nhận, đã phân bổ, nộp trước còn mở, còn thiếu, các invoice/công nợ cũ và lịch sử receipt.

Sửa bề mặt hóa đơn:

- Thay "Mẫu hóa đơn" bằng tên/loại kỳ của đợt thu.
- Bảng dòng có `Khoản thu`, `Đơn vị`, `Đơn giá`, `Số lượng`, `Thành tiền`, `Nguồn` và `Ghi chú/lý do`.
- Dòng `MANUAL` nêu ghi chú/reference đã được Finance chọn, ví dụ `3 block đón muộn theo bàn giao 05/09, 12/09, 20/09`; Parent chỉ nhận tên, đơn vị, giá, số lượng và thành tiền cần thiết.
- Điều chỉnh/hoàn trả dùng action rõ `Thêm điều chỉnh` và `Thêm hoàn trả`, luôn yêu cầu lý do cho giá trị âm; chỉ School Admin thấy action quyết toán/write-off cuối năm.
- Trang Parent cho phép tạo/xem/hủy/sửa leave request khi còn pending của trẻ được ủy quyền; không cấp Parent mutation finance, attendance, service enrollment hoặc handover. Leave request auto-approved có thể được đánh dấu conflict nếu giáo viên xác nhận trẻ vẫn đến, không bị xóa âm thầm.
- Trang Parent nhận notification attendance event nhưng không hiển thị ảnh evidence trong release đầu.
- Trang khoản tiền ăn tháng giải thích rõ số tiền gốc, deadline School cấu hình, ngày nghỉ có phép được trừ, review sau deadline và exception `PRESENT` đã xác nhận; không che deduction trong một tổng mơ hồ.
- Đăng ký dịch vụ có danh sách học sinh, hiệu lực, trạng thái và lịch sử. Invoice thứ bảy hiển thị rõ `Gói học thứ bảy` hoặc `Học lẻ thứ bảy`; Finance không nhập học lẻ cho ngày đã được service enrollment active bao phủ.
- Giáo viên/lễ tân có action `Trả trẻ` ghi thời điểm thực tế. Finance xem cutoff/grace/block theo School policy và timestamp bàn giao khi nhập phí muộn `MANUAL`; không để browser tự tính tiền hoặc Parent tự xác nhận giờ trả trẻ.
- Tổng quan run theo học sinh hiển thị `Phải thu`, `Đã thu`, `Còn thiếu`, `Nộp trước chưa áp dụng`; không dùng nhãn `Ví` hoặc `Credit`.
- Thêm trang `Thu tiền & nộp trước`: receipt list, form ghi nhận, wizard tạo nộp trước, receipt detail và void/reversal. Chế độ reversal được school cấu hình hiển thị rõ: post trực tiếp hoặc chờ School Admin duyệt.
- Thêm trang `Công nợ học sinh`: danh sách invoice chưa đủ, tổng nợ cũ/theo run, payment history và CTA phân bổ/ghi nhận tiền; filter theo học sinh, lớp, run và quá hạn.
- Thêm trang `Giảm trừ`: policy %, tiền, thời hạn, phạm vi, khoản áp dụng và trạng thái; không sửa trực tiếp invoice `ISSUED` để đổi policy lịch sử.

## 10. Báo cáo

Báo cáo hiện tại theo tháng vẫn phải có tổng đã thu, tiền mặt, chuyển khoản và tài khoản nhận tiền. Bổ sung:

- Filter theo `CollectionRun`, loại kỳ, nhóm khoản thu, khoản thu, lớp và trạng thái.
- Tổng tiền theo `receivableCode`/`receivableName` snapshot và nhóm snapshot, tách invoice issued, paid, partially paid và voided; tiền đã thu lấy từ receipt/allocation posted.
- Hiển thị riêng gross charge, discount/refund adjustment, net billed, receipt posted, receipt voided, allocated, nộp trước còn mở và outstanding debt.
- Khoản đột xuất theo năm/sự kiện không bị trộn vào báo cáo học phí tháng trừ khi Admin chọn include.

`Còn thiếu` là `outstanding debt` từ invoice chưa đủ. Nộp trước là record riêng, chỉ hiện như số tiền chưa áp dụng của từng học sinh, không phải số dư credit tổng quát. Không tính `đã thu` bằng cách cộng trạng thái invoice; chỉ cộng `PaymentReceipt.POSTED` và phân biệt rõ receipt bị void.

Không đọc giá/tên từ `Receivable` mutable khi báo cáo. Báo cáo dùng snapshot dòng invoice như báo cáo bank account hiện dùng snapshot thanh toán.

## 11. Thay đổi clean-break trong codebase

Các mục dự kiến bỏ/thay thế khi blueprint được phê duyệt:

| Phần hiện tại | Hành động |
| --- | --- |
| Prisma enum `InvoiceTemplateAmountSource` và lifecycle hóa đơn cũ | Bỏ; thay `PricingSource`, `QuantitySource`, `ReceivableStatus`, `CollectionRunStatus`, `CollectionPeriodType`, `TaxTreatment`, `InvoiceStatus`, `PaymentReceiptStatus`, `AllocationType`, `PrepaymentStatus`, `ReversalApprovalMode` |
| Prisma `InvoiceTemplate`/`InvoiceTemplateItem` | Bỏ; thay `ReceivableGroup`, `Receivable`, `CollectionRun`, `ChargeRule` |
| Module `invoice-template` và REST `/invoice-template` | Bỏ; thay modules `receivables` và `collection-runs` |
| Invoice unique `(studentId, billingMonth)` | Bỏ; thay unique `(studentId, collectionRunId)` |
| `Invoice.billingMonth` | Bỏ hoặc derive qua `CollectionRun`; không giữ compatibility field |
| `InvoiceItem(description, feeGroup, amount, position)` | Mở rộng clean-break thành snapshot đơn vị/giá/số lượng/nguồn/khoản thu |
| Batch preview `/invoices/batch-preview` | Bỏ; chuyển thành preview theo collection run |
| Xác nhận `PENDING -> COMPLETED` | Bỏ; thay bằng receipt post, payment/prepayment application và invoice balance derived |
| Báo cáo chỉ tổng `COMPLETED` | Bỏ; báo cáo đọc ledger receipt/allocation và invoice balance snapshot |
| Sidebar/page `Mẫu hóa đơn` | Bỏ; thay `Khoản thu` và `Đợt thu` |
| Seed template mặc định | Bỏ; seed nhóm và danh mục khoản thu mẫu |
| Test template, snapshot từ template | Viết lại theo danh mục, rule precedence, collection run, snapshot và idempotency generate |

Những phần giữ nguyên về nguyên tắc:

- Google session, CSRF, CORS và API ownership.
- Lớp, Học sinh, Parent-Học sinh authorization.
- Tài khoản nhận tiền, QR VietQR và Parent authorization. QR dùng số outstanding ở invoice `ISSUED` tại thời điểm render; API vẫn là nguồn amount.
- PostgreSQL `BIGINT`, snapshot bất biến, audit và idempotency; báo cáo chuyển thành projection từ finance ledger.

Do dữ liệu chỉ là seed, implementation thực hiện bằng migration mới tạo schema đích rồi cập nhật/reset seed trên môi trường dev/test. Không viết migration chuyển đổi `InvoiceTemplate`/invoice cũ; không deploy thay đổi này vào môi trường đã có dữ liệu vận hành mà thiếu kế hoạch migration riêng.

## 12. Seed gợi ý

Seed chỉ có dữ liệu minh họa, tất cả có thể sửa trong UI:

| Mã | Tên | Nhóm | Giá/đơn vị | Hoàn trả/đơn vị | Unit | Pricing | Quantity |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| `TUITION` | Học phí | Chung | Theo lớp | 0 | tháng | `CLASS_MONTHLY_TUITION` | `FIXED: 1` |
| `MEAL` | Tiền ăn | Chung | School cấu hình | School cấu hình | tháng | `RECEIVABLE_DEFAULT` | `FIXED: 1`; workflow leave tạo adjustment âm trên invoice tháng kế tiếp |
| `BOARDING` | Phí bán trú | Chung | 10.000 | 0 | ngày | `RECEIVABLE_DEFAULT` | `MANUAL` |
| `SATURDAY_PACKAGE` | Học thứ bảy cả tháng | Dịch vụ | School cấu hình | School cấu hình | tháng | `RECEIVABLE_DEFAULT` | `FIXED: 1` cho `StudentServiceEnrollment` active |
| `SATURDAY_SINGLE` | Học lẻ thứ bảy | Dịch vụ | School cấu hình | School cấu hình | buổi | `RECEIVABLE_DEFAULT` | `MANUAL`; Finance tham chiếu attendance và chặn ngày đã có service enrollment |
| `LATE_PICKUP_30M` | Phí trông muộn | Chung | 20.000 | 20.000 | 30 phút | `RECEIVABLE_DEFAULT` | `MANUAL`; Finance tham chiếu handover |
| `MATERIALS_MONTHLY` | Học phẩm học liệu | Chung | 150.000 | 0 | tháng | `RECEIVABLE_DEFAULT` | `FIXED: 1` |
| `FACILITIES` | Cơ sở vật chất | Chung | School cấu hình | School cấu hình | năm theo ngày nhập học | `RECEIVABLE_DEFAULT` | Rule do School cấu hình; Finance Manager override giá/adjustment trong `DRAFT` có ghi chú khi trẻ nhập học giữa năm |

Không seed danh mục khoản thu cố định cho mọi School. Seed/dev fixture chỉ minh họa các loại dữ liệu; mỗi School tự định nghĩa khoản, nhóm, đơn vị, giá, hoàn trả và rule áp dụng theo vận hành của mình.

## 13. Kiểm thử bắt buộc

- Unit test precedence `STUDENT > CLASS > SCHOOL`, exclude và từ chối rule ambiguous.
- Unit test giá theo catalog/lớp/override, quantity, hoàn trả, discount %/tiền có thời hạn, tiền âm/dương và các giới hạn VND safe integer.
- Unit test attendance: `REQUIRED` từ chối `PRESENT` không ảnh, `OPTIONAL` cho phép; snapshot policy, xóa evidence đúng hai tháng lịch, Parent không thể đọc evidence API, Staff/School Admin chỉ đọc trong school scope/capability.
- Unit test meal deduction: School deadline auto-approval/review, effective date không trước ngày gửi, tự bỏ ngày nghỉ/lễ, Finance Manager/SCHOOL_ADMIN duyệt sau deadline, `PRESENT` đã xác nhận loại ngày trùng và Finance xác nhận adjustment âm cho invoice tháng kế tiếp với audit.
- Unit test thứ bảy: service enrollment active tạo gói cố định; Finance chỉ được nhập học lẻ `MANUAL` cho ngày attendance `PRESENT` hợp lệ và không được charge trùng ngày đã có gói bao phủ.
- Unit test phí đón muộn: LatePickupPolicy cutoff/grace/block/exemption chỉ áp dụng nhất quán khi hiển thị/đối chiếu handover; Finance tạo dòng `MANUAL`/adjustment trong `DRAFT` với timestamp tham chiếu, lý do và audit, không có engine tự tính fee.
- PostgreSQL integration test unique hóa đơn theo `collectionRunId`, transaction generate, snapshot giữ nguyên khi sửa/inactive danh mục, rule hoặc lớp; khoản unit `năm theo ngày nhập học` dùng school-defined rule và mọi override giá/adjustment trong `DRAFT` bắt buộc có ghi chú/audit.
- Integration test không thể sửa rule run `GENERATED`, không thể dùng receivable inactive cho run mới và không thể inactive khoản đang có rule `DRAFT`/`READY`.
- Integration test idempotency preview/generate, conflict reuse key và operation reconciliation.
- Integration test receipt post/void, receipt allocation không vượt amount, nộp trước không chuyển học sinh/không áp dụng vượt amount, debt transfer gộp nợ cũ đúng trong cùng SchoolYear mà không double-count, quyết toán cuối năm chỉ School Admin, concurrent allocation và idempotency.
- Integration test invoice `ISSUED`/`PARTIALLY_PAID`/`PAID` được derive chính xác, Parent chỉ xem invoice của học sinh được ủy quyền và không thấy ledger nội bộ không cần thiết.
- Playwright: Parent gửi/School duyệt đơn nghỉ đúng và quá deadline; tự bỏ ngày nghỉ/lễ; tạo đăng ký học thứ bảy, Finance nhập học lẻ tham chiếu attendance và phí muộn tham chiếu handover; tạo khoản thu/giảm trừ, tạo run, gán rule lớp/học sinh, preview meal adjustment, generate `DRAFT` gồm nợ cũ, điều chỉnh từng invoice, chọn tài khoản riêng và issue, ghi nhận nộp trước, apply/refund nộp trước, direct/two-step reversal, quyết toán năm, Parent xem số phải trả/QR với student code + class snapshot, báo cáo breakdown khoản thu và ledger.

## 14. Câu hỏi chặn trước khi viết PRD thay thế

1. Đã chốt: cần cả `MONTHLY`, `ANNUAL` và `ONE_OFF` ngay release đầu.
2. Đã chốt: School tự tạo nhóm khoản thu và các khoản mong muốn; không giới hạn nhóm nghiệp vụ hay catalog seed mặc định.
3. Đã chốt: mã khoản thu là tùy chọn do Finance Manager tự nhập; khi có thì unique trong School.
4. Đã chốt: hoàn trả có nguồn từ đơn nghỉ có phép, nghỉ dài hạn hoặc hủy dịch vụ đã được duyệt; Finance Manager/SCHOOL_ADMIN vẫn có thể thêm adjustment thủ công trong `DRAFT` với ghi chú/audit.
5. Đã chốt: tiền ăn thu theo tháng; School cấu hình deadline, đơn trước deadline tự duyệt, Finance Manager/SCHOOL_ADMIN duyệt sau deadline và API tự bỏ ngày nghỉ/lễ. Giảm trừ là adjustment âm trên invoice tháng kế tiếp, không tính tiền ăn theo attendance từng ngày.
6. Đã chốt: phí trông muộn có policy chung toàn School; giáo viên/lễ tân xác nhận trả trẻ, Finance Manager/SCHOOL_ADMIN nhập/điều chỉnh dòng `MANUAL` trong `DRAFT` khi cần.
7. Một học sinh có thể đồng thời có xe theo lượt và xe tháng không? Nếu không, rule conflict nào phải chặn?
8. Có cần giữ tax treatment trong UI ngay khi release đầu, hay giữ nhưng ẩn khỏi luồng nếu trường không dùng?
9. Đã chốt: run `GENERATED` cho phép thêm học sinh chưa có invoice; API tạo một invoice `DRAFT` từ snapshot rule run. Học sinh đã có invoice không nhận invoice thứ hai trong cùng run; điều chỉnh `DRAFT` hoặc tạo run bổ sung sau issue.
10. Đã chốt: `Cơ sở vật chất` là khoản thu do School tự tạo như các khoản khác. Có thể dùng unit `năm theo ngày nhập học`; Finance Manager điều chỉnh giá thực thu hoặc thêm adjustment trong invoice `DRAFT` cho trường hợp nhập học giữa năm, luôn có ghi chú/audit.
11. Đã chốt: Parent hoặc School Admin tạo yêu cầu nghỉ dài hạn; chỉ School Admin duyệt/từ chối và xác nhận/chọn effective date không trước ngày yêu cầu. Sau duyệt, API dừng eligibility cho CollectionRun tương lai; invoice đã issue chỉ xử lý bằng adjustment/refund có source.
12. Đã chốt: School Admin hoặc Finance Manager tạo/hủy `StudentServiceEnrollment` cho mọi dịch vụ theo thông báo/yêu cầu Parent, có effective dates/audit; Parent không tự thay đổi đăng ký hoặc hủy dịch vụ. Học thứ bảy chỉ là một dịch vụ trong mô hình này.
13. Đã chốt: `AttendancePolicy.photoEvidenceMode` theo School là `REQUIRED` hoặc `OPTIONAL`. Evidence ảnh giữ đúng hai tháng lịch và chỉ Staff có capability attendance/School Admin xem trong school scope; Parent chỉ nhận event notification, không xem/tải/browse ảnh release đầu.
10. Đã chốt: nợ mở được gộp thành từng dòng `PRIOR_DEBT` vào hóa đơn mới trong cùng SchoolYear; receipt thanh toán invoice mới đó, không cần auto-allocation giữa invoice cũ.
11. Đã chốt: nộp trước gắn cố định với một học sinh, không có credit balance; có thể nhắm khoản/kỳ và hoàn tiền khi học sinh nghỉ trước khi áp dụng.
12. Đã chốt: `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` được tạo/post reversal theo mode cấu hình trường; mode hai bước buộc Finance Manager tạo yêu cầu và School Admin duyệt. Lý do/audit/idempotency luôn bắt buộc.
13. Đã chốt: cuối mỗi SchoolYear phải quyết toán, không auto-carryover sang năm mới; School Admin có quyền quyết định adjustment/write-off có audit.
14. Đã chốt: School Admin quản lý finance policy, đóng CollectionRun và quyết toán năm/write-off. Finance Manager và School Admin tạo/sửa/ready/generate run, rà soát/điều chỉnh/issue invoice `DRAFT`, chọn tài khoản nhận tiền riêng khi issue, ghi receipt/nộp trước và thực hiện reversal theo policy. `reversalApprovalMode` là setting School: `DIRECT` phù hợp trường nhỏ, `SCHOOL_ADMIN_APPROVAL` khi cần hai bước. Không ai sửa trực tiếp invoice sau `ISSUED`.

## 15. Bước tiếp theo

Chốt chi tiết phân quyền finance còn lại với người phụ trách tài chính và vận hành. Sau đó chạy workflow `correct course` để tạo PRD thay thế, UX/architecture spine mới và story migration clean-break. Không triển khai một phần `Receivable` song song với `InvoiceTemplate`; phải chuyển toàn bộ luồng nghĩa vụ, receipt, allocation, nộp trước và báo cáo sang ledger trong cùng thay đổi để tránh hai nguồn sự thật tiền.
