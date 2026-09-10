- source_spec: none
  summary: Tạo bộ mockup chi tiết cho Cấu hình trường, calendar và các chính sách phiên bản.
  evidence: Được tách khỏi bộ Danh bộ vì đây là domain quản trị độc lập, có các workflow policy và BankAccount riêng để review.
- source_spec: `_bmad-output/implementation-artifacts/spec-to-chuc-lai-mockup-admin.md`
  summary: Bổ sung entry point review hoặc điều hướng hợp lệ riêng cho bốn bản mẫu mốc Admin và Parent.
  evidence: Các bản mẫu mốc được giữ để truy vết nhưng không nằm trong luồng `review.html`; một số navigation nội bộ legacy vốn không trỏ tới destination có thật.
- source_spec: none
  summary: Rà soát và chuẩn hóa UX cho các mockup Ops và Parent còn lại.
  evidence: Được tách khỏi Admin workspace và hàng đợi vì đây là các portal có audience, shell và responsive behavior độc lập.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Chốt validation bounds cho phần trăm và số VND giảm của chương trình nộp trước.
  evidence: Review phát hiện contract hiện chưa nói rõ xử lý phần trăm ngoài miền hợp lệ hoặc mức giảm vượt giá gốc; đây là quy tắc pricing riêng, có trước lượt đồng bộ contract.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Chốt hành vi khi kỳ nộp trước liên tiếp vượt ranh giới SchoolYear.
  evidence: Finance records bị scope theo SchoolYear nhưng program term chưa mô tả rõ reject hay chia nguồn khi vượt năm học; quyết định này nằm ngoài ba mâu thuẫn đã duyệt.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Thiết kế atomic reservation và settlement-to-coverage cho PREPAID source Invoice.
  evidence: Review phát hiện overlap có thể chỉ bị phát hiện sau khi thu tiền và coverage issuance failure có thể để lại nguồn đã trả nhưng chưa có coverage.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Chốt reversal policy khi source Receipt đã phát hành promotional coverage.
  evidence: Reversal của nguồn đã cấp coverage có thể để lại coverage không còn nguồn tiền nhưng backlog hiện chưa định nghĩa guard hoặc workflow thu hồi.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Chốt exact hoặc partial payout semantics của Payroll đã duyệt.
  evidence: Story payout nhận paid amount nhưng chưa nói có bắt buộc bằng approved net payable hay hỗ trợ chi từng phần; thay đổi này không thuộc quyết định actor payout.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Tách lifecycle thu hồi cho Payroll correction delta âm khỏi payout bổ sung delta dương.
  evidence: Correction hiện hỗ trợ delta âm/dương nhưng cùng đi qua payout confirmation; delta âm cần recoupment hoặc khấu trừ kỳ sau thay vì một khoản chi.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Định nghĩa cột và reconciliation semantics cho prepaid-payment coverage trong finance report.
  evidence: Coverage là entitlement theo receivable-period chứ không phải cash posting; báo cáo cần tách billed, discount, allocated cash, refund và remaining covered value.
- source_spec: `_bmad-output/implementation-artifacts/spec-dong-bo-ba-contract-passionedu.md`
  summary: Bổ sung mockup Payroll theo từng trạng thái và vai trò sau submit.
  evidence: Mockup hiện chỉ giải thích separation-of-duties bằng copy, chưa dựng submitted, approver, refused, approved-unpaid hoặc payout-confirmation state; đây là vòng sửa mockup kế tiếp.
- source_spec: `_bmad-output/implementation-artifacts/spec-tab-cau-hinh-khoan-thu.md`
  summary: Đồng bộ PRD/SPEC và decision trước khi mở server-side materialization phí đón muộn.
  evidence: Mockup hiện mô tả policy/block và khoản phí materialized từ thời điểm trả trẻ, nhưng PRD canonical vẫn giới hạn release ở reference cho dòng MANUAL; cần Product/Architecture phê duyệt contract trước API, persistence hoặc lifecycle implementation.
- source_spec: `_bmad-output/implementation-artifacts/spec-tab-cau-hinh-khoan-thu.md`
  summary: Thêm browser-level test cho deep-link, Back/Forward và focus của tab Khoản thu.
  evidence: Contract test hiện kiểm tra markup/hash handler tĩnh; chưa thực thi focusRoute để xác minh transition và aria-current trong browser.
