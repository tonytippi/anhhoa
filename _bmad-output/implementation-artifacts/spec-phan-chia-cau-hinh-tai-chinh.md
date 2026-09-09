---
title: 'Phân chia cấu hình Tài chính'
type: 'refactor'
created: '2026-09-09'
status: 'done'
baseline_commit: '660febd771c922f39fc2878609560b27907f8a77'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cấu hình Khoản thu hiện tập trung catalog, phạm vi tính phí và chương trình nộp trước, trong khi các nội dung vận hành như phí đón muộn chưa được nhận diện thành một vùng cấu hình riêng. Phí đón muộn cần được tính theo block cấu hình, dựa trên thời điểm trả trẻ đã ghi nhận.

**Approach:** Tổ chức lại mockup route `Khoản thu` thành bốn vùng cấu hình dễ nhận biết: Khoản thu, Phạm vi áp dụng, Phí đón muộn và Phí nộp tiền muộn. Phí đón muộn là bảng block có thời gian bắt đầu/kết thúc và giá VND/block, được server dùng cùng thời điểm trả trẻ để tính dòng phí có snapshot. Thêm trang thống kê đón muộn theo học sinh-ngày để rà soát source trả trẻ, tổng block và tổng phí do server xác nhận. Giữ chương trình nộp trước là vùng phụ độc lập; vùng phí nộp tiền muộn chỉ ghi nhận chưa được mở trong contract hiện hành, không giả định policy hoặc cơ chế tính mới.

## Boundaries & Constraints

**Always:** Duy trì School/Năm học và server-authoritative wording. Catalog `Receivable`/`ReceivableGroup` vẫn thuộc School, có đơn vị, đơn giá VND nguyên, trạng thái, hiệu lực, audit và không thay snapshot Invoice đã phát hành. Phạm vi `ChargeRule` phải thể hiện `SCHOOL`, `CLASS`, `STUDENT`, precedence `STUDENT > CLASS > SCHOOL`, hiệu lực và việc server từ chối conflict cùng độ đặc hiệu. Phí đón muộn là policy typed/versioned theo School và hiệu lực, gồm các block không chồng lấn với giờ bắt đầu/kết thúc, giá VND nguyên và đơn vị `/ block`; block được tính khi thời điểm trả trẻ đã xác nhận bằng hoặc sau giờ bắt đầu của block. Giờ kết thúc chỉ phân tách block, không kích hoạt block kế; khoảng trống không sinh block mới, không làm tròn sang block sau và giữ nguyên tổng các block đã đạt. Server dùng thời điểm trả trẻ đã xác nhận, cộng giá mọi block đã đạt, materialize khoản phí và snapshot policy/block/source handover. Sau materialization không điều chỉnh hoặc hoàn tiền nếu thời điểm trả trẻ bị sửa. Browser không được tự tính, làm tròn hoặc tự tạo dòng phí; Invoice đã phát hành không thay đổi. Hạn thu và công nợ vẫn là FinancePolicy/snapshot của CollectionRun. Giữ PrepaidPaymentPromotionProgram và coverage/refund tách catalog, exact settlement và School Admin-only source creation.

**Ask First:** Exemption/override, thời điểm materialize charge trong lifecycle và cách xử lý khi handover bị sửa trước materialization. Bật phí nộp tiền muộn thực tế; định nghĩa rate, grace, compounding, exemption, phạm vi, ledger/invoice behavior hoặc quyền mới. Thay đổi PRD, SPEC, lifecycle, API, persistence, authorization hay bất kỳ quy tắc tài chính nào ngoài mockup.

