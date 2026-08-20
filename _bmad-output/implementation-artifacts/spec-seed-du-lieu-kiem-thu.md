---
title: 'Seed dữ liệu kiểm thử'
type: 'chore'
created: '2026-08-20'
status: 'done'
route: 'one-shot'
---

# Seed dữ liệu kiểm thử

## Intent

**Problem:** Seed hiện tại chỉ khởi tạo Mẫu hóa đơn trống, nên không có Lớp, Học sinh hoặc Tài khoản nhận tiền để kiểm thử các luồng vận hành.

**Approach:** Bổ sung một fixture phát triển nhỏ, chạy lặp lại an toàn, với ba Lớp active, sáu Học sinh active đã gán Lớp và ba Tài khoản nhận tiền active dùng dữ liệu thử nghiệm.

## Suggested Review Order

1. [`apps/api/prisma/seed.ts`](../../apps/api/prisma/seed.ts) - Xác nhận fixture, tính nguyên tử và khả năng chạy lại.
