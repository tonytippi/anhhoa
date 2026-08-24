---
title: 'Cố định port Parent PWA local'
type: 'chore'
created: '2026-08-24'
status: 'done'
route: 'one-shot'
---

# Cố định port Parent PWA local

## Intent

**Problem:** Parent PWA dùng port mặc định của Vite, có thể tự đổi port khi chạy cùng Admin PWA và làm lệch `PARENT_WEB_ORIGIN` của API.

**Approach:** Cấu hình Vite development server dùng duy nhất port `5174`, dừng rõ ràng khi port bận, và ghi giá trị origin tương ứng trong README.

## Suggested Review Order

1. [`../../apps/parent-web/vite.config.ts`](../../apps/parent-web/vite.config.ts) - Kiểm tra port `5174` và hành vi `strictPort`.
2. [`../../README.md`](../../README.md) - Kiểm tra hướng dẫn `PARENT_WEB_ORIGIN` local.
