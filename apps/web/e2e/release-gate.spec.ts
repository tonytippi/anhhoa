import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.E2E_API_PORT ?? '3000'}`;
const app = `http://localhost:${process.env.E2E_APP_PORT ?? '5173'}`;
const users = {
  app: { email: 'release-gate-admin@example.com', subject: 'release-gate-admin' },
  teacher: { email: 'release-gate-teacher@example.com', subject: 'release-gate-teacher' },
  ops: { email: 'release-gate-operator@example.com', subject: 'release-gate-operator' },
  parent: { email: 'release-gate-parent@example.com', subject: 'release-gate-parent' },
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
    [app, 'Quản trị trường'],
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
  const start = await context.request.get(`${api}/api/parent/auth/google/start`, { maxRedirects: 0 });
  const location = start.headers().location!; const state = new URL(location, api).searchParams.get('state')!; const nonce = new URL(location, api).searchParams.get('nonce')!;
  const clientId = new URL(location, api).searchParams.get('client_id')!;
  const token = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: `release-browser-${crypto.randomUUID()}`, email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const parent = await context.request.get(`${api}/api/parent/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(token)}`, { maxRedirects: 0 });
  expect(parent.status()).toBe(302); expect(parent.headers().location).toBe('http://localhost:5174');
  expect((await context.cookies(api)).some((cookie) => cookie.name === 'parent_session')).toBe(false);
  await context.close();
});

test("Parent callback issues a session only for the seeded active links and renders the School chooser", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const session = await context.request.get(`${api}/api/parent/auth/session`);
  expect(session.status()).toBe(200);
  expect((await session.json()).data.schools).toHaveLength(2);
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await expect(
    page.getByRole("heading", { name: "Chọn trường để xem" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Release Gate A/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Release Gate B/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Release Gate B/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hôm nay của các con" }),
  ).toBeVisible();
  await expect(page.locator(".selected-school strong")).toHaveText(
    "Release Gate B",
  );
  await expect(page.getByText("Bé An")).toHaveCount(0);
  await expect(page.getByText("Trường chưa ghi nhận")).toBeVisible();
  await page.getByRole("button", { name: /Bé Bình/ }).click();
  await expect(page.getByRole("heading", { name: "Bé Bình" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lịch sử điểm danh" }),
  ).toBeVisible();
  await context.close();
});

test("Parent foreground denial clears the selected School before the signed-out fallback renders", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await expect(page.getByText("Bé An")).toBeVisible();
  await page.route("**/api/parent/auth/session", async (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("link", { name: "Đăng nhập với Google" }),
  ).toBeVisible();
  await expect(page.getByText("Bé An")).toHaveCount(0);
  await expect(page.getByText("Release Gate A")).toHaveCount(0);
  await context.close();
});

test("Parent renders only the issued obligation snapshot and clears it after revoke", async ({ browser }) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: "Khoản cần thanh toán" }).click();
  await expect(page.getByText("OBL-202609-000001")).toBeVisible();
  await page.getByRole("button", { name: /OBL-202609-000001/ }).click();
  await expect(page.getByText("Tổng tiền khi phát hành")).toBeVisible();
  await expect(page.getByText("Còn phải thanh toán", { exact: true })).toBeVisible();
  await expect(page.getByText("Ngân hàng Release 1")).toBeVisible();
  await expect(page.getByText(/Tôi đã thanh toán|VietQR|Sao chép|Hoàn tiền/)).toHaveCount(0);
  await page.route("**/api/parent/schools/*/obligations/*", async (route) => route.fulfill({ status: 403 }));
  await page.getByRole("button", { name: "Quay lại danh sách" }).click();
  await page.getByRole("button", { name: /OBL-202609-000001/ }).click();
  await expect(page.getByRole("heading", { name: "Chọn trường để xem" })).toBeFocused();
  await expect(page.getByText("OBL-202609-000001")).toHaveCount(0);
  await context.close();
});

