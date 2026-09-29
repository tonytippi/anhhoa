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
  await page.getByRole('button', { name: 'Tài chính' }).click();
  const receivablesNavigation = page.getByRole('button', { name: 'Khoản thu' });
  await expect(receivablesNavigation).toBeVisible();
  await receivablesNavigation.click();
  await expect(page.getByRole('heading', { name: 'Khoản thu', level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const receivablesToolbar = page.getByRole('form', { name: 'Điều khiển danh sách khoản thu' });
  await expect(receivablesToolbar.getByRole('button', { name: 'Quản lý nhóm' })).toBeInViewport();
  await expect(receivablesToolbar.getByRole('button', { name: 'Thêm khoản thu' })).toBeInViewport();
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('Học phí Release 1');
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
  await runDialog.getByLabel('Tháng thu').fill('2026-09');
  await runDialog.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
   await openRun(page, '2026-09');
   await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs\/[^/]+/);
   await expect(page.getByRole('heading', { name: 'Đợt thu 2026-09 · Nháp' })).toBeVisible();
   await expect(page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' })).toHaveCount(0);
   await page.getByRole('button', { name: 'Quay lại danh sách đợt thu' }).click();
   await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs$/);
   await expect(page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' })).toBeVisible();
   await openRun(page, '2026-09');
  const template = page.getByRole('region', { name: 'Khoản thu trong đợt' });
  await template.getByLabel('Khoản thu').selectOption({ label: 'Học phí Release 1' });
  await template.getByLabel('Số lượng').fill('1');
   await page.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
   await expect(page.getByRole('table', { name: 'Khoản thu mẫu chung' })).toContainText('150.000');
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
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('2026-09');
  await page.getByRole('button', { name: 'Xác nhận tạo hóa đơn nháp' }).click();
   await expect(page.getByRole('region', { name: 'Tiến độ tạo hóa đơn từ máy chủ' })).toContainText(/Đang xử lý \d+\/2/);
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 10000 });
  expect(selectionRequests).toBe(0);
   const generatedResult = page.getByRole('region', { name: 'Kết quả tạo hóa đơn từ máy chủ' });
   await generatedResult.locator('tr').filter({ hasText: 'RG1-1 / Bé An' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
   await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();
     await expect(page.getByText('trạng thái Nháp')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Học sinh tiếp theo' })).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh tiếp theo' }).click();
    await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh trước' }).click();
    await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();

   const invoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-1/ });
   const invoiceLines = invoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' });
   await expect(invoiceLines).toContainText('150.000');
   await expect(invoiceLines).toContainText('15.000');
   await expect(invoiceLines).toContainText('135.000');
   await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
   await invoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
   const firstIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho Bé An' });
   await firstIssue.getByLabel('Nhập chính xác tên học sinh Bé An để xác nhận').fill('Bé An');
   const issuedRunRefresh = page.waitForResponse((response) =>
     new URL(response.url()).pathname.endsWith('/finance/collection-runs') &&
     response.request().method() === 'GET',
   );
   await firstIssue.getByRole('button', { name: 'Xác nhận phát hành' }).click();
   expect((await issuedRunRefresh).status()).toBe(200);
    await expect(invoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Tổng nghĩa vụ: 135.000 VND');
    await expect(invoiceReview.getByRole('button', { name: 'Học sinh tiếp theo' })).toBeVisible();
    await invoiceReview.getByRole('button', { name: 'Học sinh tiếp theo' }).click();
    await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
     await expect(page.getByText('trạng thái Nháp')).toBeVisible();
    await page.getByRole('button', { name: 'Học sinh trước' }).click();
    await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();
    await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
     await expect(invoiceReview.getByRole('button', { name: 'Ghi thực nhận và đóng hóa đơn' })).toHaveCount(0);
    await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tbody tr').filter({ hasText: 'RG1-2 / Bé Bình' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
  const secondInvoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-2/ });
  await expect(secondInvoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('150.000');
   await expect(secondInvoiceReview.getByText('135.000')).toHaveCount(0);

  await secondInvoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  const secondIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho Bé Bình' });
  await secondIssue.getByLabel('Nhập chính xác tên học sinh Bé Bình để xác nhận').fill('Bé Bình');
   await secondIssue.getByRole('button', { name: 'Xác nhận phát hành' }).click();
   await expect(secondInvoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Tổng nghĩa vụ: 150.000 VND');
    await page.getByRole('button', { name: 'Thu tiền' }).click();
    await expect(page.getByRole('heading', { name: 'Thu tiền' })).toBeVisible();
    const receiptQueue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
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
    await expect(queueReceipt.getByLabel('Số thực nhận (VND)')).toHaveValue('135000');
    await expect(queueReceipt.getByLabel('Số thực nhận (VND)')).toBeFocused();
    await queueReceipt.getByRole('button', { name: 'Hủy' }).focus();
    await page.keyboard.press('Tab');
    await expect(queueReceipt.getByLabel('Số thực nhận (VND)')).toBeFocused();
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
  await expect(page.getByRole('heading', { name: 'Báo cáo Finance' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Không gian báo cáo' }).getByRole('tab')).toHaveCount(4);
  await expect(page.getByText(/Chốt tại .*Asia\/Ho_Chi_Minh; FINANCE_LEDGER_V3\./)).toBeVisible();
  await expect(page.getByText('285.000 VND').first()).toBeVisible();

  const exportResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/reports/overview/exports') &&
    response.request().method() === 'POST',
  );
  const downloadResponse = page.waitForResponse((response) =>
    /\/finance\/report-exports\/[0-9a-f-]{36}\/download$/.test(new URL(response.url()).pathname) &&
    response.request().method() === 'GET',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải CSV từ máy chủ' }).click();
  expect((await exportResponse).status()).toBe(201);
  const csvResponse = await downloadResponse;
  expect(csvResponse.status()).toBe(200);
  expect(csvResponse.headers()['cache-control']).toBe('private, no-store');
  expect(csvResponse.headers()['content-type']).toContain('text/csv; charset=utf-8');
  expect(csvResponse.headers()['x-content-type-options']).toBe('nosniff');
   expect((await download).suggestedFilename()).toBe('finance-overview.csv');

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
  await expect(page.getByText('285.000 VND')).toHaveCount(0);
  await expect(page.getByText('RG1-1 / Bé An')).toHaveCount(0);
  await expect(page.getByText('Không có hoạt động sổ cái phù hợp tại thời điểm chốt.')).toBeVisible();
   await page.getByRole('button', { name: 'Khoản thu' }).click();
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('Học phí Release 2');
   await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).not.toContainText('Học phí Release 1');
   await expect(page.getByText('RG1-1 / Bé An')).toHaveCount(0);
   await expect(page.getByText('RG1-2 / Bé Bình')).toHaveCount(0);
});
