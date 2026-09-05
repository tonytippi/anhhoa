# Rà soát UX: WCAG 2.1 AA, quyền truy cập, tài chính và tiếng Việt

- Phạm vi: `DESIGN.md`, `EXPERIENCE.md` và bốn mockup HTML trong `mockups/`.
- Ngày rà soát: 05-09-2026.
- Chuẩn đối chiếu: WCAG 2.1 AA và các invariant hành vi đã nêu trong Experience Spine. Đây là review của đặc tả và prototype tĩnh, không xác nhận được cơ chế uỷ quyền, xoá cache hay số liệu từ API khi chưa có bản chạy.
- Kết luận: **Chưa đạt để handoff/triển khai.** Spine có định hướng tốt, nhất là cấm lộ evidence cho Parent, tái uỷ quyền deep-link và đối soát Operation. Tuy nhiên mockup và một số hợp đồng UX chưa đủ để bảo đảm các nguyên tắc này trong giao diện thực tế.

## Điểm tốt đã ghi nhận

- `EXPERIENCE.md` phần Component Patterns và State Patterns yêu cầu re-authorize deep-link, clear protected memory khi `401`/revoke, không hiển thị evidence cho Parent, và đối soát Operation trước khi cho gửi lại.
- Trạng thái điểm danh được gọi đúng ngữ cảnh: `Trường chưa ghi nhận`, không suy diễn là vắng; Parent không có affordance sửa điểm danh.
- Tài chính nêu rõ server preview và API-returned values là nguồn có thẩm quyền; flow có idempotency và đối soát timeout.
- `DESIGN.md` quy định trạng thái đi kèm nhãn chữ, VND nguyên và không dùng màu như nguồn thông tin duy nhất.

## Phát hiện nghiêm trọng

Không có phát hiện mức Nghiêm trọng. Các vấn đề mức Cao dưới đây phải được giải quyết trước khi dùng mockup làm chuẩn build, vì có thể dẫn tới thao tác tài chính sai, lộ dữ liệu trẻ em sau đổi quyền, hoặc chặn người dùng bàn phím/trợ năng.

## Phát hiện mức Cao

### H-01: Nút tạo 124 hoá đơn nháp không có bước xác nhận có tên và số liệu kiểm tra cuối

- **Vị trí:** `mockups/finance-run-preview.html`, nút `Tạo 124 hóa đơn nháp`; mâu thuẫn với `EXPERIENCE.md` phần Interaction Primitives (destructive/issue actions require named confirmation) và Flow 2.
- **Rủi ro:** Một lần bấm có thể tạo hàng loạt khoản phải thu khi người dùng đang đọc sai phạm vi, kỳ thu hoặc dữ liệu preview cũ. Idempotency chỉ chống nhân đôi do retry, không ngăn một lần phát hành nhầm.
- **Yêu cầu sửa:** Sau nút phải có confirmation dialog một lớp, nêu rõ trường, kỳ/hiệu lực, phạm vi, số hoá đơn sẽ tạo và tổng tiền theo server, cùng cảnh báo về bản nháp. Yêu cầu người dùng nhập hoặc chọn lại tên đợt thu/số lượng trước khi xác nhận. Dialog phải có trạng thái đang tạo, timeout chuyển sang đối soát Operation ID, và kết quả created/skipped có liên kết lọc.

### H-02: Preview đợt thu không cho kiểm tra tổng tiền, cấu phần và thời điểm tính trước khi tạo hàng loạt

- **Vị trí:** `mockups/finance-run-preview.html`, khối `Kết quả do hệ thống tính` và bảng dòng học sinh.
- **Rủi ro:** UI gọi cột tiền là `Dự kiến` nhưng không hiển thị tổng server-returned, thời điểm/as-of, kỳ thu, catalogue/khoản thu, quy tắc nợ cũ hay tổng tác động của 3 bản ghi bỏ qua. Người duyệt không thể đối chiếu nhanh sự chênh lệch và có thể phát hành dự thảo sai số tiền hoặc sai đối tượng.
- **Yêu cầu sửa:** Hiển thị summary authoritative: số eligible/skipped, **tổng phải thu VND**, tổng nợ cũ gộp, tổng theo từng khoản thu và `Tính lúc …`/phiên bản preview. Đổi `Dự kiến` thành nhãn chính xác theo semantics API, ví dụ `Số tiền sẽ tạo trên hoá đơn nháp` nếu preview được chốt server-side; nếu chỉ ước tính thì giải thích rõ điều gì có thể thay đổi. Hiển thị mọi lý do bỏ qua bằng tiếng Việt, dữ liệu nguồn và đường dẫn xem đầy đủ.

