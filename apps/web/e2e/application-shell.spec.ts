import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/me', async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
});

test('shell desktop có điều hướng, heading duy nhất và PWA metadata', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng quan' })).toHaveCount(1);
  await expect(page.getByRole('link')).toHaveCount(7);
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBe('/manifest.webmanifest');
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const metadata = await response.json();
  expect(metadata).toMatchObject({ name: 'Ánh Hoa Admin', display: 'standalone' });
  expect(metadata.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ]);
  await Promise.all(metadata.icons.map(async (icon: { src: string; sizes: string; type: string }) => {
    const iconResponse = await page.request.get(icon.src);
    const bytes = await iconResponse.body();
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
    expect(icon.type).toBe('image/png');
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  }));
  const requestedFonts = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(requestedFonts.some((url) => url.endsWith('/fonts/inter-vietnamese.woff2'))).toBe(true);
  expect(requestedFonts.some((url) => url.endsWith('/fonts/be-vietnam-pro-vietnamese.woff2'))).toBe(true);
  await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /Be Vietnam Pro/);
  await expect(page.getByRole('link', { name: 'Tổng quan', exact: true })).toHaveCSS('color', 'rgb(29, 101, 56)');
  await expect(page.locator('main')).toHaveCSS('padding-left', '32px');
});

test('breakpoint 1023px dùng sheet và 1024px dùng sidebar thu gọn', async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Mở điều hướng quản trị' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toHaveCSS('width', '72px');
  await expect(page.getByRole('link', { name: 'Hóa đơn', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Hóa đơn', exact: true })).toBeVisible();
});

test('breakpoint 1279px giữ sidebar thu gọn và 1280px hiển thị sidebar đầy đủ', async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toHaveCSS('width', '72px');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toHaveCSS('width', '232px');
});

test('768px dùng sheet dialog, đóng bằng Escape và trả focus về trigger', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng quản trị' }).click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();
  await expect(page.locator('.menu-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.menu-button')).toHaveAttribute('aria-controls', 'mobile-navigation-dialog');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Đóng điều hướng' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();
  await page.getByRole('button', { name: 'Đóng điều hướng' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toHaveCount(0);
  await expect(page.locator('.menu-button')).toBeFocused();
  await expect(page.locator('.menu-button')).not.toHaveAttribute('aria-controls');
});

test('sheet đóng hoàn toàn khi viewport chuyển sang desktop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  const trigger = page.locator('.menu-button');
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).not.toHaveAttribute('aria-controls');
  await expect(trigger).toHaveAttribute('tabindex', '-1');
  await expect(trigger).toBeFocused();
});

test('sheet đóng khi chọn route và toàn bộ nav vẫn truy cập được trên mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng quản trị' }).click();
  await page.getByRole('link', { name: /Báo cáo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo' })).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toHaveCount(0);
});

test('sheet đóng khi click backdrop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng quản trị' }).click();
  await page.locator('.sheet-backdrop').click({ position: { x: 760, y: 790 } });
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toHaveCount(0);
});

test('route không tồn tại render not-found với đúng một h1', async ({ page }) => {
  await page.goto('/duong-dan-khong-ton-tai');
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('keyboard hiển thị focus trên icon control có target tối thiểu 40px', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Mở điều hướng quản trị' });
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS('outline-style', 'solid');
  await expect(trigger).toHaveCSS('outline-color', 'rgb(39, 126, 72)');
  const box = await trigger.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(40);
  expect(box?.height).toBeGreaterThanOrEqual(40);
});

test('320px giữ toàn bộ target đóng sheet trong viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng quản trị' }).click();
  const closeTarget = await page.getByRole('button', { name: 'Đóng điều hướng' }).boundingBox();
  expect(closeTarget).not.toBeNull();
  expect(closeTarget?.width).toBeGreaterThanOrEqual(40);
  expect(closeTarget?.height).toBeGreaterThanOrEqual(40);
  expect(closeTarget?.x).toBeGreaterThanOrEqual(0);
  expect((closeTarget?.x ?? 0) + (closeTarget?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(closeTarget?.y).toBeGreaterThanOrEqual(0);
  expect((closeTarget?.y ?? 0) + (closeTarget?.height ?? 0)).toBeLessThanOrEqual(640);
});

test('chỉ hiện một thông báo cho mỗi đợt mất mạng', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByText('Bạn đang ngoại tuyến. Không thể lưu thay đổi.')).toHaveCount(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.getByText('Bạn đang ngoại tuyến. Không thể lưu thay đổi.')).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByText('Bạn đang ngoại tuyến. Không thể lưu thay đổi.')).toHaveCount(1);
});

test('khách deep link chỉ thấy đăng nhập Google khi phiên không hợp lệ', async ({ page }) => {
  await page.unroute('**/auth/me');
  await page.route('**/auth/me', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }) }));
  await page.goto('/hoa-don');
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập Google' })).toHaveCount(1);
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Hóa đơn' })).toHaveCount(0);
});