test("Parent loads and refreshes the authorized obligation list from its direct route", async ({ browser }) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174/obligations");
  await expect(page.getByRole("heading", { name: "Khoản cần thanh toán" })).toBeVisible();
  await expect(page.getByText("OBL-202609-000001")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Khoản cần thanh toán" })).toBeVisible();
  await expect(page.getByText("OBL-202609-000001")).toBeVisible();
  await context.close();
});

test("Parent child endpoint denial clears child detail and returns focus to the safe fallback", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: /Bé An/ }).click();
  await expect(page.getByRole("heading", { name: "Bé An" })).toBeFocused();
  await page.route(
    "**/api/parent/schools/*/students/*/daily-journal?*",
    async (route) => route.fulfill({ status: 403 }),
  );
  await page.getByRole("button", { name: "Quay lại Hôm nay" }).click();
  await page.getByRole("button", { name: /Bé An/ }).click();
  const fallback = page.getByRole("heading", { name: "Chọn trường để xem" });
  await expect(fallback).toBeFocused();
  await expect(page.getByText("Bé An")).toHaveCount(0);
  await context.close();
});

test("Parent creates, receives a server validation error, cancels a pending leave, and clears on denial", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: /Bé An/ }).click();
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await page.getByLabel("Ngày bắt đầu").fill("2026-09-28");
  await page.getByLabel("Ngày kết thúc").fill("2026-09-27");
  await page.getByRole("button", { name: "Gửi đơn" }).click();
  const validationSummary = page.getByRole("alert").first();
  await expect(validationSummary).toContainText(
    "Ngày kết thúc không được trước ngày bắt đầu.",
  );
  await expect(validationSummary).toBeFocused();
  await expect(page.getByLabel("Ngày bắt đầu")).toHaveValue("2026-09-28");
  await page.getByLabel("Ngày kết thúc").fill("2026-09-29");
  await page.getByRole("button", { name: "Gửi đơn" }).click();
  await expect(page.getByText("Đang chờ duyệt")).toHaveCount(2);
  await page.getByRole("button", { name: "Hủy đơn" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận hủy đơn" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận hủy đơn" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hủy đơn" }).first(),
  ).toBeFocused();
  await page.getByRole("button", { name: "Hủy đơn" }).first().click();
  await page.getByRole("button", { name: "Xác nhận hủy đơn" }).click();
  await expect(page.getByText("Đã hủy")).toBeVisible();
  await page.route(
    "**/api/parent/schools/*/leave-requests?studentId=*",
    async (route) => route.fulfill({ status: 403 }),
  );
  await page.getByRole("button", { name: "Quay lại Hôm nay" }).click();
  await page.getByRole("button", { name: /Bé An/ }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn trường để xem" }),
  ).toBeFocused();
  await expect(page.getByText("Đã hủy")).toHaveCount(0);
  await context.close();
});

test("Parent reconciles a leave timeout before enabling a new mutation", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: /Bé An/ }).click();
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await page.getByLabel("Ngày bắt đầu").fill("2026-09-28");
  await page.getByLabel("Ngày kết thúc").fill("2026-09-29");
  let mutations = 0;
  let operationReads = 0;
  await page.route("**/api/parent/schools/*/leave-requests", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    mutations += 1;
    await route.fetch();
    await route.fulfill({ status: 504 });
  });
  await page.route("**/api/parent/schools/*/operations/*", async (route) => {
    operationReads += 1;
    await route.continue();
  });
  await page.getByRole("button", { name: "Gửi đơn" }).click();
  await expect(
    page.getByRole("button", { name: "Đang đối soát thao tác..." }),
  ).toBeDisabled();
  await expect.poll(() => operationReads).toBeGreaterThan(0);
  await expect(page.getByText("Đang chờ duyệt")).toHaveCount(2);
  expect(mutations).toBe(1);
  await context.close();
});