### H-03: Nội dung Parent không có hợp đồng UX đầy đủ cho revoke trong lúc đang xem hoặc khi mở lại từ cache

- **Vị trí:** `EXPERIENCE.md` dòng 70, 82, 92 và Flow 3 bước 6; `mockups/parent-home.html` và `mockups/parent-inbox.html` không có trạng thái revoke/expired/safe context.
- **Rủi ro:** Spine nói clear protected memory nhưng không xác định thứ tự observable, phạm vi cache/offline PWA, hoặc nội dung thay thế. Nếu revoke xảy ra khi sheet, history hoặc notification đang mở, tên trẻ, trạng thái đi học và khoản phải thu có thể còn hiện qua Back, offline cache, ảnh chụp route hoặc deep-link đã render.
- **Yêu cầu sửa:** Bổ sung state/flow bắt buộc cho `403`, `401`, membership/parent-link revoked, School switch và app resume: chặn render trước khi re-authorize; xoá query cache, route state, persisted store và dữ liệu offline theo School/child; đóng dialog; thay màn hình bằng `Bạn không còn quyền xem nội dung này` không chứa tên trẻ; `replace` history về School chooser hoặc empty signed-out. Nêu rõ inbox event bị revoke không được render title/body trước khi kiểm tra quyền. Thêm mockup cho các trạng thái này.

### H-04: Màn hình Inbox Parent không hiển thị ngữ cảnh Trường nên dễ nhầm hoặc lộ ngữ cảnh chéo trường

- **Vị trí:** `mockups/parent-inbox.html`; so với `EXPERIENCE.md` dòng 34, 51, 59, 82 và `DESIGN.md` dòng 127.
- **Rủi ro:** Parent có thể có nhiều trường hoặc trẻ trùng tên. Inbox chỉ ghi `Bé An`/`Bé Minh`, không có School context hay bộ lọc School hiện tại. Khi deep-link, quay lại hoặc quyền đổi, người dùng không thể xác nhận sự kiện thuộc trường nào; implementation cũng dễ tái dùng danh sách cache của School trước.
- **Yêu cầu sửa:** Đặt School context switcher có tên trường hiển thị ở Inbox; tiêu đề/danh sách chỉ được tải theo selected School đã được server authorize. Khi đổi trường hay revoke, xoá danh sách và badge trước khi hiển thị skeleton. Với dữ liệu sự kiện, chỉ hiển thị child display name sau authorisation và có empty state an toàn nếu không còn trẻ nào được phép xem.

### H-05: Các hành động chính trong prototype không phải control có thể dùng bằng bàn phím/trình đọc màn hình

- **Vị trí:** `mockups/parent-home.html`, chuông thông báo là `span.bell`; `mockups/parent-inbox.html`, dòng `Chạm để xem...` nằm trong `article`; `mockups/admin-operational-queue.html`, mục điều hướng là các thẻ `p`; `mockups/finance-run-preview.html`, bước wizard là `span`.
- **Rủi ro:** Người dùng bàn phím, switch control và screen reader không thể mở inbox, chi tiết thông báo, điều hướng hay nhận biết/bước tới các bước wizard nếu các phần tử này được gắn click như mockup. Điều này vi phạm WCAG 2.1.1 Keyboard, 2.4.3 Focus Order, 4.1.2 Name, Role, Value.
- **Yêu cầu sửa:** Dùng `<button>` cho chuông và hành động trong trang, `<a href>` cho destination/route, `<nav>` với link cho sidebar, và cấu trúc wizard có semantic stepper (bước hiện tại được công bố). Gán accessible name chứa số thông báo chưa đọc, ví dụ `Mở thông báo, 2 thông báo chưa đọc`; không dùng một `article` click-only. Kiểm tra Tab, Enter, Space, screen-reader name/role/state ở cả desktop và mobile.

### H-06: Token primary với chữ trắng không đạt độ tương phản AA cho chữ kích thước thông thường

