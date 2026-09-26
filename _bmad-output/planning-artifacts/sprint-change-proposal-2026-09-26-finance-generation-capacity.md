# Sprint Change Proposal: Điều chỉnh capacity proof cho CollectionRun Finance

**Ngày:** 2026-09-26
**Trạng thái:** Draft chờ phê duyệt
**Mode:** Batch
**Phạm vi:** Finance Admin MVP, Story 5.6 release gate và evidence generate CollectionRun

## 1. Tóm tắt vấn đề

NFR và Story 5.6 đang dùng fixture generate 1.000 Student trong <= 60 giây. Quy mô vận hành mục tiêu đã được xác nhận là một trường mầm non thường không vượt 200 học sinh. Khi Epic 6 bổ sung carry và coverage materialization, final atomic publish cho 1.000 Student vượt Prisma interactive transaction default 5 giây. Hướng tăng timeout final publish lên 60 giây bị review từ chối vì generation lease hiện 30 giây, tạo khả năng reclaim/publish song song và terminal Operation race.

Thay đổi này điều chỉnh performance acceptance về capacity thực tế, giữ default Prisma transaction timeout và không làm yếu các invariant Finance. Kết quả 200-Student proof sẽ quyết định có cần tối ưu publish riêng hay không; không dùng capacity mới để biện minh cho nới timeout hoặc bỏ correctness/concurrency tests.

## 2. Phân tích tác động

### Epic và Story

- Epic 5/Story 5.6 bị ảnh hưởng trực tiếp: performance fixture, release proof và wording trong implementation spec đổi từ 1.000/60 giây thành 200/30 giây.
- Epic 6 không đổi requirement settlement/carry/coverage; capacity fixture chỉ chạy qua code đã tích hợp Epic 6 để phát hiện regression.
- Không tạo story mới, không đổi sprint-status vì các story đã done; đây là remediation cho release evidence trước push/release completion.

### PRD, kiến trúc và UX

- PRD NFR performance assumption phải đồng bộ để canonical contract không mâu thuẫn release proof.
- Architecture spine không cần đổi: School scope, atomic final publish, durable Operation progress, PostgreSQL locks và idempotency giữ nguyên.
- UX không đổi: Admin tiếp tục chỉ hiển thị server-returned progress/terminal Operation, không dùng browser elapsed time hay client-estimated success.

### Kỹ thuật và verification

- Không sửa Prisma global configuration, schema hoặc migration.
- Không tăng timeout `publishGeneration()` và không thay generation lease 30 giây trong change này.
- Test performance dùng 200 selected Students, vẫn assert intermediate durable progress batch 50, no duplicate Invoice, `COMPLETED` Operation và end-to-end <= 30 giây với Prisma default 5 giây.
- Correctness/race fixtures nhỏ hiện hữu vẫn giữ nguyên, gồm idempotency, cross-School rejection, unique Invoice và final atomic publish.

## 3. Cách tiếp cận đề xuất

**Direct adjustment, moderate scope.** Cập nhật canonical NFR trước, đồng bộ Epic 5/Story 5.6 và implementation evidence, rồi đổi đúng test fixture/threshold. Chạy PostgreSQL integration từ `.env.test` với default timeout. Nếu 200-student test còn hết 5 giây, dừng để mở optimization story set-based publish; không nới timeout hay lease trong proposal này.

Rủi ro chính là capacity 200 có thể không đại diện trường tăng trưởng lớn. Điều này được chấp nhận vì đây là stated operating target; bất kỳ rollout vượt 200 Student phải tạo performance/change proposal mới với benchmark, lease fencing và worker transaction design phù hợp.

## 4. Đề xuất thay đổi chi tiết

### PRD

**Artifact:** `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md`, section 7 NFR assumption.

**OLD**

`generate 1,000 Student <= 60 s va co progress Operation.`

**NEW**

`generate 200 Student <= 30 s va co progress Operation trong fixture acceptance cua truong muc tieu.`

**Rationale:** Đồng bộ acceptance capacity với quy mô vận hành trường mầm non mục tiêu; vẫn bảo toàn server-authoritative progress.

### Canonical Epic

**Artifact:** `_bmad-output/planning-artifacts/epics-passionedu.md`.

**OLD:** NFR-6 và Story 5.6 AC dùng `1,000 Student <= 60 s`.

**NEW:** NFR-6 và Story 5.6 AC dùng `200 Student <= 30 giây`; giải thích đây là fixture capacity của target school, không thay thế tenant/concurrency/correctness proof.

**Rationale:** Backlog và PRD phải cùng một acceptance contract; Story 5.6 vẫn yêu cầu durable Operation progress và retry-safe failure outcome.

### Implementation Evidence

**Artifacts:**

- `_bmad-output/implementation-artifacts/epic-5-context.md`
- `_bmad-output/implementation-artifacts/spec-5-6-release-gate-finance-admin-mvp.md`
- `_bmad-output/implementation-artifacts/spec-finance-generation-transaction-timeout.md`

**OLD:** Release proof/timeout draft dựa trên 1.000 Student hoặc hướng mở rộng final publish transaction budget.

**NEW:** Evidence dùng 200 Student <= 30 giây với Prisma default 5 giây. Timeout draft được thay bằng outcome: nếu proof pass, đóng spec như no-code remediation; nếu fail, đánh dấu blocked và mở optimization story riêng. Không thêm timeout, lease hoặc migration change.

**Rationale:** Giữ implementation artifacts truthful với canonical decision và loại bỏ hướng sửa đã bị review phát hiện concurrency risk.

### PostgreSQL Integration Test

**Artifact:** `apps/api/src/integration/finance.integration.test.ts`.

**OLD:** Test `generates 1,000 empty DRAFT invoices within sixty seconds without duplicates`, fixture 1.000 Students, assertions total/created/count 1.000, test timeout 70 giây.

**NEW:** Test `generates 200 empty DRAFT invoices within thirty seconds without duplicates`, fixture 200 Students, assertions total/created/count 200, retain `processed: 50` intermediate progress, threshold <= 30.000 ms and Vitest timeout 40 giây.

**Rationale:** Giữ release proof cho end-to-end durable worker lifecycle ở realistic capacity, trong khi batch observation tiếp tục bảo vệ server progress contract.

## 5. Handoff implementation

**Classification:** Moderate, Product/Developer coordination.

**Implementation order:**

1. Phê duyệt proposal này và cập nhật PRD/epics canonical wording.
2. Đồng bộ Epic 5 context, Story 5.6 spec và timeout-remediation artifact.
3. Đổi integration fixture/threshold; không sửa `FinanceService.publishGeneration()` timeout hay lease.
4. Generate Prisma client nếu cần, chạy targeted 200-student proof và full API integration bằng `.env.test`; chạy API typecheck và `git diff --check`.
5. Chỉ khi tất cả pass mới đánh dấu timeout-remediation spec done và xác nhận Epic 6 merge sẵn sàng push.

**Success criteria:** 200-student end-to-end generation completes <= 30 seconds using default Prisma timeout, reports authoritative progress, produces exactly one Invoice per selected Student, and does not add a global/final publish timeout or weaken atomicity/reconciliation.
