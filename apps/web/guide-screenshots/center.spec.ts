import { expect, test } from '@playwright/test';
import { dialog, dismiss, generate, go, issue, login, openRun, openSchool, receive, region, runInvoices, seed, shooter } from './helpers';

// Drives the synthetic "Trung tâm Anh ngữ Hoa Mai" through a realistic sequence of units and saves the screenshots
// that the language-center guides (src/guides/articles/trung-tam) embed. Everything shown is invented demo data.
const center = 'Trung tâm Anh ngữ Hoa Mai';
const shot = shooter('tt-');

test('language center guide screenshots', async ({ page }) => {
  seed('seed-guide-demo-center.ts');
  await login(page, 'guide-demo-admin', 'guide-demo-admin@example.com');
  await openSchool(page, center);

  await test.step('settings', async () => {
    await go(page, 'Cấu hình trường', 'Cấu hình chung');
    await page.getByRole('link', { name: 'Tài chính & thanh toán' }).click();
    await shot(page.locator('section, article, div.card').filter({ has: page.getByRole('heading', { name: 'Tài khoản nhận tiền' }) }).last(), 'cau-hinh-tai-khoan');
  });

  await test.step('classes', async () => {
    await go(page, 'Danh bộ', 'Lớp học');
    const table = page.getByRole('table', { name: `Lớp học của ${center}` });
    await expect(table).toContainText('Flyers 1');
    await shot(table, 'lop-hoc-danh-sach');
    await table.locator('tbody tr').filter({ hasText: 'Starters 1' }).getByRole('button', { name: 'Khoản thu cố định' }).click();
    await shot(page.getByRole('dialog'), 'lop-hoc-khoan-thu-co-dinh');
    await dismiss(page);
    await table.locator('tbody tr').filter({ hasText: 'Starters 1' }).getByRole('button', { name: 'Tài khoản thu' }).click();
    await shot(page.getByRole('dialog'), 'lop-hoc-tai-khoan-thu');
    await dismiss(page);
  });

  await test.step('students', async () => {
    await go(page, 'Danh bộ', 'Học sinh');
    await expect(page.getByRole('table', { name: 'Danh sách học sinh' })).toContainText('Nguyễn Minh Anh');
    await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
    const intake = dialog(page, 'Tạo học sinh và ghi danh');
    await intake.getByLabel('Họ và tên', { exact: true }).fill('Lâm Gia Hân');
    await intake.getByLabel('Ngày sinh').fill('14/03/2017');
    await intake.getByRole('radio', { name: 'Xếp lớp', exact: true }).check();
    await intake.locator('label').filter({ hasText: /^Lớp/ }).getByRole('combobox').selectOption({ label: 'Starters 1' });
    await intake.getByLabel('Ngày hiệu lực').fill('05/10/2026');
    await shot(intake, 'hoc-sinh-them');
    await dismiss(page);
  });

  await test.step('receivables', async () => {
    await go(page, 'Tài chính', 'Khoản thu');
    const list = page.getByRole('table').first();
    await expect(list).toContainText('Học phí Starters');
    await shot(list, 'khoan-thu-danh-sach');
    await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
    const add = dialog(page, 'Thêm khoản thu');
    await add.getByRole('radio', { name: 'Khoản thu cố định' }).check();
    await add.getByRole('radio', { name: 'Các lớp được chọn' }).check();
    await add.getByRole('checkbox', { name: 'Flyers 1' }).check();
    await add.getByLabel('Tên khoản thu').fill('Học phí Flyers nâng cao');
    await add.getByLabel('Đơn vị tính').fill('unit');
    await add.getByLabel('Giá / đơn vị (chưa VAT)').fill('5200000');
    await shot(add, 'khoan-thu-them');
    await dismiss(page);
  });

  await test.step('services', async () => {
    await go(page, 'Danh bộ', 'Dịch vụ');
    const services = page.getByRole('table', { name: `Dịch vụ · ${center}` });
    await expect(services).toContainText('Đưa đón tuyến 1');
    await shot(services, 'dich-vu-danh-sach');
    await page.getByRole('button', { name: 'Thêm dịch vụ' }).click();
    const add = dialog(page, 'Thêm dịch vụ');
    await add.getByLabel('Tên dịch vụ').fill('Đưa đón tuyến 2');
    await add.getByLabel('Khoản thu').selectOption({ index: 1 });
    await shot(add, 'dich-vu-them');
    await dismiss(page);
    await page.getByRole('link', { name: 'Xem thành viên' }).first().click();
    await expect(page.getByRole('heading', { name: 'Đưa đón tuyến 1' })).toBeVisible();
    await shot(page, 'dich-vu-chi-tiet');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.waitForTimeout(500);
    await shot(page.getByRole('dialog'), 'dich-vu-them-hoc-sinh');
    await dismiss(page);
  });

  await test.step('promotions', async () => {
    await go(page, 'Tài chính', 'Ưu đãi');
    await page.getByRole('button', { name: 'Thêm chính sách' }).click();
    const add = dialog(page, 'Thêm chính sách ưu đãi');
    await add.getByLabel('Tên chính sách').fill('Giảm học phí anh chị em');
    for (const name of ['Học phí Starters', 'Học phí Movers', 'Học phí Flyers']) await add.getByRole('checkbox', { name }).check();
    await add.getByLabel('Mức giảm').fill('10');
    await add.getByLabel('Hiệu lực từ').fill('01/08/2026');
    await shot(add, 'uu-dai-them');
    await add.getByRole('button', { name: 'Lưu phiên bản ưu đãi' }).click();
    await expect(add).toBeHidden();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Tùy chọn/ }).first().click();
    await page.getByRole('menuitem', { name: 'Kích hoạt phiên bản' }).click();
    await page.getByRole('button', { name: 'Xác nhận kích hoạt' }).click();
    await expect(page.getByRole('table').first()).toContainText('Đang áp dụng');
    await page.getByRole('button', { name: /^Tùy chọn/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: 'Gán học sinh' }).click();
    const assign = page.getByRole('dialog');
    await assign.getByLabel('Áp dụng từ').fill('01/08/2026');
    await assign.getByRole('row').filter({ hasText: 'Hoàng Bảo Ngọc' }).getByRole('checkbox').check();
    await assign.getByRole('row').filter({ hasText: 'Đặng Thu Hà' }).getByRole('checkbox').check();
    await assign.getByLabel('Lý do').fill('Anh chị em cùng học tại trung tâm');
    await shot(assign, 'uu-dai-gan-hoc-sinh');
    await assign.getByRole('button', { name: 'Lưu gán học sinh' }).click();
    await expect(assign).toBeHidden();
    await page.waitForTimeout(800);
  });

  await test.step('starters 1 · unit 1', async () => {
    await go(page, 'Tài chính', 'Đợt thu');
    await page.getByRole('button', { name: 'Mở đợt thu' }).click();
    const open = dialog(page, 'Mở đợt thu');
    await open.getByLabel('Lớp').selectOption({ label: 'Starters 1' });
    await open.getByLabel('Tên đợt').fill('Unit 1');
    await open.getByLabel('Từ ngày').fill('03/08/2026');
    await open.getByLabel('Đến ngày').fill('26/09/2026');
    await shot(open, 'dot-thu-mo');
    await open.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
    await expect(page.getByRole('heading', { name: 'Starters 1 · Unit 1 · Nháp', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
    const line = dialog(page, 'Thêm khoản thu');
    await line.getByLabel('Khoản thu').selectOption({ label: 'Giáo trình · 650.000 đ/bộ' });
    await line.getByRole('radio', { name: 'Cả lớp' }).check();
    await shot(line, 'dot-thu-them-khoan-thu');
    await line.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
    await expect(line).toBeHidden();
    await shot(region(page, 'Khoản thu trong đợt'), 'dot-thu-khoan-thu-trong-dot');
    await shot(region(page, 'Dịch vụ trong đợt'), 'dot-thu-dich-vu-trong-dot');
    await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
    await expect(page.getByRole('heading', { name: 'Kết quả xem trước từ máy chủ' })).toBeVisible();
    await shot(region(page, 'Kết quả xem trước từ máy chủ'), 'dot-thu-xem-truoc');
    await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
    await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
    await shot(page.getByRole('dialog'), 'dot-thu-tao-hoa-don-xac-nhan');
    await page.getByRole('button', { name: /Tạo hóa đơn nháp cho 6 học sinh/ }).click();
    await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 30_000 });
    await expect(runInvoices(page).locator('tbody tr')).toHaveCount(6);
    await shot(region(page, 'Hóa đơn trong đợt'), 'dot-thu-hoa-don-trong-dot');
    await runInvoices(page).getByRole('button', { name: 'Rà soát hóa đơn' }).first().click();
    await expect(page.getByRole('region', { name: /^Rà soát hóa đơn / })).toBeVisible();
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-chi-tiet');
    await shot(page.getByRole('complementary', { name: 'Rà soát trước khi phát hành' }), 'hoa-don-ra-soat-phat-hanh');
    for (let index = 0; index < 5; index += 1) await issue(page, true, index === 0 ? (target) => shot(target, 'hoa-don-xac-nhan-phat-hanh') : undefined);
    await issue(page, false);
    await shot(page.getByRole('complementary', { name: 'Thanh toán' }), 'hoa-don-thanh-toan');
    await page.getByRole('button', { name: 'Xem ảnh hóa đơn' }).first().click();
    const image = page.getByRole('img', { name: 'Xem trước ảnh hóa đơn' }).first();
    await expect(image).toBeVisible();
    await page.waitForTimeout(500);
    await shot(dialog(page, 'Ảnh hóa đơn'), 'hoa-don-anh');
    await dismiss(page);
  });

  await test.step('receipts unit 1', async () => {
    await go(page, 'Tài chính', 'Thu tiền');
    const queue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
    await expect(queue).toContainText('Starters 1 · Unit 1');
    await shot(page.getByRole('table', { name: 'Hóa đơn chờ thu' }), 'thu-tien-danh-sach');
    for (const student of ['Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Khánh Chi', 'Hoàng Bảo Ngọc', 'Vũ Hải Đăng']) await receive(page, student, 'trường');
    await receive(page, 'Nguyễn Minh Anh', 'cá nhân');
    await receive(page, 'Trần Gia Bảo', 'cá nhân', '3300000', (target) => shot(target, 'thu-tien-ghi-thieu'));
    await shot(page.locator('section.receipt-result'), 'thu-tien-ghi-thieu-ket-qua');
    await receive(page, 'Lê Khánh Chi', 'cá nhân');
    await receive(page, 'Hoàng Bảo Ngọc', 'cá nhân');
    await receive(page, 'Vũ Hải Đăng', 'cá nhân', '3700000');
  });

  await test.step('starters 3 merges into starters 1', async () => {
    await go(page, 'Tài chính', 'Đợt thu');
    await page.getByRole('button', { name: 'Mở đợt thu' }).click();
    const open = dialog(page, 'Mở đợt thu');
    await open.getByLabel('Lớp').selectOption({ label: 'Starters 3' });
    await open.getByLabel('Tên đợt').fill('Unit 2');
    await open.getByLabel('Từ ngày').fill('14/09/2026');
    await open.getByLabel('Đến ngày').fill('07/11/2026');
    await open.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
    await expect(page.getByRole('heading', { name: 'Starters 3 · Unit 2 · Nháp', level: 1 })).toBeVisible();
    await generate(page, 2);
    await go(page, 'Danh bộ', 'Học sinh');
    await page.getByRole('button', { name: 'Chuyển danh bộ' }).click();
    await page.getByLabel('Lớp nguồn').selectOption({ label: 'Starters 3' });
    await page.getByLabel('Lớp đích').selectOption({ label: 'Starters 1' });
    await page.getByLabel('Ngày hiệu lực').fill('05/10/2026');
    await page.getByLabel('Lý do').fill('Gộp lớp Starters 3 vào Starters 1');
    await page.getByRole('button', { name: 'Tạo kết quả xem trước' }).click();
    await expect(page.getByText('2 học sinh có thể chuyển')).toBeVisible();
    await shot(page.locator('.school-context-workspace'), 'chuyen-danh-bo');
    await page.getByLabel('Nhập CHUYỂN DANH BỘ để xác nhận').fill('CHUYỂN DANH BỘ');
    await page.getByRole('button', { name: 'Xác nhận chuyển danh bộ' }).click();
    await page.waitForTimeout(2000);
  });

  await test.step('starters 1 · unit 2', async () => {
    await go(page, 'Tài chính', 'Đợt thu');
    await page.getByRole('button', { name: 'Mở đợt thu' }).click();
    const open = dialog(page, 'Mở đợt thu');
    await open.getByLabel('Lớp').selectOption({ label: 'Starters 1' });
    await open.getByLabel('Tên đợt').fill('Unit 2');
    await open.getByLabel('Từ ngày').fill('28/09/2026');
    await open.getByLabel('Đến ngày').fill('21/11/2026');
    await expect(open.getByText(/được sao chép từ đợt Unit 1 của lớp Starters 1/)).toBeVisible();
    await shot(open, 'dot-thu-mo-dot-sau');
    await open.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
    await expect(page.getByRole('heading', { name: 'Starters 1 · Unit 2 · Nháp', level: 1 })).toBeVisible();
    await generate(page, 8);
    const lock = page.locator('div').filter({ has: page.getByText(/^Chưa thể phát hành hóa đơn của đợt này/) }).filter({ has: page.getByRole('button', { name: 'Mở đợt thu Unit 1' }) }).last();
    await shot(lock, 'dot-thu-khoa-dot-truoc');
    await shot(runInvoices(page), 'dot-thu-hoa-don-trung-ky');
    await page.getByRole('button', { name: 'Mở đợt thu Unit 1' }).click();
    await expect(page.getByRole('heading', { name: 'Starters 1 · Unit 1 · Đã tạo hóa đơn', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Đóng đợt thu', exact: true }).click();
    const close = dialog(page, 'Đóng đợt thu Starters 1 · Unit 1');
    await close.getByLabel('Lý do đóng đợt thu').fill('Hết Unit 1, đã phát hành đủ hóa đơn');
    await shot(close, 'dot-thu-dong');
    await close.getByRole('button', { name: 'Đóng đợt thu Starters 1 · Unit 1' }).click();
    await expect(page.getByRole('heading', { name: 'Starters 1 · Unit 1 · Đã đóng', level: 1 })).toBeVisible();

    await openRun(page, 'Starters 1 · Unit 2');
    const debts = region(page, 'Công nợ kỳ trước');
    await expect(debts).toContainText('Phạm Đức Duy');
    await shot(debts, 'cong-no-danh-sach');
    await debts.getByRole('button', { name: 'Chuyển tất cả công nợ' }).click();
    await shot(page.getByRole('dialog'), 'cong-no-xac-nhan');
    await page.getByRole('dialog').getByRole('button', { name: 'Chuyển công nợ' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.waitForTimeout(800);

    const review = async (student: string) => {
      await runInvoices(page).locator('tbody tr').filter({ hasText: student }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
      await expect(page.getByRole('region', { name: new RegExp(`^Rà soát hóa đơn .*${student}`) })).toBeVisible();
    };
    await review('Trần Gia Bảo');
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-chenh-lech-ky-truoc');
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await review('Phạm Đức Duy');
    await shot(region(page, 'Chi tiết hóa đơn'), 'cong-no-tren-hoa-don');
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await review('Võ Nhật Hào');
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-trung-ky');
    const tuition = region(page, 'Chi tiết hóa đơn').getByRole('row').filter({ hasText: 'Học phí Starters' });
    await tuition.locator('input').nth(2).fill('1');
    await tuition.locator('input').nth(3).fill('3600000');
    await page.getByPlaceholder(/Lý do sửa phần bớt/).fill('Đã thu ở Starters 3');
    await expect(page.getByText(/Số in nghiêng là số dự kiến/)).toBeVisible();
    await shot(region(page, 'Chi tiết hóa đơn'), 'hoa-don-sua-bot');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await review('Nguyễn Minh Anh');
    await issue(page, false);
    await page.getByRole('button', { name: 'Chuẩn bị bản điều chỉnh' }).click();
    await page.waitForTimeout(400);
    await shot(page.getByRole('dialog'), 'dieu-chinh-chuan-bi');
    await dismiss(page);
  });

  await test.step('student joins mid-unit', async () => {
    await go(page, 'Danh bộ', 'Học sinh');
    await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
    const intake = dialog(page, 'Tạo học sinh và ghi danh');
    await intake.getByLabel('Họ và tên', { exact: true }).fill('Lâm Gia Hân');
    await intake.getByLabel('Ngày sinh').fill('14/03/2017');
    await intake.getByRole('radio', { name: 'Xếp lớp', exact: true }).check();
    await intake.locator('label').filter({ hasText: /^Lớp/ }).getByRole('combobox').selectOption({ label: 'Starters 1' });
    await intake.getByLabel('Ngày hiệu lực').fill('12/10/2026');
    await intake.getByRole('button', { name: 'Tạo học sinh' }).click();
    await expect(intake).toBeHidden();
    await openRun(page, 'Starters 1 · Unit 2');
    await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
    const add = dialog(page, 'Thêm học sinh vào đợt đã tạo');
    await expect(add).toContainText('Lâm Gia Hân');
    await shot(add, 'dot-thu-them-hoc-sinh');
    await add.getByRole('button', { name: 'Yêu cầu thêm' }).click();
    await page.getByRole('dialog', { name: /^Thêm .*Lâm Gia Hân vào đợt/ }).getByRole('button', { name: 'Thêm học sinh vào đợt' }).click();
    await expect(runInvoices(page)).toContainText('Lâm Gia Hân');
  });

  await test.step('other classes, run list, receipts and reports', async () => {
    for (const [className, name, from, to, count] of [['Movers 1', 'Unit 3', '17/08/2026', '10/10/2026', 5], ['Flyers 1', 'Term 1', '07/09/2026', '29/11/2026', 4]] as const) {
      await go(page, 'Tài chính', 'Đợt thu');
      await page.getByRole('button', { name: 'Mở đợt thu' }).click();
      const open = dialog(page, 'Mở đợt thu');
      await open.getByLabel('Lớp').selectOption({ label: className });
      await open.getByLabel('Tên đợt').fill(name);
      await open.getByLabel('Từ ngày').fill(from);
      await open.getByLabel('Đến ngày').fill(to);
      await open.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
      await expect(page.getByRole('heading', { name: `${className} · ${name} · Nháp`, level: 1 })).toBeVisible();
      if (className === 'Movers 1') await generate(page, count);
    }
    await go(page, 'Tài chính', 'Đợt thu');
    const runs = page.getByRole('table', { name: `Danh sách đợt thu của ${center}` });
    await expect(runs.locator('tbody tr')).toHaveCount(5);
    await shot(runs, 'dot-thu-danh-sach');
    await go(page, 'Tài chính', 'Báo cáo');
    await page.getByRole('button', { name: 'Xem số liệu' }).click();
    await expect(page.getByText(/^Số liệu chốt/)).toBeVisible();
    await shot(page.locator('.school-context-workspace'), 'bao-cao-tong-quan');
    await page.getByRole('tab', { name: 'Đối soát đợt thu' }).or(page.getByRole('link', { name: 'Đối soát đợt thu' })).or(page.getByRole('button', { name: 'Đối soát đợt thu' })).first().click();
    await page.waitForTimeout(1000);
    await shot(page.locator('.school-context-workspace'), 'bao-cao-doi-soat');
  });

});
