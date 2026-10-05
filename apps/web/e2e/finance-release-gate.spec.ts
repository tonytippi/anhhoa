import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.E2E_API_PORT ?? '3000'}`;
const app = `http://localhost:${process.env.E2E_APP_PORT ?? '5173'}`;

async function login(context: import('@playwright/test').BrowserContext) {
  const start = await context.request.get(`${api}/api/app/auth/google/start`, { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const authorizationUrl = new URL(start.headers().location!);
  const state = authorizationUrl.searchParams.get('state')!;
  const nonce = authorizationUrl.searchParams.get('nonce')!;
  const clientId = authorizationUrl.searchParams.get('client_id')!;
  const code = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: 'release-gate-admin', email: 'release-gate-admin@example.com', email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const callback = await context.request.get(`${api}/api/app/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`, { maxRedirects: 0 });
  expect(callback.status()).toBe(302);
}
async function openSchool(page: import('@playwright/test').Page, schoolName: string) {
  await page.getByRole('table', { name: 'Danh sách trường được cấp quyền' }).getByRole('row', { name: new RegExp(`${schoolName} Mở trường`) }).getByRole('button', { name: 'Mở trường' }).click();
}
async function openRun(page: import('@playwright/test').Page, month: string) {
  const trigger = page.getByRole('button', { name: `Tùy chọn cho đợt thu ${month}` });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click();
}

async function expectMenuDoesNotMoveNextRow(trigger: import('@playwright/test').Locator) {
  // Measure after the trigger is in view: click() would otherwise scroll and look like a layout shift.
  await trigger.scrollIntoViewIfNeeded();
  const row = trigger.locator('xpath=ancestor::tr[1]');
  const nextRow = row.locator('xpath=following-sibling::tr[1]');
  const before = await nextRow.boundingBox();
  expect(before).not.toBeNull();
  await trigger.click();
  await expect(trigger.page().getByRole('menu')).toBeVisible();
  const after = await nextRow.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.y).toBe(before?.y);
  expect(after?.height).toBe(before?.height);
  await trigger.page().keyboard.press('Escape');
  await expect(trigger.page().getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

test.describe.configure({ mode: 'serial' });

test('Admin Finance uses server-returned promotion values and clears the other School context', async ({ page }) => {
  await login(page.context());
  await page.goto(app);
  await openSchool(page, 'Release Gate A');
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 })).toBeFocused();
  // Story 5.34: extracurricular class -> bulk memberships -> bulk end, all through the server under Danh bộ.
  await page.getByRole('button', { name: 'Danh bộ' }).click();
  await page.getByRole('button', { name: 'Lớp ngoại khóa' }).click();
  await expect(page.getByRole('heading', { name: /^Lớp ngoại khóa · /, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm lớp ngoại khóa' }).click();
  const classDialog = page.getByRole('dialog', { name: 'Thêm lớp ngoại khóa' });
  await classDialog.getByLabel('Tên lớp').fill('Tiếng Anh A1 (T2-T4)');
  await classDialog.getByLabel('Khoản thu').selectOption({ label: 'Tiếng Anh Release 1 · 600.000 đ/tháng' });
  await classDialog.getByRole('button', { name: 'Lưu lớp ngoại khóa' }).click();
  await expect(classDialog).toBeHidden();
  await expect(page.getByRole('table', { name: /Lớp ngoại khóa/ })).toContainText('Tiếng Anh A1 (T2-T4)');
  await page.getByRole('link', { name: 'Xem thành viên' }).click();
  await expect(page.getByRole('heading', { name: /^Tiếng Anh A1 \(T2-T4\) · /, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm học sinh' }).click();
  const addDialog = page.getByRole('dialog', { name: /^Thêm học sinh/ });
  await addDialog.getByRole('checkbox', { name: 'Chọn tất cả học sinh có thể thêm' }).check();
  await addDialog.getByLabel('Hiệu lực từ').fill('2026-09-01');
  await addDialog.getByLabel('Lý do').fill('Đăng ký học kỳ 1');
  await addDialog.getByRole('button', { name: 'Thêm học sinh đã chọn' }).click();
  await expect(addDialog).toBeHidden();
  await page.getByLabel('Trạng thái').selectOption('ALL');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  const members = page.getByRole('table', { name: /^Thành viên/ });
  await expect(members).toContainText('Bé An');
  await expect(members).toContainText('Bé Bình');
  await members.getByRole('checkbox', { name: 'Chọn Bé Bình' }).check();
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  const endDialog = page.getByRole('dialog', { name: /^Kết thúc tham gia/ });
  await endDialog.getByLabel('Ngày kết thúc').fill('2026-11-15');
  await endDialog.getByLabel('Lý do').fill('Phụ huynh xin nghỉ');
  await endDialog.getByRole('button', { name: 'Kết thúc tham gia' }).click();
  await expect(endDialog).toBeHidden();
  await expect(members.getByRole('row', { name: /Bé Bình/ })).toContainText('15/11/2026');
  // Bé An leaves mid-month (single end); Bé Bình moves A1 -> A2 on 16/11 through a second class that shares the same receivable.
  await members.getByRole('checkbox', { name: 'Chọn Bé An' }).check();
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await endDialog.getByLabel('Ngày kết thúc').fill('2026-11-20');
  await endDialog.getByLabel('Lý do').fill('Nghỉ giữa tháng');
  await endDialog.getByRole('button', { name: 'Kết thúc tham gia' }).click();
  await expect(endDialog).toBeHidden();
  await expect(members.getByRole('row', { name: /Bé An/ })).toContainText('20/11/2026');
  await page.getByRole('link', { name: 'Lớp ngoại khóa', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm lớp ngoại khóa' }).click();
  const secondClassDialog = page.getByRole('dialog', { name: 'Thêm lớp ngoại khóa' });
  await secondClassDialog.getByLabel('Tên lớp').fill('Tiếng Anh A2 (T3-T5)');
  await secondClassDialog.getByLabel('Khoản thu').selectOption({ label: 'Tiếng Anh Release 1 · 600.000 đ/tháng' });
  await expect(secondClassDialog.getByText('Dùng chung với: Tiếng Anh A1 (T2-T4).')).toBeVisible();
  await secondClassDialog.getByRole('button', { name: 'Lưu lớp ngoại khóa' }).click();
  await expect(secondClassDialog).toBeHidden();
  await page.getByRole('row', { name: /^Tiếng Anh A2 \(T3-T5\)/ }).getByRole('link', { name: 'Xem thành viên' }).click();
  await page.getByRole('button', { name: 'Thêm học sinh' }).click();
  const moveDialog = page.getByRole('dialog', { name: /^Thêm học sinh/ });
  await moveDialog.getByRole('checkbox', { name: 'Chọn Bé Bình' }).check();
  await moveDialog.getByLabel('Hiệu lực từ').fill('2026-11-16');
  await moveDialog.getByLabel('Lý do').fill('Chuyển từ Tiếng Anh A1');
  await moveDialog.getByRole('button', { name: 'Thêm học sinh đã chọn' }).click();
  await expect(moveDialog).toBeHidden();
  await page.getByLabel('Trạng thái').selectOption('ALL');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.getByRole('table', { name: /^Thành viên/ }).getByRole('row', { name: /Bé Bình/ })).toContainText('16/11/2026');
  await page.getByRole('button', { name: 'Tài chính' }).click();
  const receivablesNavigation = page.getByRole('button', { name: 'Khoản thu' });
  await expect(receivablesNavigation).toBeVisible();
  await receivablesNavigation.click();
  await expect(page.getByRole('heading', { name: 'Khoản thu', level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const receivablesToolbar = page.getByRole('form', { name: 'Điều khiển danh sách khoản thu' });
  await expect(page.getByRole('button', { name: 'Quản lý nhóm' })).toHaveCount(0);
  await expect(receivablesToolbar.getByLabel('Nhóm').locator('option')).toHaveText(['Tất cả nhóm', 'Khoản thu cố định', 'Khoản thu linh hoạt', 'Ngoại khóa']);
  await expect(page.getByRole('button', { name: 'Thêm khoản thu' })).toBeInViewport();
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('Học phí Release 1');
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('gắn 2 lớp ngoại khóa');
  await page.getByRole('button', { name: 'Ưu đãi' }).click();
  await expect(page.getByRole('heading', { name: 'Ưu đãi', level: 1 })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Điều khiển danh sách ưu đãi' }).getByRole('button', { name: 'Thêm chính sách' })).toBeInViewport();
   await page.getByRole('button', { name: 'Đợt thu' }).click();
  await expect(page.getByRole('heading', { name: 'Đợt thu', level: 1 })).toBeVisible();
  const runsToolbar = page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' });
  await expect(runsToolbar.getByLabel('Lọc trạng thái')).toBeInViewport();
  const createRun = runsToolbar.getByRole('button', { name: 'Tạo đợt thu' });
  await createRun.scrollIntoViewIfNeeded();
  await expect(createRun).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 900 });

  await createRun.click();
  const runDialog = page.getByRole('dialog', { name: 'Tạo hoặc mở đợt thu' });
  await runDialog.getByLabel('Năm học').selectOption({ label: 'Năm học Release 2026' });
  await runDialog.getByLabel('Tháng thu').fill('2026-10');
  await runDialog.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
   await expect(page.getByRole('dialog', { name: 'Rời không gian làm việc?' })).toHaveCount(0);
   await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs\/[^/]+/);
   await expect(page.getByRole('heading', { name: 'Đợt thu tháng 10/2026 · Nháp' })).toBeVisible();
   await expect(page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' })).toHaveCount(0);
   await page.getByRole('button', { name: 'Quay lại danh sách đợt thu' }).click();
   await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs$/);
   await expect(page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' })).toBeVisible();
   await openRun(page, '2026-10');
  // Story 5.36: the October run lists the class with its members; leave it out of this run (the existing amounts below are fixed-line only).
  const octClasses = page.getByRole('table', { name: /Lớp ngoại khóa tính vào đợt thu tháng 10\/2026/ });
  await expect(octClasses.getByRole('row').filter({ hasText: 'Tiếng Anh A1 (T2-T4)' })).toContainText('Tính trong đợt');
  await page.getByRole('button', { name: 'Loại khỏi đợt này Tiếng Anh A1 (T2-T4)' }).click();
  await page.getByRole('dialog', { name: 'Loại Tiếng Anh A1 (T2-T4) khỏi đợt này' }).getByLabel('Lý do (không bắt buộc)').fill('Chưa thu ngoại khóa tháng 10');
  await page.getByRole('dialog').getByRole('button', { name: 'Loại khỏi đợt này' }).click();
  await expect(octClasses.getByRole('row').filter({ hasText: 'Tiếng Anh A1 (T2-T4)' })).toContainText('Loại khỏi đợt này');
  await page.getByRole('button', { name: 'Khôi phục Tiếng Anh A1 (T2-T4)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Khôi phục' }).click();
  await expect(octClasses.getByRole('row').filter({ hasText: 'Tiếng Anh A1 (T2-T4)' })).toContainText('Tính trong đợt');
  await page.getByRole('button', { name: 'Loại khỏi đợt này Tiếng Anh A1 (T2-T4)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Loại khỏi đợt này' }).click();
  await expect(octClasses.getByRole('row').filter({ hasText: 'Tiếng Anh A1 (T2-T4)' })).toContainText('Loại khỏi đợt này');
  // Story 5.35: opening the run already put the ACTIVE FIXED receivable in the template, for everyone.
  const templateTable = page.getByRole('table', { name: 'Khoản thu mẫu của đợt' });
  const feeRow = templateTable.getByRole('row').filter({ hasText: 'Học phí Release 1' });
  await expect(feeRow).toContainText('Cố định');
  await expect(feeRow).toContainText('Tự thêm khi mở đợt thu');
  await expect(feeRow).toContainText('Toàn bộ');
  await expect(feeRow).toContainText('150.000');
  await expect(page.getByRole('checkbox', { name: /Chọn RG1-/ })).toHaveCount(0);
  let selectionRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/selection')) selectionRequests += 1;
  });
  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/collection-runs/') &&
    response.url().endsWith('/preview') &&
    response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
  await expect((await previewResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Kết quả xem trước từ máy chủ' })).toBeVisible();
  const eligibleStudents = page.getByRole('table', { name: 'Học sinh đủ điều kiện' });
  await expect(eligibleStudents).toContainText('RG1-1 / Bé An');
  await expect(eligibleStudents).toContainText('Mầm Release 1');
  await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
  await expect(page.getByRole('button', { name: 'Tạo hóa đơn nháp' })).toBeVisible();
  const overview = page.getByLabel('Tổng quan do máy chủ tính');
  await expect(page.getByRole('list', { name: 'Tiến trình đợt thu' }).locator('[aria-current="step"]')).toHaveText('Sẵn sàng tạo hóa đơn');
  await expect(overview).toContainText('2');
  await expect(overview).toContainText('285.000 đ');
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
   await page.getByRole('button', { name: /Tạo hóa đơn nháp cho 2 học sinh/ }).click();
   await expect(page.getByRole('region', { name: 'Tiến độ tạo hóa đơn từ máy chủ' })).toContainText(/Đang xử lý \d+\/2/);
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 10000 });
  expect(selectionRequests).toBe(0);
   await expect(page.getByRole('list', { name: 'Tiến trình đợt thu' }).locator('[aria-current="step"]')).toHaveText('Đã tạo hóa đơn');
   await expect(overview).toContainText('285.000 đ');
   await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tr').filter({ hasText: 'RG1-1 / Bé An' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
   await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();
   await expect(page).toHaveURL(/\/collection-runs\/[^/]+\/invoices\/[^/?]+/);
   await expect(page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' })).toHaveCount(0);
   await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn', level: 1 })).toBeFocused();
   await page.reload();
   await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-1 / Bé An' }).getByText('Nháp', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Học sinh tiếp theo' })).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh tiếp theo' }).click();
    await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh trước' }).click();
    await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();

   const invoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-1/ });
   const invoiceLines = invoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' });
   await expect(invoiceLines).toContainText('150.000');
   await expect(invoiceLines).toContainText('15.000');
   await expect(invoiceLines).toContainText('135.000');
   await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
   await expect(invoiceReview.getByTitle('Nguồn')).toHaveText('Cố định');
   await invoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
   const firstIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho RG1-1 / Bé An · tháng 10/2026' });
   await expect(firstIssue).toContainText('RG1-1 / Bé An · tháng 10/2026');
   const issuedRunRefresh = page.waitForResponse((response) =>
     /\/finance\/collection-runs\/[^/]+$/.test(new URL(response.url()).pathname) &&
     response.request().method() === 'GET',
   );
   await firstIssue.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
   expect((await issuedRunRefresh).status()).toBe(200);
     await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' }).getByText('Nháp', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh trước' }).click();
    await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();
    await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
   await expect(invoiceReview.getByTitle('Nguồn')).toHaveText('Cố định');
     await expect(invoiceReview.getByRole('button', { name: 'Ghi thực nhận và đóng hóa đơn' })).toHaveCount(0);
    await invoiceReview.getByRole('button', { name: 'Quay lại đợt thu' }).click();
    await expect(page).toHaveURL(/\/collection-runs\/[^/]+$/);
    await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tbody tr').filter({ hasText: 'RG1-2 / Bé Bình' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  await expect(page.getByRole('region', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
  const secondInvoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-2/ });
  await expect(secondInvoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('150.000');
   await expect(secondInvoiceReview.getByText('135.000')).toHaveCount(0);

  await secondInvoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
   const secondIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho RG1-2 / Bé Bình · tháng 10/2026' });
    await expect(secondIssue).toContainText('RG1-2 / Bé Bình · tháng 10/2026');
    await secondIssue.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
   await expect(secondInvoiceReview.getByRole('complementary', { name: 'Thanh toán' })).toContainText('Tổng cần nộp150.000 đ');
    // The initial queue load rewrites the filter form with the server's default month when it lands, so let it finish before typing.
    const initialQueue = page.waitForResponse((response) => response.url().includes('/finance/receipt-queue?'));
    await page.getByRole('button', { name: 'Thu tiền' }).click();
    await expect(page.getByRole('heading', { name: 'Thu tiền' })).toBeVisible();
    expect((await initialQueue).status()).toBe(200);
    // The queue defaults to the current month, so select each month explicitly instead of depending on today's date.
    const receiptQueue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
    await expect(receiptQueue).toBeVisible();
    await expect(page.getByLabel('Tháng thu')).not.toHaveValue('');
    const septemberQueue = page.waitForResponse((response) => response.url().includes('/finance/receipt-queue?') && response.url().includes('billingMonth=2026-09'));
    await page.getByLabel('Tháng thu').fill('2026-09');
    await page.getByRole('button', { name: 'Lọc' }).click();
    expect((await septemberQueue).status()).toBe(200);
    // The seed already holds an issued 2026-09 Invoice.
    await expect(receiptQueue).toContainText('09/2026');
    const octoberQueue = page.waitForResponse((response) => response.url().includes('/finance/receipt-queue?') && response.url().includes('billingMonth=2026-10'));
    await page.getByLabel('Tháng thu').fill('2026-10');
    await page.getByRole('button', { name: 'Lọc' }).click();
    expect((await octoberQueue).status()).toBe(200);
    await expect(receiptQueue).not.toContainText('09/2026');
    await expect(receiptQueue).toContainText('RG1-1 / Bé An');
    await expect(receiptQueue).toContainText('RG1-2 / Bé Bình');
    await page.setViewportSize({ width: 390, height: 844 });
     const queueMenu = receiptQueue.getByRole('button', { name: 'Tùy chọn cho Bé An' });
     await expectMenuDoesNotMoveNextRow(queueMenu);
     await queueMenu.scrollIntoViewIfNeeded();
    await expect(queueMenu).toBeVisible();
    await queueMenu.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Ghi thực nhận' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(queueMenu).toBeFocused();
    await queueMenu.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('menuitem', { name: 'Ghi thực nhận' }).click();
    const queueReceipt = page.getByRole('dialog', { name: 'Ghi thực nhận cho Bé An' });
    await expect(queueReceipt.getByLabel('Số thực nhận (đ)')).toHaveValue('135000');
    await expect(queueReceipt.getByLabel('Số thực nhận (đ)')).toBeFocused();
    await queueReceipt.getByRole('button', { name: 'Hủy' }).focus();
    await page.keyboard.press('Tab');
    await expect(queueReceipt.getByLabel('Số thực nhận (đ)')).toBeFocused();
    const reconciledQueueRefresh = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/finance/receipt-queue') &&
      response.request().method() === 'GET',
    );
    let receiptPosts = 0;
    await page.route('**/finance/invoices/*/receipt', async (route) => {
      receiptPosts += 1;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.fulfill({ status: 504, contentType: 'application/json', body: '{"message":"gateway timeout"}' });
    }, { times: 1 });
    await queueReceipt.getByRole('button', { name: 'Xác nhận ghi thực nhận' }).click();
    expect((await reconciledQueueRefresh).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Kết quả ghi thực nhận' })).toBeVisible();
    expect(receiptPosts).toBe(1);
    const nextReceipt = page.getByRole('button', { name: 'Hóa đơn tiếp theo' });
    await expect(nextReceipt).toBeVisible();
    await expect(nextReceipt).toBeInViewport();
    await nextReceipt.click();
    const secondQueueReceipt = page.getByRole('dialog', { name: 'Ghi thực nhận cho Bé Bình' });
    await expect(secondQueueReceipt).toBeVisible();
    expect(receiptPosts).toBe(1);
    await page.keyboard.press('Escape');
   const reportResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/reports/overview') &&
    response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Báo cáo' }).click();
  const overviewResponse = await reportResponse;
  expect(overviewResponse.status()).toBe(200);
  expect(overviewResponse.headers()['cache-control']).toBe('private, no-store');
  await expect(page.getByRole('heading', { name: 'Báo cáo tài chính' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Không gian báo cáo' }).getByRole('tab')).toHaveCount(4);
  await expect(page.getByText(/Số liệu chốt/)).toBeVisible();
  await expect(page.getByText(/múi giờ Asia\/Ho_Chi_Minh, phiên bản FINANCE_LEDGER_V5/)).toBeVisible();
  await expect(page.getByText('285.000 đ').first()).toBeVisible();

  const exportResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/reports/overview/exports') &&
    response.request().method() === 'POST',
  );
  const downloadResponse = page.waitForResponse((response) =>
    /\/finance\/report-exports\/[0-9a-f-]{36}\/download$/.test(new URL(response.url()).pathname) &&
    response.request().method() === 'GET',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải CSV' }).click();
  expect((await exportResponse).status()).toBe(201);
  const csvResponse = await downloadResponse;
  expect(csvResponse.status()).toBe(200);
  expect(csvResponse.headers()['cache-control']).toBe('private, no-store');
  expect(csvResponse.headers()['content-type']).toContain('text/csv; charset=utf-8');
  expect(csvResponse.headers()['x-content-type-options']).toBe('nosniff');
   expect((await download).suggestedFilename()).toBe('finance-overview.csv');

  // Story 5.35: a new month starts with the fixed line; a flexible line scoped to one official class reaches the Invoices with its provenance.
  await page.getByRole('button', { name: 'Đợt thu' }).click();
  await page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' }).getByRole('button', { name: 'Tạo đợt thu' }).click();
  const novDialog = page.getByRole('dialog', { name: 'Tạo hoặc mở đợt thu' });
  await novDialog.getByLabel('Năm học').selectOption({ label: 'Năm học Release 2026' });
  await novDialog.getByLabel('Tháng thu').fill('2026-11');
  await novDialog.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
  await expect(page.getByRole('heading', { name: 'Đợt thu tháng 11/2026 · Nháp' })).toBeVisible();
  const novTemplate = page.getByRole('table', { name: 'Khoản thu mẫu của đợt' });
  await expect(novTemplate.getByRole('row').filter({ hasText: 'Học phí Release 1' })).toContainText('Cố định');
  await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
  const lineDialog = page.getByRole('dialog', { name: 'Thêm khoản thu' });
  await expect(lineDialog.getByLabel('Khoản thu').locator('option')).toHaveText(['Chọn khoản thu linh hoạt', 'Phí dã ngoại Release 1 · 50.000 đ/lần']);
  await lineDialog.getByLabel('Khoản thu').selectOption({ label: 'Phí dã ngoại Release 1 · 50.000 đ/lần' });
  await lineDialog.getByRole('radio', { name: 'Lớp chính thức' }).check();
  await lineDialog.getByRole('checkbox', { name: 'Mầm Release 1' }).check();
  await lineDialog.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
  await expect(lineDialog).toBeHidden();
  await expect(novTemplate.getByRole('row').filter({ hasText: 'Phí dã ngoại Release 1' })).toContainText('Lớp chính thức: Mầm Release 1');
  await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
  const perLine = page.getByRole('table', { name: 'Tạm tính theo dòng khoản thu' });
  await expect(perLine.getByRole('row').filter({ hasText: 'Phí dã ngoại Release 1' })).toContainText('100.000');
  await expect(perLine.getByRole('row').filter({ hasText: 'Học phí Release 1' })).toContainText('300.000');
  await expect(perLine.getByRole('row').filter({ hasText: 'Tiếng Anh Release 1' })).toContainText('1.200.000');
  await expect(page.getByRole('table', { name: /Lớp ngoại khóa tính vào đợt thu tháng 11\/2026/ }).getByRole('row').filter({ hasText: 'Tiếng Anh A1 (T2-T4)' })).toContainText('1.200.000 đ');
  await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
   await page.getByRole('button', { name: /Tạo hóa đơn nháp cho 2 học sinh/ }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tr').filter({ hasText: 'RG1-1 / Bé An' }).first().getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  const novReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-1/ });
  await expect(novReview.getByTitle('Nguồn').filter({ hasText: 'Cố định' })).toBeVisible();
  await expect(novReview.getByTitle('Nguồn').filter({ hasText: 'Linh hoạt · Lớp chính thức: Mầm Release 1' })).toBeVisible();
  await expect(novReview.getByTitle('Nguồn').filter({ hasText: 'Ngoại khóa · Tiếng Anh A1 (T2-T4)' })).toBeVisible();
  // Bé An left on 20/11: flagged as joining/leaving mid-month.
  await expect(novReview.getByText('Vào/nghỉ giữa tháng')).toBeVisible();
  // Bé Bình moved A1 -> A2 within the month: one merged line, flagged as a class change, adjustable with a reason.
  await novReview.getByRole('button', { name: 'Học sinh tiếp theo' }).click();
  const novSecond = page.getByRole('region', { name: /Rà soát hóa đơn RG1-2/ });
  await expect(novSecond.getByTitle('Nguồn').filter({ hasText: 'Ngoại khóa · Tiếng Anh A1 (T2-T4) → Tiếng Anh A2 (T3-T5)' })).toBeVisible();
  await expect(novSecond.getByText('Chuyển lớp trong tháng')).toBeVisible();
  await expect(novSecond.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' }).getByRole('row').filter({ hasText: 'Tiếng Anh Release 1' })).toHaveCount(1);
  await novSecond.getByRole('button', { name: 'Điều chỉnh' }).click();
  const adjust = page.getByRole('dialog', { name: /Điều chỉnh dòng · Tiếng Anh Release 1/ });
  await adjust.getByLabel('Đơn giá (đ)').fill('300000');
  await adjust.getByLabel('Lý do điều chỉnh').fill('Nghỉ lớp 15/11, thu nửa tháng');
  const dotted = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const adjustedResponse = page.waitForResponse((response) => /\/finance\/invoices\/[^/]+\/lines\/[^/]+$/.test(response.url()) && response.request().method() === 'PUT');
  await adjust.getByRole('button', { name: 'Lưu điều chỉnh' }).click();
  const adjustedBody = await (await adjustedResponse).json();
  const adjustedInvoice = adjustedBody.data.outcome ?? adjustedBody.data;
  const serverTotal = String(adjustedInvoice.total);
  expect(serverTotal).toMatch(/^\d+$/);
  expect(adjustedInvoice.lines.find((line: { receivableName: string }) => line.receivableName === 'Tiếng Anh Release 1').unitPrice).toBe('300000');
  await expect(adjust).toBeHidden();
  await expect(novSecond.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('300.000');
  // The refreshed invoice total is the server figure from the PUT, rendered verbatim in the payment part.
  await expect(novSecond.locator('.finance-payment-total').first()).toContainText(`${dotted(serverTotal)} `);

   await page.setViewportSize({ width: 1280, height: 900 });
     await page.getByRole('button', { name: 'Về trang chủ PassionEdu' }).click();
     await openSchool(page, 'Release Gate B');
   await expect(page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 })).toBeFocused();
  const otherSchoolReport = page.waitForResponse((response) =>
    response.url().includes('/finance/reports/overview') &&
    response.request().method() === 'GET',
  );
   await page.getByRole('button', { name: 'Tài chính' }).click();
   await page.getByRole('button', { name: 'Báo cáo' }).click();
  expect((await otherSchoolReport).status()).toBe(200);
  await expect(page.getByText('285.000 đ')).toHaveCount(0);
  await expect(page.getByText('RG1-1 / Bé An')).toHaveCount(0);
  await expect(page.getByText('Không có hoạt động sổ cái phù hợp tại thời điểm chốt.')).toBeVisible();
   await page.getByRole('button', { name: 'Khoản thu' }).click();
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('Học phí Release 2');
   await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).not.toContainText('Học phí Release 1');
   await expect(page.getByText('RG1-1 / Bé An')).toHaveCount(0);
   await expect(page.getByText('RG1-2 / Bé Bình')).toHaveCount(0);
});
