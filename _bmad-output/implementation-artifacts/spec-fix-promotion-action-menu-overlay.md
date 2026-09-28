---
title: 'Khac phuc menu tuy chon Finance lam xô dong bang'
type: 'bugfix'
created: '2026-09-28'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'a328cef3fd0ea59fa483ba391e1da9697a0a6130'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/promotion-configuration.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trong bang `Chinh sach uu dai theo Truong`, bam nut `...` cua mot version DRAFT hien nut `Kich hoat phien ban` ben duoi nut trigger va lam hang bang cao len, nhu anh nguoi dung cung cap. Ra soat Admin cho thay cung loi nay o menu assignment, dot thu, nhom khoan thu va hang doi thu tien; cac menu nay lam bang bi xô lech va khac voi pattern Finance da duyet.

**Approach:** Chuyen tat ca menu tuy chon Finance dang nam trong table row sang popover portal neo theo trigger, dung `@base-ui/react` da co de tranh bi clip boi table/dialog scroll. Menu uu tien mo xuong, canh phai trigger va tu flip/shift khi sat mep viewport; khong thay doi chieu cao/cot/routing hay luong kich hoat, ngung version, ket thuc gan, thao tac dot thu, nhom khoan thu va thu tien.

## Boundaries & Constraints

**Always:** Giu dung visual language va interaction cua mockup Finance: menu neo theo trigger, uu tien mo xuong, canh phai, co z-index cao hon bang va khoang cach doc nho. Render menu qua portal ra ngoai scroll container, tu flip len tren va shift ngang khi thieu viewport. Dung `@base-ui/react` da co lam mot owner duy nhat cho roving focus, Escape, outside press va focus return; giu button labels, confirm dialog, authorization va API mutation hien co. Menu phai dung duoc tren desktop va mobile.

**Ask First:** Dung lai neu Base UI Menu khong the giu duoc keyboard/focus behavior hien co khi action mo dialog, hoac can them dependency moi. Mockup `receipt-queue.html` khong dinh nghia overlay cho menu thu tien; chi ap dung pattern Finance chung da duyet neu khong can thay doi labels, action hay geometry ngoai popover.

**Never:** Khong render action menu trong normal document flow hoac ben trong overflow container co the clip. Khong doi CSS toan cuc cua bang hay selector generic `td`/`:has()`, khong thay doi kich thuoc hang de che loi, khong sua backend/API, khong them dependency moi hay tu quan ly portal/geometry khi primitive Base UI co san.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Version DRAFT | Bam `...` trong cot Tuy chon cua policy DRAFT | Menu hien `Kich hoat phien ban` duoi, ben phai trigger; chieu cao hang khong doi | N/A |
| Action policy khac | Bam menu ACTIVE hoac policy version khac | Menu overlay van neo dung row va luong action cu hoat dong | Dong menu theo hanh vi hien co |
| Assignment action | Bam `...` tai bang hoc sinh duoc ap dung | Menu ket thuc gan hien overlay, khong lam xô row | Dong menu theo hanh vi hien co |
| Run/group action | Bam `...` tai bang dot thu hoac dialog nhom khoan thu | Menu thao tac hien overlay, khong lam xô row/dialog | Dong menu theo hanh vi hien co |
| Receipt queue action | Bam `...` tai Hoa don cho thu | Menu thu tien hien overlay, khong lam xô row | Dong menu theo hanh vi hien co |
| Narrow viewport | Bang trong horizontal scroll container, trigger sat mep | Menu khong lam thay doi table geometry, tu flip/shift va van co the bam | Khong clip menu |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx:1122-1123,1243,1693` -- render menu policy, assignment, dot thu va nhom khoan thu truc tiep trong `<td>`; nguon lam row tang chieu cao.
- `apps/web/src/finance/receipt-queue-workspace.tsx:33` -- render menu Hoa don cho thu truc tiep trong `<td>`; cung loi normal flow.
- `apps/web/package.json:15` -- `@base-ui/react` da co san, chua duoc dung; la primitive portal/collision phu hop de giai quyet overflow clipping.
- `apps/web/src/index.css:1613-1633` -- CSS absolute cu va selector generic `td`/`:has()` phai bo; them styling popover portal Finance chi qua class tường minh.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/promotion-configuration.html:3,6` -- UX contract: `details.row-menu` relative va `[role=menu]` absolute `right: 0`, z-index 2.
- `apps/web/src/finance/finance-workspace.test.tsx:79-89,209-223` -- precedent menu overlay va test action kich hoat/focus restoration can giu; mo rong cho policy, assignment, dot thu va nhom.
- `apps/web/src/finance/receipt-queue-workspace.test.tsx` -- test component hang doi thu tien can bo sung assertion overlay.
- `apps/web/e2e/finance-release-gate.spec.ts` -- smoke E2E Finance; them geometry regression row truoc/sau mo menu.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/components/anchored-action-menu.tsx` -- Tao wrapper Base UI Menu portal co placement `bottom-end`, flip/shift collision va class style; primitive la owner focus/Escape/outside press -- tai su dung cho Finance ma khong clip overflow.
- [ ] `apps/web/src/finance/finance-workspace.tsx` -- Thay inline menu policy, assignment, dot thu, khoan thu va nhom khoan thu bang wrapper popover -- loai khoi normal flow ma giu action behavior.
- [ ] `apps/web/src/finance/receipt-queue-workspace.tsx` -- Thay inline menu Hoa don cho thu bang wrapper popover -- loai khoi normal flow ma khong doi action behavior.
- [ ] `apps/web/src/index.css` -- Xoa selector generic `td`/`:has()` va CSS absolute cu; them class style cua Finance portal menu -- gioi han pham vi, giu geometry mockup.
- [ ] `apps/web/src/finance/finance-workspace.test.tsx` va `apps/web/src/finance/receipt-queue-workspace.test.tsx` -- Them assertion primitive portal/action/focus cho tat ca menu Finance -- khoa regression interaction.
- [ ] `apps/web/e2e/finance-release-gate.spec.ts` -- Sua helper geometry dung row to tien, them regression cho promotion, dot thu, nhom khoan thu va receipt queue o desktop/mobile, assert menu visible/khong clip/action click -- chung minh khong day bang va collision dung.

**Acceptance Criteria:**
- Given version DRAFT hien trong bang promotion, when nguoi dung bam `...`, then `Kich hoat phien ban` hien qua portal duoi-can-phai trigger va chieu cao row truoc/sau khi mo khong doi.
- Given nguoi dung chon action policy hoac assignment, when menu duoc mo va action duoc bam, then dialog, mutation va focus restoration hien co van hoat dong.
- Given nguoi dung mo menu dot thu, nhom khoan thu hoac hang doi thu tien, when menu hien, then menu la overlay va row/dialog khong tang chieu cao.
- Given menu Finance duoc render trong scrollable workspace hoac dialog, when trigger sat canh viewport tren desktop hoac mobile, then table/dialog geometry khong bi day gian va menu flip/shift de khong bi che boi container.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- finance-workspace.test.tsx` -- expected: menu/action tests pass.
- `pnpm --filter @passionedu/admin-web test -- receipt-queue-workspace.test.tsx` -- expected: receipt queue menu tests pass.
- `pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: geometry regression khong co layout shift.
- `pnpm --filter @passionedu/admin-web build` -- expected: TypeScript va Vite build pass.
- `git diff --check` -- expected: khong co whitespace error.

**Manual checks:**
- Mo `Uu dai`, bam `...` cua row DRAFT va xac nhan menu de, khong xô row; thu man hinh hep va action kich hoat.
