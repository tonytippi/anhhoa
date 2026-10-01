import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const mockups = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const read = path => readFile(new URL(path, mockups), 'utf8');
const [css, shell, prototype, parent, timekeeping, payroll, invoice, generation, receivables, promotions, settings, report] = await Promise.all([
  read('prototype.css'), read('admin/admin-shell.js'), read('prototype.js'), read('parent/parent.html'),
  read('admin/payroll-timekeeping-import.html'), read('admin/payroll-run-review.html'),
   read('admin/invoice-detail-review.html'), read('admin/invoice-generation.html'),
    read('admin/receivable-configuration.html'), read('admin/promotion-configuration.html'), read('admin/school-settings.html'), read('admin/finance-report.html')
]);
const paymentImage = await read('admin/invoice-payment-image.html');

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
// CollectionRun list and each run detail are mutually exclusive route states.
assert.match(generation, /id="run-list" data-run-view>/);
for (const state of ['draft', 'ready', 'generated']) assert.match(generation, new RegExp(`id="run-${state}" data-run-view hidden`));
assert.match(generation, /views\.forEach\(function \(view\) \{ view\.hidden = view !== target; \}\)/);
assert.doesNotMatch(generation, /href="invoice-detail-review\.html"/);
assert.match(invoice, /href="invoice-generation\.html#run-generated">Quay lại đợt thu</);
assert.match(invoice, /data-admin-route="runs"/);
assert.match(invoice, /Con cán bộ trường · Phiên bản 1/);
assert.match(invoice, /Ưu đãi · Con cán bộ trường/);
assert.doesNotMatch(invoice, /Giảm trừ/);
// Thu/Bớt on the same line: the server proposes leave-day deductions; Finance edits quantity/price with a reason.
assert.match(invoice, /Thu 22 ngày · 35\.000 đ\/ngày[\s\S]*Bớt<br><small class="muted">3 ngày · 28\.000 đ\/ngày · nghỉ có phép 09\/2026[\s\S]*-84\.000 đ[\s\S]*Tổng phần 2<\/b><b>686\.000 đ/);
assert.match(invoice, /id="deduction-dialog"/);
assert.match(invoice, /Dùng lại số đề xuất/);
assert.match(invoice, /Nhập lý do khi phần bớt khác số hệ thống đề xuất\./);
assert.equal((invoice.match(/data-edit-deduction data-line=/g) ?? []).length, 2);
assert.match(invoice, /10% · 150\.000 đ · hệ thống đã áp dụng/);
assert.match(invoice, /Tổng cần thu do hệ thống xác nhận/);
assert.match(invoice, /Yêu cầu kiểm tra lại ưu đãi/);
assert.match(invoice, /snapshot bất biến/);
for (const unavailable of ['Receipt', 'coverage', 'nộp trước', 'carry', 'hoàn tiền']) assert.doesNotMatch(invoice, new RegExp(unavailable, 'i'));
assert.doesNotMatch(invoice, /parseAmount|toLocaleString|var difference/);
// Issued Invoice: Finance downloads a server-rendered payment image; the browser never builds QR or amounts.
assert.match(invoice, /id="payment-panel" aria-labelledby="payment-title" hidden/);
assert.match(invoice, /id="download-image">Tải ảnh hóa đơn</);
assert.match(invoice, /Tổng cần nộp/);
assert.match(invoice, /Nguyen Minh Anh Mam 4A/);
// Payment notice: taxed lines go to the School account, untaxed lines to a personal account; VAT is server-calculated.
assert.match(invoice, /Phần 1 · Thu vào tài khoản trường/);
assert.match(invoice, /Phần 2 · Thu vào tài khoản cá nhân/);
assert.match(invoice, /Thuế GTGT 5%[\s\S]*67\.500 đ[\s\S]*Tổng phần 1<\/b><b>1\.417\.500 đ/);
assert.match(invoice, /id="invoice-total">2\.103\.500 đ</);
assert.match(invoice, /Hệ thống tự dùng tài khoản trường đang hiệu lực; không đổi tại đây\./);
assert.match(invoice, /<select id="personal-account"[^>]*>[\s\S]*<option value="an-binh" selected>[^<]*\(mặc định lớp Mầm 4A\)<\/option>/);
assert.match(invoice, /id="issue-invoice"[^>]*>Phát hành phiếu thu</);
for (const code of ['OBL-202610-000123', 'OBL-202610-000124']) assert.match(invoice, new RegExp(`Mã hóa đơn ${code}`));
assert.doesNotMatch(invoice, /Ghi nhận thực thu/);
assert.equal((invoice.match(/<b id="paid-part-(school|personal)">[^<]*<\/b><span class="badge info">Chưa thu<\/span>/g) ?? []).length, 2);
assert.match(invoice, /window\.location\.hash==='#issued'/);
assert.doesNotMatch(invoice, /Gửi email|createObjectURL|Blob\(|canvas/i);
assert.match(paymentImage, /Thông báo học phí tháng 10\/2026/);
assert.equal((paymentImage.match(/aria-label="Mã VietQR minh họa · Phần [12] · [\d.]+ đ"/g) ?? []).length, 2);
assert.equal((paymentImage.match(/<dd class="content">Nguyen Minh Anh Mam 4A<\/dd>/g) ?? []).length, 2);
assert.match(paymentImage, /Phần 1 · Thu vào tài khoản trường<\/h2><span>Mã: OBL-202610-000123[\s\S]*Thuế GTGT 5%<\/td><td class="money">67\.500 đ[\s\S]*Tổng phần 1<\/td><td class="money">1\.417\.500 đ[\s\S]*TRUONG MN ANH HOA/);
assert.match(paymentImage, /Phần 2 · Thu vào tài khoản cá nhân<\/h2><span>Mã: OBL-202610-000124[\s\S]*Bớt nghỉ có phép 09\/2026 · 3 ngày x 28\.000<\/td><td class="money">-84\.000 đ[\s\S]*Tổng phần 2<\/td><td class="money">686\.000 đ[\s\S]*NGUYEN VAN AN/);
assert.match(paymentImage, /Tổng cần nộp <small>\(2 lần chuyển khoản\)<\/small><\/td><td class="money">2\.103\.500 đ/);
assert.doesNotMatch(paymentImage, /Giảm trừ/);
assert.match(paymentImage, /OBL-202610-000123-HS001\.png/);
assert.doesNotMatch(paymentImage, /reduce\(|parseInt|toLocaleString|Tôi đã chuyển/);
// Finance reports are a server-result-only Finance workspace with CSV as its sole export.
assert.match(report, /data-admin-route="report"/);
for (const workspace of ['overview', 'runs', 'debt', 'ledger']) assert.match(report, new RegExp(`data-workspace="${workspace}"`));
for (const metadata of ['data-as-of', 'Asia\/Ho_Chi_Minh', 'data-normalized-filter', 'Finance report v1\.0']) assert.match(report, new RegExp(metadata));
assert.match(report, /Tệp CSV chứa đúng các dòng và metadata của kết quả đã được cấp quyền/);
for (const filter of ['collectionRun', 'receivableGroup', 'invoiceStatus']) assert.match(report, new RegExp(`name="${filter}"`));
for (const source of ['finance-source-difference', 'finance-source-coverage', 'finance-source-receipt', 'finance-source-refund', 'finance-source-reversal']) assert.match(report, new RegExp(source));
assert.match(report, /aria-busy="true"/);
assert.match(report, /Chênh lệch chờ chuyển kỳ sau[\s\S]*Đã chuyển sang kỳ sau[\s\S]*Hóa đơn thay thế/);
// Report leads with figures and charts; result metadata is a one-line footnote, not a card.
assert.doesNotMatch(report, /Kết quả do hệ thống trả về|Phiên bản định nghĩa/);
assert.match(report, /class="kpis" data-report-summary/);
assert.match(report, /data-report-charts/);
for (const kind of ['columns', 'bridge', 'stacked', 'status', 'aging']) assert.match(report, new RegExp(`kind: '${kind}'`));
assert.match(report, /Xem dạng bảng/);
assert.match(report, /Số liệu chốt <b data-as-of>/);
assert.match(report, /Hoàn học phí nộp trước[\s\S]*Đảo phiếu thu[\s\S]*Chi hoàn quyết toán/);
assert.match(report, /query\(\) !== 'workspace=' \+ current \+ '&fixture=october'/);
assert.doesNotMatch(report, /PDF|XLSX|Payroll|createObjectURL|Blob\(|toLocaleString|reduce\(|invoice-detail-review/);
// Finance Admin MVP exposes catalog and CollectionRun destinations only.
assert.match(generation, /<h1>Đợt thu<\/h1>/);
assert.match(generation, /TRƯỜNG ÁNH HOA · NĂM HỌC 2026-2027/);
assert.match(generation, /Quay lại danh sách đợt thu/);
// Detail shows server lifecycle as a non-interactive step indicator and a server-computed overview.
assert.equal((generation.match(/<ol class="steps" aria-label="Tiến trình đợt thu">/g) ?? []).length, 3);
assert.equal((generation.match(/aria-current="step"/g) ?? []).length, 3);
assert.doesNotMatch(generation, /<ol class="steps"[^>]*>(?:(?!<\/ol>)[^])*<(a|button)\b/);
assert.equal((generation.match(/aria-label="Tổng quan do máy chủ tính"/g) ?? []).length, 3);
for (const metric of ['Học sinh đủ điều kiện', 'Học sinh bị bỏ qua', 'Cần thu dự kiến', 'Đã phát hành', 'Tổng phải thu']) assert.match(generation, new RegExp(`<span>${metric}</span>`));
assert.doesNotMatch(generation, /reduce\(|parseInt|toLocaleString/);
assert.match(generation, /<h2>Khoản thu trong đợt<\/h2>/);
assert.match(generation, /Tiền ăn tháng<\/td><td>22 ngày<\/td><td class="money">35\.000 đ<\/td><td class="money">770\.000 đ/);
assert.match(generation, /<caption>Khoản thu đã chốt cho đợt<\/caption>/);
assert.match(generation, /<thead><tr><th>Học sinh<\/th><th>Lý do<\/th><\/tr><\/thead>/);
assert.match(generation, /Đã tạo 125 hóa đơn nháp; bỏ qua 1 học sinh\./);
assert.doesNotMatch(generation, /<caption>Hóa đơn nháp đã tạo<\/caption>/);
assert.match(generation, /id="add-student-dialog"/);
assert.doesNotMatch(generation, /2\.120\.000/);
assert.match(generation, /Bé Minh Anh<\/td><td>Mầm 4A<\/td><td class="money">2\.270\.000 đ<\/td><td class="money">150\.000 đ<\/td><td class="money">84\.000 đ<\/td><td class="money">67\.500 đ<\/td><td class="money">2\.103\.500 đ/);
assert.match(generation, /<th class="money">Ưu đãi<\/th><th class="money">Bớt<\/th>/);
assert.doesNotMatch(generation, /Giảm trừ/);
// Students who left last month are settled in this run.
assert.match(generation, /<h2 id="settlement-title">Cần quyết toán<\/h2>/);
assert.match(generation, /data-create-settlement>Tạo hóa đơn quyết toán</);
assert.match(generation, /href="invoice-settlement-review\.html\?run=2026-09&amp;student=gia-bao&amp;invoice=settlement-gia-bao"/);
assert.match(generation, /<thead><tr><th>Học sinh<\/th><th>Lớp<\/th><th>Tài khoản nhận<\/th><th>Trạng thái<\/th>/);
assert.match(generation, /Bé Minh Anh<\/td><td>Mầm 4A<\/td><td>Tài khoản trường<\/td><td><span class="badge neutral">Nháp<\/span><\/td><td class="money">1\.417\.500 đ/);
assert.match(generation, /Bé Minh Anh<\/td><td>Mầm 4A<\/td><td>Tài khoản cá nhân<\/td><td><span class="badge neutral">Nháp<\/span><\/td><td class="money">686\.000 đ/);
assert.match(generation, /href="invoice-detail-review\.html\?run=2026-09&amp;student=minh-anh&amp;invoice=draft-minh-anh"/);
for (const unavailable of ['Đã nhận', 'Còn thiếu', 'Receipt', 'carry', 'thực nhận', 'chênh lệch']) assert.doesNotMatch(generation, new RegExp(unavailable, 'i'));

// Receivables remains catalog-only; Pha 1b promotion configuration is separate.
assert.match(receivables, /<h1>Khoản thu<\/h1>/);
assert.match(receivables, /TRƯỜNG ÁNH HOA · NĂM HỌC 2026-2027/);
assert.match(receivables, /<h2>Danh sách khoản thu<\/h2>/);
assert.match(receivables, /Đơn giá mặc định \(chưa VAT\)<\/th><th class="money">Giá hoàn trả<\/th><th>Thuế<\/th>/);
assert.match(receivables, /Giá hoàn trả \/ đơn vị \(chưa VAT\)<input type="number" name="refundUnitPrice" min="0" step="1" required inputmode="numeric" value="0"/);
assert.match(receivables, /35\.000 đ\/ngày<\/td><td class="money">28\.000 đ\/ngày/);
assert.match(receivables, /Giá \/ đơn vị \(chưa VAT\)/);
const taxOptions = [...(receivables.match(/<select name="taxCategory"[^>]*>([\s\S]*?)<\/select>/)?.[1] ?? '').matchAll(/<option value="([A-Z_0-9]+)"[^>]*>([^<]+)<\/option>/g)].map(match => `${match[1]}:${match[2]}`);
assert.deepEqual(taxOptions, ['NOT_DECLARED:Không kê khai nộp thuế', 'EXEMPT:Không chịu thuế', 'VAT_0:Thuế suất 0%', 'VAT_5:Thuế suất 5%', 'VAT_8:Thuế suất 8%', 'VAT_10:Thuế suất 10%']);
assert.match(receivables, /<option value="NOT_DECLARED" selected>/);
assert.match(receivables, /id="tax-channel-hint">Thu vào tài khoản cá nhân</);
assert.match(receivables, /'Thu vào tài khoản cá nhân':'Thu vào tài khoản trường'/);
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
// BankAccount create requires a bank BIN from the server VietQR list; no free-text bank.
assert.match(settings, /<select name="bankBin" required><option value="">Chọn ngân hàng<\/option>/);
assert.match(settings, /<option value="970436">Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam<\/option>/);
assert.doesNotMatch(settings, /name="receivingBank"/);
// Receiving accounts are split by kind; tax treatment is per Receivable, not a School finance setting.
assert.match(settings, /<h3 id="school-account-title">Tài khoản trường \(khoản có thuế\)<\/h3>/);
assert.match(settings, /<h3 id="personal-account-title">Tài khoản cá nhân \(khoản không kê khai\)<\/h3>/);
assert.match(settings, /<select name="kind" required><option value="PERSONAL" selected>Tài khoản cá nhân \(khoản không kê khai\)<\/option><option value="SCHOOL">Tài khoản trường \(khoản có thuế\)<\/option>/);
assert.match(settings, /Tối đa một tài khoản trường đang hiệu lực/);
assert.doesNotMatch(settings, /taxTreatment|Xử lý thuế/i);

// Receipt queue: one row per channel Invoice; receipts are posted per receiving account.
const receiptQueue = await read('admin/receipt-queue.html');
assert.match(receiptQueue, /<thead><tr><th>Học sinh<\/th><th>Lớp<\/th><th>Tháng<\/th><th>Tài khoản nhận<\/th><th class="money">Còn phải thu<\/th><th>Trạng thái<\/th><th>Tùy chọn<\/th><\/tr><\/thead>/);
assert.equal((receiptQueue.match(/<td><b>Bé Minh Anh<\/b>/g) ?? []).length, 2);
assert.match(receiptQueue, /<td>Tài khoản trường<\/td><td class="money">1\.417\.500 đ/);
assert.match(receiptQueue, /<td>Tài khoản cá nhân<\/td><td class="money">686\.000 đ/);
// Negative settlement Invoices are closed by an exact recorded payout, not a Receipt.
assert.match(receiptQueue, /<option>Cần chi hoàn<\/option>/);
assert.match(receiptQueue, /<td class="money">Hoàn 11\.970\.000 đ<\/td><td><span class="badge warning">Chờ chi hoàn<\/span>/);
assert.match(receiptQueue, /data-record-payout[^>]*>Ghi nhận đã chi</);
assert.match(receiptQueue, /id="payout-dialog"/);
assert.match(receiptQueue, /Chi đúng số tiền này một lần/);
assert.match(receiptQueue, /<h2 id="receipt-title">Ghi thực nhận cho Bé Minh Anh · Tài khoản trường<\/h2>/);
assert.match(receiptQueue, /'Ghi thực nhận cho Bé Minh Anh · '\+current/);
assert.doesNotMatch(receiptQueue, /[pP]hần [12]|2\.120\.000/);

// Class default receiving account: table column plus row-action dialog, not part of the create form.
const classes = await read('admin/roster/school-year-classes.html');
assert.match(classes, /<th>Tài khoản thu mặc định<\/th>/);
assert.match(classes, /Ngân hàng An Bình · •••• 2088<br><small class="muted">NGUYEN VAN AN<\/small>/);
assert.match(classes, /<td>Chưa chọn<\/td>/);
assert.match(classes, /data-class-bank-account="Mầm 3-4 tuổi"[^>]*>Tài khoản thu<\/button>/);
assert.doesNotMatch(classes.slice(classes.indexOf('<form'), classes.indexOf('</form>')), /default-bank-account|Tài khoản thu/);
assert.doesNotMatch(classes, /sao chép/);
assert.match(prototype, /dialog\(`Tài khoản thu mặc định · \$\{button\.dataset\.classBankAccount\}`/);
assert.match(prototype, /\['', 'Chưa chọn'\], \['an-binh', 'Ngân hàng An Bình · •••• 2088 · NGUYEN VAN AN'\]/);
assert.match(prototype, />Lưu tài khoản thu<\/button>/);
assert.doesNotMatch(prototype, /Chuyển năm học sẽ sao chép/);

console.log('Rendered mockup contract checks passed (collection-run landing included).');

// Settlement Invoice after withdrawal: no new charges, meal deduction and prepaid package refund; negative total, no VietQR.
const settlement = await read('admin/invoice-settlement-review.html');
const refundImage = await read('admin/invoice-refund-image.html');
assert.match(settlement, /data-admin-route="runs"/);
assert.match(settlement, /<h1>Hóa đơn quyết toán<\/h1>/);
assert.match(settlement, /Học phí của tháng nghỉ học không được hoàn/);
assert.match(settlement, /6\.900\.000 đ x 6 = 41\.400\.000 đ/);
assert.match(settlement, /<b>-11\.400\.000 đ<\/b>/);
assert.match(settlement, /16 ngày · 28\.000 đ\/ngày · 2 ngày nghỉ có phép 08\/2026/);
assert.match(settlement, /id="invoice-total">12\.418\.000 đ</);
assert.match(settlement, /id="issue-invoice"[^>]*>Phát hành phiếu hoàn tiền</);
assert.doesNotMatch(settlement, /VietQR minh họa|parseAmount|toLocaleString|reduce\(/);
assert.match(refundImage, /Phiếu hoàn tiền quyết toán tháng 09\/2026/);
assert.match(refundImage, /Trường hoàn lại cho phụ huynh <small>\(2 lần chi\)<\/small><\/td><td class="money">12\.418\.000 đ/);
assert.doesNotMatch(refundImage, /class="qr"|Mã VietQR/);