**Never:** Không sao chép visual identity hoặc copy của Kidsonline. Không để browser tự tính phí từ operational facts, thêm tax/VAT model, hành động client đổi trạng thái Invoice/Receipt, partial/unallocated/mixed-Student settlement, hay coi browser/School context là authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Mở cấu hình | Finance Manager mở Khoản thu | Thấy bốn vùng rõ ràng và catalog trước; mọi giá/tổng là dữ liệu máy chủ cho kỳ mới. | Loading/empty/error/permission của catalog giữ wording server-authoritative. |
| Xem phạm vi | Mở phạm vi của Học phí tháng | Thấy School/Class/Student, precedence, hiệu lực, audit và snapshot Invoice immutable. | Conflict cùng precedence được ghi rõ là server từ chối, không tự resolve. |
| Tính phí đón muộn | Trả trẻ lúc 18:00 với block 17:38-18:00, 18:05-18:30 và 18:30-19:00 | Tổng là 20.000 đ: đạt block bắt đầu 17:38, chưa đạt block 18:05. | Browser không tính; server snapshot block/source khi materialize. |
| Tính phí qua gap | Trả trẻ lúc 18:04 với cùng policy | Tổng vẫn là 20.000 đ; gap không sinh block mới. | Không làm tròn/nhảy sang block sau. |
| Tính phí cộng dồn | Trả trẻ lúc 18:35 với cùng policy | Tổng là 260.000 đ, bằng tổng 20.000 + 40.000 + 200.000 đ của các block đã đạt. | Không điều chỉnh/hoàn tiền sau materialization nếu handover bị sửa. |
| Xem phí đón muộn | Mở policy đón muộn hiệu lực | Thấy từng block có giờ bắt đầu/kết thúc, giá VND/block, hiệu lực và audit; thời điểm trả trẻ là source fact do server xác nhận. | Block chồng lấn/không hợp lệ bị server từ chối; browser không tính phí hay sửa Invoice đã issued. |
| Rà soát thống kê | Finance Manager chọn đợt thu hoặc khoảng 01-09/09/2026 | Ma trận học sinh-ngày hiện tên/mã, lớp/khối, tổng số block và tổng VND theo học sinh; từng ô ngày hiện giờ trả trẻ, block và VND khi phát sinh. | Ngày không có trả trẻ muộn để trống; loading/empty/error/no-permission theo dữ liệu server, không suy diễn client. |
| Xem phí nộp muộn | Release chưa có contract fee | Thấy trạng thái chưa cấu hình cùng link/ràng buộc hạn thu-công nợ hiện có. | Không hiển thị rate, CTA lưu hay kết quả tiền giả định. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:14-127` -- route cần đổi copy/header, tách catalog tại `28-97`, thay section rule `99-113` bằng Phạm vi áp dụng rõ nghĩa, thêm hai vùng policy trước Prepaid giữ ở `115-127`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/late-pickup-statistics.html` -- tạo route thống kê đón muộn riêng: filter đợt thu/khoảng ngày, export chỉ là mockup, tìm kiếm, phân trang và ma trận học sinh-ngày server-fixture.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- tái dùng route head, card, table wrap, notice, badge và responsive table; chỉ bổ sung style nếu component có sẵn không biểu đạt được trạng thái policy/read-only.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:4-10,54-67` -- tải route Khoản thu và thêm assertions về bốn vùng, manual-only late pickup, deferred late-payment và Prepaid tách biệt.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:18,35,39-42` -- cập nhật inventory và ranh giới liên thông Finance; không dùng tài liệu này để mở contract mới.
- `_bmad-output/specs/spec-passionedu/SPEC.md:64-71` -- chỉ đọc: thay đổi này cần decision/contract cập nhật để cho phép server-side pricing từ time-of-pickup.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md:160-168,240-247` -- chỉ đọc: nguồn truth catalog/scope; đoạn late-pickup manual/reference phải được thay thế bởi decision được duyệt trước API/persistence.

## Tasks & Acceptance

**Execution:**
- [x] Decision artifact phù hợp -- chốt contract server-side cho bảng block, source time-of-pickup, semantics, snapshot, materialization và correction -- thay thế ranh giới manual/reference của contract hiện hành trước API/persistence.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- phân vùng rõ Catalog, Phạm vi áp dụng, Phí đón muộn, Phí nộp tiền muộn và giữ Prepaid tách biệt; biểu diễn bảng block đón muộn cùng entry point tới thống kê -- để phản ánh mental model cấu hình Finance và server-side calculation contract.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/late-pickup-statistics.html` -- tạo trang thống kê đón muộn ma trận học sinh-ngày -- giúp Finance đối chiếu giờ trả trẻ, block và VND trước/sau materialization mà không tự tính trên browser.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- kiểm tra các section, bảng block/source handover, deferred late-payment và ranh giới Prepaid -- chống regression thành client-calculated fee hoặc late-payment model ngầm.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- mô tả bốn vùng và late-payment deferred -- giữ phạm vi review nhất quán.

**Acceptance Criteria:**
- Given Finance Manager mở Khoản thu, when nhìn phần cấu hình, then nhận biết được Khoản thu, Phạm vi áp dụng, Phí đón muộn và Phí nộp tiền muộn bằng heading/copy độc lập; catalog và CTA tạo đợt thu vẫn hoạt động như trước.
- Given reviewer xem Phạm vi áp dụng, when mở chi tiết khoản thu, then thấy scope, precedence, hiệu lực, audit và server conflict boundary; Invoice đã phát hành vẫn immutable.
- Given thời điểm trả trẻ đúng giờ kết thúc block hoặc nằm trong gap, when server tính phí, then không đạt block tiếp theo và giữ tổng các block đã đạt.
- Given thời điểm trả trẻ đạt nhiều block, when server materialize khoản phí, then tổng là giá VND nguyên cộng dồn của mọi block đạt và snapshot policy/block/source; sau đó không điều chỉnh/hoàn tiền khi handover bị sửa.
- Given reviewer xem Phí đón muộn, when đọc policy, then thấy block thời gian, VND/block, hiệu lực, audit và thời điểm trả trẻ là source fact cho server-side calculation; browser không tự tính hay sửa Invoice đã issued.
- Given Finance Manager mở thống kê đón muộn, when chọn đợt thu hoặc khoảng ngày, then thấy ma trận học sinh-ngày với tên/mã, lớp/khối, tổng số block, tổng VND và giờ trả trẻ từng ngày do server trả về.
- Given một ô ngày có phát sinh đón muộn, when reviewer xem ô đó, then thấy giờ trả trẻ và block/VND materialized; ngày không phát sinh để trống, không hiển thị tổng do browser tự cộng.
- Given reviewer xem Phí nộp tiền muộn, when release chưa có contract tương ứng, then thấy trạng thái chưa cấu hình và due date/debt hiện hữu, không có rate, tính tiền hoặc CTA giả định.
- Given chạy kiểm thử mockup, when assertions đọc route, then kiểm chứng được cả bốn vùng, ranh giới manual/deferred và Prepaid riêng biệt.

