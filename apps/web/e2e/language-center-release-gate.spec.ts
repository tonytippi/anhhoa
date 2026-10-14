import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

// Story 5.53 (sprint change 2026-10-12): release gate of a LANGUAGE_CENTER School driven through the Admin portal.
// The center, its two Classes, Students, receivables and the "Đưa đón" service come from seed-e2e-release-gate.ts.
const api = `http://localhost:${process.env.E2E_API_PORT ?? '3000'}`;
const app = `http://localhost:${process.env.E2E_APP_PORT ?? '5173'}`;
const parentApp = `http://localhost:${process.env.E2E_PARENT_APP_PORT ?? '5174'}`;
const opsApp = `http://localhost:${process.env.E2E_OPS_APP_PORT ?? '5176'}`;
const users = {
  app: { email: 'release-gate-admin@example.com', subject: 'release-gate-admin' },
  owner: { email: 'release-gate-center-owner@example.com', subject: 'release-gate-center-owner' },
  ops: { email: 'release-gate-operator@example.com', subject: 'release-gate-operator' },
  parent: { email: 'release-gate-center-parent@example.com', subject: 'release-gate-center-parent' },
} as const;
const center = 'Trung tâm Release Gate';
const unit1 = { from: '03/08/2026', to: '26/09/2026' };
const unit2 = { from: '28/09/2026', to: '21/11/2026' };
const moversUnit = { from: '17/08/2026', to: '10/10/2026' };

