import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const schoolClass = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1', monthlyTuition: 1500000, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', activeStudentCount: 0 };
const destinationClass = { ...schoolClass, id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 2' };

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

test('đi từ danh sách đến detail, giữ focus modal và gửi idempotency key khi chuyển lớp', async ({ page }) => {
  const source = { ...schoolClass, activeStudentCount: 1 };
  await page.route('**/*', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) });
    if (pathname.endsWith('/classes')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [source, destinationClass], meta: { page: 1, pageSize: 100, total: 2, pageCount: 1 } }) });
    if (pathname.endsWith('/students')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }) });
    if (pathname.endsWith('/auth/csrf')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { csrfToken: 'token' } }) });
    return route.fallback();
  });
  await page.route(new RegExp(`/classes/${source.id}$`), (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: source }) }));
  await page.route(`**/classes/${source.id}/transfer`, async (route) => {
    expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { source: { ...source, activeStudentCount: 0 }, destination: { ...destinationClass, activeStudentCount: 1 }, affectedStudentCount: 1, operationId: route.request().headers()['idempotency-key'] } }) });
  });
  await page.goto('/lop');
  await page.getByRole('link', { name: 'Mầm 1' }).click();
  await expect(page).toHaveURL(new RegExp(`/lop/${source.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Mầm 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Chuyển cả lớp' }).click();
  await expect(page.getByRole('dialog', { name: 'Chuyển học sinh đang học' })).toContainText('Học sinh nghỉ học vẫn ở lại Mầm 1.');
  await expect(page.getByLabel('Lớp đích')).toContainText('Mầm 2');
  await expect(page.getByLabel('Lớp đích')).not.toContainText('Mầm 1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Chuyển cả lớp' })).toBeFocused();
  await page.getByRole('button', { name: 'Chuyển cả lớp' }).click();
  await page.getByLabel('Lớp đích').selectOption(destinationClass.id);
  await page.getByRole('button', { name: 'Xác nhận chuyển' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
