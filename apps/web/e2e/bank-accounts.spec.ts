import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngoc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const account = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', bankCode: 'VCB', accountNumber: '123456789', accountHolderName: 'Nguyen An', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

test('quản trị viên xem, ngừng dùng và kích hoạt lại tài khoản nhận tiền', async ({ page }) => {
  let current = account;
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/bank-accounts?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [current], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.route('**/auth/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { csrfToken: 'token' } }) }));
  await page.route(`**/bank-accounts/${account.id}/deactivate`, (route) => { current = { ...account, status: 'INACTIVE' }; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: current }) }); });
  await page.route(`**/bank-accounts/${account.id}/activate`, (route) => { current = account; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: current }) }); });
  await page.goto('/tai-khoan-nhan-tien'); await expect(page.getByRole('table', { name: 'Danh sách tài khoản nhận tiền' })).toBeVisible();
  await page.getByRole('button', { name: 'Ngừng dùng' }).click(); await expect(page.getByRole('dialog', { name: 'Ngừng dùng 123456789?' })).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Ngừng dùng' })).toBeFocused();
  await page.getByRole('button', { name: 'Ngừng dùng' }).click(); await page.getByRole('button', { name: 'Xác nhận ngừng dùng' }).click(); await expect(page.getByRole('button', { name: 'Kích hoạt' })).toBeVisible();
  await page.getByRole('button', { name: 'Kích hoạt' }).click(); await page.getByRole('button', { name: 'Xác nhận kích hoạt' }).click(); await expect(page.getByRole('button', { name: 'Ngừng dùng' })).toBeVisible();
});
