import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const schoolClass = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', activeStudents: [] };

test('quản trị viên xem được lớp và mở confirmation archive', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/classes?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.goto('/lop');
  await expect(page.getByRole('heading', { level: 1, name: 'Lớp' })).toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Danh sách lớp' })).toBeVisible();
  await expect(page.getByText('1.500.000 đ')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu trữ' }).click();
  await expect(page.getByRole('dialog', { name: 'Lưu trữ Mầm 1?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu trữ' })).toBeFocused();
});

test('archive thành công và hiển thị hướng dẫn khi còn học sinh active', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/classes?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.route('**/auth/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { csrfToken: 'token' } }) }));
  let archiveAttempt = 0;
  await page.route(`**/classes/${schoolClass.id}/archive`, (route) => {
    archiveAttempt += 1;
    return route.fulfill({ status: archiveAttempt === 1 ? 200 : 409, contentType: 'application/json', body: JSON.stringify(archiveAttempt === 1 ? { data: { ...schoolClass, status: 'ARCHIVED' } } : { error: { code: 'CLASS_HAS_ACTIVE_STUDENTS', message: 'Class has active students.', metadata: { activeStudentCount: 2 } } }) });
  });
  await page.goto('/lop');
  await page.getByRole('button', { name: 'Lưu trữ' }).click();
  await page.getByRole('button', { name: 'Xác nhận lưu trữ' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lưu trữ' }).click();
  await page.getByRole('button', { name: 'Xác nhận lưu trữ' }).click();
  await expect(page.getByRole('alert')).toHaveText('Lớp còn 2 học sinh đang học. Hãy chuyển lớp hoặc cho nghỉ học các em trước.');
});
