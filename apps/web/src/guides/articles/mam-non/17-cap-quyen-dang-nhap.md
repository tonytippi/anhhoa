---
title: Cấp quyền đăng nhập cho nhân viên
summary: Cho một nhân viên đã có hồ sơ đăng nhập bằng Google, và thu hồi khi họ nghỉ việc hoặc đổi vị trí.
order: 17
requires: staff
---
Tạo hồ sơ nhân viên **không** tự cho họ đăng nhập. Hồ sơ chỉ ghi thông tin nhân sự; muốn nhân viên vào được phần mềm, người quản lý phải **cấp quyền đăng nhập** riêng cho từng người.

## Cấp quyền đăng nhập

1. Vào `Danh bộ` › `Nhân viên`, bấm `...` ở dòng của nhân viên.
2. Chọn `Cấp quyền đăng nhập`. Hộp thoại nêu email sẽ dùng để đăng nhập.
3. Nhập `Lý do` (bắt buộc, được lưu để kiểm tra sau này) rồi bấm `Cấp quyền đăng nhập`.

Sau đó nhân viên mở phần mềm, chọn `Đăng nhập với Google` với **đúng email trong hồ sơ**. Mục `Cấp quyền đăng nhập` chỉ hiện khi nhân viên đang hiệu lực, có email và chưa được cấp.

## Thu hồi quyền đăng nhập

Dùng khi nhân viên nghỉ việc, chuyển công tác hoặc cần chặn tạm thời.

1. Bấm `...` ở dòng nhân viên, chọn `Thu hồi quyền đăng nhập`.
2. Nhập `Lý do` rồi bấm `Thu hồi quyền đăng nhập`.

Nhân viên bị chặn từ thao tác kế tiếp trên phần mềm. Hồ sơ nhân viên được giữ nguyên và bạn có thể cấp lại bất cứ lúc nào bằng `Cấp quyền đăng nhập`. Bạn không thể tự thu hồi quyền của chính mình.

## Cần lưu ý

- **Quyền thao tác của nhân viên do chức danh quyết định.** Cấp quyền đăng nhập chỉ cho họ vào được trường; việc họ thấy và làm được gì phụ thuộc chức danh ở `Cấu hình trường › Chức danh`. Nếu chức danh chưa có quyền vào trường, hệ thống vẫn cấp nhưng báo "chưa có quyền vào trường" và nhân viên sẽ thấy `Chưa có trường được cấp quyền`. Hãy cấp quyền cho chức danh trước.
- **Cần quyền `Quản lý truy cập`.** Nếu không thấy các mục này trong menu `...` hoặc báo thiếu quyền, nhờ người quản lý trường (Hiệu trưởng hoặc Quản lý trường) làm thay.
- **Email phải là tài khoản Google thật của nhân viên.** Sai email thì người khác có thể đăng nhập vào nhầm hồ sơ. Kiểm tra kỹ trước khi cấp.
- **Một email chỉ gắn với một nhân viên trong cùng trường.** Nếu email đã thuộc hồ sơ khác, hệ thống từ chối và nêu lý do.
- **Sửa email trong hồ sơ sau khi cấp không đổi tài khoản đăng nhập.** Muốn nhân viên dùng email khác, hãy `Thu hồi quyền đăng nhập`, sửa email ở `Sửa hồ sơ`, rồi cấp lại.
- **Email từng bị chặn ở cấp trường** (ví dụ bị gỡ quyền truy cập từ trước) không cấp lại được bằng nút này; liên hệ quản trị hệ thống.

> [!WARNING]
> Đừng chia sẻ một tài khoản Google cho nhiều người. Mọi thao tác được ghi theo tài khoản đăng nhập, nên dùng chung sẽ không truy được ai đã làm gì.