## Design Notes

Bốn vùng là taxonomy UI, không phải bốn engine tính tiền. Phạm vi vẫn là biểu đạt của `ChargeRule`; đón muộn là pricing policy server-side riêng, lấy thời điểm trả trẻ đã xác nhận làm source fact và snapshot policy/block khi materialize charge. Một block được tính từ giờ bắt đầu; giờ kết thúc chỉ phân tách block. Gap không làm tròn hoặc kích hoạt block tiếp theo; tổng phí cộng dồn tất cả block đã đạt. Khi phí đã materialize, hậu sửa handover không làm adjustment/refund. Thống kê đón muộn là ma trận review theo học sinh-ngày, không phải nguồn tính lại: row summary và cell block/VND đều là fixture server. Phí nộp muộn chưa có product/finance contract nên dùng empty/deferred state minh bạch thay vì mock một cơ chế có thể bị hiểu là yêu cầu đã được duyệt.

## Spec Change Log

- Review loop 1: Review phát hiện câu interval nửa mở mâu thuẫn với ví dụ đã chốt `18:00` tính block bắt đầu `17:38`. Human xác nhận block được tính khi thời điểm trả trẻ bằng hoặc sau giờ bắt đầu; đã thay wording trong intent, matrix và design notes để tránh implementation loại block tại giờ kết thúc. Giữ bốn vùng cấu hình, gap không làm tròn, tổng block cộng dồn, server-authoritative calculation và deferred late-payment.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: toàn bộ mockup contract checks passed.
- `git diff --check` -- expected: không có lỗi whitespace.

**Manual checks:**
- Mở `mockups/admin/receivable-configuration.html` ở desktop và viewport hẹp; kiểm tra thứ tự section, table scroll, disclosure và CTA Prepaid/CollectionRun không đổi.
- Đọc section đón muộn để xác nhận bảng block, source thời điểm trả trẻ và server-side calculation; đọc section nộp muộn để xác nhận không ngụ ý fee policy chưa được quyết định.
- Mở `mockups/admin/late-pickup-statistics.html` ở desktop và viewport hẹp; kiểm tra filter, cột nhận diện cố định, ngày ngang cuộn được, cell giờ trả trẻ/block/VND và empty state.

## Suggested Review Order

**Quy tắc tính block**

- Chốt source fact, ngưỡng đạt block, gap và snapshot trước khi xây server-side pricing.
  [`decision-late-pickup-server-pricing-2026-09-09.md:7`](decision-late-pickup-server-pricing-2026-09-09.md#L7)

- Giữ các quyết định lifecycle chưa chốt ngoài phạm vi mockup/API hiện tại.
  [`decision-late-pickup-server-pricing-2026-09-09.md:11`](decision-late-pickup-server-pricing-2026-09-09.md#L11)

**Cấu hình Finance**

- Catalog giữ vị trí đầu tiên, sau đó phân tách rõ phạm vi và hai chính sách phí.
  [`receivable-configuration.html:28`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L28)

- Phạm vi áp dụng diễn đạt precedence và server conflict thay vì tự resolve ở browser.
  [`receivable-configuration.html:99`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L99)

- Policy đón muộn hiển thị block/server snapshot và dẫn tới màn hình rà soát riêng.
  [`receivable-configuration.html:115`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L115)

- Phí nộp muộn minh bạch deferred, không ngầm đưa rate hay engine mới.
  [`receivable-configuration.html:127`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L127)

**Rà soát phát sinh**

- Ma trận theo học sinh-ngày giữ giờ trả trẻ, block và VND do server trả về.
  [`late-pickup-statistics.html:33`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/late-pickup-statistics.html#L33)

- Static filter không điều hướng hay tính lại fixture cục bộ.
  [`prototype.js:442`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L442)

**Contract checks**

- Assertions khóa các vùng cấu hình, semantics block và ma trận thống kê.
  [`test-rendered-mockup-contracts.mjs:68`](test-rendered-mockup-contracts.mjs#L68)
