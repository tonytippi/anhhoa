import { expect, test } from "@playwright/test";

const api = "http://localhost:3000";

async function login(context: import("@playwright/test").BrowserContext) {
  const start = await context.request.get(`${api}/api/parent/auth/google/start`, { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const authorizationUrl = new URL(start.headers().location!);
  const code = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    sub: "release-gate-parent",
    email: "release-gate-parent@example.com",
    email_verified: true,
    aud: authorizationUrl.searchParams.get("client_id"),
    nonce: authorizationUrl.searchParams.get("nonce"),
    exp: Math.ceil(Date.now() / 1000) + 600,
  })).toString("base64url");
  const callback = await context.request.get(`${api}/api/parent/auth/google/callback?state=${encodeURIComponent(authorizationUrl.searchParams.get("state")!)}&code=${encodeURIComponent(code)}`, { maxRedirects: 0 });
  expect(callback.status()).toBe(302);
}

async function chooseSchool(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Release Gate A/ }).click();
  await expect(page.getByText("Bé An")).toBeVisible();
}

async function waitForServiceWorkerControl(page: import("@playwright/test").Page) {
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  });
}

async function openProtectedMedia(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^Bé An\b/ }).click();
  await expect(page.getByText("Nhận xét Release Gate có ảnh bảo vệ.")).toBeVisible();
  const response = page.waitForResponse((candidate) =>
    /\/api\/parent\/schools\/[^/]+\/daily-journal-media\//.test(candidate.url()),
  );
  await page.getByRole("button", { name: "Xem ảnh nhận xét" }).click();
  const media = await response;
  expect(media.ok()).toBe(true);
  await expect(page.getByAltText("Ảnh nhận xét trong ngày")).toBeVisible();
  return new URL(media.url()).pathname;
}

async function protectedCachePaths(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const keys = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return keys.flat().map((request) => new URL(request.url).pathname);
  });
}

test("actual Parent service worker never caches authenticated reads and fails closed offline after logout", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await login(context);
  const page = await context.newPage();
  await chooseSchool(page);
  await waitForServiceWorkerControl(page);
  const mediaPath = await openProtectedMedia(page);

  await page.getByRole("button", { name: "Thông báo" }).click();
  await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await page.getByRole("button", { name: "Khoản cần thanh toán" }).click();
  await expect(page.getByText("OBL-202609-000001")).toBeVisible();
  await page.getByRole("button", { name: /OBL-202609-000001/ }).click();
  await expect(page.getByText("Ngân hàng Release 1")).toBeVisible();
  await page.getByRole("navigation", { name: "Điều hướng phụ huynh" }).getByRole("button", { name: "Liên hệ" }).click();
  await expect(page.getByRole("textbox", { name: "Số điện thoại" })).toHaveValue("0900000000");

  const cached = await protectedCachePaths(page);
  expect(cached.some((path) => /^\/api(?:\/|$)/.test(path))).toBe(false);
  expect(cached.some((path) => /media|payment|evidence/i.test(path))).toBe(false);
  expect(cached).not.toContain(mediaPath);

  const logoutStatus = await page.evaluate(async () => {
    const csrf = document.cookie.split("; ").find((item) => item.startsWith("parent_csrf="))?.split("=")[1];
    return (await fetch("http://localhost:3000/api/parent/auth/logout", { method: "POST", credentials: "include", headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {} })).status;
  });
  expect(logoutStatus).toBe(204);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("link", { name: "Đăng nhập với Google" })).toBeVisible();
  await expect(page.getByText("OBL-202609-000001")).toHaveCount(0);
  await expect(page.getByText("Bé An")).toHaveCount(0);
  expect(await protectedCachePaths(page)).toEqual(cached);
  await context.close();
});

test("foreground revalidation clears loaded protected PWA state after the active parent link is really revoked", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await login(context);
  const page = await context.newPage();
  await chooseSchool(page);
  await waitForServiceWorkerControl(page);
  const mediaPath = await openProtectedMedia(page);

  await page.getByRole("button", { name: "Thông báo" }).click();
  await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await page.getByRole("button", { name: "Khoản cần thanh toán" }).click();
  await page.getByRole("button", { name: /OBL-202609-000001/ }).click();
  await expect(page.getByText("Ngân hàng Release 1")).toBeVisible();

  try {
    const revoke = await context.request.post(`${api}/api/test-fixtures/release-gate/revoke-parent-link`, {
      data: { schoolSlug: "release-gate-a" },
      headers: { "x-test-fixture-key": "parent-release-gate-fixture-key" },
    });
    expect(revoke.status()).toBe(201);

    const session = await context.request.get(`${api}/api/parent/auth/session`);
    expect(session.status()).toBe(200);
    expect((await session.json()).data.schools).toEqual([
      expect.objectContaining({ schoolName: "Release Gate B" }),
    ]);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hôm nay của các con" })).toBeVisible();
    await expect(page.locator(".selected-school strong")).toHaveText("Release Gate B");
    await expect(page.getByText("Bé An")).toHaveCount(0);
    await expect(page.getByText("Nhận xét Release Gate có ảnh bảo vệ.")).toHaveCount(0);
    await expect(page.getByAltText("Ảnh nhận xét trong ngày")).toHaveCount(0);
    await expect(page.getByText("Ngân hàng Release 1")).toHaveCount(0);
    await expect(page.getByText("OBL-202609-000001")).toHaveCount(0);
    expect(await protectedCachePaths(page)).not.toContain(mediaPath);
  } finally {
    await context.request.post(`${api}/api/test-fixtures/release-gate/restore-parent-link`, {
      data: { schoolSlug: "release-gate-a" },
      headers: { "x-test-fixture-key": "parent-release-gate-fixture-key" },
    });
    await context.close();
  }
});

test("Parent mobile baseline supports keyboard-only navigation and safe leave dialog behavior", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await login(context);
  const page = await context.newPage();
  await chooseSchool(page);

  const navigation = page.getByRole("navigation", { name: "Điều hướng phụ huynh" });
  await expect(navigation.getByRole("button")).toHaveCount(4);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Trường chưa ghi nhận")).toBeVisible();
  for (const button of await navigation.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: /Bé An/ }).click();
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  const start = page.getByLabel("Ngày bắt đầu");
  await start.focus();
  await expect(start).toBeFocused();
  expect(await start.evaluate((input) => getComputedStyle(input).outlineStyle)).not.toBe("none");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: "Hủy đơn" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận hủy đơn" });
  const confirm = dialog.getByRole("button", { name: "Xác nhận hủy đơn" });
  const back = dialog.getByRole("button", { name: "Quay lại" });
  await expect(confirm).toBeFocused();
  await back.focus();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hủy đơn" }).first()).toBeFocused();
  await context.close();
});
