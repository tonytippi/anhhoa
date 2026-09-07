- source_spec: none
  summary: Tạo bộ mockup chi tiết cho Cấu hình trường, calendar và các chính sách phiên bản.
  evidence: Được tách khỏi bộ Danh bộ vì đây là domain quản trị độc lập, có các workflow policy và BankAccount riêng để review.
- source_spec: `_bmad-output/implementation-artifacts/spec-to-chuc-lai-mockup-admin.md`
  summary: Bổ sung entry point review hoặc điều hướng hợp lệ riêng cho bốn bản mẫu mốc Admin và Parent.
  evidence: Các bản mẫu mốc được giữ để truy vết nhưng không nằm trong luồng `review.html`; một số navigation nội bộ legacy vốn không trỏ tới destination có thật.
- source_spec: none
  summary: Áp dụng quy tắc UX mới cho Admin workspace, hàng đợi và các mockup Danh bộ.
  evidence: Được tách khỏi nhóm Tài chính vì đây là các bề mặt quản trị độc lập, có thể review và triển khai riêng.
