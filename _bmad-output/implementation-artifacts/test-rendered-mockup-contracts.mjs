import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const mockups = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const read = path => readFile(new URL(path, mockups), 'utf8');
const [css, shell, prototype, parent, timekeeping, payroll, invoice, generation, receivables, latePickup] = await Promise.all([
  read('prototype.css'), read('admin/admin-shell.js'), read('prototype.js'), read('parent/parent.html'),
  read('admin/payroll-timekeeping-import.html'), read('admin/payroll-run-review.html'),
  read('admin/invoice-detail-review.html'), read('admin/invoice-generation.html'),
  read('admin/receivable-configuration.html'), read('admin/late-pickup-statistics.html')
]);

// Admin mobile: viewport containment, scroll-owned tables, accessible sheet and focus return.
assert.match(css, /html,body\{max-width:100%\}/);
assert.doesNotMatch(css, /overflow-x:hidden/);
assert.match(css, /\.table-wrap\{width:100%;max-width:100%;overscroll-behavior-inline:contain\}/);
assert.match(css, /@media\(max-width:1023px\).*\.sidebar\{position:fixed/s);
assert.match(shell, /aria-controls="admin-navigation" aria-expanded="false"/);
assert.match(shell, /event\.key === 'Escape'/);
assert.match(shell, /if \(returnFocus && lastOpener\) lastOpener\.focus\(\)/);
assert.match(shell, /workspace\.inert = true/);
assert.match(shell, /workspace\.inert = false/);
assert.doesNotMatch(shell, /'report', 'Báo cáo'/);
for (const entry of await readdir(new URL('admin/', mockups))) {
  if (entry.endsWith('.html')) assert.match(await read(`admin/${entry}`), /name="viewport"/);
}

// Deep links and Parent binding: non-workspace hashes survive; exactly one Student route is selected.
assert.match(prototype, /data-admin-shell\]\[data-admin-route="overview"/);
assert.match(parent, /href="#child-an"/);
assert.match(parent, /href="#child-minh"/);
assert.match(parent, /id="child-an" data-parent-route/);
assert.match(parent, /id="child-minh" data-parent-route hidden/);
assert.match(prototype, /section\.hidden = section !== localRoute/);
assert.match(prototype, /window\.location\.hash = '#home'/);
assert.match(prototype, /:scope > :not\(header\).*section\.remove/s);
assert.doesNotMatch(prototype, /Đã xóa fixture Ánh Hoa/);

// School switch: dirty forms can stay/discard, pending Operations reconcile, and old context is cleared.
assert.match(prototype, /if \(knownOperation\) \{ reconcileOperation\(button\); return; \}/);
assert.match(prototype, /form\.reset\(\)/);
assert.match(prototype, /Mầm non Bình Minh · Năm học 2026-2027/);
assert.match(prototype, /oldBankAccount\.value = ''/);

// Payroll gates and destinations.
assert.match(timekeeping, /disabled aria-describedby="calculate-blocked"/);
assert.match(timekeeping, /Xử lý 2 mã máy/);
assert.match(payroll, /disabled aria-describedby="payroll-submit-blocked"/);
for (const id of ['an-detail', 'huong-detail', 'hoa-detail']) assert.match(payroll, new RegExp(`id="${id}"`));
assert.equal((payroll.match(/class="[^"]*payroll-detail[^"]*" hidden/g) || []).length, 3);
assert.match(timekeeping, /data-fixture-complete="\[aria-describedby='calculate-blocked'\]"/);
assert.match(payroll, /data-fixture-complete="\[aria-describedby='payroll-submit-blocked'\]"/);
assert.match(prototype, /target\.disabled = false/);

// Invoice lifecycle and exact Receipt facts remain mutually exclusive and server-fixture based.
for (const state of ['draft', 'receipt', 'issued']) assert.match(invoice, new RegExp(`data-invoice-state="${state}"`));
assert.match(prototype, /section\.dataset\.invoiceState !== invoiceState/);
assert.match(invoice, /id="bank-account" required/);
for (const fact of ['receipt-date', 'receipt-method', 'receipt-reference', 'receipt-evidence']) assert.match(invoice, new RegExp(`id="${fact}"`));
assert.match(invoice, /id="receipt-amount" value="8\.100\.000 đ" readonly/);
assert.match(invoice, /Bé An · Ánh Hoa · Năm học 2026-2027/);
assert.match(invoice, /Không cho phép một phần, dư, chưa phân bổ hoặc khác học sinh/);
assert.match(prototype, /receipt\.reportValidity\(\)/);
assert.match(prototype, /delete issueButton\.dataset\.idempotentAction/);
assert.match(generation, /badge success">Sẵn sàng/);
assert.match(generation, /Tạo 124 hóa đơn nháp/);

// Receivable form owns its default scope; a class matrix shows every charge for every Student.
for (const id of ['receivables', 'student-assignments', 'discount-policies', 'late-pickup']) assert.match(receivables, new RegExp(`class="route-state" id="${id}"`));
for (const hash of ['#receivables', '#student-assignments', '#discount-policies', '#late-pickup']) assert.match(receivables, new RegExp(`href="${hash}"`));
for (const heading of ['Danh sách khoản thu', 'Bảng khoản thu theo lớp', 'Chính sách ưu đãi', 'Phí đón muộn']) assert.match(receivables, new RegExp(`<h2>${heading}</h2>`));
assert.match(css, /\.tabs a\.active,\.tabs button\.active\{color:var\(--green\);border-bottom:3px solid var\(--green\)\}/);
assert.match(prototype, /const receivableTabs = \$\$\('\[data-receivable-tabs\] a'\)/);
assert.match(prototype, /const selected = receivableStates\.find/);
assert.match(prototype, /section\.hidden = section !== selected/);
assert.match(receivables, /data-open-receivable-form="edit"/);
assert.match(receivables, /data-receivable-form/);
assert.match(prototype, /data-open-receivable-form/);
assert.match(prototype, /form\.reset\(\)/);
assert.match(prototype, /Sửa \$\{button\.dataset\.receivableName\}/);
assert.match(receivables, /<th scope="col">Phạm vi áp dụng<\/th>/);
for (const scope of ['Toàn trường', 'Khối · Nhà trẻ, Mẫu giáo', 'Phân công theo học sinh', 'Lớp · Mầm 3-4 tuổi']) assert.match(receivables, new RegExp(`<td>${scope}</td>`));
assert.match(receivables, /Bảng khoản thu · Mầm 3-4 tuổi · Tháng 09\/2026/);
for (const charge of ['Học phí tháng', 'Tiền ăn tháng', 'Học thứ 7', 'Câu lạc bộ cuối tuần']) assert.match(receivables, new RegExp(`<th scope="col">${charge}`));
for (const student of ['Bé An', 'Bé Bình', 'Bé Chi']) assert.match(receivables, new RegExp(`<th scope="row">${student}`));
assert.match(receivables, /cột gồm mọi khoản thu đang áp dụng cho lớp/);
assert.match(receivables, /Theo phạm vi/);
assert.doesNotMatch(receivables, /charge-scopes/);
assert.match(prototype, /\[data-charge-scope-options\]/);
for (const scope of ['Toàn trường', 'Khối', 'Lớp', 'Nhóm học sinh', 'Phân công theo học sinh']) assert.match(receivables, new RegExp(`name="charge-scope"[^>]*> ${scope}`));
for (const block of ['Nhà trẻ', 'Mẫu giáo']) assert.match(receivables, new RegExp(`> ${block}</`));
for (const group of ['Học thử', 'Chờ phân lớp', 'Sắp vào lớp', 'Trong lớp', 'Bảo lưu']) assert.match(receivables, new RegExp(`> ${group}</`));
assert.doesNotMatch(receivables, /Nghỉ học/);
assert.doesNotMatch(receivables, /Tốt nghiệp/);
assert.doesNotMatch(receivables, /Lớp ngoại khóa/);
for (const scope of ['school', 'block', 'class', 'student-group', 'student']) assert.match(receivables, new RegExp(`data-charge-scope-options="${scope}"`));
assert.match(receivables, /Khối và Nhóm học sinh đang minh họa cách tổ chức màn hình/);
for (const quantity of ['Cố định', 'Nhập khi lập hóa đơn']) assert.match(receivables, new RegExp(`name="quantity-method"[^>]*> ${quantity}`));
assert.match(receivables, /Kế toán chỉ thay đổi giá hoặc số lượng khi hóa đơn còn ở trạng thái nháp/);
assert.match(receivables, /Hệ thống kiểm tra phạm vi và thời gian áp dụng khi lưu; thay đổi không sửa hóa đơn đã phát hành/);
assert.doesNotMatch(receivables, /mức thu riêng/);
assert.doesNotMatch(receivables, /mức giá riêng theo học sinh/);
for (const policy of ['Đóng 12 tháng giảm 30 triệu', 'Hỗ trợ học sinh theo hồ sơ', 'Ưu đãi đồng phục đầu năm']) assert.match(receivables, new RegExp(`<b>${policy}</b>`));
for (const detail of ['12 tháng', 'Thu trước nhiều kỳ', 'Gán cho học sinh', 'Không cộng dồn']) assert.match(receivables, new RegExp(detail));
assert.match(receivables, /Sửa chính sách tạo phiên bản mới/);
assert.match(receivables, /17:38/);
assert.match(receivables, /Trang này chỉ hiển thị các khung giờ và số liệu đã được hệ thống xác nhận/);
assert.doesNotMatch(receivables, /Phí nộp tiền muộn/);
assert.doesNotMatch(receivables, /<h2>Chương trình nộp trước<\/h2>/);
assert.match(receivables, /Chương trình nộp trước \(chỉ School Admin\)/);
assert.match(receivables, /href="late-pickup-statistics.html"/);
assert.match(latePickup, /<h1>Thống kê đón muộn<\/h1>/);
assert.match(latePickup, /Ma trận học sinh - ngày/);
assert.match(latePickup, /18:00<\/b><br><span class="muted">1 block<\/span><br><span class="money">20\.000 đ/);
assert.match(latePickup, /18:04<\/b><br><span class="muted">1 block<\/span><br><span class="money">20\.000 đ/);
assert.match(latePickup, /18:35/);
assert.match(latePickup, /260\.000 đ/);
assert.match(latePickup, /<b>280\.000 đ<\/b>/);
assert.match(latePickup, /Bản mẫu không tự tính phí/);
for (const day of ['05/09', '06/09', '07/09', '08/09', '09/09']) assert.match(latePickup, new RegExp(`<th scope="col">${day}</th>`));
assert.match(latePickup, /Xuất dữ liệu chưa được mô phỏng trong release này/);
assert.match(prototype, /form\.hasAttribute\('data-static-filter'\)/);

console.log('Rendered mockup contract checks passed (receivable scopes included).');
