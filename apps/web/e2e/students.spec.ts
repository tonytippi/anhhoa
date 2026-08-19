import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const student = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: 'An', classId: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

test('quản trị viên quản lý lifecycle học sinh qua table và confirmation accessible', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/students?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.goto('/hoc-sinh');
  await expect(page.getByRole('heading', { level: 1, name: 'Học sinh' })).toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Danh sách học sinh' })).toBeVisible();
  await page.getByRole('button', { name: 'Cho nghỉ học' }).click();
  await expect(page.getByRole('dialog', { name: 'Cho Bé An nghỉ học?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cho nghỉ học' })).toBeFocused();
});
