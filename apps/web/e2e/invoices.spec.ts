import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const invoice = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', billingMonth: '2026-08', student: { name: 'Bé An lúc tạo', nickname: 'An' }, schoolClass: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1 lúc tạo' }, status: 'PENDING', total: 1500000, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const invoiceDetail = { ...invoice, items: [{ id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Học phí', feeGroup: null, amount: 1500000, position: 0 }], payment: { method: 'CASH', bankAccount: null }, qr: null, createdBy: { id: 'd2e36687-69b4-4e89-8ec0-141ff397837f', displayName: admin.displayName }, completedBy: null, completedAt: null };
const schoolClass = { id: invoice.schoolClass.id, name: 'Mầm 1', monthlyTuition: 1500000, status: 'ARCHIVED', createdAt: invoice.createdAt, updatedAt: invoice.updatedAt, activeStudentCount: 0 };

test('quản trị viên tra cứu hóa đơn snapshot theo tháng và mở detail chỉ đọc', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/classes?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }) }));
  await page.route(/\/invoices\?/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [invoice], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.route('**/invoices/*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: invoiceDetail }) }));
  await page.goto('/hoa-don?month=2026-08');
  await expect(page.getByRole('heading', { level: 1, name: 'Hóa đơn' })).toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Danh sách hóa đơn tháng 08/2026' })).toBeVisible();
  await expect(page.getByText('Bé An lúc tạo')).toBeVisible();
  await expect(page.getByText('Mầm 1 lúc tạo')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chờ xác nhận' })).toBeVisible();
  await page.getByRole('link', { name: 'Bé An lúc tạo' }).click();
  await expect(page).toHaveURL(new RegExp(`/hoa-don/${invoice.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Hóa đơn Bé An lúc tạo' })).toHaveCount(1);
  await expect(page.locator('.invoice-summary dd.money')).toHaveText('1.500.000 đ');
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole('link', { name: 'Quay lại danh sách' })).toBeVisible();
});

test('tháng trống giữ picker và chỉ hiện một CTA tạo hóa đơn', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/classes?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }) }));
  await page.route(/\/invoices\?/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }) }));
  await page.goto('/hoa-don?month=2026-08');
  await expect(page.getByLabel('Tháng hóa đơn')).toHaveValue('2026-08');
  await expect(page.getByRole('button', { name: 'Tạo hóa đơn tháng' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Tạo hóa đơn tháng' })).toBeEnabled();
});

test('mobile keeps invoice table horizontally scrollable with sticky student identity', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/classes?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }) }));
  await page.route(/\/invoices\?/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [invoice], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.goto('/hoa-don?month=2026-08');
  const table = page.getByRole('table', { name: 'Danh sách hóa đơn tháng 08/2026' }); await expect(table).toBeVisible();
  await expect(table.locator('th.invoice-identity').first()).toHaveCSS('position', 'sticky');
  await expect(table.locator('..')).toHaveCSS('overflow-x', 'auto');
});

test('quản trị viên xác nhận đã nhận tiền và xem audit hóa đơn hoàn tất', async ({ page }) => {
  const completed = { ...invoiceDetail, status: 'COMPLETED', completedBy: { id: admin.id, displayName: admin.displayName }, completedAt: '2026-08-02T00:00:00.000Z' };
  let wasCompleted = false;
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/auth/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { csrfToken: 'token' } }) }));
  await page.route(/\/invoices\/.+/, (route) => { if (route.request().method() === 'POST') { expect(route.request().url()).toContain(`/invoices/${invoice.id}/complete`); expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); wasCompleted = true; } return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: wasCompleted ? completed : invoiceDetail }) }); });
  await page.goto(`/hoa-don/${invoice.id}`);
  await page.getByRole('button', { name: 'Xác nhận đã nhận tiền' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xác nhận đã nhận tiền' });
  await expect(dialog).toContainText('Bé An lúc tạo');
  await expect(dialog).toContainText('1.500.000 đ');
  await dialog.getByRole('button', { name: 'Xác nhận đã nhận tiền' }).click();
  await expect(page.getByText('Đã hoàn tất')).toBeVisible();
  await expect(page.getByText('Người xác nhận')).toBeVisible();
  await expect(page.locator('.invoice-summary dd').filter({ hasText: admin.displayName }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trả về nháp' })).toHaveCount(0);
});

test('hủy xác nhận không gửi completion request', async ({ page }) => {
  let completionPosts = 0;
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route(/\/invoices\/.+/, (route) => { if (route.request().method() === 'POST') completionPosts += 1; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: invoiceDetail }) }); });
  await page.goto(`/hoa-don/${invoice.id}`);
  await page.getByRole('button', { name: 'Xác nhận đã nhận tiền' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(completionPosts).toBe(0);
});
