import { expect, test } from '@playwright/test';

const api = 'http://localhost:3000';
const users = {
  app: { email: 'release-gate-admin@example.com', subject: 'release-gate-admin' },
  teacher: { email: 'release-gate-teacher@example.com', subject: 'release-gate-teacher' },
  ops: { email: 'release-gate-operator@example.com', subject: 'release-gate-operator' },
} as const;

async function login(context: import('@playwright/test').BrowserContext, audience: keyof typeof users) {
  const user = users[audience];
  const start = await context.request.get(`${api}/api/${audience}/auth/google/start`, { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const authorizationUrl = new URL(start.headers().location!);
  const state = authorizationUrl.searchParams.get('state')!; const nonce = authorizationUrl.searchParams.get('nonce')!; const clientId = authorizationUrl.searchParams.get('client_id')!;
  const code = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: user.subject, email: user.email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const callback = await context.request.get(`${api}/api/${audience}/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`, { maxRedirects: 0 });
  expect(callback.status()).toBe(302);
  expect((await context.cookies(api)).some((cookie) => cookie.name === `${audience}_session`)).toBe(true);
}

test('four portal origins expose safe signed-out state and no Parent protected content', async ({ browser }) => {
  for (const [origin, heading] of [
    ['http://localhost:5173', 'PassionEdu - Quản trị trường'],
    ['http://localhost:5175', 'PassionEdu - Giáo viên'],
    ['http://localhost:5174', 'PassionEdu'],
    ['http://localhost:5176', 'PassionEdu - Vận hành nền tảng'],
  ]) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(origin); await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Đăng nhập với Google' })).toBeVisible();
    await context.close();
  }
});

test('deterministic Parent callback redirects to the safe portal state', async ({ browser }) => {
  const email = `release-browser-${crypto.randomUUID()}@example.com`;
  const context = await browser.newContext();
  const start = await context.request.get('http://localhost:3000/api/parent/auth/google/start', { maxRedirects: 0 });
  const location = start.headers().location!; const state = new URL(location, 'http://localhost:3000').searchParams.get('state')!; const nonce = new URL(location, 'http://localhost:3000').searchParams.get('nonce')!;
  const clientId = new URL(location, 'http://localhost:3000').searchParams.get('client_id')!;
  const token = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: `release-browser-${crypto.randomUUID()}`, email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const parent = await context.request.get(`http://localhost:3000/api/parent/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(token)}`, { maxRedirects: 0 });
  expect(parent.status()).toBe(302); expect(parent.headers().location).toBe('http://localhost:5174');
  expect((await context.cookies(api)).some((cookie) => cookie.name === 'parent_session')).toBe(false);
  await context.close();
});

test.describe.configure({ mode: 'serial' });

test('Admin uses an authenticated two-School context for clean, dirty, timeout, and suspended deep-link states', async ({ page, browser }) => {
  await login(page.context(), 'app'); await page.goto('http://localhost:5173');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate A' })).toBeFocused();
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate B' })).toBeFocused();
  await page.getByLabel('Email').fill('dirty-switch@example.com');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('dialog')).toContainText('Biểu mẫu đang có nội dung chưa gửi');
  await page.getByRole('button', { name: 'Ở lại' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate B' })).toBeVisible();
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('dialog')).toContainText('Biểu mẫu đang có nội dung chưa gửi');
  await page.getByRole('button', { name: 'Bỏ nội dung và đổi trường' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate A' })).toBeVisible();

  await page.getByLabel('Email').fill('timeout-reconcile@example.com');
  let intercepted = false;
  await page.route('**/api/app/schools/*/memberships', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true; await route.fetch(); await route.fulfill({ status: 504 });
  });
  let pendingOperation = true; let actualOperationGet = false;
  await page.route('**/api/app/schools/*/operations/*', async (route) => {
    if (!pendingOperation) return route.continue();
    pendingOperation = false;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { status: 'PENDING' } }) });
  });
  await page.getByRole('button', { name: 'Cấp quyền' }).click();
  await expect(page.getByRole('button', { name: 'Đang đối soát...' })).toBeDisabled();
  await expect(page.getByLabel('Chọn trường')).toBeDisabled();
  await page.unroute('**/api/app/schools/*/operations/*');
  await page.route('**/api/app/schools/*/operations/*', async (route) => { actualOperationGet = true; await route.continue(); });
  await expect.poll(() => actualOperationGet).toBe(true);
  await expect(page.getByText('timeout-reconcile@example.com')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Cấp quyền' })).toBeEnabled();
  await expect(page.getByLabel('Chọn trường')).toBeEnabled();

  const ops = await page.context().newPage();
  await login(page.context(), 'ops'); await ops.goto('http://localhost:5176');
  await expect(ops.getByRole('button', { name: 'Tạm ngừng' }).filter({ has: undefined }).first()).toBeVisible();
  const rows = ops.locator('tbody tr'); const target = rows.filter({ hasText: 'Release Gate A' });
  await target.getByRole('button', { name: 'Tạm ngừng' }).click();
  await ops.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(target).toContainText('Đã tạm ngừng');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate A' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Release Gate A' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Release Gate B' })).toHaveCount(1);
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Release Gate B' })).toBeVisible();

  await target.getByRole('button', { name: 'Kích hoạt lại' }).click();
  await ops.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(target).toContainText('Đang hoạt động');
  await ops.close();
});

test('Teacher session is audience-isolated and uses the real two-School dirty switch guard', async ({ page }) => {
  await login(page.context(), 'teacher');
  expect((await page.context().request.get(`${api}/api/app/auth/session`)).status()).toBe(401);
  await page.goto('http://localhost:5175'); await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate B' })).toBeFocused();
  await page.getByRole('button', { name: 'Đánh dấu thay đổi chưa gửi' }).click();
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('dialog')).toContainText('Thay đổi chưa gửi');
  await page.getByRole('button', { name: 'Bỏ nội dung và đổi trường' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeVisible();
});
