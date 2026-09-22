# Prompt review: Sửa lệnh khởi động Ops local tại port 5176

Các prompt dưới đây được ghi ra vì harness hiện tại không cho khởi tạo reviewer subagent. Chạy từng prompt trong một session riêng, rồi gửi lại toàn bộ findings.

## Blind Hunter

```text
Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:
docs/local-finance-admin-mvp.md
@@ -107,15 +107,15 @@ Cho API lang nghe tai `http://localhost:3000`. Neu API khong khoi dong, kiem tra
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev -- --port 5176
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev --port 5176 --strictPort
 ```
 
-Mo `http://localhost:5176` chi sau khi process Ops da chay.
+Mo `http://localhost:5176` chi sau khi process Ops da chay. Khong dat them `--` truoc `--port`: voi script `dev` chay `vite`, separator do lam Vite khong parse `--port` va quay ve port mac dinh `5173`. `--strictPort` se dung ngay neu `5176` dang bi chiem; dung process dang chiem port thay vi doi origin OAuth/API.
 
 Terminal 3, Admin:
 
 ```bash
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev -- --port 5173
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev --port 5173 --strictPort
 ```

Do not invoke any skill. Return only the review result.
```

## Edge Case Hunter

```text
Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/edge-case-hunter.md` completely and follow it as your review instructions.

Review content:

docs/local-finance-admin-mvp.md
@@ -107,15 +107,15 @@ Cho API lang nghe tai `http://localhost:3000`. Neu API khong khoi dong, kiem tra
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev -- --port 5176
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev --port 5176 --strictPort
 ```
 
-Mo `http://localhost:5176` chi sau khi process Ops da chay.
+Mo `http://localhost:5176` chi sau khi process Ops da chay. Khong dat them `--` truoc `--port`: voi script `dev` chay `vite`, separator do lam Vite khong parse `--port` va quay ve port mac dinh `5173`. `--strictPort` se dung ngay neu `5176` dang bi chiem; dung process dang chiem port thay vi doi origin OAuth/API.
 
 Terminal 3, Admin:
 
 ```bash
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev -- --port 5173
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev --port 5173 --strictPort
 ```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.
```

## Verification Gap Reviewer

```text
Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/verification-gap.md` completely and follow it as your review instructions.

Review content:

docs/local-finance-admin-mvp.md
@@ -107,15 +107,15 @@ Cho API lang nghe tai `http://localhost:3000`. Neu API khong khoi dong, kiem tra
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev -- --port 5176
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev --port 5176 --strictPort
 ```
 
-Mo `http://localhost:5176` chi sau khi process Ops da chay.
+Mo `http://localhost:5176` chi sau khi process Ops da chay. Khong dat them `--` truoc `--port`: voi script `dev` chay `vite`, separator do lam Vite khong parse `--port` va quay ve port mac dinh `5173`. `--strictPort` se dung ngay neu `5176` dang bi chiem; dung process dang chiem port thay vi doi origin OAuth/API.
 
 Terminal 3, Admin:
 
 ```bash
-VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev -- --port 5173
+VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev --port 5173 --strictPort
 ```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.
```
