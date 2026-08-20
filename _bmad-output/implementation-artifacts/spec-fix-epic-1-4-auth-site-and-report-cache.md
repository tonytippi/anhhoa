---
title: 'Khắc phục deployment auth cross-site và cache báo cáo sau completion'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c0bc9d48120f7a297b16f73e8b35e7e44ae1b691'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-retro-2026-08-20.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-retro-2026-08-20.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Cấu hình API hiện có thể khởi động với web và API thuộc hai schemeful site khác nhau, dù cookie session/CSRF `SameSite=Lax` khiến `/auth/me` và mutation không hoạt động. Sau khi Admin hoàn tất hóa đơn, report và overview cùng tháng có thể tiếp tục hiển thị số liệu đã cache trước completion.

**Approach:** Fail-fast khi `WEB_ORIGIN` không schemefully same-site với public API origin từ `GOOGLE_CALLBACK_URL`, giữ nguyên cookie/CSRF contract. Khi API xác nhận completion, invalidates chính xác report query của `billingMonth` từ response để mọi report surface refetch dữ liệu snapshot mới.

## Boundaries & Constraints

**Always:** So sánh site theo scheme và registrable domain, không theo origin hay port; sibling subdomain và localhost khác port hợp lệ. `GOOGLE_CALLBACK_URL` là public API callback đã đăng ký với Google; `VITE_API_URL` phải trỏ cùng public API origin này. Giữ cookie `Secure`, `httpOnly` session và `SameSite=Lax`; CSRF vẫn yêu cầu exact `Origin === WEB_ORIGIN` cùng double-submit token. Chỉ invalidate report sau terminal completion được server xác nhận, dùng `result.billingMonth` và exact key `['reports', 'monthly', billingMonth]`.

**Ask First:** Hỏi trước nếu phải đổi cookie sang `SameSite=None`, nới CSRF từ exact-origin sang same-site, hỗ trợ topology web/API cross-site, hoặc thay OAuth callback/deployment model.

**Never:** Không suy API origin từ `PORT`, CORS hay hostname suffix thủ công; không dùng heuristic last-two-label thay cho public-suffix-aware registrable domain; không invalidate report khi mutation chưa thành công hoặc toàn bộ report month không liên quan; không đổi lifecycle, snapshot, schema/migration hoặc response contract hóa đơn/báo cáo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Same-site cross-origin deployment | `https://admin.anhhoa.vn` và callback `https://api.anhhoa.vn/auth/google/callback` | API khởi động; `SameSite=Lax` contract vẫn dùng được | Không áp dụng |
| Local different ports | `http://localhost:5173` và callback `http://localhost:3000/...` | API khởi động | Không áp dụng |
| Cross-site or scheme mismatch | Khác registrable domain hoặc `http`/`https` khác nhau | Bootstrap fail trước Nest create/listen, lỗi config nêu topology không hỗ trợ | Không bind port |
| Cached monthly report then completion | Report tháng đã inactive trong query cache, completion trực tiếp hoặc reconciliation trả terminal Invoice | Query đúng tháng bị stale; overview/report mount lại refetch count, total và snapshot breakdown mới | Không invalidate khi kết quả còn PENDING/không xác định |

</frozen-after-approval>

## Code Map