async function login(context: BrowserContext, who: keyof typeof users = 'app') {
  const user = users[who];
  const audience = who === 'owner' ? 'app' : who;
  const start = await context.request.get(`${api}/api/${audience}/auth/google/start`, { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const authorizationUrl = new URL(start.headers().location!);
  const state = authorizationUrl.searchParams.get('state')!;
  const nonce = authorizationUrl.searchParams.get('nonce')!;
  const clientId = authorizationUrl.searchParams.get('client_id')!;
  const code = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: user.subject, email: user.email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString('base64url');
  const callback = await context.request.get(`${api}/api/${audience}/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`, { maxRedirects: 0 });
  expect(callback.status()).toBe(302);
}
async function openSchool(page: Page, schoolName: string) {
  await page.getByRole('table', { name: 'Danh sách trường được cấp quyền' }).getByRole('row', { name: new RegExp(`^${schoolName} Mở trường`) }).getByRole('button', { name: 'Mở trường' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành', level: 1 })).toBeFocused();
}
// The shell keeps a navigation group open only while needed; open the group first when its item is not on screen.
async function navigate(page: Page, group: 'Danh bộ' | 'Tài chính', item: string) {
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị và nhân sự' });
  // The toggle's accessible name ends with its chevron ("Tài chính ›").
  const toggle = nav.getByRole('button', { name: new RegExp(`^${group}`) });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await nav.getByRole('button', { name: item, exact: true }).click();
}
const runsToolbar = (page: Page) => page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' });
const runsTable = (page: Page) => page.getByRole('table', { name: `Danh sách đợt thu của ${center}` });
const runInvoices = (page: Page) => page.getByRole('table', { name: 'Hóa đơn hiện có trong đợt thu' });
const invoiceRow = (table: Locator, student: string) => table.locator('tbody tr').filter({ hasText: student });

async function goToRuns(page: Page) {
  await navigate(page, 'Tài chính', 'Đợt thu');
  await expect(page.getByRole('heading', { name: 'Đợt thu', level: 1 })).toBeVisible();
  await expect(runsToolbar(page)).toBeVisible();
}
async function fillRunDialog(page: Page, className: string, name: string, period: { from: string; to: string }) {
  await runsToolbar(page).getByRole('button', { name: 'Mở đợt thu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mở đợt thu' });
  await expect(dialog.getByText('Năm học')).toHaveCount(0);
  await expect(dialog.getByText('Tháng thu')).toHaveCount(0);
  await dialog.getByLabel('Lớp').selectOption({ label: className });
  await dialog.getByLabel('Tên đợt').fill(name);
  await dialog.getByLabel('Từ ngày').fill(period.from);
  await dialog.getByLabel('Đến ngày').fill(period.to);
  return dialog;
}
// Opens a run through the dialog and returns the ids the server answered with, for the read-back assertions.
async function openClassRun(page: Page, className: string, name: string, period: { from: string; to: string }) {
  const dialog = await fillRunDialog(page, className, name, period);
  const created = page.waitForResponse((response) => /\/finance\/collection-runs$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const outcome = (await response.json()).data.outcome as { id: string; scope: string; billingMonth: string };
  expect(outcome.scope).toBe('CLASS');
  await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs\/[^/]+$/);
  await expect(page.getByRole('heading', { name: `${className} · ${name} · Nháp`, level: 1 })).toBeVisible();
  await expect(page.getByText(`Đợt thu · Lớp ${className} · Kỳ ${period.from} – ${period.to}`)).toBeVisible();
  return { runId: outcome.id, schoolId: /\/schools\/([^/]+)\/finance\//.exec(new URL(response.url()).pathname)![1]!, billingMonth: outcome.billingMonth };
}
async function openRunDetail(page: Page, title: string) {
  await page.getByRole('button', { name: `Tùy chọn cho đợt thu ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click();
  await expect(page).toHaveURL(/\/schools\/[^/]+\/collection-runs\/[^/]+$/);
}
async function previewFromServer(page: Page) {
  const preview = page.waitForResponse((response) => response.url().includes('/finance/collection-runs/') && response.url().endsWith('/preview') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Xem trước từ máy chủ' }).click();
  expect((await preview).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Kết quả xem trước từ máy chủ' })).toBeVisible();
}
async function readyAndGenerate(page: Page, students: number) {
  await page.getByRole('button', { name: 'Xác nhận xem trước và chuyển sẵn sàng' }).click();
  await expect(page.getByRole('list', { name: 'Tiến trình đợt thu' }).locator('[aria-current="step"]')).toHaveText('Sẵn sàng tạo hóa đơn');
  await page.getByRole('button', { name: 'Tạo hóa đơn nháp' }).click();
  await page.getByRole('button', { name: new RegExp(`Tạo hóa đơn nháp cho ${students} học sinh`) }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả tạo hóa đơn từ máy chủ' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('list', { name: 'Tiến trình đợt thu' }).locator('[aria-current="step"]')).toHaveText('Đã tạo hóa đơn');
}
// Issues the invoice on screen; the portal then moves to the next DRAFT of the run, or reports that none is left.
async function issueCurrentInvoice(page: Page, student: RegExp, runTitle: string) {
  const review = page.getByRole('region', { name: student });
  await expect(review.getByText('Nháp', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  const dialog = page.getByRole('dialog', { name: new RegExp(`^Phát hành hóa đơn · ${runTitle}$`) });
  await expect(dialog).toBeVisible();
  const issued = page.waitForResponse((response) => /\/finance\/invoices\/[^/]+\/issue$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Phát hành hóa đơn' }).click();
  expect((await issued).status()).toBe(201);
  await expect(dialog).toBeHidden();
}

test('Admin runs a language center: staggered unit runs per class, a service, a mid-unit student, receipt, close and the next unit with old debt', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page.context());
  await page.goto(app);
  await openSchool(page, center);

  // 1. The shell of a center: no school year anywhere, "Dịch vụ" instead of "Lớp ngoại khóa".
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị và nhân sự' });
  await expect(page.locator('.school-context-current-school strong')).toHaveText(center);
  await nav.getByRole('button', { name: 'Danh bộ' }).click();
  await expect(nav.getByRole('button', { name: 'Dịch vụ', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Lớp ngoại khóa' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Năm học' })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Học sinh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Học sinh', level: 2 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Danh sách học sinh' })).toContainText('Học viên An');
  await expect(page.getByText(/Năm học/)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /Năm học/ })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Dịch vụ', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^Dịch vụ · ${center}`), level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đưa đón' }).or(page.getByRole('cell', { name: /Đưa đón/ })).first()).toBeVisible();
  await expect(page.getByText(/Năm học/)).toHaveCount(0);

  // 2. Two staggered runs, one per class; the list shows Lớp / Tên đợt / Kỳ.
  await goToRuns(page);
  await expect(page.getByText(/Năm học/)).toHaveCount(0);
  await expect(runsToolbar(page).getByRole('button', { name: 'Tạo đợt thu' })).toHaveCount(0);
  const starters1 = await openClassRun(page, 'Starters A', 'Unit 1', unit1);
  expect(starters1.billingMonth).toBe('2026-08');
  await expect(page.getByRole('table', { name: 'Khoản thu mẫu của đợt' })).toContainText('Chưa có khoản thu mẫu');
  await page.getByRole('button', { name: 'Quay lại danh sách đợt thu' }).click();
  await expect(runsToolbar(page)).toBeVisible();
  await openClassRun(page, 'Movers B', 'Unit 4', moversUnit);
  await page.getByRole('button', { name: 'Quay lại danh sách đợt thu' }).click();
  await expect(runsTable(page).getByRole('columnheader')).toHaveText(['Lớp', 'Tên đợt', 'Kỳ', 'Trạng thái', 'Tùy chọn']);
  await expect(runsTable(page).locator('tbody tr')).toHaveCount(2);
  await expect(runsTable(page).locator('tbody tr').filter({ hasText: 'Starters A' }).getByRole('cell')).toContainText(['Starters A', 'Unit 1', `${unit1.from} – ${unit1.to}`, 'Nháp']);
  await expect(runsTable(page).locator('tbody tr').filter({ hasText: 'Movers B' }).getByRole('cell')).toContainText(['Movers B', 'Unit 4', `${moversUnit.from} – ${moversUnit.to}`, 'Nháp']);

  // 3. A second Starters A run that overlaps Unit 1 is refused inline, naming the run; nothing is created.
  const overlap = await fillRunDialog(page, 'Starters A', 'Unit 2', { from: '21/09/2026', to: '14/11/2026' });
  const refused = page.waitForResponse((response) => /\/finance\/collection-runs$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await overlap.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
  const refusal = await refused;
  expect(refusal.status()).toBe(409);
  expect((await refusal.json()).error.code).toBe('COLLECTION_RUN_PERIOD_OVERLAP');
  await expect(overlap.locator('#invoice-run-periodStartsOn-error')).toHaveText(`Kỳ này trùng với đợt Unit 1 (${unit1.from} – ${unit1.to}) của lớp Starters A.`);
  await expect(overlap.getByLabel('Từ ngày')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/collection-runs(\?.*)?$/);
  await overlap.getByRole('button', { name: 'Hủy' }).click();
  await expect(overlap).toBeHidden();
  await expect(runsTable(page).locator('tbody tr')).toHaveCount(2);
  const listed = await page.request.get(`${api}/api/app/schools/${starters1.schoolId}/finance/collection-runs`);
  expect(listed.status()).toBe(200);
  expect(((await listed.json()).data.runs as Array<{ name: string }>).map((run) => run.name).sort()).toEqual(['Unit 1', 'Unit 4']);

  // 4. Starters A · Unit 1: whole-class tuition, the transport service, preview, ready, generate.
  await openRunDetail(page, 'Starters A · Unit 1');
  await expect(page.getByRole('heading', { name: 'Starters A · Unit 1 · Nháp', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
  const lineDialog = page.getByRole('dialog', { name: 'Thêm khoản thu' });
  await expect(lineDialog.getByRole('radio')).toHaveCount(2);
  await expect(lineDialog.getByRole('radio', { name: 'Lớp chính thức' })).toHaveCount(0);
  await expect(lineDialog.getByLabel('Khoản thu').locator('option')).toHaveText(['Chọn khoản thu linh hoạt', 'Học phí unit · 3.600.000 đ/unit']);
  await lineDialog.getByLabel('Khoản thu').selectOption({ label: 'Học phí unit · 3.600.000 đ/unit' });
  await lineDialog.getByRole('radio', { name: 'Cả lớp' }).check();
  await lineDialog.getByRole('button', { name: 'Lưu khoản thu mẫu' }).click();
  await expect(lineDialog).toBeHidden();
  const template = page.getByRole('table', { name: 'Khoản thu mẫu của đợt' });
  await expect(template.getByRole('row').filter({ hasText: 'Học phí unit' })).toContainText('Cả lớp');
  await expect(page.getByRole('heading', { name: 'Dịch vụ trong đợt' })).toBeVisible();
  const services = page.getByRole('table', { name: 'Dịch vụ tính vào đợt thu Starters A · Unit 1' });
  const transport = services.locator('tbody tr').filter({ hasText: 'Đưa đón' });
  await expect(transport).toContainText('800.000 đ/unit');
  await expect(transport).toContainText('Tính trong đợt');
  // "Học viên Chi" of Movers B is a member of the service too; the run counts only its own class.
  await expect(transport).toContainText('Chỉ tính học sinh của lớp Starters A');
  await expect(transport.getByRole('cell').nth(2)).toHaveText(/^1\s*Chỉ tính/);
  await previewFromServer(page);
  const eligible = page.getByRole('table', { name: 'Học sinh đủ điều kiện' });
  await expect(eligible).toContainText('TT1 / Học viên An');
  await expect(eligible).toContainText('TT2 / Học viên Bình');
  await expect(eligible).not.toContainText('Học viên Chi');
  await expect(eligible).not.toContainText('Học viên Dũng');
  const perLine = page.getByRole('table', { name: 'Tạm tính theo dòng khoản thu' });
  await expect(perLine.getByRole('row').filter({ hasText: 'Học phí unit' })).toContainText('7.200.000');
  await expect(perLine.getByRole('row').filter({ hasText: 'Đưa đón' })).toContainText('800.000');
  await expect(transport).toContainText('800.000 đ');
  await readyAndGenerate(page, 2);
  await expect(runInvoices(page).locator('tbody tr')).toHaveCount(2);
  await expect(invoiceRow(runInvoices(page), 'TT1 / Học viên An')).toContainText('4.400.000');
  await expect(invoiceRow(runInvoices(page), 'TT2 / Học viên Bình')).toContainText('3.600.000');
  await expect(runInvoices(page)).not.toContainText('Học viên Chi');
  await expect(runInvoices(page)).not.toContainText('Học viên Dũng');
  const runUrl = `${api}/api/app/schools/${starters1.schoolId}/finance/collection-runs/${starters1.runId}`;
  const generated = (await (await page.request.get(runUrl)).json()).data as { invoices: Array<{ studentCode: string; className: string; total: string }> };
  expect(generated.invoices.map((invoice) => [invoice.studentCode, invoice.className, invoice.total]).sort()).toEqual([['TT1', 'Starters A', '4400000'], ['TT2', 'Starters A', '3600000']]);

  // 5. A Student joins Starters A in the middle of Unit 1 through the roster, then is added to the generated run.
  await navigate(page, 'Danh bộ', 'Học sinh');
  await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
  const intake = page.getByRole('dialog', { name: 'Tạo học sinh và ghi danh' });
  await intake.getByLabel('Họ và tên', { exact: true }).fill('Học viên Em');
  await intake.getByLabel('Ngày sinh').fill('05/05/2017');
  await intake.getByRole('radio', { name: 'Xếp lớp', exact: true }).check();
  await intake.locator('label').filter({ hasText: /^Lớp/ }).getByRole('combobox').selectOption({ label: 'Starters A' });
  await intake.getByLabel('Ngày hiệu lực').fill('01/09/2026');
  const enrolled = page.waitForResponse((response) => /\/roster\/students$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await intake.getByRole('button', { name: 'Tạo học sinh' }).click();
  expect((await enrolled).status()).toBe(201);
  await expect(intake).toBeHidden();
  await expect(page.getByRole('table', { name: 'Danh sách học sinh' })).toContainText('Học viên Em');
  await goToRuns(page);
  await expect(runsTable(page).locator('tbody tr').filter({ hasText: 'Starters A' })).toContainText('Đã tạo hóa đơn');
  await openRunDetail(page, 'Starters A · Unit 1');
  await expect(page.getByRole('heading', { name: 'Starters A · Unit 1 · Đã tạo hóa đơn', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm học sinh', exact: true }).click();
  const addDialog = page.getByRole('dialog', { name: 'Thêm học sinh vào đợt đã tạo' });
  const addable = addDialog.getByRole('table', { name: 'Học sinh có thể yêu cầu thêm' });
  await expect(addable.locator('tbody tr')).toHaveText([/^TT5 \/ Học viên Em/]);
  await addable.getByRole('button', { name: 'Yêu cầu thêm' }).click();
  const confirmAdd = page.getByRole('dialog', { name: 'Thêm TT5 / Học viên Em vào đợt Starters A · Unit 1' });
  await confirmAdd.getByRole('button', { name: 'Thêm học sinh vào đợt' }).click();
  await expect(confirmAdd).toBeHidden();
  await expect(runInvoices(page).locator('tbody tr')).toHaveCount(3);
  await expect(invoiceRow(runInvoices(page), 'TT5 / Học viên Em')).toContainText('3.600.000');
  await expect(runInvoices(page)).not.toContainText('Trùng kỳ');

  // 6. Issue the three invoices, record one receipt, leave the others unpaid, close the run.
  await invoiceRow(runInvoices(page), 'TT1 / Học viên An').getByRole('button', { name: 'Rà soát hóa đơn' }).click();
  const anReview = page.getByRole('region', { name: /Rà soát hóa đơn TT1 \/ Học viên An/ });
  await expect(anReview.getByText(/Đợt thu Starters A · Unit 1 ·/)).toBeVisible();
  const anLines = anReview.getByRole('table', { name: 'Dòng hóa đơn do máy chủ tính' });
  await expect(anLines.getByRole('row').filter({ hasText: 'Học phí unit' }).getByTitle('Nguồn')).toHaveText('Linh hoạt · Cả lớp');
  await expect(anLines.getByRole('row').filter({ hasText: 'Đưa đón' }).getByTitle('Nguồn')).toHaveText('Dịch vụ · Đưa đón');
  await issueCurrentInvoice(page, /Rà soát hóa đơn TT1 \/ Học viên An/, 'Starters A · Unit 1');
  await issueCurrentInvoice(page, /Rà soát hóa đơn TT2 \/ Học viên Bình/, 'Starters A · Unit 1');
  await issueCurrentInvoice(page, /Rà soát hóa đơn TT5 \/ Học viên Em/, 'Starters A · Unit 1');
  await expect(page.getByText('Đã phát hành toàn bộ hóa đơn trong đợt.')).toBeVisible();

  const initialQueue = page.waitForResponse((response) => response.url().includes('/finance/receipt-queue?'));
  await navigate(page, 'Tài chính', 'Thu tiền');
  await expect(page.getByRole('heading', { name: 'Thu tiền' })).toBeVisible();
  expect((await initialQueue).status()).toBe(200);
  const queue = page.getByRole('table', { name: 'Hóa đơn chờ thu' });
  await expect(queue.getByRole('columnheader')).toContainText(['Học sinh', 'Lớp', 'Kỳ']);
  await expect(page.getByLabel('Tháng thu')).not.toHaveValue('');
  const unitQueue = page.waitForResponse((response) => response.url().includes('/finance/receipt-queue?') && response.url().includes('billingMonth=2026-08'));
  await page.getByLabel('Tháng thu').selectOption('2026-08');
  await page.getByRole('button', { name: 'Lọc' }).click();
  expect((await unitQueue).status()).toBe(200);
  await expect(queue.locator('tbody tr')).toHaveCount(3);
  const anQueueRow = queue.locator('tbody tr').filter({ hasText: 'TT1 / Học viên An' });
  await expect(anQueueRow.getByRole('cell').nth(2)).toHaveText('Starters A · Unit 1');
  await expect(anQueueRow).toContainText('4.400.000 đ');
  await queue.getByRole('button', { name: /^Tùy chọn cho Học viên An · / }).click();
  await page.getByRole('menuitem', { name: 'Ghi thực nhận' }).click();
  const receipt = page.getByRole('dialog', { name: /^Ghi thực nhận · .* Học viên An$/ });
  await expect(receipt.getByLabel('Số thực nhận (đ)')).toHaveValue('4400000');
  const receiptPost = page.waitForResponse((response) => /\/finance\/invoices\/[^/]+\/receipt$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await receipt.getByRole('button', { name: 'Xác nhận ghi thực nhận' }).click();
  expect((await receiptPost).status()).toBe(201);
  await expect(page.getByRole('heading', { name: /^Đã ghi thực nhận / })).toBeVisible();
  await expect(queue.locator('tbody tr')).toHaveCount(2);
  await expect(queue).not.toContainText('Học viên An');
  await expect(queue.locator('tbody tr').filter({ hasText: 'TT2 / Học viên Bình' }).getByRole('cell').nth(2)).toHaveText('Starters A · Unit 1');

  await goToRuns(page);
  await openRunDetail(page, 'Starters A · Unit 1');
  await expect(invoiceRow(runInvoices(page), 'TT1 / Học viên An')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng đợt thu', exact: true }).click();
  const closeDialog = page.getByRole('dialog', { name: 'Đóng đợt thu Starters A · Unit 1' });
  await closeDialog.getByLabel('Lý do đóng đợt thu').fill('Hết Unit 1');
  await closeDialog.getByRole('button', { name: 'Đóng đợt thu Starters A · Unit 1' }).click();
  await expect(closeDialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Starters A · Unit 1 · Đã đóng', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Hóa đơn đã khóa theo đợt thu' }).locator('tbody tr')).toHaveCount(3);

  // 7. Unit 2 of Starters A: the whole-class line is copied, and the unpaid Unit 1 invoices are offered as prior debt.
  // A fixed receivable assigned to Starters A only (sprint change 2026-10-13) is added to its next run by itself.
  await navigate(page, 'Tài chính', 'Khoản thu');
  await page.getByRole('button', { name: 'Thêm khoản thu' }).click();
  const fixedDialog = page.getByRole('dialog', { name: 'Thêm khoản thu' });
  await fixedDialog.getByRole('radio', { name: 'Khoản thu cố định' }).check();
  await fixedDialog.getByRole('radio', { name: 'Các lớp được chọn' }).check();
  await expect(fixedDialog.getByRole('group', { name: 'Lớp áp dụng' }).getByRole('checkbox')).toHaveCount(2);
  await expect(fixedDialog.getByText(/năm học/i)).toHaveCount(0);
  await fixedDialog.getByLabel('Tên khoản thu').fill('Giáo trình Starters');
  await fixedDialog.getByLabel('Đơn vị tính').fill('unit');
  await fixedDialog.getByLabel('Giá / đơn vị (chưa VAT)').fill('500000');
  await fixedDialog.getByRole('button', { name: 'Lưu khoản thu' }).click();
  await expect(fixedDialog.getByText('Chọn ít nhất một lớp áp dụng.')).toBeVisible();
  await fixedDialog.getByRole('checkbox', { name: 'Starters A' }).check();
  const fixedCreated = page.waitForResponse((response) => /\/finance\/receivables$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await fixedDialog.getByRole('button', { name: 'Lưu khoản thu' }).click();
  const fixedResponse = await fixedCreated;
  expect(fixedResponse.status()).toBe(201);
  expect((await fixedResponse.json()).data.outcome).toMatchObject({ kind: 'FIXED', appliesToClassNames: ['Starters A'] });
  await expect(fixedDialog).toBeHidden();
  // The Class screen shows the assignment and changes it per class.
  await navigate(page, 'Danh bộ', 'Lớp học');
  const classTable = page.getByRole('table', { name: `Lớp học của ${center}` });
  await expect(classTable.locator('tbody tr').filter({ hasText: 'Starters A' })).toContainText('Giáo trình Starters · 500.000 đ/unit');
  const moversRow = classTable.locator('tbody tr').filter({ hasText: 'Movers B' });
  await expect(moversRow).toContainText('Chưa gán');
  await moversRow.getByRole('button', { name: 'Khoản thu cố định' }).click();
  const classFixed = page.getByRole('dialog', { name: 'Khoản thu cố định · Movers B' });
  await expect(classFixed.getByRole('button', { name: 'Lưu khoản thu cố định' })).toBeDisabled();
  await classFixed.getByRole('checkbox', { name: /Giáo trình Starters/ }).check();
  const assigned = page.waitForResponse((response) => /\/finance\/classes\/[^/]+\/fixed-receivables$/.test(new URL(response.url()).pathname) && response.request().method() === 'PUT');
  await classFixed.getByRole('button', { name: 'Lưu khoản thu cố định' }).click();
  expect((await assigned).ok()).toBe(true);
  await expect(classFixed).toBeHidden();
  await expect(moversRow).toContainText('Giáo trình Starters · 500.000 đ/unit');
  await goToRuns(page);
  const unit2Dialog = await fillRunDialog(page, 'Starters A', 'Unit 2', unit2);
  await expect(unit2Dialog.getByText('Khoản thu cố định áp dụng cho lớp được tự thêm; khoản thu linh hoạt được sao chép từ đợt Unit 1 của lớp Starters A. Sửa được khi đợt còn Nháp.')).toBeVisible();
  const unit2Created = page.waitForResponse((response) => /\/finance\/collection-runs$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await unit2Dialog.getByRole('button', { name: 'Xác nhận mở đợt thu' }).click();
  expect((await unit2Created).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Starters A · Unit 2 · Nháp', level: 1 })).toBeVisible();
  const unit2Template = page.getByRole('table', { name: 'Khoản thu mẫu của đợt' });
  await expect(unit2Template.locator('tbody tr')).toHaveCount(2);
  await expect(unit2Template.getByRole('row').filter({ hasText: 'Giáo trình Starters' })).toContainText('Cố định');
  await expect(unit2Template.getByRole('row').filter({ hasText: 'Học phí unit' })).toContainText('Cả lớp');
  await expect(unit2Template.getByRole('row').filter({ hasText: 'Học phí unit' })).toContainText('3.600.000');
  await previewFromServer(page);
  await readyAndGenerate(page, 3);
  await expect(runInvoices(page).locator('tbody tr')).toHaveCount(3);
  await expect(invoiceRow(runInvoices(page), 'TT1 / Học viên An')).toContainText('4.900.000');
  // Unit 1 is CLOSED, so nothing holds back issuing in Unit 2.
  await expect(page.getByText(/Chưa thể phát hành hóa đơn của đợt này/)).toHaveCount(0);
  const debts = page.getByRole('table', { name: 'Công nợ kỳ trước chưa thu' });
  await expect(debts.getByRole('columnheader').nth(2)).toHaveText('Kỳ');
  await expect(debts.locator('tbody tr')).toHaveCount(2);
  const binhDebt = debts.locator('tbody tr').filter({ hasText: 'TT2 / Học viên Bình' });
  await expect(binhDebt.getByRole('cell').nth(2)).toHaveText('Starters A · Unit 1');
  await expect(binhDebt).toContainText('3.600.000');
  await expect(binhDebt.getByRole('button', { name: 'Chuyển vào hóa đơn đợt này' })).toBeEnabled();
  await expect(debts.locator('tbody tr').filter({ hasText: 'TT5 / Học viên Em' }).getByRole('cell').nth(2)).toHaveText('Starters A · Unit 1');
  await expect(debts).not.toContainText('Học viên An');
  // A class run has no end-of-enrollment settlement block.
  await expect(page.getByText('Cần quyết toán')).toHaveCount(0);
});

// Runs after the Admin flow above: "Học viên Bình" has an issued, unpaid Unit 1 invoice and a draft Unit 2 one.
test('Parent of a center student sees the class and unit of the issued invoice, not a month', async ({ browser }) => {
  const context = await browser.newContext();
  await login(context, 'parent');
  const listed = context.waitForEvent('response', (response) => /\/api\/parent\/schools\/[^/]+\/obligations$/.test(new URL(response.url()).pathname));
  const page = await context.newPage();
  await page.goto(`${parentApp}/obligations`);
  await expect(page.getByRole('heading', { name: 'Khoản cần thanh toán' })).toBeVisible();
  const response = await listed;
  expect(response.status()).toBe(200);
  const obligations = (await response.json()).data as Array<{ periodLabel: string; outstanding: string }>;
  // Only the issued Unit 1 invoice is an obligation; the Unit 2 draft is not shown to the Parent.
  expect(obligations.map((item) => [item.periodLabel, item.outstanding])).toEqual([['Starters A · Unit 1', '3600000']]);
  const card = page.locator('button.child-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Starters A · Unit 1');
  await expect(card).toContainText('Còn phải thanh toán 3.600.000 đ');
  await expect(card).not.toContainText(/2026-08|Tháng 0?8/);
  await context.close();
});

test('Ops provisions a language center and its first owner gets the center shell', async ({ browser }) => {
  const name = 'Trung tâm Ops E2E';
  const opsContext = await browser.newContext();
  await login(opsContext, 'ops');
  const ops = await opsContext.newPage();
  await ops.goto(opsApp);
  await expect(ops.getByRole('heading', { name: 'Trường học', level: 1 })).toBeVisible();
  const schools = ops.getByRole('table', { name: 'Danh sách trường của nền tảng' });
  await expect(schools.locator('tbody tr').filter({ hasText: center })).toContainText('Trung tâm ngoại ngữ');
  await expect(schools.locator('tbody tr').filter({ hasText: 'Release Gate A' })).toContainText('Trường mầm non');
  await ops.getByRole('button', { name: 'Khởi tạo trường' }).click();
  const dialog = ops.getByRole('dialog', { name: 'Xác nhận khởi tạo trường' });
  await dialog.getByLabel('Tên trường').fill(name);
  await dialog.getByLabel('Mã trường').fill('release-gate-ops-center');
  await expect(dialog.getByLabel('Loại trường').locator('option')).toHaveText(['Chọn loại trường', 'Trường mầm non', 'Trung tâm ngoại ngữ']);
  await expect(dialog.getByText('Không đổi được sau khi khởi tạo.')).toBeVisible();
  await dialog.getByLabel('Tiền tố mã học sinh').fill('OC');
  await dialog.getByLabel('Email chủ sở hữu đầu tiên').fill(users.owner.email);
  // The kind is required: without it the browser keeps the dialog open and nothing is sent.
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Loại trường').selectOption({ label: 'Trung tâm ngoại ngữ' });
  const provisioned = ops.waitForResponse((response) => new URL(response.url()).pathname === '/api/ops/schools' && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();
  const created = await provisioned;
  expect(created.status()).toBe(201);
  expect(JSON.parse(created.request().postData()!)).toMatchObject({ kind: 'LANGUAGE_CENTER', studentCodePrefix: 'OC' });
  await expect(dialog).toBeHidden();
  const row = schools.locator('tbody tr').filter({ hasText: name });
  await expect(row).toContainText('Trung tâm ngoại ngữ');
  await expect(row).toContainText(`${users.owner.email} (Đang chờ liên kết)`);
  await opsContext.close();

  // The owner's first login binds the account; the School opens as a center with no school year and class runs.
  const context = await browser.newContext();
  await login(context, 'owner');
  const page = await context.newPage();
  await page.goto(app);
  await openSchool(page, name);
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị và nhân sự' });
  await nav.getByRole('button', { name: 'Danh bộ' }).click();
  await expect(nav.getByRole('button', { name: 'Dịch vụ', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Năm học' })).toHaveCount(0);
  await navigate(page, 'Tài chính', 'Đợt thu');
  await expect(page.getByRole('heading', { name: 'Đợt thu', level: 1 })).toBeVisible();
  await expect(runsToolbar(page).getByRole('button', { name: 'Mở đợt thu' })).toBeVisible();
  await expect(runsToolbar(page).getByRole('button', { name: 'Tạo đợt thu' })).toHaveCount(0);
  await context.close();
});

test('A preschool still opens a monthly run with its school year and month picker', async ({ page }) => {
  await login(page.context());
  await page.goto(app);
  await openSchool(page, 'Release Gate B');
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị và nhân sự' });
  await nav.getByRole('button', { name: 'Danh bộ' }).click();
  await expect(nav.getByRole('button', { name: 'Lớp ngoại khóa' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Dịch vụ', exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Học sinh', exact: true }).click();
  await expect(page.getByText('Năm học: Năm học Release 2026')).toBeVisible();
  await navigate(page, 'Tài chính', 'Đợt thu');
  await expect(page.getByRole('heading', { name: 'Đợt thu', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Đợt thu theo trường' }).getByRole('columnheader')).toHaveText(['Tháng', 'Năm học', 'Trạng thái', 'Tùy chọn']);
  const toolbar = page.getByRole('form', { name: 'Điều khiển danh sách đợt thu' });
  await expect(toolbar.getByRole('button', { name: 'Mở đợt thu' })).toHaveCount(0);
  await toolbar.getByRole('button', { name: 'Tạo đợt thu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo hoặc mở đợt thu' });
  await expect(dialog.getByLabel('Lớp')).toHaveCount(0);
  await expect(dialog.getByLabel('Tên đợt')).toHaveCount(0);
  await dialog.getByLabel('Năm học').selectOption({ label: 'Năm học Release 2026' });
  await dialog.getByLabel('Tháng thu').selectOption('2026-10');
  const created = page.waitForResponse((response) => /\/finance\/collection-runs$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Xác nhận tạo hoặc mở' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect((await response.json()).data.outcome).toMatchObject({ scope: 'SCHOOL', classId: null, name: 'Tháng 10/2026', billingMonth: '2026-10', periodStartsOn: '2026-10-01', periodEndsOn: '2026-10-31' });
  await expect(page.getByRole('heading', { name: 'Đợt thu tháng 10/2026 · Nháp' })).toBeVisible();
  await expect(page.getByText('Đợt thu · Năm học Release 2026')).toBeVisible();
  // The ACTIVE FIXED receivable is still seeded into a monthly run, and the block keeps its preschool wording.
  await expect(page.getByRole('table', { name: 'Khoản thu mẫu của đợt' }).getByRole('row').filter({ hasText: 'Học phí Release 2' })).toContainText('Cố định');
  await expect(page.getByRole('heading', { name: 'Lớp ngoại khóa trong đợt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dịch vụ trong đợt' })).toHaveCount(0);
});
