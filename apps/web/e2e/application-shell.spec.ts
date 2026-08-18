import { expect, test } from '@playwright/test';

test('shell desktop có điều hướng, heading duy nhất và PWA metadata', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng quan' })).toHaveCount(1);
  await expect(page.getByRole('link')).toHaveCount(7);
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBe('/manifest.webmanifest');
});

test('1024px dùng sidebar thu gọn nhưng vẫn giữ điều hướng truy cập được', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Điều hướng quản trị' })).toHaveCSS('width', '72px');
  await expect(page.getByRole('link', { name: 'Hóa đơn', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Hóa đơn', exact: true })).toBeVisible();
});

test('768px dùng sheet dialog, đóng bằng Escape và trả focus về trigger', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở điều hướng quản trị' }).click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Mở điều hướng quản trị' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Đóng điều hướng' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Điều hướng quản trị' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở điều hướng quản trị' })).toBeFocused();
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
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByText('Bạn đang ngoại tuyến. Không thể lưu thay đổi.')).toHaveCount(1);
});
