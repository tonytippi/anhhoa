import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const item = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', description: 'Tiền ăn', feeGroup: 'Ăn uống', position: 0, amountSource: 'FIXED', fixedAmount: 300000, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

test('quản trị viên quản lý dòng mẫu với điều khiển thứ tự truy cập được', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/invoice-template', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id: 'template', items: [item], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } }) }));
  await page.goto('/mau-hoa-don');
  await expect(page.getByRole('heading', { level: 1, name: 'Mẫu hóa đơn' })).toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Dòng mẫu hóa đơn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lên Tiền ăn' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Xuống Tiền ăn' })).toBeDisabled();
  await page.getByRole('button', { name: 'Sửa' }).click();
  await page.getByLabel('Nguồn tiền').selectOption('CLASS_TUITION');
  await expect(page.getByLabel('Số tiền (VND)')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Sửa' })).toBeFocused();
});
