import { expect, test } from '@playwright/test';

const api = 'http://localhost:3000';

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
async function openRun(page: import('@playwright/test').Page, month: string) {
  const trigger = page.getByRole('button', { name: `Tùy chọn cho đợt thu ${month}` });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click();
}

test.describe.configure({ mode: 'serial' });

test('Admin Finance uses server-returned promotion values and clears the other School context', async ({ page }) => {
  await login(page.context());
  await page.goto('http://localhost:5173');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await page.getByRole('button', { name: 'Khoản thu' }).click();
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Khoản thu theo trường', exact: true })).toContainText('Học phí Release 1');

  await page.getByRole('button', { name: 'Tạo đợt thu' }).click();
  const runDialog = page.getByRole('dialog', { name: 'Tạo hoặc mở đợt thu' });
  await runDialog.getByLabel('Năm học').selectOption({ label: 'Năm học Release 2026' });
  await runDialog.getByLabel('Tháng thu').fill('2026-09');
  await runDialog.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
  await openRun(page, '2026-09');
  await expect(page.getByRole('heading', { name: 'Đợt thu 2026-09 / DRAFT' })).toBeVisible();
  const template = page.getByRole('region', { name: 'Khoản thu trong đợt' });
  await template.getByLabel('Khoản thu').selectOption({ label: 'Học phí Release 1' });
  await template.getByLabel('Số lượng').fill('1');
   await page.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
   await expect(page.getByRole('table', { name: 'Khoản thu mẫu chung' })).toContainText('150.000');
   await page.getByLabel('Chọn RG1-1 Bé An').check();
   await page.getByLabel('Chọn RG1-2 Bé Bình').check();
  await page.getByRole('button', { name: 'Lưu danh sách đã chọn' }).click();
  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/collection-runs/') &&
    response.url().endsWith('/preview') &&
    response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
  await expect((await previewResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Xem trước authoritative' })).toBeVisible();
  const eligibleStudents = page.getByRole('table', { name: 'Học sinh đủ điều kiện' });
  await expect(eligibleStudents).toContainText('RG1-1 / Bé An');
  await expect(eligibleStudents).toContainText('Mầm Release 1');
  await page.getByRole('button', { name: 'Xác nhận preview và chuyển READY' }).click();
  await expect(page.getByRole('button', { name: 'Tạo hóa đơn nháp' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('2026-09');
  await page.getByRole('button', { name: 'Xác nhận tạo hóa đơn nháp' }).click();
   await expect(page.getByRole('region', { name: 'Tiến độ tạo hóa đơn từ máy chủ' })).toContainText(/(QUEUED|RUNNING|COMPLETED): đã xử lý \d+\/2/);
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tbody tr').filter({ hasText: 'RG1-1 / Bé An' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-1 / Bé An' })).toBeVisible();
   await expect(page.getByText('trạng thái DRAFT')).toBeVisible();
   await expect(page.getByRole('button', { name: 'Học sinh tiếp theo' })).toBeVisible();

   const invoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-1/ });
   const invoiceLines = invoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' });
   await expect(invoiceLines).toContainText('150.000');
   await expect(invoiceLines).toContainText('15.000');
   await expect(invoiceLines).toContainText('135.000');
   await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
  await invoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  const firstIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho Bé An' });
  await firstIssue.getByLabel('Nhập chính xác tên học sinh Bé An để xác nhận').fill('Bé An');
   await firstIssue.getByRole('button', { name: 'Xác nhận phát hành' }).click();
     await expect(invoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Tổng nghĩa vụ: 135.000 VND');
     await expect(invoiceReview.getByRole('button', { name: 'Học sinh tiếp theo' })).toBeVisible();
    await expect(invoiceLines).toContainText('Ưu đãi Release Gate');
   await invoiceReview.getByRole('button', { name: 'Ghi thực nhận và đóng hóa đơn' }).click();
   const receiptDialog = page.getByRole('dialog', { name: 'Ghi thực nhận cho Bé An' });
   await expect(receiptDialog.getByLabel('Số thực nhận (VND)')).toHaveValue('135000');
   const receiptResponse = page.waitForResponse((response) =>
     response.url().includes('/receipt') && response.request().method() === 'POST',
   );
   await receiptDialog.getByRole('button', { name: 'Xác nhận ghi thực nhận' }).click();
   expect((await receiptResponse).status()).toBe(201);
   await expect(invoiceReview.getByText('trạng thái CLOSED')).toBeVisible();
   await expect(invoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Thực nhận: 135.000 VND. Kết quả máy chủ: Đủ. Chênh lệch: 0 VND.');
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

  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate B' })).toBeFocused();
  const otherSchoolReport = page.waitForResponse((response) =>
    response.url().includes('/finance/reports/overview') &&
    response.request().method() === 'GET',
  );
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
