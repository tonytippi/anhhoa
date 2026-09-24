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

test.describe.configure({ mode: 'serial' });

test('Admin Finance uses server values through populated DRAFT adjustment and clears the other School context', async ({ page }) => {
  await login(page.context());
  await page.goto('http://localhost:5173');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await page.getByRole('button', { name: 'Khoản thu' }).click();
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
  await expect(page.getByText('Học phí Release 1')).toBeVisible();

  await page.getByLabel('Năm học').selectOption({ label: 'Năm học Release 2026' });
  await page.getByLabel('Tháng thu').fill('2026-09');
  await page.getByRole('button', { name: 'Mở hoặc vào đợt thu' }).click();
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
  await expect(page.getByText('RG1-1 / Bé An')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Học sinh đủ điều kiện' })).toContainText('Mầm Release 1');
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

   const invoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-1/ });
  await expect(invoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('150.000');
  await page.getByRole('button', { name: 'Sửa' }).click();
  await page.getByLabel('Số lượng').fill('2');
  const adjustmentResponse = page.waitForResponse((response) =>
    response.url().includes('/finance/invoices/') &&
    response.url().includes('/lines/') &&
    response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu dòng' }).click();
  const adjustment = await adjustmentResponse;
  if (adjustment.status() !== 200) throw new Error(`Invoice adjustment failed: ${await adjustment.text()}`);
  await expect(invoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('300.000');
  await invoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  const firstIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho Bé An' });
  await firstIssue.getByLabel('Nhập chính xác tên học sinh Bé An để xác nhận').fill('Bé An');
  await firstIssue.getByRole('button', { name: 'Xác nhận phát hành' }).click();
  await expect(invoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Tổng nghĩa vụ: 300.000 VND');
  await page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' }).locator('tbody tr').filter({ hasText: 'RG1-2 / Bé Bình' }).getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  await expect(page.getByRole('heading', { name: 'Rà soát hóa đơn RG1-2 / Bé Bình' })).toBeVisible();
  const secondInvoiceReview = page.getByRole('region', { name: /Rà soát hóa đơn RG1-2/ });
  await expect(secondInvoiceReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' })).toContainText('150.000');
  await expect(secondInvoiceReview.getByText('300.000')).toHaveCount(0);

  await secondInvoiceReview.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  const secondIssue = page.getByRole('dialog', { name: 'Phát hành hóa đơn cho Bé Bình' });
  await secondIssue.getByLabel('Nhập chính xác tên học sinh Bé Bình để xác nhận').fill('Bé Bình');
  await secondIssue.getByRole('button', { name: 'Xác nhận phát hành' }).click();
  await expect(secondInvoiceReview.getByRole('region', { name: 'Snapshot phát hành' })).toContainText('Tổng nghĩa vụ: 150.000 VND');
  await page.getByRole('button', { name: 'Đóng đợt thu' }).click();
  const closeDialog = page.getByRole('dialog', { name: 'Đóng đợt thu 2026-09' });
  await closeDialog.getByLabel('Nhập chính xác tháng thu 2026-09 để xác nhận').fill('2026-09');
  await closeDialog.getByLabel('Lý do đóng đợt thu').fill('Đã phát hành hóa đơn đã rà soát');
  await closeDialog.getByRole('button', { name: 'Xác nhận đóng đợt thu' }).click();
  await expect(page.getByRole('heading', { name: 'Đợt thu 2026-09 / CLOSED' })).toBeVisible();

  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate B' })).toBeFocused();
  await page.getByRole('button', { name: 'Khoản thu' }).click();
  await expect(page.getByText('Học phí Release 2')).toBeVisible();
   await expect(page.getByText('Học phí Release 1')).toHaveCount(0);
   await expect(page.getByText('RG1-1 / Bé An')).toHaveCount(0);
   await expect(page.getByText('RG1-2 / Bé Bình')).toHaveCount(0);
});
