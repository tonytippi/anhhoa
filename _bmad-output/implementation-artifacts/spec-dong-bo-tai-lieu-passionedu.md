---
title: 'Đồng bộ tài liệu PassionEdu sau review readiness'
type: 'chore'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
baseline_commit: '5347cb7b6b11a8778107d61e389a861bb38fe487'
context:
  - '_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bộ tài liệu PassionEdu ở commit hiện tại còn giữ một số contract mâu thuẫn và report UX dựa trên Anh Hoa đã superseded. Các mâu thuẫn này làm implementer có thể xây sai settlement, authorization Staff, coverage refund hoặc thứ tự phát hành epic.

**Approach:** Đồng bộ các artifact canonical theo contract PassionEdu final, làm rõ các lifecycle/authorization còn thiếu và xóa các tài liệu UX cũ có thể bị đọc như nguồn yêu cầu hiện hành.

## Boundaries & Constraints

**Always:** Giữ PassionEdu là sản phẩm multi-school clean-break; PRD, Architecture Spine, SPEC, UX và epics phải nhất quán; normal receipt settlement luôn exact, không có `PARTIALLY_PAID`; mọi sửa đổi viết bằng tiếng Việt và giữ các artifact legacy Ánh Hoa chỉ để truy vết.

**Ask First:** Dừng hỏi nếu cần thay đổi phạm vi sản phẩm, lifecycle finance ngoài các finding đã review, hoặc sửa artifact final ngoài bộ PassionEdu liên quan trực tiếp.

**Never:** Không thay đổi code, schema hoặc artifact legacy Anh Hoa; không thêm compatibility layer; không giữ report UX dùng PRD/Architecture Ánh Hoa như nguồn áp dụng cho PassionEdu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Exact settlement | Canonical SPEC kèm addendum | Addendum chỉ yêu cầu exact settlement fixture | Không còn chỉ dẫn partial payment |
| Staff attendance | Staff profile, login và assignment tách biệt | Contract xác định binding/capability/scope trước E4 | Từ chối identity, capability hoặc assignment không hợp lệ |
| Coverage refund | Coverage nhiều kỳ hoặc kỳ tùy ý | Có interval, source payment, lifecycle và denominator rõ | Từ chối overlap, không có nguồn paid hoặc zero-day denominator |
| Run close | Run GENERATED còn DRAFT Invoice | Close chỉ hợp lệ khi Invoice terminal | Trả state conflict, không khóa DRAFT vĩnh viễn |
| Obsolete UX review | Report dựa trên Anh Hoa legacy | File bị xóa khỏi bộ UX PassionEdu | Không còn source mâu thuẫn để downstream dùng |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md` -- nguồn functional contract cho identity, finance, coverage và release order.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md` -- companion verification matrix, cần loại bỏ fixture partial payment cũ.
- `_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md` -- invariant tenant, finance, Staff authorization và idempotency.
- `_bmad-output/specs/spec-passionedu/SPEC.md` -- canonical concise contract và danh sách companions.
- `_bmad-output/planning-artifacts/epics-passionedu.md` -- release dependencies và acceptance criteria của Epic 1, 4, 5, 6.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- behavior cho finance mutation/policy branches.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-05.md` -- historical approved change record cần phản ánh artifact đã được áp dụng.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/reconcile-sources.md` -- obsolete report cần xóa vì sử dụng baseline Anh Hoa superseded.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/review-rubric.md` -- stale report cần xóa vì findings đã không còn đúng với artifact final.

## Tasks & Acceptance

**Execution:**
- [x] Các canonical PRD/addendum/Spine/SPEC -- đồng bộ exact-settlement verification, Staff authorization, coverage/refund and provision contracts -- loại bỏ mâu thuẫn build-critical.
- [x] `epics-passionedu.md` -- điều chỉnh Epic 4/5/6 dependency và acceptance criteria -- mọi story có thể hoàn thành theo release order mà không tạo finance behavior ngầm.
- [x] `EXPERIENCE.md` -- đặc tả nhánh `DIRECT` và `SCHOOL_ADMIN_APPROVAL` -- UI phản ánh đúng FinancePolicy.
- [x] `sprint-change-proposal-2026-09-05.md` -- ghi nhận thay đổi đã được áp dụng -- proposal không còn diễn tả contract final là pending.
- [x] UX review artifacts cũ -- xóa `reconcile-sources.md`, `review-rubric.md` và review accessibility stale nếu không được revalidated -- downstream không còn nguồn yêu cầu mâu thuẫn.

**Acceptance Criteria:**
- Given implementer đọc bất kỳ canonical companion nào, when xây finance settlement, then không có tài liệu nào yêu cầu hoặc ngụ ý partial settlement.
- Given Staff đăng nhập và ghi attendance/handover, when server authorize request, then contract xác định identity binding, role capability, class scope và effective-date checks.
- Given coverage paid bị withdrawal/transfer, when refund preview được tạo, then mọi input thời gian, nguồn tiền, rounding và zero-denominator outcome đều xác định được.
- Given CollectionRun được close, when còn DRAFT Invoice, then server từ chối close hoặc lifecycle sau close được định nghĩa không mơ hồ.
- Given downstream mở thư mục UX PassionEdu, when tìm source yêu cầu, then không còn report dựa trên Anh Hoa legacy hoặc finding stale.

## Spec Change Log

- Review loop 1: Bổ sung `PAID` vào điều kiện đóng CollectionRun; thống nhất SchoolYear cho settlement; giới hạn refund override theo nguồn còn lại; làm rõ source/calendar/lifecycle coverage, Platform Operation và nhánh UX `DIRECT`. Tránh run không thể đóng, cross-year settlement, over-refund và contract authorization/idempotency mơ hồ. Giữ exact settlement, multi-school clean-break và việc xóa review UX stale.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `rg -n 'partial payment|PARTIALLY_PAID|pending artifact application|prd-anhhoa-2026-08-18' _bmad-output/planning-artifacts _bmad-output/specs` -- expected: chỉ còn tham chiếu historical/superseded có chủ đích, không còn canonical requirement mâu thuẫn.

**Manual checks (if no CLI):**
- Đối chiếu PRD, Spine, SPEC, UX và epics cho settlement, Staff authorization, coverage refund, CollectionRun close và proposal status.

## Suggested Review Order

**Canonical Finance Contract**

- Xác định settlement, coverage và refund trước khi đọc chi tiết story.
  [`prd.md:162`](../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md#L162)

- Giữ tenant, SchoolYear và lifecycle tại ranh giới server.
  [`ARCHITECTURE-SPINE.md:92`](../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md#L92)

- Kiểm tra contract tóm tắt mà downstream dùng làm nguồn canonical.
  [`SPEC.md:28`](../specs/spec-passionedu/SPEC.md#L28)

**Authorization And Delivery**

- Rà binding Staff và provision Operation trước khi dựng API routes.
  [`prd.md:87`](../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md#L87)

- Xác nhận dependency Epic 4/5 và acceptance finance thực thi được.
  [`epics-passionedu.md:180`](../planning-artifacts/epics-passionedu.md#L180)

- Kiểm tra UI phản ánh hai nhánh correction/reversal theo policy.
  [`EXPERIENCE.md:58`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L58)

**Historical Traceability**

- Xác nhận proposal đã được áp dụng, không còn là quyết định pending.
  [`sprint-change-proposal-2026-09-05.md:1`](../planning-artifacts/sprint-change-proposal-2026-09-05.md#L1)