- **Vị trí:** `DESIGN.md` dòng 15-17, 72-75 và tuyên bố dòng 107; CSS `.active`/`button` trong tất cả mockup dùng `#2E8B69` trên `#FFFFFF` với chữ 13-16px.
- **Rủi ro:** Tỷ lệ tương phản của `#2E8B69` với trắng xấp xỉ 4.1:1, thấp hơn 4.5:1 yêu cầu cho text thường, trong khi button và step có chữ 13-16px. Tuyên bố “All text/background ... meet WCAG 2.1 AA” không đúng, dễ khiến implementation kế thừa lỗi ở mọi primary action.
- **Yêu cầu sửa:** Đổi primary nền sang màu tối hơn đạt ít nhất 4.5:1 với trắng, hoặc giữ màu hiện tại và dùng foreground tối đạt AA; kiểm tra cả hover, disabled, focus, badge và text 13px. Ghi tỷ lệ kiểm chứng cho từng token foreground/background thay vì tuyên bố chung.

### H-07: Prototype không cung cấp cơ chế bỏ qua navigation và chưa định nghĩa focus/landmark cho shell desktop

- **Vị trí:** `mockups/admin-operational-queue.html`, `aside` + `main`; `EXPERIENCE.md` dòng 79-82, 88-91.
- **Rủi ro:** Mỗi lần route đổi, người dùng bàn phím phải tab qua toàn bộ sidebar trước khi đến queue. Mockup không có `<nav>`, `<main>`, skip link, current page state, hoặc điểm focus sau route change. Điều này không đáp ứng WCAG 2.4.1 Bypass Blocks và làm giảm đáng kể khả năng vận hành của Admin/Staff.
- **Yêu cầu sửa:** Dùng landmarks (`header`, `nav` có accessible name, `main`), thêm link `Bỏ qua điều hướng` hiện khi focus, đánh dấu route hiện tại bằng `aria-current="page"`, và sau chuyển route đưa focus đến `h1`/main theo quy tắc đã nêu ở Experience Spine. Bổ sung focus-visible token không chỉ dựa vào outline mặc định của trình duyệt.

### H-08: Thẻ “Khoản cần thanh toán” của Parent không đủ thông tin tài chính tối thiểu để hiểu nghĩa vụ

- **Vị trí:** `mockups/parent-home.html`, card `Khoản cần thanh toán`; `EXPERIENCE.md` dòng 60, 83 và `DESIGN.md` dòng 131.
- **Rủi ro:** Card chỉ có tên trẻ và `Tháng 09`, không có số tiền VND, trạng thái (còn phải trả/đã thanh toán/quá hạn nếu có), mã hoặc ngày phát hành, hay thời điểm dữ liệu. Parent có thể coi đây là yêu cầu thanh toán chung, không nhận biết số tiền cần đối chiếu, hoặc nhầm nghĩa vụ của trẻ khác.
- **Yêu cầu sửa:** Card và trang instruction phải hiển thị snapshot read-only từ API: tên trẻ, mã hoá đơn/obligation, kỳ thu, **số tiền còn phải thanh toán VND**, trạng thái, hạn thanh toán nếu chính sách có, và thời điểm cập nhật. Nêu rõ đây là hướng dẫn thanh toán, không có chức năng báo đã trả. Khi không còn nghĩa vụ, không giữ card cũ trong cache; dùng `Hiện không có khoản cần thanh toán`.

## Phát hiện mức Trung bình

### M-01: Lý do bỏ qua dùng trạng thái kỹ thuật tiếng Anh và không đủ khả năng hành động

- **Vị trí:** `mockups/finance-run-preview.html`, `Bỏ qua: chưa ENROLLED`.
- **Rủi ro:** `ENROLLED` là enum nội bộ, mơ hồ với người dùng tài chính và không cho biết phải xử lý ở đâu.
- **Yêu cầu sửa:** Dùng `Bỏ qua: học sinh chưa có ghi danh hiệu lực trong kỳ thu này`, kèm link/lọc đến danh sách bị bỏ qua; nếu quyền không cho sửa danh bộ thì chỉ hiển thị hướng dẫn liên hệ đúng vai trò.

### M-02: Một số microcopy dùng “chạm” trên web đa thiết bị

- **Vị trí:** `mockups/parent-inbox.html`, `Chạm để xem ngày ...`.
- **Rủi ro:** Không bao hàm click chuột, bàn phím và assistive technology; cũng không diễn đạt action như tên control.
- **Yêu cầu sửa:** Đặt toàn bộ item trong link/button có nhãn `Xem điểm danh của Bé An ngày 05 tháng 09`, bỏ câu hướng dẫn phụ thuộc phương thức nhập.

### M-03: Ngày trong Inbox mơ hồ qua ranh giới tháng/năm và “Hôm nay/Hôm qua” không nêu ngày lịch đầy đủ