test("Parent validates, saves, and reconciles a phone update timeout", async ({ browser }) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: "Liên hệ", exact: true }).click();
  const phone = page.locator('input[type="tel"]');
  await phone.fill("bad");
  await page.getByRole("button", { name: "Lưu số điện thoại" }).click();
  const validation = page.getByRole("alert");
  await expect(validation).toContainText("Số điện thoại không hợp lệ.");
  await expect(validation).toBeFocused();
  await expect(phone).toHaveValue("bad");
  await phone.fill("090 123 4567");
  let mutations = 0;
  let operationReads = 0;
  await page.route("**/api/parent/schools/*/profile/phone", async (route) => {
    mutations += 1;
    await route.fetch();
    await route.fulfill({ status: 504 });
  });
  await page.route("**/api/parent/schools/*/operations/*", async (route) => {
    operationReads += 1;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { status: "PENDING", outcome: null } }) });
  });
  await page.getByRole("button", { name: "Lưu số điện thoại" }).click();
  await expect(page.getByRole("button", { name: "Đang đối soát thao tác..." })).toBeDisabled();
  await expect.poll(() => operationReads).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Thông báo" }).click();
  await expect(page.getByRole("button", { name: "Đang đối soát thao tác..." })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Đổi trường" })).toBeDisabled();
  await page.getByRole("button", { name: "Hôm nay" }).click();
  await page.getByRole("button", { name: "Liên hệ", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang đối soát thao tác..." })).toBeDisabled();
  expect(mutations).toBe(1);
  await context.close();
});

test("Parent inbox displays an unread event, resolves it before child navigation, and clears on denied open", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await login(context, "parent");
  const page = await context.newPage();
  await page.goto("http://localhost:5174");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await page.getByRole("button", { name: /Thông báo/ }).click();
  await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await expect(page.getByText("Bé An lúc phát sự kiện")).toBeVisible();
  await expect(page.getByText("Đã ghi nhận có mặt")).toBeVisible();
  await page.getByRole("button", { name: /Bé An lúc phát sự kiện/ }).click();
  await expect(page).toHaveURL(/\/children\/.*\/days\//);
  await expect(page.getByRole("heading", { name: "Bé An" })).toBeVisible();
  const destination = page.url();
  await page.goto(destination);
  await expect(page.getByRole("heading", { name: "Bé An" })).toBeVisible();
  await page.getByRole("button", { name: "Thông báo" }).click();
  await page.route("**/api/parent/schools/*/inbox/*/open", async (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.getByRole("button", { name: /Bé An lúc phát sự kiện/ }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn trường để xem" }),
  ).toBeFocused();
  await expect(page.getByText("Bé An lúc phát sự kiện")).toHaveCount(0);
  await context.close();
});

test.describe.configure({ mode: 'serial' });

async function openAdminSchool(page: import('@playwright/test').Page, schoolName: string) {
  await page.getByRole('table', { name: 'Danh sách trường được cấp quyền' }).getByRole('row', { name: new RegExp(`${schoolName} Mở trường`) }).getByRole('button', { name: 'Mở trường' }).click();
}

test('Admin uses an authenticated two-School context for clean, dirty, timeout, and suspended deep-link states', async ({ page, browser }) => {
  await login(page.context(), 'app'); await page.goto(app);
  await openAdminSchool(page, 'Release Gate A');
  const schoolAHeading = page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 });
  await expect(schoolAHeading).toBeVisible();
  await expect(schoolAHeading).toBeFocused();
  await page.getByRole('button', { name: 'Danh bộ' }).click();
  await page.getByRole('button', { name: 'Nhân viên' }).click();
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  await page.getByLabel('Email liên hệ').fill('dirty-switch@example.com');
  await page.getByRole('dialog', { name: 'Tạo hồ sơ nhân viên' }).getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('dialog', { name: 'Rời không gian làm việc?' })).toContainText('Biểu mẫu đang có nội dung chưa gửi');
  await page.getByRole('button', { name: 'Ở lại' }).click();
  await expect(page.getByRole('dialog', { name: 'Tạo hồ sơ nhân viên' }).getByLabel('Email liên hệ')).toHaveValue('dirty-switch@example.com');
  await page.getByRole('dialog', { name: 'Tạo hồ sơ nhân viên' }).getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('dialog', { name: 'Rời không gian làm việc?' })).toContainText('Biểu mẫu đang có nội dung chưa gửi');
  await page.getByRole('button', { name: 'Bỏ thay đổi' }).click();
  await openAdminSchool(page, 'Release Gate B');
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Danh bộ' }).click();
  await page.getByRole('button', { name: 'Nhân viên' }).click();
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  await page.getByLabel('Họ và tên nhân sự').fill('Nhân sự đối soát timeout');
  await page.getByLabel('Email liên hệ').fill('timeout-reconcile@example.com');
  await page.getByLabel('Số điện thoại nhân sự').fill('0900000099');
  await page.getByLabel('Ngày sinh nhân sự').fill('1990-01-01');
  await page.getByLabel('Giới tính').selectOption({ label: 'Khác' });
  await page.getByLabel('Địa chỉ').fill('Release Gate B');
  await page.locator('form').filter({ has: page.getByRole('button', { name: 'Lưu hồ sơ nhân sự' }) }).getByLabel('Chức danh chính').selectOption({ label: 'Quản lý trường' });
  let intercepted = false;
  await page.route('**/api/app/schools/*/roster/staff', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true; await route.fetch(); await route.fulfill({ status: 504 });
  });
  let pendingOperation = true; let actualOperationGet = false;
  await page.route('**/api/app/schools/*/operations/*', async (route) => {
    if (!pendingOperation) return route.continue();
    pendingOperation = false;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { status: 'PENDING' } }) });
  });
  await page.getByRole('button', { name: 'Lưu hồ sơ nhân sự' }).click();
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ nhân sự' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Về trang chủ PassionEdu' })).toBeVisible();
  await page.unroute('**/api/app/schools/*/operations/*');
  await page.route('**/api/app/schools/*/operations/*', async (route) => { actualOperationGet = true; await route.continue(); });
  await expect.poll(() => actualOperationGet).toBe(true);
  await expect(page.getByRole('rowheader', { name: 'Nhân sự đối soát timeout' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Về trang chủ PassionEdu' })).toBeVisible();

  const ops = await page.context().newPage();
  await login(page.context(), 'ops'); await ops.goto('http://localhost:5176');
  await expect(ops.getByRole('button', { name: 'Tạm ngừng' }).filter({ has: undefined }).first()).toBeVisible();
  const rows = ops.locator('tbody tr'); const target = rows.filter({ hasText: 'Release Gate A' });
  await target.getByRole('button', { name: 'Tạm ngừng' }).click();
  await ops.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(target).toContainText('Đã tạm ngừng');

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Release Gate A', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Release Gate A' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nhân viên', level: 2 })).toBeVisible();

  await target.getByRole('button', { name: 'Kích hoạt lại' }).click();
  await ops.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(target).toContainText('Đang hoạt động');
  await ops.close();
});

test('Teacher session is audience-isolated and uses the current two-School context', async ({ page }) => {
  await login(page.context(), 'teacher');
  expect((await page.context().request.get(`${api}/api/app/auth/session`)).status()).toBe(401);
  await page.goto('http://localhost:5175'); await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate B' })).toBeFocused();
  await page.getByRole('button', { name: 'Về trang chủ' }).click(); await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeVisible();
});

test('Teacher queue is read-only, URL-scoped, re-authorized, and clears stale School data', async ({ page }) => {
  await login(page.context(), 'teacher');
  await page.goto('http://localhost:5175');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('heading', { name: 'Hàng đợi lớp' })).toBeVisible();
  const schoolId = (await (await page.context().request.get(`${api}/api/teacher/schools`)).json()).data.find((school: { schoolName: string }) => school.schoolName === 'Release Gate A').schoolId;
  const classId = '00000000-0000-4000-8000-000000000001';
  const queue = page.waitForResponse((response) => response.url().includes(`/teacher/schools/${schoolId}/operational-queue?`) && response.status() === 200);
  await page.getByLabel('Ngày hàng đợi').fill('2026-09-24');
  await queue;
  await page.getByRole('button', { name: '1 đơn' }).click();
  await expect(page).toHaveURL(new RegExp(`date=2026-09-24&classId=${classId}&status=PENDING`));
  await expect(page.getByText('Bé An')).toBeVisible();
  await expect(page.getByText('Không có thao tác ghi nhận tại đây.')).toBeVisible();
  await expect(page.getByRole('button', { name: /phí|có mặt|vắng mặt/i })).toHaveCount(0);

  let denied = false;
  await page.route('**/api/teacher/schools/*/operational-queue/items?*', async (route) => {
    if (denied) return route.continue();
    denied = true;
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Không còn quyền xem hàng đợi.' } }) });
  });
  await page.getByRole('button', { name: 'Quay lại hàng đợi' }).click();
  await page.getByRole('button', { name: '1 đơn' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toHaveCount(0);
  await expect(page.getByLabel('Chọn trường')).toBeVisible();
  await expect(page.getByText('Bé An')).toHaveCount(0);
  await page.unroute('**/api/teacher/schools/*/operational-queue/items?*');

  await expect(page).toHaveURL('http://localhost:5175/');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate B' })).toBeVisible();
  await expect(page.getByText('Bé An')).toHaveCount(0);
});

test('Teacher attendance and handover use server capability, confirmed errors, and a guarded School switch', async ({ page }) => {
  await login(page.context(), 'teacher');
  await page.goto('http://localhost:5175');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Điều hướng trường' })).toContainText('Điểm danh');
  await expect(page.getByRole('navigation', { name: 'Điều hướng trường' })).toContainText('Bàn giao');
  await expect(page.getByRole('heading', { name: 'Điểm danh lớp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bàn giao - tham chiếu vận hành' })).toBeVisible();
  await expect(page.getByText('Ghi nhận giờ trả trẻ, không phải ủy quyền đón trẻ và không áp dụng phí.')).toBeVisible();
  await expect(page.getByRole('button', { name: /phí/i })).toHaveCount(0);

  const attendanceDate = '2026-09-24';
  const schoolId = (await (await page.context().request.get(`${api}/api/teacher/schools`)).json()).data.find((school: { schoolName: string }) => school.schoolName === 'Release Gate A').schoolId;
  const context = await page.request.get(`${api}/api/teacher/schools/${schoolId}`);
  expect(context.status()).toBe(200);
  const navigation = (await context.json()).data.navigation as Array<{ id: string }>;
  expect(navigation.map((item) => item.id)).toEqual(expect.arrayContaining(['attendance', 'handover']));

  const classId = '00000000-0000-4000-8000-000000000001';
  const rosterRequest = page.waitForResponse((response) => response.url().includes('/attendance-roster?') && response.status() === 200);
  await page.getByLabel('Mã lớp', { exact: true }).fill(classId);
  await page.getByLabel('Ngày điểm danh').fill(attendanceDate);
  await page.getByRole('button', { name: 'Tải danh sách' }).first().click();
  await rosterRequest;
  await expect(page.getByText('Bé An')).toBeVisible();

  const schools = await page.context().request.get(`${api}/api/teacher/schools`);
  expect(schools.status()).toBe(200);
  const fixtureSchool = (await schools.json()).data.find((school: { schoolName: string }) => school.schoolName === 'Release Gate A');
  const apiRoster = await page.context().request.get(`${api}/api/teacher/schools/${fixtureSchool.schoolId}/handover-roster?handoverOn=${attendanceDate}`);
  expect(apiRoster.status()).toBe(200);
  const handoverRoster = (await apiRoster.json()).data;
  expect(handoverRoster.students).toEqual(expect.arrayContaining([expect.objectContaining({ fullName: 'Bé An' })]));

  await page.getByLabel('Ngày bàn giao').fill(attendanceDate);
  await page.getByRole('region', { name: 'Bàn giao - tham chiếu vận hành' }).getByRole('button', { name: 'Tải danh sách' }).click();
  await expect(page.getByText('Bé An')).toBeVisible();

  let handoverIntercepted = false;
  let handoverReconciled = false;
  await page.route('**/api/teacher/schools/*/handovers', async (route) => {
    if (route.request().method() !== 'POST' || handoverIntercepted) return route.continue();
    handoverIntercepted = true;
    await route.fetch();
    await route.fulfill({ status: 504 });
  });
  await page.route('**/api/teacher/schools/*/operations/*', async (route) => { handoverReconciled = true; await route.continue(); });
  // The picked-up time defaults to now; it must fall on the fixed handover date or the server rightly rejects it.
  await page.getByLabel('Giờ trả trẻ Bé An').fill(`${attendanceDate}T16:30`);
  await page.getByRole('region', { name: 'Bàn giao - tham chiếu vận hành' }).getByRole('row').filter({ hasText: 'Bé An' }).getByRole('button', { name: 'Xác nhận trả trẻ' }).click();
  await expect.poll(() => handoverReconciled).toBe(true);
  await page.unroute('**/api/teacher/schools/*/handovers');
  await page.unroute('**/api/teacher/schools/*/operations/*');

  await page.getByLabel('Bằng chứng Bé An').fill('00000000-0000-4000-8000-000000000099');
  let validationIntercepted = false;
  await page.route('**/api/teacher/schools/*/attendance', async (route) => {
    if (route.request().method() !== 'POST' || validationIntercepted) return route.continue();
    validationIntercepted = true;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Bằng chứng không hợp lệ.', fieldErrors: { evidenceId: 'Bằng chứng không hợp lệ.' } } }) });
  });
  await page.getByRole('row').filter({ hasText: 'Bé An' }).getByRole('button', { name: 'Có mặt' }).click();
  const error = page.getByRole('alert').first();
  await expect(error).toHaveText('Bằng chứng không hợp lệ.');
  await expect(error).toBeFocused();
  await expect(page.getByRole('region', { name: 'Điểm danh lớp' }).getByRole('row').filter({ hasText: 'Bé An' })).toContainText('NOT_RECORDED');
  await page.unroute('**/api/teacher/schools/*/attendance');

  let intercepted = false;
  let reconciled = false;
  await page.route('**/api/teacher/schools/*/attendance', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    await route.fetch();
    await route.fulfill({ status: 504 });
  });
  await page.route('**/api/teacher/schools/*/operations/*', async (route) => { reconciled = true; await route.continue(); });
  await page.getByLabel('Bằng chứng Bé An').fill('');
  await page.getByRole('row').filter({ hasText: 'Bé An' }).getByRole('button', { name: 'Có mặt' }).click();
  await expect.poll(() => reconciled).toBe(true);
  await expect(page.getByRole('region', { name: 'Điểm danh lớp' }).getByRole('row').filter({ hasText: 'Bé An' })).toContainText('PRESENT');
  await page.unroute('**/api/teacher/schools/*/attendance');
  await page.unroute('**/api/teacher/schools/*/operations/*');

  await page.getByLabel('Bằng chứng Bé An').fill('draft-evidence');
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('dialog')).toContainText('Thay đổi chưa gửi sẽ không được tự lưu.');
  await page.getByRole('button', { name: 'Ở lại' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeVisible();
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await page.getByRole('button', { name: 'Bỏ thay đổi' }).click();
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate B' })).toBeVisible();
  await expect(page.getByLabel('Mã lớp', { exact: true })).toHaveValue('');
  await expect(page.getByText('Bé An')).toHaveCount(0);
});

test('Teacher DailyJournal focuses validation errors, reconciles a timeout, and clears stale data after a guarded School switch', async ({ page }) => {
  await login(page.context(), 'teacher');
  await page.goto('http://localhost:5175');
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate A' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Điều hướng trường' })).toContainText('Nhận xét trong ngày');

  // The Parent fixture already seeds today's journal for Bé An, so this flow writes Bé Bình's first journal.
  const journalDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const classId = '00000000-0000-4000-8000-000000000001';
  const rosterRequest = page.waitForResponse((response) => response.url().includes('/daily-journal-roster?') && response.status() === 200);
  await page.getByLabel('Mã lớp nhận xét').fill(classId);
  await page.getByLabel('Ngày nhận xét').fill(journalDate);
  await page.getByRole('button', { name: 'Tải danh sách' }).last().click();
  await rosterRequest;
  await page.getByRole('row').filter({ hasText: 'Bé Bình' }).getByRole('button', { name: 'Viết nhận xét' }).click();

  let validationIntercepted = false;
  await page.route('**/api/teacher/schools/*/daily-journals', async (route) => {
    if (route.request().method() !== 'POST' || validationIntercepted) return route.continue();
    validationIntercepted = true;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Nhận xét cần từ 1 đến 5000 ký tự.', fieldErrors: { text: 'Nhận xét cần từ 1 đến 5000 ký tự.' } } }) });
  });
  await page.getByRole('button', { name: 'Lưu nhận xét' }).click();
  const validationError = page.getByRole('alert').first();
  await expect(validationError).toHaveText('Nhận xét cần từ 1 đến 5000 ký tự.');
  await expect(validationError).toBeFocused();
  await expect(page.getByRole('row').filter({ hasText: 'Bé Bình' })).toContainText('Chưa có nhận xét');
  await page.unroute('**/api/teacher/schools/*/daily-journals');

  await page.locator('textarea').fill('Bé Bình tham gia hoạt động rất tích cực.');
  let intercepted = false;
  let reconciled = false;
  await page.route('**/api/teacher/schools/*/daily-journals', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    await route.fetch();
    await route.fulfill({ status: 504 });
  });
  await page.route('**/api/teacher/schools/*/operations/*', async (route) => { reconciled = true; await route.continue(); });
  await page.getByRole('button', { name: 'Lưu nhận xét' }).click();
  await expect.poll(() => reconciled).toBe(true);
  await expect(page.getByRole('row').filter({ hasText: 'Bé Bình' }).getByRole('cell', { name: 'Đã có nhận xét' })).toBeVisible();
  await page.unroute('**/api/teacher/schools/*/daily-journals');
  await page.unroute('**/api/teacher/schools/*/operations/*');

  await page.getByRole('row').filter({ hasText: 'Bé Bình' }).getByRole('button', { name: 'Xem/Sửa' }).click();
  await page.locator('textarea').fill('Bản nháp không được mang sang trường khác.');
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.getByRole('dialog', { name: 'Rời không gian làm việc?' })).toContainText('Thay đổi chưa gửi sẽ không được tự lưu.');
  await page.getByRole('button', { name: 'Ở lại' }).click();
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate A' })).toBeVisible();
  await page.getByRole('button', { name: 'Về trang chủ' }).click();
  await page.getByRole('button', { name: 'Bỏ thay đổi' }).click();
  await page.getByLabel('Chọn trường').selectOption({ label: 'Release Gate B' });
  await expect(page.getByRole('heading', { name: 'PassionEdu - Giáo viên - Release Gate B' })).toBeVisible();
  await expect(page.getByLabel('Mã lớp nhận xét')).toHaveValue('');
  await expect(page.getByText('Bé Bình')).toHaveCount(0);
  await expect(page.getByText('Bản nháp không được mang sang trường khác.')).toHaveCount(0);
});
