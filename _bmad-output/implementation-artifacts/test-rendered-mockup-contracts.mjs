import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const mockups = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const read = path => readFile(new URL(path, mockups), 'utf8');
const [css, shell, prototype, parent, timekeeping, payroll, invoice, generation, generationUx, receivables, promotions, settings, report] = await Promise.all([
  read('prototype.css'), read('admin/admin-shell.js'), read('prototype.js'), read('parent/parent.html'),
  read('admin/payroll-timekeeping-import.html'), read('admin/payroll-run-review.html'),
   read('admin/invoice-detail-review.html'), read('admin/invoice-generation.html'), read('admin/invoice-generation-ux.js'),
    read('admin/receivable-configuration.html'), read('admin/promotion-configuration.html'), read('admin/school-settings.html'), read('admin/finance-report.html')
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
assert.match(shell, /'report', 'Báo cáo', root \+ 'finance-report\.html'/);
assert.match(shell, /var financeAuthorized = host\.getAttribute\('data-finance-authorized'\) === 'true';/);
assert.match(shell, /!financeAuthorized && link\[1\] === 'report'/);
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

// Finance sidebar opens workspaces; Invoice and Receipt stay contextual deep links.
assert.doesNotMatch(shell, /invoice-detail-review\.html/);
assert.doesNotMatch(shell, /'invoice-review'|\'settlement\'/);
assert.match(shell, /'runs', 'Đợt thu', root \+ 'invoice-generation\.html'/);
assert.match(shell, /'promotions', 'Ưu đãi', root \+ 'promotion-configuration\.html'/);
assert.doesNotMatch(shell, /Đợt thu \/ Nộp trước/);
assert.match(generation, /id="run-detail" tabindex="-1" hidden/);
assert.doesNotMatch(generation, /href="invoice-detail-review\.html"/);
assert.match(invoice, /data-admin-route="runs"/);
assert.match(invoice, /Con cán bộ trường · Phiên bản 1/);
assert.match(invoice, /Giảm trừ ưu đãi/);
assert.match(invoice, /10% · 150\.000 đ · hệ thống đã áp dụng/);
assert.match(invoice, /Tổng cần thu do hệ thống xác nhận/);
assert.match(invoice, /Yêu cầu kiểm tra lại ưu đãi/);
assert.match(invoice, /snapshot bất biến/);
for (const unavailable of ['Receipt', 'coverage', 'nộp trước', 'carry', 'hoàn tiền']) assert.doesNotMatch(invoice, new RegExp(unavailable, 'i'));
assert.doesNotMatch(invoice, /parseAmount|toLocaleString|var difference/);
// Finance reports are a server-result-only Finance workspace with CSV as its sole export.
assert.match(report, /data-admin-route="report"/);
for (const workspace of ['overview', 'runs', 'debt', 'ledger']) assert.match(report, new RegExp(`data-workspace="${workspace}"`));
for (const metadata of ['data-as-of', 'Asia\/Ho_Chi_Minh', 'data-normalized-filter', 'Finance report v1\.0']) assert.match(report, new RegExp(metadata));
assert.match(report, /Tệp CSV chứa đúng các dòng và metadata của kết quả đã được cấp quyền/);
for (const filter of ['collectionRun', 'receivableGroup', 'invoiceStatus']) assert.match(report, new RegExp(`name="${filter}"`));
for (const source of ['finance-source-difference', 'finance-source-coverage', 'finance-source-receipt', 'finance-source-refund', 'finance-source-reversal']) assert.match(report, new RegExp(source));
assert.match(report, /aria-busy="true"/);
assert.match(report, /Settlement difference mở[\s\S]*Carry đã materialize[\s\S]*Revision\/hủy/);
assert.match(report, /Hoàn tiền coverage[\s\S]*Reversal[\s\S]*Tiền\/điều chỉnh có dấu/);
assert.match(report, /query\(\) !== 'workspace=' \+ current \+ '&fixture=october'/);
assert.doesNotMatch(report, /PDF|XLSX|Payroll|createObjectURL|Blob\(|toLocaleString|reduce\(|invoice-detail-review/);
// Finance Admin MVP exposes catalog and CollectionRun destinations only.
assert.match(generation, /<h1>Đợt thu<\/h1>/);
assert.match(generation, /TRƯỜNG ÁNH HOA · NĂM HỌC 2026-2027/);
assert.match(generation, /<h2>Rà soát đợt thu<\/h2>/);
assert.match(generation, /<h3>Khoản thu trong đợt<\/h3>/);
assert.match(generation, /id="template-lines"/);
assert.match(generation, /Tiền ăn tháng/);
assert.match(generation, /Số ngày tiền ăn tháng/);
assert.match(generation, /value="22"/);
assert.match(generation, /35\.000 đ/);
assert.match(generation, /770\.000 đ/);
assert.match(generation, /Giá và thành tiền do hệ thống xác nhận/);
assert.match(generation, /770\.000 đ/);
assert.match(generation, /class="template-quantity" type="number" min="1" step="1"/);
assert.match(generation, /Template khoản thu đã thay đổi\. Hãy yêu cầu preview mới từ hệ thống\./);
assert.match(generation, /Preview và generate do hệ thống quyết định/);
assert.match(generation, /Đang kiểm tra kết quả với hệ thống\. Đối soát thao tác trước khi thử lại hoặc đổi Trường\./);
assert.match(generation, /Tháng 11\/2026/);
assert.match(generation, /href="invoice-detail-review\.html\?run=2026-10&amp;student=minh-anh&amp;invoice=draft-minh-anh"/);
assert.match(generation, /id="preview-run"/);
assert.match(generation, /id="generate-invoices"[^>]*disabled/);
assert.match(generation, /data-open-run="11\/2026"/);
assert.match(generation, /function openRun\(month,readonly\)/);
assert.match(generation, /invoice-generation-ux\.js/);
assert.match(generationUx, /reviewLinks\.forEach/);
assert.match(generationUx, /selectAll\.indeterminate/);
assert.match(generationUx, /Lựa chọn đã thay đổi\. Hãy yêu cầu preview mới từ hệ thống\./);
for (const unavailable of ['Đã nhận', 'Còn thiếu', 'Receipt', 'carry', 'thực nhận', 'chênh lệch']) assert.doesNotMatch(generation, new RegExp(unavailable, 'i'));

// Receivables remains catalog-only; Pha 1b promotion configuration is separate.
assert.match(receivables, /<h1>Khoản thu<\/h1>/);
assert.match(receivables, /TRƯỜNG ÁNH HOA · NĂM HỌC 2026-2027/);
assert.match(receivables, /<h2>Danh sách khoản thu<\/h2>/);
assert.match(receivables, /Đơn giá mặc định/);
assert.match(receivables, /Tiền ăn[ -]*35\.000 đ\/ngày/);
assert.doesNotMatch(receivables, /TA-THANG|600\.000 đ/);
assert.match(invoice, /22 ngày · 35\.000 đ\/ngày · Không có ưu đãi áp dụng/);
assert.match(invoice, /770\.000 đ/);
assert.match(receivables, /Đang kiểm tra kết quả với hệ thống/);
assert.match(receivables, /Giữ nguyên ngữ cảnh Trường và đối soát thao tác trước khi thử lại/);
assert.match(receivables, /id="open-groups"/);
assert.match(receivables, /<h2>Quản lý nhóm khoản thu<\/h2>/);
assert.match(receivables, /data-lifecycle>Ngừng áp dụng/);
assert.match(receivables, /data-lifecycle>Áp dụng lại/);
assert.match(receivables, /type="number" min="1" step="1" required inputmode="numeric"/);
assert.match(receivables, /reportValidity\(\)/);
for (const unavailable of ['Dịch vụ theo học sinh', 'Chính sách ưu đãi', 'service-matrix', 'scope', 'automation']) assert.doesNotMatch(receivables, new RegExp(unavailable, 'i'));
assert.match(promotions, /<h1>Ưu đãi<\/h1>/);
assert.match(promotions, /Con cán bộ trường/);
assert.match(promotions, /Học phí tháng/);
assert.match(promotions, /Gán học sinh/);
assert.match(promotions, /Lý do/);
assert.match(promotions, /Đang kiểm tra kết quả với hệ thống/);
for (const unavailable of ['PREPAID_COVERAGE', 'Receipt', 'coverage', 'carry', 'hoàn tiền']) assert.doesNotMatch(promotions, new RegExp(unavailable, 'i'));

// Settings remains a separate school-policy surface.
assert.match(settings, /id="school-profile-form"/);
assert.match(settings, /name="timezone" value="Asia\/Ho_Chi_Minh \(Việt Nam\)" readonly/);
assert.match(settings, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.doesNotMatch(settings, /#parent-access|id="parent-access"|Truy cập phụ huynh/);

console.log('Rendered mockup contract checks passed (collection-run landing included).');
