# Sprint Change Proposal: PromotionPolicy Pha 1b multi-target va batch assignment

**Status:** Approved 2026-09-25

## Issue Summary

Story 5.12 khong the implement an toan vi contract cu chua chot multi-target, lifecycle version, effective interval, stacking va UI quan ly hoc sinh sau khi policy active. Stakeholder da chap thuan contract toi gian cho Pha 1b.

## Approved Contract

- `PromotionPolicy` la identity School-scoped. Moi thay doi cau hinh tao `PromotionPolicyVersion` moi.
- Version co lifecycle `DRAFT -> ACTIVE -> RETIRED`. Version `ACTIVE` va `RETIRED` bat bien ve targets, discount, priority, stacking va interval.
- Mot version co mot hoac nhieu `PromotionPolicyTarget`; moi target tham chieu mot `Receivable` cung School va mot Receivable chi xuat hien mot lan trong version.
- Discount rule dung chung cho toan version: `FIXED_VND | PERCENTAGE`, gia tri server-validated, priority nguyen duong va `STACKABLE | EXCLUSIVE`.
- Cung policy khong co hai version active overlap. UI nhap ngay ket thuc bao gom; API luu interval nua mo `[effectiveFrom, effectiveTo)` voi end optional.
- `StudentPromotionAssignment` la lifecycle rieng cho version `ACTIVE`. Finance co the gan mot hoac nhieu Student cung School trong mot batch atomic, dung chung interval va reason bat buoc. Moi Student co assignment rieng; batch loi thi khong ghi mot record nao va API tra loi theo Student.
- Assignment phai nam tron trong interval version, khong overlap cung Student/cung policy, va ket thuc bang ngay ket thuc + reason, khong hard-delete.
- Evaluator Story 5.13 chi dung `CollectionRun.billingMonth`; `FIXED_VND` truoc `PERCENTAGE`, priority lon hon thang, tie-break theo policy ID, `EXCLUSIVE` loai policy khac cung Receivable target trong ky. Browser khong gui formula, discount, gross, net hay total.
- Pha 1b khong co charge cadence daily/monthly/yearly, target quantity/unit, fulfillment mode, Class/service/attendance auto-eligibility, `PREPAID_COVERAGE`, Receipt, settlement, carry hay refund.

## Impact And Handoff

Direct adjustment scope moderate trong Epic 5. Story 5.12 owns policy/version/target/assignment configuration; Story 5.13 owns evaluation and stale preview; Story 5.14 owns Issue recheck/snapshot; Story 5.15 owns release proof. Final PRD, Spine, SPEC va epics giu nguyen theo repository policy; proposal nay va decision companion la build input da duyet cho Story 5.12.

UX update giu destination `Ưu đãi` table-first, them multi-target picker, policy detail, batch assignment va end-assignment flow. Khi timeout, client reconcile Operation; khi doi School, client clear state va chan response stale.
