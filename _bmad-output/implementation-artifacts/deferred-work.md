- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-chuyen-mot-hoc-sinh-giua-cac-lop.md`
  summary: Cung cấp picker Lớp có tìm kiếm hoặc phân trang khi có hơn 100 Lớp active.
  evidence: API `/classes` giới hạn pageSize 100; picker Story 2.3 dùng giới hạn tối đa này nên không thể liệt kê mọi đích khi vượt ngưỡng.
- source_spec: `_bmad-output/implementation-artifacts/spec-khac-phuc-phien-admin-va-chan-doan-oauth.md`
  summary: Đồng bộ TTL và dọn cookie JWT hết hạn cho phiên Parent.
  evidence: Parent callback và guard vẫn để cookie JWT cũ trong browser sau khi token hết hạn; sửa này chỉ giới hạn luồng Admin đã được duyệt.
