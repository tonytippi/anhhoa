import { expect, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Shared by the guide screenshot scripts: each one reseeds its synthetic School, logs in as its demo account and
// saves element screenshots into public/guides under its own file prefix.
const api = `http://localhost:${process.env.E2E_API_PORT ?? '6001'}`;
const out = resolve(import.meta.dirname, '../public/guides');

export const shooter = (prefix: string) => async (target: Locator | Page, name: string) => {
  await (target as Locator).screenshot({ path: `${out}/${prefix}${name}.jpg`, type: 'jpeg', quality: 85, animations: 'disabled', caret: 'hide' });
};
export function seed(script: string) {
  execFileSync('npx', ['tsx', `scripts/${script}`], { cwd: resolve(import.meta.dirname, '../../api'), stdio: 'inherit', env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL } });
}
export async function login(page: Page, subject: string, email: string) {
  const start = await page.context().request.get(`${api}/api/app/auth/google/start`, { maxRedirects: 0 });
  const authorizationUrl = new URL(start.headers().location!);
  const nonce = authorizationUrl.searchParams.get('nonce')!;
  const code = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: subject, email, email_verified: true, aud: authorizationUrl.searchParams.get('client_id'), nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const callback = await page.context().request.get(`${api}/api/app/auth/google/callback?state=${encodeURIComponent(authorizationUrl.searchParams.get('state')!)}&code=${encodeURIComponent(code)}`, { maxRedirects: 0 });
  expect(callback.status()).toBe(302);
  // Leaving a form that was only filled for a screenshot asks to discard it; always discard.
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Rời không gian làm việc?' }), async (prompt) => { await prompt.getByRole('button', { name: 'Bỏ thay đổi' }).click(); });
}
export async function openSchool(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('table', { name: 'Danh sách trường được cấp quyền' }).getByRole('row', { name: new RegExp(`^${name}`) }).getByRole('button', { name: 'Mở trường' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 })).toBeVisible();
}

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Điều hướng quản trị và nhân sự' });
export async function go(page: Page, group: 'Danh bộ' | 'Tài chính' | 'Cấu hình trường', item: string) {
  const toggle = nav(page).getByRole('button', { name: new RegExp(`^${group}`) });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  // "Đợt thu" carries the number of invoices waiting for approval in its name.
  await nav(page).getByRole('button', { name: new RegExp(`^${item}(\\s*\\d+ hóa đơn chờ duyệt)?$`) }).click();
}
export const region = (page: Page, name: string | RegExp) => page.getByRole('region', { name });
export const runInvoices = (page: Page) => page.getByRole('table', { name: /^Hóa đơn (chưa|đã) phát hành trong đợt thu$/ });
// The run table lists one state at a time; the progress chips switch it.
export async function showNotices(page: Page, state: RegExp) {
  await page.getByRole('region', { name: 'Hóa đơn theo trạng thái' }).getByRole('button', { name: state }).click();
}
export async function openRun(page: Page, title: string) {
  await go(page, 'Tài chính', 'Đợt thu');
  await page.getByRole('button', { name: `Tùy chọn cho đợt thu ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^${title} · `), level: 1 })).toBeVisible();
}
export async function generate(page: Page, students: number) {
  await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả xem trước từ máy chủ' })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
  await page.getByRole('button', { name: new RegExp(`Tạo hóa đơn nháp cho ${students} học sinh`) }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 30_000 });
}
// Submits the invoice on screen for approval, approves it as the demo manager (who holds both permissions) unless asked
// to leave it waiting, and moves on to the next draft when asked.
export async function issue(page: Page, next: boolean, confirmShot?: (target: Locator) => Promise<void>, options: { approve?: boolean; pendingShot?: (target: Locator) => Promise<void> } = {}) {
  const review = page.getByRole('region', { name: /^Rà soát hóa đơn / });
  await review.getByRole('button', { name: /^Gửi duyệt (lại )?(phiếu thu|hóa đơn|bản thay thế|phiếu hoàn tiền)$/ }).click();
  const confirm = page.getByRole('dialog', { name: /^Gửi duyệt / });
  if (confirmShot) await confirmShot(confirm);
  await confirm.getByRole('button', { name: /^Gửi duyệt / }).click();
  await expect(confirm).toBeHidden();
  const pending = page.getByRole('complementary', { name: 'Chờ duyệt' });
  await expect(pending).toBeVisible();
  if (options.pendingShot) await options.pendingShot(pending);
  if (options.approve !== false) await approve(page);
  if (next) await review.getByRole('button', { name: /^Học sinh kế tiếp/ }).click();
}
// Approves the pending invoice on screen.
export async function approve(page: Page) {
  const review = page.getByRole('region', { name: /^Rà soát hóa đơn / });
  await review.getByRole('button', { name: 'Duyệt & gửi phụ huynh' }).click();
  await expect(review.getByRole('complementary', { name: 'Thanh toán' })).toBeVisible();
}
export async function receive(page: Page, student: string, channel: 'trường' | 'cá nhân', amount?: string, dialogShot?: (target: Locator) => Promise<void>) {
  const queue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
  await queue.getByRole('button', { name: `Tùy chọn cho ${student} · Tài khoản ${channel}` }).first().click();
  await page.getByRole('menuitem', { name: 'Ghi thực nhận' }).click();
  const receipt = page.getByRole('dialog', { name: new RegExp(`^Ghi thực nhận · .*${student}$`) });
  if (amount) await receipt.getByLabel('Số thực nhận (đ)').fill(amount);
  if (dialogShot) await dialogShot(receipt);
  await receipt.getByRole('button', { name: 'Xác nhận ghi thực nhận' }).click();
  await expect(receipt).toBeHidden();
}
export const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });
// Dialogs here ignore Escape; leave through their own cancel button.
export async function dismiss(page: Page) {
  await page.getByRole('dialog').last().getByRole('button', { name: /^(Hủy|Đóng)$/ }).first().click();
}

