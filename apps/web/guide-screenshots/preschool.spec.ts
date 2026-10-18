import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { approve, dialog, dismiss, generate, go, issue, login, openSchool, receive, region, runInvoices, seed, shooter, showNotices } from './helpers';

// Drives the synthetic "Trường Mầm non Hoa Mai" through the October and November runs and saves the screenshots that
// the preschool guides (src/guides/articles/mam-non) embed. Everything shown is invented demo data.
const school = 'Trường Mầm non Hoa Mai';
const shot = shooter('');
// One picture spanning several elements, e.g. the policy table with the form below it.
async function shotSpan(page: Page, parts: Locator[], name: string) {
  const boxes = [];
  for (const part of parts) {
    await part.scrollIntoViewIfNeeded();
    boxes.push((await part.boundingBox())!);
  }
  const scrollY = await page.evaluate(() => window.scrollY);
  const pad = 8;
  const left = Math.min(...boxes.map((box) => box.x)) - pad, top = Math.min(...boxes.map((box) => box.y + scrollY)) - pad;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + pad, bottom = Math.max(...boxes.map((box) => box.y + scrollY + box.height)) + pad;
  await page.screenshot({ path: resolve(import.meta.dirname, `../public/guides/${name}.jpg`), type: 'jpeg', quality: 85, fullPage: true, clip: { x: left, y: top, width: right - left, height: bottom - top }, animations: 'disabled', caret: 'hide' });
}
// A monthly run is listed by its billing month (the options button is named by "2026-10").
async function openMonth(page: Page, month: string) {
  await go(page, 'Tài chính', 'Đợt thu');
  await page.getByRole('button', { name: `Tùy chọn cho đợt thu ${month}` }).click();
  await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^Đợt thu tháng ${month.slice(5)}/${month.slice(0, 4)} · `), level: 1 })).toBeVisible();
}
const review = (page: Page) => page.getByRole('region', { name: /^Rà soát hóa đơn / });
async function reviewStudent(page: Page, student: string) {
  await runInvoices(page).locator('tbody tr').filter({ hasText: student }).getByRole('button', { name: /^(Rà soát hóa đơn|Xem hóa đơn)$/ }).click();
  await expect(page.getByRole('region', { name: new RegExp(`^Rà soát hóa đơn .*${student}`) })).toBeVisible();
}

test('preschool guide screenshots', async ({ page }) => {
  seed('seed-guide-demo-preschool.ts');
  await login(page, 'guide-demo-preschool', 'guide-demo-preschool@example.com');
  await openSchool(page, school);

  await test.step('settings', async () => {
    await go(page, 'Cấu hình trường', 'Cấu hình chung');
    await page.getByRole('link', { name: 'Tài chính & thanh toán' }).click();
    const policyTable = page.getByRole('table', { name: 'Phiên bản chính sách tài chính' });
    await expect(policyTable).toContainText('Thiết lập đầu năm học');
    await shotSpan(page, [policyTable.locator('xpath=..'), page.getByRole('form', { name: 'Đề xuất chính sách tài chính' })], 'cau-hinh-chinh-sach-tai-chinh');
    const accounts = page.getByRole('region', { name: 'Tài khoản nhận tiền' });
    await accounts.getByLabel('Loại tài khoản').selectOption({ index: 1 });
    await accounts.getByLabel('Ngân hàng nhận').selectOption('970407');
    await accounts.getByLabel('Số tài khoản').fill('19034567890123');
    await accounts.getByLabel('Chủ tài khoản').fill('TRUONG MAM NON HOA MAI');
    await shotSpan(page, [accounts.getByRole('heading', { name: 'Tài khoản nhận tiền' }), accounts.getByRole('button', { name: 'Thêm tài khoản nhận tiền' }), accounts.getByLabel('Số tài khoản')], 'cau-hinh-them-tai-khoan');
    await shotSpan(page, [accounts.getByRole('region', { name: /^Tài khoản trường/ }), accounts.getByRole('region', { name: /^Tài khoản cá nhân/ })], 'cau-hinh-danh-sach-tai-khoan');
  });

  await test.step('class receiving accounts', async () => {
    await go(page, 'Danh bộ', 'Lớp học');
    const table = page.getByRole('table', { name: /^Lớp thuộc / });
    await expect(table).toContainText('Mầm 1');
    await table.locator('tbody tr').filter({ hasText: 'Mầm 1' }).getByRole('button', { name: 'Tài khoản thu' }).click();
    const accounts = page.getByRole('dialog');
    await accounts.getByLabel('Tài khoản trường mặc định').selectOption({ index: 1 });
    await accounts.getByLabel('Tài khoản cá nhân mặc định').selectOption({ index: 1 });
    await shot(accounts, 'lop-hoc-dialog-tai-khoan-thu');
    await accounts.getByRole('button', { name: 'Lưu tài khoản thu' }).click();
    await expect(accounts).toBeHidden();
    await expect(table.locator('tbody tr').filter({ hasText: 'Mầm 1' })).not.toContainText('Chưa chọn');
    await shot(table, 'lop-hoc-tai-khoan-thu-da-chon');
  });

  await test.step('receivables', async () => {
    await go(page, 'Tài chính', 'Khoản thu');
    const list = page.getByRole('table').first();
    await expect(list).toContainText('Tiền ăn');
    await shot(list, 'khoan-thu-danh-sach');
    await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
    const add = dialog(page, 'Thêm khoản thu');
    await add.getByLabel('Tên khoản thu').fill('Tiền ăn bán trú');
    await add.getByLabel('Mã khoản thu').fill('TA-BT');
    await add.getByRole('radio', { name: 'Khoản thu cố định' }).check();
    await add.getByLabel('Giá / đơn vị (chưa VAT)').fill('40000');
    await add.getByLabel('Giá hoàn trả / đơn vị (chưa VAT)').fill('35000');
    await add.getByLabel('Đơn vị tính').fill('ngày');
    await add.getByRole('checkbox', { name: 'Tự động trừ theo ngày nghỉ có phép' }).check();
    await add.getByLabel('Mức thuế suất').selectOption({ label: 'Thuế suất 8%' });
    await shot(add, 'khoan-thu-them');
    await dismiss(page);
    const meals = list.locator('tbody tr').filter({ hasText: 'Tiền ăn' });
    await meals.getByRole('button').last().click();
    await page.waitForTimeout(300);
    await shotSpan(page, [meals, page.getByRole('menu')], 'khoan-thu-menu');
    await page.getByRole('menuitem', { name: 'Chỉnh sửa' }).click();
    const edit = page.getByRole('dialog');
    await edit.getByLabel('Lý do').fill('Điều chỉnh giá suất ăn từ tháng 11');
    await edit.getByLabel('Giá / đơn vị (chưa VAT)').fill('42000');
    await shot(edit, 'khoan-thu-sua');
    await dismiss(page);
  });

  await test.step('promotions', async () => {
    await go(page, 'Tài chính', 'Ưu đãi');
    await page.getByRole('button', { name: 'Thêm chính sách' }).click();
    let add = dialog(page, 'Thêm chính sách ưu đãi');
    await add.getByLabel('Tên chính sách').fill('Giảm học phí anh chị em');
    for (const name of ['Học phí Mầm', 'Học phí Chồi', 'Học phí Lá']) await add.getByRole('checkbox', { name }).check();
    await add.getByLabel('Mức giảm').fill('10');
    await add.getByLabel('Hiệu lực từ').fill('01/08/2026');
    await shot(add, 'uu-dai-them');
    await add.getByRole('button', { name: 'Lưu phiên bản ưu đãi' }).click();
    await expect(add).toBeHidden();
    await page.getByRole('button', { name: /^Tùy chọn/ }).first().click();
    await page.waitForTimeout(300);
    const versions = page.getByRole('table').first();
    await shotSpan(page, [versions.locator('tbody tr').first(), page.getByRole('menu')], 'uu-dai-menu');
    await page.getByRole('menuitem', { name: 'Kích hoạt phiên bản' }).click();
    await page.getByRole('button', { name: 'Xác nhận kích hoạt' }).click();
    await expect(versions).toContainText('Đang áp dụng');
    await page.getByRole('button', { name: /^Tùy chọn/ }).first().click();
    await page.getByRole('menuitem', { name: 'Gán học sinh' }).click();
    const assign = page.getByRole('dialog');
    await assign.getByLabel('Áp dụng từ').fill('01/10/2026');
    for (const name of ['Hoàng Khánh Linh', 'Đỗ Thảo Vy']) await assign.getByRole('row').filter({ hasText: name }).getByRole('checkbox').check();
    await assign.getByLabel('Lý do').fill('Hai chị em cùng học tại trường');
    await shot(assign, 'uu-dai-gan-hoc-sinh');
    await assign.getByRole('button', { name: 'Lưu gán học sinh' }).click();
    await expect(assign).toBeHidden();
    await page.getByRole('button', { name: 'Thêm chính sách' }).click();
    add = dialog(page, 'Thêm chính sách ưu đãi');
    await add.getByLabel('Tên chính sách').fill('Đóng trước 3 tháng');
    for (const name of ['Học phí Mầm', 'Học phí Chồi', 'Học phí Lá']) await add.getByRole('checkbox', { name }).check();
    await add.getByLabel('Mức giảm').fill('5');
    await add.getByLabel('Hiệu lực từ').fill('01/08/2026');
    await add.getByRole('radio', { name: /Ưu đãi nộp trước/ }).check();
    await add.getByLabel('Thời hạn nộp trước (tháng)').fill('3');
    await shot(add, 'uu-dai-nop-truoc');
    await add.getByRole('button', { name: 'Lưu phiên bản ưu đãi' }).click();
    await expect(add).toBeHidden();
    await versions.locator('tbody tr').filter({ hasText: 'Đóng trước 3 tháng' }).getByRole('button', { name: /^Tùy chọn/ }).click();
    await page.getByRole('menuitem', { name: 'Kích hoạt phiên bản' }).click();
    await page.getByRole('button', { name: 'Xác nhận kích hoạt' }).click();
    await expect(versions.locator('tbody tr').filter({ hasText: 'Đóng trước 3 tháng' })).toContainText('Đang áp dụng');
    await shotSpan(page, [versions, page.getByRole('table').nth(1)], 'uu-dai-danh-sach');
  });

  await test.step('extracurricular classes', async () => {
    await go(page, 'Danh bộ', 'Lớp ngoại khóa');
    await page.getByRole('button', { name: 'Thêm lớp ngoại khóa' }).click();
    const add = dialog(page, 'Thêm lớp ngoại khóa');
    await add.getByLabel('Tên lớp').fill('Năng khiếu vẽ (T6)');
    const drawing = await add.getByLabel('Khoản thu').locator('option', { hasText: 'Năng khiếu vẽ' }).getAttribute('value');
    await add.getByLabel('Khoản thu').selectOption(drawing!);
    await shot(add, 'ngoai-khoa-them-lop');
    await add.getByRole('button', { name: 'Lưu lớp ngoại khóa' }).click();
    await expect(add).toBeHidden();
    const list = page.getByRole('table', { name: new RegExp(`^Lớp ngoại khóa · ${school}`) });
    await expect(list).toContainText('Năng khiếu vẽ (T6)');
    await shot(list, 'ngoai-khoa-danh-sach');
    await list.locator('tbody tr').filter({ hasText: 'Tiếng Anh A1 (T3-T5)' }).getByRole('link', { name: 'Xem thành viên' }).click();
    await expect(page.getByRole('heading', { name: 'Tiếng Anh A1 (T3-T5)' })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    const members = page.getByRole('dialog');
    await members.getByRole('row').filter({ hasText: 'Đặng Quỳnh Anh' }).getByRole('checkbox').check();
    await members.getByLabel('Hiệu lực từ').fill('01/10/2026');
    await members.getByLabel('Lý do').fill('Phụ huynh đăng ký từ tháng 10');
    await shot(members, 'ngoai-khoa-them-hoc-sinh');
    await members.getByRole('button', { name: 'Thêm học sinh đã chọn' }).click();
    await expect(members).toBeHidden();
    await expect(page.getByRole('table').last()).toContainText('Đặng Quỳnh Anh');
    await shot(page, 'ngoai-khoa-chi-tiet');
    await go(page, 'Danh bộ', 'Học sinh');
    await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
    const intake = dialog(page, 'Tạo học sinh và ghi danh');
    await intake.getByRole('radio', { name: 'Chỉ ngoại khóa' }).check();
    await shot(intake.getByRole('group', { name: /Ghi danh/ }), 'hoc-sinh-chi-ngoai-khoa');
    await dismiss(page);
  });

  await test.step('october run', async () => {
    await go(page, 'Tài chính', 'Đợt thu');
    await page.getByRole('button', { name: 'Tạo đợt thu' }).click();
    const open = dialog(page, 'Tạo hoặc mở đợt thu');
    await open.getByLabel('Năm học').selectOption({ label: 'Năm học 2026-2027' });
    await open.getByLabel('Tháng thu').selectOption('2026-10');
    await shot(open, 'dot-thu-tao');
    await open.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
    await expect(page.getByRole('heading', { name: 'Đợt thu tháng 10/2026 · Thiết lập khoản thu', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
    const line = dialog(page, 'Thêm khoản thu');
    await line.getByLabel('Khoản thu').selectOption({ label: 'Phí dã ngoại · 250.000 đ/lần' });
    await line.getByRole('radio', { name: 'Lớp chính thức' }).check();
    await line.getByRole('checkbox', { name: 'Lá 1' }).check();
    await shot(line, 'dot-thu-them-khoan-thu');
    await line.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
    await expect(line).toBeHidden();
    await shot(region(page, 'Lớp ngoại khóa trong đợt'), 'dot-thu-ngoai-khoa-trong-dot');
    await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
    await expect(page.getByRole('heading', { name: 'Kết quả xem trước từ máy chủ' })).toBeVisible();
    await shot(region(page, 'Khoản thu trong đợt'), 'dot-thu-khoan-thu-trong-dot');
    await shot(page.getByRole('table', { name: 'Tạm tính theo dòng khoản thu' }), 'dot-thu-xem-truoc-tong');
    await shot(page.getByRole('table', { name: 'Học sinh đủ điều kiện' }), 'dot-thu-xem-truoc-hoc-sinh');
    await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
    await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
    await shot(page.getByRole('dialog'), 'dot-thu-tao-hoa-don-xac-nhan');
    // The progress card only shows while the worker runs; slow the status polls so it stays on screen for the picture.
    const slow = async (route: import('@playwright/test').Route) => { await new Promise((done) => setTimeout(done, 3000)); await route.continue().catch(() => undefined); };
    await page.route(/\/operations\/|\/generation/, slow);
    await page.getByRole('button', { name: /Tạo hóa đơn nháp cho \d+ học sinh/ }).click();
    await expect(page.getByRole('heading', { name: 'Tiến độ tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 15_000 });
    await shot(page.getByRole('heading', { name: 'Tiến độ tạo hóa đơn từ máy chủ' }).locator('xpath=ancestor::section[1]'), 'dot-thu-tien-do');
    await page.unroute(/\/operations\/|\/generation/, slow).catch(() => undefined);
    await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 30_000 });
    await shot(region(page, 'Hóa đơn trong đợt'), 'dot-thu-da-tao-hoa-don');
  });

  await test.step('october invoices', async () => {
    const back = () => page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await reviewStudent(page, 'Nguyễn Minh An');
    const meals = region(page, 'Chi tiết hóa đơn').getByRole('row').filter({ hasText: 'Tiền ăn' });
    await meals.locator('input').nth(2).fill('3');
    await page.getByPlaceholder(/Lý do sửa phần bớt/).fill('Nghỉ ốm thêm 1 ngày, phụ huynh báo qua điện thoại');
    await expect(page.getByText(/Số in nghiêng là số dự kiến/)).toBeVisible();
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-sua-bot');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0);
    await back();
    await reviewStudent(page, 'Vũ Minh Khang');
    await region(page, 'Gói nộp trước').getByRole('button', { name: 'Áp dụng gói nộp trước' }).click();
    const apply = dialog(page, 'Áp dụng gói nộp trước');
    const packageValue = await apply.getByLabel('Gói nộp trước').locator('option', { hasText: 'Đóng trước 3 tháng' }).getAttribute('value');
    await apply.getByLabel('Gói nộp trước').selectOption(packageValue!);
    await expect(apply.getByText('12/2026')).toBeVisible();
    await shot(apply, 'hoa-don-nop-truoc-xem-truoc');
    await apply.getByRole('button', { name: 'Áp dụng gói' }).click();
    const coverage = region(page, 'Gói nộp trước');
    await expect(coverage).toContainText('Chờ thu đủ');
    await shot(coverage, 'hoa-don-nop-truoc');
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-nop-truoc-dong');
    await back();

    // Submit and approve the first notice, keeping it open for the payment pictures; the others wait for approval.
    await runInvoices(page).getByRole('button', { name: 'Rà soát hóa đơn' }).first().click();
    await expect(review(page)).toBeVisible();
    await shot(page.getByRole('complementary', { name: 'Rà soát trước khi gửi duyệt' }), 'hoa-don-ra-soat-gui-duyet');
    await issue(page, false, (target) => shot(target, 'hoa-don-xac-nhan-gui-duyet'), { approve: false, pendingShot: (target) => shot(target, 'hoa-don-cho-duyet') });
    await approve(page);
    await shot(page.getByRole('complementary', { name: 'Thanh toán' }), 'hoa-don-thanh-toan');
    await page.getByRole('button', { name: 'Xem ảnh hóa đơn' }).first().click();
    await expect(page.getByRole('img', { name: 'Xem trước ảnh hóa đơn' }).first()).toBeVisible();
    await page.waitForTimeout(500);
    await shot(dialog(page, 'Ảnh hóa đơn'), 'hoa-don-anh');
    await dismiss(page);
    await review(page).getByRole('button', { name: /^Học sinh kế tiếp/ }).click();
    for (let index = 0; index < 9; index += 1) await issue(page, true, undefined, { approve: false });
    await issue(page, false, undefined, { approve: false });
    await expect(page.getByText(/Đã gửi duyệt toàn bộ hóa đơn nháp trong đợt/)).toBeVisible();

    // The manager returns one notice with a note; Finance reads it on the invoice and submits again.
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await showNotices(page, /^Chờ duyệt/);
    await reviewStudent(page, 'Trần Gia Bình');
    await review(page).getByRole('button', { name: 'Trả lại', exact: true }).click();
    const giveBack = dialog(page, /^Trả lại hóa đơn/);
    await giveBack.getByLabel('Ghi chú cho kế toán').fill('Tháng 10 bé nghỉ có phép 2 ngày (07 và 08/10), chưa bớt tiền ăn.');
    await shot(giveBack, 'hoa-don-tra-lai');
    await giveBack.getByRole('button', { name: 'Trả lại', exact: true }).click();
    await expect(giveBack).toBeHidden();
    await expect(page.getByText('Ghi chú của quản lý')).toBeVisible();
    await shot(page.getByRole('complementary', { name: 'Rà soát trước khi gửi duyệt' }), 'hoa-don-ghi-chu-tra-lai');
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await showNotices(page, /^Cần sửa/);
    await shot(region(page, 'Hóa đơn trong đợt'), 'dot-thu-can-sua');
    await shot(region(page, 'Hóa đơn theo trạng thái'), 'dot-thu-trang-thai-hoa-don');
    await reviewStudent(page, 'Trần Gia Bình');
    await issue(page, false, undefined, { approve: false });

    // Bulk approval from the run page.
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await showNotices(page, /^Chờ duyệt/);
    await runInvoices(page).getByRole('checkbox', { name: 'Chọn tất cả hóa đơn đang hiện' }).check();
    await page.getByRole('region', { name: 'Thao tác với hóa đơn đã chọn' }).getByRole('button', { name: 'Duyệt & gửi phụ huynh' }).click();
    const approval = dialog(page, /^Duyệt & gửi \d+ hóa đơn/);
    await expect(approval.getByRole('table', { name: 'Theo lớp' })).toBeVisible();
    // The dialog scrolls inside the viewport; a taller window shows all of it in one picture.
    await page.setViewportSize({ width: 1440, height: 1500 });
    await shot(approval, 'dot-thu-duyet');
    await page.setViewportSize({ width: 1440, height: 900 });
    await approval.getByRole('button', { name: 'Duyệt & gửi phụ huynh' }).click();
    await expect(approval).toBeHidden({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Tải ảnh hóa đơn (ZIP)' }).click();
    await shot(dialog(page, 'Tải ảnh hóa đơn (ZIP)'), 'dot-thu-tai-zip');
    await dismiss(page);
  });

  await test.step('october receipts', async () => {
    await go(page, 'Tài chính', 'Thu tiền');
    const queue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
    await expect(queue).toContainText('Lê Bảo Ngọc');
    await shot(page, 'thu-tien-danh-sach');
    const vcb = await page.getByLabel('Tài khoản nhận').locator('option', { hasText: 'NGUYEN THI MAU' }).getAttribute('value');
    await page.getByLabel('Tài khoản nhận').selectOption(vcb!);
    await page.getByRole('button', { name: 'Lọc' }).click();
    await expect(queue).not.toContainText('BIDV');
    await shot(page.locator('.school-context-workspace'), 'thu-tien-loc-tai-khoan');
    await page.getByLabel('Tài khoản nhận').selectOption('');
    await page.getByRole('button', { name: 'Lọc' }).click();
    await receive(page, 'Lê Bảo Ngọc', 'cá nhân', '3000000', (target) => shot(target, 'thu-tien-ghi-thieu'));
    await shot(page.locator('section.receipt-result'), 'thu-tien-ghi-thieu-ket-qua');
    await receive(page, 'Trần Gia Bình', 'cá nhân', '3600000');
    await shot(page.locator('section.receipt-result'), 'thu-tien-ghi-thua-ket-qua');
    for (const name of ['Lê Bảo Ngọc', 'Nguyễn Minh An', 'Trần Gia Bình', 'Hoàng Khánh Linh', 'Vũ Minh Khang', 'Đỗ Thảo Vy', 'Bùi Gia Hân', 'Ngô Tuấn Kiệt']) await receive(page, name, 'trường');
    for (const name of ['Nguyễn Minh An', 'Hoàng Khánh Linh', 'Vũ Minh Khang', 'Đỗ Thảo Vy', 'Bùi Gia Hân', 'Ngô Tuấn Kiệt', 'Đặng Quỳnh Anh', 'Mai Anh Thư']) await receive(page, name, 'cá nhân');
  });

  await test.step('revisions', async () => {
    await openMonth(page, '2026-10');
    await reviewStudent(page, 'Đặng Quỳnh Anh');
    await page.getByRole('button', { name: 'Chuẩn bị bản điều chỉnh' }).click();
    let prepare = page.getByRole('dialog');
    await prepare.getByRole('radio', { name: /^Phần 1/ }).check();
    await prepare.getByLabel('Lý do điều chỉnh').fill('Lớp Lá 1 hoãn dã ngoại, bỏ phí dã ngoại tháng 10');
    await shot(prepare, 'dieu-chinh-chuan-bi');
    await prepare.getByRole('button', { name: 'Chuẩn bị bản điều chỉnh' }).click();
    await expect(prepare).toBeHidden();
    const trip = region(page, 'Chi tiết hóa đơn').getByRole('row').filter({ hasText: 'Phí dã ngoại' });
    await trip.getByRole('button', { name: 'Xóa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xóa dòng Phí dã ngoại' }).click();
    await expect(region(page, 'Chi tiết hóa đơn')).not.toContainText('Phí dã ngoại');
    await shot(region(page, 'Chi tiết hóa đơn'), 'dieu-chinh-ban-nhap');
    await issue(page, false, (target) => shot(target, 'dieu-chinh-gui-duyet'));
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await showNotices(page, /^Đã thu đủ/);
    await reviewStudent(page, 'Ngô Tuấn Kiệt');
    await page.getByRole('button', { name: 'Chuẩn bị bản điều chỉnh' }).click();
    prepare = page.getByRole('dialog');
    await prepare.getByRole('radio', { name: /^Phần 1/ }).check();
    await prepare.getByLabel('Lý do điều chỉnh').fill('Kiểm tra lại tiền ăn');
    await prepare.getByRole('button', { name: 'Chuẩn bị bản điều chỉnh' }).click();
    await expect(prepare).toBeHidden();
    await page.getByRole('button', { name: 'Hủy bản điều chỉnh' }).click();
    const discard = page.getByRole('dialog');
    await discard.getByLabel('Lý do hủy').fill('Tiền ăn đã đúng, không cần điều chỉnh');
    await shot(discard, 'dieu-chinh-huy');
    await discard.getByRole('button', { name: 'Hủy bản điều chỉnh' }).click();
    await expect(discard).toBeHidden();
  });

  await test.step('november run, lock, close, reports and prior debt', async () => {
    await go(page, 'Tài chính', 'Đợt thu');
    await page.getByRole('button', { name: 'Tạo đợt thu' }).click();
    const open = dialog(page, 'Tạo hoặc mở đợt thu');
    await open.getByLabel('Năm học').selectOption({ label: 'Năm học 2026-2027' });
    await open.getByLabel('Tháng thu').selectOption('2026-11');
    await open.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
    await expect(page.getByRole('heading', { name: 'Đợt thu tháng 11/2026 · Thiết lập khoản thu', level: 1 })).toBeVisible();
    await generate(page, 11);
    const lock = page.locator('div').filter({ has: page.getByText(/^Đợt thu tháng 10\/2026 chưa đóng/) }).filter({ has: page.getByRole('button', { name: 'Mở đợt thu 10/2026' }) }).last();
    await shot(lock, 'dot-thu-khoa-dot-truoc');
    await reviewStudent(page, 'Lê Bảo Ngọc');
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-chenh-lech-ky-truoc');
    await issue(page, false, undefined, { approve: false });
    await shot(page.getByRole('complementary', { name: 'Chờ duyệt' }), 'hoa-don-khoa-duyet');
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await page.getByRole('button', { name: 'Mở đợt thu 10/2026' }).click();
    await expect(page.getByRole('heading', { name: /^Đợt thu tháng 10\/2026 · Duyệt & thu tiền/, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Đóng đợt thu', exact: true }).click();
    const close = page.getByRole('dialog');
    await close.getByLabel('Lý do đóng đợt thu').fill('Đã phát hành đủ hóa đơn tháng 10');
    await shot(close, 'dot-thu-dong');
    await close.getByRole('button', { name: /^Đóng đợt thu/ }).click();
    await expect(close).toBeHidden();
    // Reports before the debt moves, so the Công nợ tab still lists the unpaid October notice.
    await go(page, 'Tài chính', 'Báo cáo');
    await page.getByRole('button', { name: 'Xem số liệu' }).click();
    await expect(page.getByText(/^Số liệu chốt/)).toBeVisible();
    for (const [tab, name] of [['Tổng quan', 'bao-cao-tong-quan'], ['Đối soát đợt thu', 'bao-cao-doi-soat'], ['Công nợ', 'bao-cao-cong-no'], ['Sổ tiền và điều chỉnh', 'bao-cao-so-tien']] as const) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(1000);
      await shot(page.locator('.school-context-workspace'), name);
    }
    await openMonth(page, '2026-11');
    const debts = region(page, 'Công nợ kỳ trước');
    await expect(debts).toContainText('Phạm Đức Huy');
    await shot(debts, 'cong-no-danh-sach');
    await debts.getByRole('button', { name: 'Chuyển tất cả công nợ' }).click();
    await shot(page.getByRole('dialog'), 'cong-no-xac-nhan');
    await page.getByRole('dialog').getByRole('button', { name: 'Chuyển công nợ' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await reviewStudent(page, 'Phạm Đức Huy');
    await expect(region(page, 'Chi tiết hóa đơn')).toContainText('Công nợ kỳ trước');
    await shot(region(page, 'Chi tiết hóa đơn'), 'cong-no-tren-hoa-don');
  });

});
