---
title: 'Giữ menu tùy chọn Khoản thu không làm giãn hàng'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
route: 'one-shot'
---

# Giữ menu tùy chọn Khoản thu không làm giãn hàng

## Intent

**Problem:** Menu Tùy chọn của hàng Khoản thu cuối render trong normal flow, làm hàng và bảng giãn ra khi mở.

**Approach:** Đặt menu lifecycle thành overlay tuyệt đối trong ô hành động và mở lên phía trên trigger, giữ nguyên menu item, keyboard handler và mutation.

## Suggested Review Order

- Ô hành động tạo positioning context cho menu, giữ chiều cao hàng không đổi.
  [`finance-workspace.tsx:1100`](../../apps/web/src/finance/finance-workspace.tsx#L1100)

- Overlay mở lên để không bị cắt ở cuối vùng cuộn bảng.
  [`index.css:1515`](../../apps/web/src/index.css#L1515)

- Test khóa cấu trúc overlay và action lifecycle đang có.
  [`finance-workspace.test.tsx:79`](../../apps/web/src/finance/finance-workspace.test.tsx#L79)