- `apps/api/src/common/config/auth-config.ts:39-93` -- parse `WEB_ORIGIN` và `GOOGLE_CALLBACK_URL`; thêm public-suffix-aware same-site validation trước bootstrap hoàn tất.
- `apps/api/src/common/config/auth-config.test.ts:4-23` -- `validEnv` localhost khác port là baseline; thêm accept sibling subdomain/different port, reject cross-domain, scheme mismatch và public-suffix regression.
- `apps/api/src/main.test.ts` -- xác minh invalid topology fail trước `NestFactory.create`/`listen`.
- `apps/api/package.json` -- nơi khai báo dependency API; chỉ thêm parser registrable domain được duy trì nếu cần cho PSL chính xác.
- `apps/api/.env.example:6-10`, `README.md` -- document callback API, same-site constraint và yêu cầu `VITE_API_URL` cùng public API origin.
- `apps/web/src/features/invoices/detail-page.tsx:71-92` -- `finishCompletion` là điểm chung duy nhất cho direct completion và terminal reconciliation; thêm exact monthly-report invalidation tại đây.
- `apps/web/src/features/reports/api.ts:17` -- định nghĩa canonical report query key.
- `apps/web/e2e/invoices.spec.ts`, `apps/web/e2e/reports.spec.ts` -- fixture/route pattern để test cached report, completion và refetch cross-route.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/common/config/auth-config.ts` -- thêm dependency PSL-aware tối thiểu và validate schemeful same-site giữa web origin/callback API origin -- chặn topology khiến cookie Lax vô dụng mà vẫn cho phép cross-origin cùng site.
- [x] `apps/api/src/common/config/auth-config.test.ts`, `apps/api/src/main.test.ts` -- cover topology hợp lệ/bị từ chối và fail-fast trước Nest bind -- khóa deployment invariant.
- [x] `apps/api/.env.example`, `README.md` -- mô tả public callback, same-site rule, `VITE_API_URL` cùng API origin và cross-site không được hỗ trợ -- tránh deploy sai config.
- [x] `apps/web/src/features/invoices/detail-page.tsx` -- invalidate exact report query từ `result.billingMonth` trong completion terminal path -- refresh derived financial data sau direct success hoặc reconciliation.
- [x] `apps/web/e2e/invoices.spec.ts` -- cache report trước completion, hoàn tất invoice transfer và xác minh overview/report refetch count, total và transfer breakdown snapshot -- cover regression xuyên Epic.

**Acceptance Criteria:**
- Given config web/API cùng schemeful site nhưng khác origin, when API bootstrap, then startup succeeds và cookie `SameSite=Lax` cùng exact-origin CSRF contract không đổi.
- Given config khác registrable domain, public suffix boundary hoặc scheme, when API bootstrap, then startup rejects trước khi tạo/bind Nest app với lỗi config rõ ràng.
- Given report tháng đã cache và invoice cùng tháng được server xác nhận `COMPLETED`, when Admin mở lại overview hoặc report, then API refetch đúng tháng và UI phản ánh count, total và transfer snapshot breakdown mới.

## Design Notes

Same-site không phải same-origin: port không tham gia site comparison, nhưng scheme có tham gia. PSL-aware parsing tránh coi hai tenant khác nhau trên public suffix chung là cùng site. Callback URL là nguồn server-side đáng tin cậy duy nhất cho public API origin; browser build vẫn phải cấu hình `VITE_API_URL` khớp origin đó.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: auth config/bootstrap cùng test API hiện hữu pass.
- `pnpm --filter web test:e2e` -- expected: cached-report completion regression cùng Playwright suite pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: toàn workspace pass.

## Suggested Review Order

**Auth deployment invariant**

- Fail-fast compares scheme plus PSL-aware registrable domain, while preserving same-host local development.
  [`auth-config.ts:53`](../../apps/api/src/common/config/auth-config.ts#L53)

- Documents the required public callback/API topology without exposing any real configuration value.
  [`.env.example:6`](../../apps/api/.env.example#L6)

**Financial cache refresh**

- A terminal completion invalidates only the server-authoritative billing month's derived report.
  [`detail-page.tsx:71`](../../apps/web/src/features/invoices/detail-page.tsx#L71)

- The canonical report key and fresh interval make exact invalidation explicit and testable.
  [`api.ts:5`](../../apps/web/src/features/reports/api.ts#L5)

**Regression coverage**

- Configuration coverage accepts valid same-site topologies and rejects cross-site deployment before startup.
  [`auth-config.test.ts:17`](../../apps/api/src/common/config/auth-config.test.ts#L17)

- SPA navigation retains two fresh report months and proves only the completed month refetches.
  [`invoices.spec.ts:66`](../../apps/web/e2e/invoices.spec.ts#L66)
