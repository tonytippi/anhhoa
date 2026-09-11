---
title: 'Mockup danh sach va tao dot thu'
type: 'feature'
created: '2026-09-10'
status: 'done'
baseline_commit: '055448c118b18e0092bb7ba50757b00882198b62'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `invoice-generation.html` hien chi la preview cua mot dot thu thang, nen Ke toan khong co noi de xem cac dot thu da tao, trang thai va thong ke truoc khi bat dau dot moi. Tham khao van hanh cho thay can danh sach dot thu co tong quan thu va mot luong tao dot cho phep chon them cac khoan ngoai hoc phi.

**Approach:** Doi trang thanh landing `Dot thu`, bao gom danh sach lich su co thong ke server-provided va CTA mo luong tao CollectionRun moi. Luong tao chon Receivable dang active, dung pham vi va hieu luc de bo sung vao dot thu; preview authoritative va generate giu dung lifecycle Finance hien co.

## Boundaries & Constraints

**Always:** Day la mockup UX va static interaction, khong tao API, persistence hay client-side finance engine. Hien lich su voi ky, loai run, trang thai, so Invoice tao/skip, gross/uu dai/net, thoi diem-va-phien-ban tinh; technical ID chi hien trong disclosure. Run thuong tuan theo `DRAFT -> READY -> GENERATED -> CLOSED`; browser chi render eligibility, VND integer, discount, total va status do server tra ve. Khoan bo sung phai la Receivable trong catalog dang active, dung School/scope/effective period; khong phai dong tien ad-hoc. Preview phan loai skip va cho phep generate chi sau READY; high-impact generate dung confirmation, idempotency va Operation reconciliation khi timeout. `PREPAID_COVERAGE` la dedicated `PREPAID` run, School Admin-only, exact settlement va coverage chi sau PAID; khong tron vao tao run thuong.

**Ask First:** Them loai CollectionRun ngoai `MONTHLY`, `ANNUAL`, `ONE_OFF`; cho phep nhap khoan thu/so tien tu do trong run; doi Finance lifecycle, scope/eligibility, policy, settlement hay them API/data model.

**Never:** Khong copy giao dien Kidsonline; khong tinh tong/giam tru/eligibility tai client; khong sua Invoice da issue; khong cho Parent tao run/prepaid; khong tao gia rieng theo Student, generic credit/balance, partial, excess, unallocated hoac mixed-Student settlement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Mo Dot thu | Ke toan vao trang | Thay danh sach dot thu cu, bo loc mockup, statistics va CTA tao moi. | So lieu ghi ro la server-confirmed, khong suy dien tu browser state. |
| Tao run thuong | Ke toan chon ky, scope va Receivable bo sung | Form chi liet ke Receivable eligible; preview READY hien composition, skips va tong VND server-returned. | Receivable khong active/dung scope/het hieu luc bi tu choi voi ly do server-side. |
| Generate | Preview READY da duoc review | CTA confirmed tao Invoice DRAFT idempotent va giu Operation de reconcile. | Timeout khong la that bai; doi soat Operation truoc retry. |
| Prepaid | School Admin chon policy/start period | Chuyen sang sub-flow `PREPAID` rieng, khong them nhu charge cua run thuong. | Parent va actor khong du quyen khong co mutation. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- doi route preview mot run thanh landing danh sach/tao run; giu projection preview, generate va prepaid boundary trong mot route khong song song.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:37-146,428-458` -- reuse confirmation, `data-idempotent-action`, known Operation va reconcile truoc retry; them state UI toi thieu cho mo/dong form tao run, khong them finance calculation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:28-66` -- catalog la nguon UX cho Receivable/scope/quantity; lien ket ngu can duoc cap nhat neu copy route doi.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html:19-39` -- giu la diem den review Invoice DRAFT va receipt, khong dua settlement vao dashboard run.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:124-127` -- CollectionRun lifecycle va run bo sung la contract UX phai bao toan.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:55-67` -- mo rong static assertions cho list, create wizard, authoritative preview/generate va prepaid isolation.
- `docs/kidsonline/dot-thu-thong-ke.png` va `docs/kidsonline/tao-dot-thu.png` -- evidence tham khao van hanh, khong la visual contract.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- tao dashboard danh sach dot thu, statistics va create/preview flow; bo sung Receivable catalog selection ngoai hoc phi trong boundary server-authoritative.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- bind cac control danh sach/tao moi va reuse idempotent Operation flow, khong duy tri tong tien hay eligibility o client.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- them assertions/negative assertions cho list, lifecycle, Receivable selection, generate reconciliation va prepaid boundary.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- cap nhat inventory de phan anh trang Dot thu la landing danh sach va tao run.

**Acceptance Criteria:**
- Given Ke toan mo Dot thu, when xem trang, then thay cac dot cu voi ky, loai, trang thai, Invoice tao/skip, gross/uu dai/net va thoi diem tinh do server xac nhan.
- Given Ke toan tao dot moi, when chon khoan thu bo sung, then chi Receivable active/dung scope/hieu luc duoc de xuat, khong co input tong tien hay gia rieng hoc sinh.
- Given run chua READY, when Ke toan xem action, then khong the generate; Given preview READY, when confirm generate, then mockup bao ve idempotency va reconciliation sau timeout.
- Given mot policy prepaid du dieu kien, when School Admin chon, then flow van la `PREPAID` dedicated va khong duoc the hien nhu khoan them cua run thuong.

## Design Notes

Trang co hai lop: bang lich su la diem vao mac dinh; form tao moi la progressive disclosure de khong che phu tong quan. Preview la server projection sau khi chon ky/scope/Receivable, khong phai preview tinh tai browser. Cac khoan bo sung duoc nhom theo hoc phi va dich vu/catalog, de Ke toan hieu day la chon nghia vu thu da cau hinh chu khong tao gia moi.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: mockup contract checks passed.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: no syntax errors.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Trang va lifecycle**

- Landing giu lich su, tao moi va prepaid theo ba vung khong tron state.
  [`invoice-generation.html:19`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L19)

- Form chi chon Receivable du dieu kien va cho preview authoritative truoc generate.
  [`invoice-generation.html:31`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L31)

- `READY` da luu duoc hydrate dung snapshot; sua cau hinh huy ket qua cu.
  [`prototype.js:527`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L527)

**Ranh gioi Finance**

- Prepaid van la dedicated run cua School Admin, tach khoi khoan thu bo sung.
  [`invoice-generation.html:49`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L49)

**Bang chung**

- Static contract bao ve landing, preview, snapshot invalidation va prepaid isolation.
  [`test-rendered-mockup-contracts.mjs:65`](test-rendered-mockup-contracts.mjs#L65)

- Inventory xac nhan pham vi mockup cho review UX tiep theo.
  [`MOCKUP-COVERAGE.md:20`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L20)
