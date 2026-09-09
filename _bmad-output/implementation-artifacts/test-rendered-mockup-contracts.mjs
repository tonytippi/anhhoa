import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const mockups = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const read = path => readFile(new URL(path, mockups), 'utf8');
const [css, shell, prototype, parent, timekeeping, payroll, invoice, generation] = await Promise.all([
  read('prototype.css'), read('admin/admin-shell.js'), read('prototype.js'), read('parent/parent.html'),
  read('admin/payroll-timekeeping-import.html'), read('admin/payroll-run-review.html'),
  read('admin/invoice-detail-review.html'), read('admin/invoice-generation.html')
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

console.log('Rendered mockup contract checks passed (8 matrix scenarios).');
