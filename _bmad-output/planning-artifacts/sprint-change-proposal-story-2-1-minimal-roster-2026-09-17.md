---
title: "Sprint Change Proposal - Thu gọn contract Story 2.1"
status: approved
approved: 2026-09-17
created: 2026-09-17
trigger: "Quyết định của Product Owner trong Build Auto Story 2.1"
affected_epics: [2]
---

# Sprint Change Proposal - Thu gọn contract Story 2.1

## 1. Issue Summary

Build Auto phát hiện contract Story 2.1 chưa chốt đầy đủ và có nguy cơ kéo Student hoặc finance vào một story nền tảng. Product Owner yêu cầu giữ implementation đơn giản, không đưa học phí vào Class, và không coi SchoolYear là đối tượng chỉnh ngày thường xuyên.

## 2. Impact Analysis

- Epic 2: Story 2.1 chỉ thiết lập boundary SchoolYear/Class tối thiểu; Story 2.2 vẫn là owner duy nhất của Student/enrollment và archive guard có `activeStudentCount`.
- Finance: `monthlyFee` không thuộc `Class`; khoản thu và giá tiền do finance receivable/rule sở hữu ở Epic 5.
- API/UX: chỉ cần quản lý SchoolYear và Class tenant-scoped. Không có date-editing workflow, Student list, archive flow hoặc error metadata Student trong Story 2.1.
- Architecture: không đổi invariants tenant, authorization, CSRF, audit, Operation/idempotency hoặc VND integer. Không có migration Student sớm.

## 3. Recommended Approach

**Chọn: Direct Adjustment, phạm vi tối giản.**

SchoolYear được tạo với nhãn và khoảng thời gian business (`startsOn`, `endsOn`); status active là server-derived từ ngày hiện tại theo `Asia/Ho_Chi_Minh`, không có mutation đổi ngày hoặc đổi trạng thái trong Story 2.1. Class có `name`, `schoolYearId` và trạng thái `ACTIVE`; Class không có `monthlyFee`, không có Student relation, và không có archive trong Story 2.1. Các lifecycle/migration cần Student được giao cho Story 2.2.

Phạm vi: Minor. Rủi ro thấp vì không thay đổi artifact final hoặc invariant liên epic.

## 4. Detailed Change Proposals

### Story 2.1 - Scope và acceptance refinement

**OLD:**

```text
SchoolYear/Class form quản lý Class, với refinement Class có monthlyFee, archive và activeStudentCount.
```

**NEW:**

```text
- School Admin tạo SchoolYear trong selected active School với name, startsOn và endsOn; startsOn phải trước endsOn. API không hỗ trợ update ngày hoặc status trong Story 2.1.
- Server coi SchoolYear active khi business date Asia/Ho_Chi_Minh nằm trong [startsOn, endsOn); database bảo đảm một School không có hai interval SchoolYear overlap. Không cần một active-state mutation riêng.
- School Admin tạo và sửa tên Class thuộc một SchoolYear của selected School. Tên được trim, không rỗng sau trim, tối đa 100 ký tự và được phép trùng.
- Class chỉ có name, schoolYearId, status ACTIVE và timestamps trong Story 2.1. Không có monthlyFee, effective interval, Student relation, Student list, activeStudentCount hoặc archive endpoint.
- Mọi read/write vẫn server-authorized, School-scoped, có CSRF/origin protection cho cookie mutation, audit và idempotent Operation theo contract nền tảng. UI giữ input và fieldErrors khi validation/context failure, và hiển thị School/SchoolYear rõ ràng.
```

**Rationale:** Giữ SchoolYear/Class là nền boundary cho danh bộ, không triển khai trước Student lifecycle hoặc finance pricing.

### Story 2.2 - Deferred ownership

**NEW:**

```text
Story 2.2 bổ sung Student/enrollment, Class archive, activeStudentCount và cùng transaction lock/revalidation để chặn quan hệ Student ACTIVE với Class archived.
```

**Rationale:** Archive chỉ có ý nghĩa khi Student đã tồn tại; đặt toàn bộ invariant đó trong story sở hữu Student tránh schema tạm thời và API nửa vời.

## 5. Implementation Handoff

Developer triển khai Story 2.1 theo contract trên, không chỉnh artifact final. Thành công khi School Admin có thể quản lý SchoolYear/Class trong tenant đã chọn, không tạo dữ liệu cross-School, không có monthlyFee/Student/archive surface, và portal thể hiện đúng context/error contract.
