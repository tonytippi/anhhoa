import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const student = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: 'An', classId: null, class: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

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

test('quản trị viên chọn Lớp active khi sửa học sinh', async ({ page }) => {
  const schoolClass = { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', activeStudentCount: 0, createdAt: student.createdAt, updatedAt: student.updatedAt };
  const archivedClass = { ...schoolClass, id: 'c2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm đã lưu trữ', status: 'ARCHIVED' };
  let assigned = false;
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/students?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [assigned ? { ...student, classId: schoolClass.id, class: { id: schoolClass.id, name: schoolClass.name } } : student], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }) }));
  await page.route('**/classes?*', (route) => { expect(route.request().url()).toContain('status=ACTIVE'); expect(route.request().url()).toContain('pageSize=100'); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [schoolClass], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }) }); });
  await page.route('**/csrf', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { csrfToken: 'token' } }) }));
  await page.route(`**/students/${student.id}`, async (route) => { expect(route.request().postDataJSON()).toMatchObject({ classId: schoolClass.id }); expect(route.request().headers()['x-csrf-token']).toBe('token'); assigned = true; await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ...student, classId: schoolClass.id, class: { id: schoolClass.id, name: schoolClass.name } } }) }); });
  await page.goto('/hoc-sinh');
  await page.getByRole('button', { name: 'Sửa' }).click();
  await expect(page.getByRole('option', { name: archivedClass.name })).toHaveCount(0);
  await page.getByLabel('Lớp hiện tại').selectOption(schoolClass.id);
  await expect(page.getByText('Thay đổi Lớp chỉ áp dụng hiện tại, không làm thay đổi snapshot của các Hóa đơn đã có.')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu học sinh' }).click();
  await expect(page.getByRole('cell', { name: schoolClass.name })).toBeVisible();
});
