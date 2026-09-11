---
title: 'Chi tiet dot thu theo hoc sinh'
type: 'feature'
created: '2026-09-11'
status: 'done'
baseline_commit: '7d1dc59d4f877122d34a8c313a3a8ed85c5bd3e5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trang Dot thu dang dua `PREPAID` vao danh sach va mot luong van hanh rieng. Quan ly/Kế toan chi can theo doi trong tung dot thu: thu hoc sinh nao, bao nhieu tien, da thu/chua thu va cac khoan tren hoa don; hai danh sach run va prepaid lam tang tai nhan thuc. Trang hien tai cung chua co chi tiet dot thu theo hoc sinh nhu thao tac quen thuoc cua Kidsonline.

**Approach:** Loai bo `PREPAID` khoi giao dien Dot thu va chi liet ke cac dot thu van hanh. Click mot dot mo chi tiet co summary server-returned va bang theo hoc sinh: khoan thu snapshot, gross/uu dai/net, da thu/con phai thu, trang thai Invoice va ly do khong tao. Click hoc sinh co Invoice di den chi tiet Invoice; hoc sinh khong co Invoice do coverage mo projection chi doc. Dung bo cuc thao tac danh sach/chi tiet quen thuoc tu Kidsonline lam tham khao, nhung giu visual language PassionEdu va khong copy giao dien.

## Boundaries & Constraints

**Always:** Day la mockup static, khong tao API, data model hay client evaluator. Dot thu la mental model van hanh duy nhat tren trang nay; so lieu, Invoice snapshot, VND, uu dai, settlement, eligibility va status do server tra ve. Detail run hien Student/lop, cac Receivable snapshot, gross/uu dai/net, da thu/con phai thu, Invoice status va ly do excluded. `PREPAID_COVERAGE` la implementation/source-provenance o backend, khong la loai dot thu hay thao tac tren trang nay; normal run chi skip dung receivable-period facts da cover. Khoan da cover khong tao dong am/0 dong; neu con khoan thu khac thi Invoice chi chua phan con phai thu, neu khong con thi Student hien projection "Khong tao hoa don" chi doc. Parent khong co mutation.

**Ask First:** Dua thao tac gan/chon policy dong truoc vao Dot thu, hien danh sach/source run PREPAID, cho Finance nhap discount/target/coverage bang tay, thay doi exact settlement/refund, hoac hien thuc backend/schema/API.

**Never:** Khong hien `PREPAID` nhu mot row/tab/flow rieng tren Dot thu; khong copy visual identity/copy cua Kidsonline; khong tinh money/eligibility o browser; khong tao Invoice gia 0 dong, dong am, partial/excess/unallocated/mixed-Student settlement hay generic balance.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Mo chi tiet dot thu | Ke toan click mot dot thu | Thay summary va bang Student theo snapshot server tra ve. | Khong duoc suy dien status/tong tien tu browser state. |
| Student co Invoice | Ke toan click hoc sinh con nghia vu | Mo chi tiet Invoice voi cac khoan thu snapshot va uu dai da ap dung. | Invoice da issue chi doc; settlement exact la server-authoritative. |
| Student da cover | Tat ca khoan hop le trong ky da cover | Hien projection chi doc "Khong tao hoa don" va reason/provenance toi thieu. | Khong tao Invoice 0 dong hoac dong tien am; link truy vet chi cho Finance. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html:19-55` -- doi list row thanh diem vao detail Student/Invoice va bo vung PREPAID.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:527-583` -- reuse state detail/list va idempotent generate; them static detail transition, khong them calculator.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:65-86` -- them assertions cho Student detail/Invoice/projection coverage va negative assertion PREPAID UI.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html:19-39` -- tai su dung diem den Invoice detail, khong tao invoice view song song.
- `docs/kidsonline/chi-tiet-dot-thu.png` -- tham khao thao tac list Student/thong ke, khong la visual contract.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- bo PREPAID UI va them detail dot thu theo Student, Invoice/projection navigation va metrics server-authoritative.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- them transition list/detail va Student-to-Invoice/projection toi thieu, khong tinh client-side.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- bao ve detail Student/Invoice/coverage projection va cam PREPAID UI.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- dong bo inventory voi mental model Dot thu duy nhat.

**Acceptance Criteria:**
- Given Ke toan click mot dot thu, when chi tiet mo, then thay Student list va totals server-returned thay vi danh sach PREPAID.
- Given Ke toan click Student co Invoice, when xem chi tiet, then di den Invoice snapshot co khoan thu/uu dai cua Student do.
- Given Student da cover toan bo khoan thu, when xem dong Student, then thay projection chi doc va reason, khong co Invoice 0 dong.
- Given static contract test chay, when doc mockup, then xac minh duoc detail Student/Invoice/projection va khong con PREPAID UI tren Dot thu.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: mockup contract checks passed.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: no syntax errors.
- `git diff --check` -- expected: no whitespace errors.