- **Vị trí:** `mockups/parent-inbox.html`.
- **Rủi ro:** Sự kiện lưu 30 ngày có thể đi qua tháng/năm; thông tin tài chính/điểm danh cần đối chiếu ngày chính xác. `Hôm nay · 08:12` không đủ sau khi đọc lại hoặc qua timezone.
- **Yêu cầu sửa:** Hiển thị ngày đầy đủ ngay trên item, ví dụ `05 tháng 09 năm 2026, 08:12`; có thể thêm `Hôm nay` trước ngày đầy đủ. Deep-link giữ định dạng ngày nhất quán.

### M-04: “Cần phản hồi hôm nay” là deadline mơ hồ và có thể gây áp lực sai

- **Vị trí:** `mockups/admin-operational-queue.html`, card đơn xin nghỉ.
- **Rủi ro:** Không rõ đây là SLA, deadline hệ thống hay lời nhắc, trong khi Experience Spine tránh giải thích internal deadline ở luồng Parent.
- **Yêu cầu sửa:** Nếu không có deadline chính sách được server trả về, dùng `Có 5 đơn đang chờ xử lý`. Nếu có hạn thật, hiển thị ngày/giờ và timezone, ví dụ `Cần xử lý trước 17:00 hôm nay`.

### M-05: Bảng finance chưa thể hiện caption, scope của header và phương án responsive trong prototype

- **Vị trí:** `mockups/finance-run-preview.html`, bảng preview; `EXPERIENCE.md` dòng 79, 91 và `DESIGN.md` dòng 115.
- **Rủi ro:** Screen reader thiếu mô tả bảng; header chưa có `scope`; mockup không chứng minh sticky identifier/horizontal scroll trên màn hình hẹp. Dòng skip dùng `colspan` làm thông tin tiền biến mất khỏi cấu trúc cột.
- **Yêu cầu sửa:** Thêm `<caption>Danh sách học sinh trong preview đợt thu tháng 09 năm 2026</caption>`, `<th scope="col">`, nhãn accessible cho bảng scroll, và mockup mobile. Biểu diễn skip bằng các ô riêng có nhãn/giá trị `Không tạo hoá đơn` thay vì gộp mơ hồ.

### M-06: Thiếu mô tả trạng thái tải/lỗi/thành công cho screen reader ở các mutation quan trọng

- **Vị trí:** `EXPERIENCE.md` dòng 72-74; `mockups/finance-run-preview.html`.
- **Rủi ro:** Có quy tắc visual về reconciliation nhưng không nêu `aria-live`, `aria-busy`, tiêu điểm kết quả hay thông báo lỗi không bị lặp. Người dùng screen reader có thể không biết request đang được đối soát hay đã tạo bao nhiêu bản nháp.
- **Yêu cầu sửa:** Bổ sung pattern: vùng status `role="status"`/`aria-live="polite"` cho tiến trình và kết quả; `role="alert"` cho lỗi chặn; chuyển focus tới summary kết quả khi Operation hoàn thành và không tự cướp focus lúc đang nhập.

### M-07: Tuyên bố quyền trong navigation chưa chỉ rõ trạng thái unauthorized ở action cũ/URL đã bookmark

- **Vị trí:** `EXPERIENCE.md` dòng 34 và 70; `mockups/admin-operational-queue.html` sidebar.
- **Rủi ro:** “Chỉ hiển thị capability server grants” không đủ an toàn nếu người dùng giữ URL, tab cũ hoặc queue card sau khi role bị hạ. UI có thể hiển thị tiêu đề/row trước khi 403 trả về hoặc phản hồi chung chung.
- **Yêu cầu sửa:** Quy định authorization trước data render cho route và mutation, thay action đã revoke bằng safe denied state không hé lộ count/danh sách, clear route/query cache theo capability, và ghi rõ route fallback cho Admin/Staff tương tự Parent.

## Danh sách kiểm tra trước handoff

- Chốt palette foreground/background bằng kết quả contrast AA và trạng thái focus/disabled.
- Bổ sung prototype cho confirm tạo hàng loạt, timeout/reconciliation, kết quả created/skipped, revoke khi đang mở child detail/inbox, School switch và unauthorized bookmarked URL.
- Bổ sung keyboard walkthrough: skip link, sidebar, queue card, wizard, bảng scroll, bell/inbox, dialog và focus return.
- Kiểm tra privacy theo tình huống nhiều trường, hai trẻ trùng display name, parent link bị revoke, app quay lại từ background và offline/PWA cache.
- Kiểm tra finance bằng dữ liệu có nợ cũ, điều chỉnh, 0 eligible, nhiều lý do skip, số tiền lớn và Operation timeout.
