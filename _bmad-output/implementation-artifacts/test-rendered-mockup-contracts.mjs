import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const mockups = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const read = path => readFile(new URL(path, mockups), 'utf8');
const [css, shell, prototype, parent, timekeeping, payroll, invoice, generation, receivables, settings] = await Promise.all([
  read('prototype.css'), read('admin/admin-shell.js'), read('prototype.js'), read('parent/parent.html'),
  read('admin/payroll-timekeeping-import.html'), read('admin/payroll-run-review.html'),
  read('admin/invoice-detail-review.html'), read('admin/invoice-generation.html'),
  read('admin/receivable-configuration.html'), read('admin/school-settings.html')
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

// Finance sidebar opens workspaces; Invoice and Receipt stay contextual deep links.
assert.doesNotMatch(shell, /invoice-detail-review\.html/);
assert.doesNotMatch(shell, /'invoice-review'|\'settlement\'/);
assert.match(shell, /'runs', 'Đợt thu', root \+ 'invoice-generation\.html'/);
assert.doesNotMatch(shell, /Đợt thu \/ Nộp trước/);
assert.match(generation, /href="finance-run-preview\.html">Rà soát đợt thu/);
assert.doesNotMatch(generation, /href="invoice-detail-review\.html"/);
assert.match(invoice, /data-admin-route="runs"/);
assert.match(invoice, /Invoice này chứa fact nộp trước nên chỉ nhận đúng tổng cần thu/);
assert.match(invoice, /id="payment-amount"[^>]*readonly/);
assert.match(invoice, /revision\.hidden = true/);
assert.match(invoice, /id="revision-confirmation"/);
assert.match(invoice, /hóa đơn hiện tại vẫn là nghĩa vụ thanh toán/i);
assert.doesNotMatch(invoice, /parseAmount|toLocaleString|var difference/);
// CollectionRun landing, student-level details and authoritative generate.
assert.match(generation, /<h1>Đợt thu<\/h1>/);
assert.match(generation, /Mỗi tháng có một đợt thu chung/);
assert.match(generation, /Chênh lệch thu được xử lý ở tháng sau/);
assert.match(generation, /Tháng 11\/2026/);
assert.doesNotMatch(generation, /invoice-detail-review\.html/);

// Receivable fixtures retain server-owned catalog/policy values and optional services.
for (const tab of ['#receivables', '#services', '#policies']) assert.match(receivables, new RegExp(`href="${tab}"`));
for (const panel of ['receivables', 'services', 'policies']) assert.match(receivables, new RegExp(`id="${panel}" data-panel`));
for (const heading of ['Danh sách khoản thu', 'Khoản thu áp dụng theo học sinh', 'Chính sách ưu đãi']) assert.match(receivables, new RegExp(`<h2>${heading}</h2>`));
assert.match(receivables, /Hóa đơn đã phát hành không thay đổi/);
assert.match(receivables, /id="service-matrix"/);
assert.match(receivables, /Ưu đãi nộp trước học kỳ/);
assert.doesNotMatch(receivables, /Phí nộp tiền muộn|late-pickup-statistics\.html|invoice-generation\.html#prepaid/);

// Settings remains a separate school-policy surface.
assert.match(settings, /id="school-profile-form"/);
assert.match(settings, /name="timezone" value="Asia\/Ho_Chi_Minh \(Việt Nam\)" readonly/);
assert.match(settings, /accept="image\/jpeg,image\/png,image\/webp"/);
assert.doesNotMatch(settings, /#parent-access|id="parent-access"|Truy cập phụ huynh/);

console.log('Rendered mockup contract checks passed (collection-run landing included).');
