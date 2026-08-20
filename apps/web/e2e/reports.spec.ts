import { expect, test } from '@playwright/test';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
function report(month: string) { return { data: { billingMonth: month, counts: { draft: 1, pending: 2, completed: 3 }, totalCollected: month === '2026-09' ? 450000 : 350000, cashCollected: 100000, transferCollected: month === '2026-09' ? 350000 : 250000, transferBreakdown: [{ bankCode: 'VCB', accountNumber: '123', accountHolderName: 'Cô Hoa', total: month === '2026-09' ? 350000 : 250000 }] } }; }

test('báo cáo và tổng quan giữ ngữ cảnh tháng, trạng thái và breakdown snapshot', async ({ page }) => {
  await page.route('**/auth/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: admin }) }));
  await page.route('**/reports/monthly?*', (route) => { const month = new URL(route.request().url()).searchParams.get('billingMonth'); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(report(month === '2026-09' ? '2026-09' : '2026-08')) }); });
  await page.goto('/bao-cao?month=2026-08');
  await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo thu' })).toHaveCount(1);
  await expect(page.getByLabel('Tháng báo cáo')).toHaveValue('2026-08');
  await expect(page.getByText('Cô Hoa')).toBeVisible(); await expect(page.getByText('VCB · 123')).toBeVisible();
  await page.getByLabel('Tháng báo cáo').fill('2026-09');
  await expect(page.getByText('450.000 đ')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem hóa đơn hoàn tất' })).toHaveAttribute('href', '/hoa-don?month=2026-09&status=COMPLETED');
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator('.kpi-grid')).toHaveCSS('grid-template-columns', '343px');
  await page.goto('/?month=2026-08');
  await page.getByRole('link', { name: 'Chờ xác nhận' }).click();
  await expect(page).toHaveURL(/\/hoa-don\?month=2026-08&status=PENDING/);
});
