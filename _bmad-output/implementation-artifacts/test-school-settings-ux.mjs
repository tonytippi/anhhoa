import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../../apps/web/node_modules/jsdom/lib/api.js';

const root = '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups';
const [html, rosterHtml, shell, script] = await Promise.all([
  readFile(`${root}/admin/school-settings.html`, 'utf8'), readFile(`${root}/admin/roster/roster.html`, 'utf8'),
  readFile(`${root}/admin/admin-shell.js`, 'utf8'), readFile(`${root}/prototype.js`, 'utf8')
]);
function load(url) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url });
  dom.window.eval(shell); dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom.window;
}
const roster = new JSDOM(rosterHtml, { runScripts: 'outside-only', url: 'https://mock.test/admin/roster/roster.html' });
roster.window.eval(shell);
assert.equal([...roster.window.document.querySelectorAll('.side-link')].find(link => link.textContent === 'Cấu hình trường').getAttribute('href'), '../school-settings.html');

const tabCases = [
  ['school-information', 'Thông tin trường'], ['calendar', 'Lịch hoạt động'], ['finance-payment', 'Tài chính & thanh toán'],
  ['attendance-handover', 'Điểm danh & bàn giao'], ['parent-access', 'Truy cập phụ huynh']
];
const defaultTab = load('https://mock.test/admin/school-settings.html');
assert.equal(defaultTab.document.querySelector('#school-information').hidden, false);
assert.equal(defaultTab.document.querySelectorAll('[data-settings-panel]:not([hidden])').length, 1);
assert.equal(defaultTab.document.querySelector('[data-settings-tabs] a[href="#school-information"]').getAttribute('aria-current'), 'page');
for (const [id, label] of tabCases) {
  const window = load(`https://mock.test/admin/school-settings.html#${id}`);
  const panels = [...window.document.querySelectorAll('[data-settings-panel]')];
  assert.equal(panels.filter(panel => !panel.hidden).length, 1);
  assert.equal(window.document.querySelector(`#${id}`).hidden, false);
  assert.equal(window.document.querySelector(`[data-settings-tabs] a[href="#${id}"]`).getAttribute('aria-current'), 'page');
  assert.equal(window.document.activeElement.textContent, label);
}
const window = load('https://mock.test/admin/school-settings.html?status=active&sort=bank&page=1#finance-payment');
const dialog = () => window.document.querySelector('.dialog-backdrop:last-child');
const visibleRows = () => [...window.document.querySelectorAll('[data-bank-account-rows] tr')].filter(row => !row.hidden);
const fallback = load('https://mock.test/admin/school-settings.html#not-a-settings-tab');
assert.equal(fallback.document.querySelector('#school-information').hidden, false, 'invalid tab falls back to school information');
assert.equal(fallback.location.hash, '#school-information');
window.location.hash = '#finance-payment';
assert.equal(window.document.querySelector('#finance-payment').hidden, false);
assert.equal(visibleRows().length, 2);
const filter = window.document.querySelector('[data-bank-account-filter]');
filter.elements.q.value = 'đại tín';
filter.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.equal(window.location.hash, '#finance-payment');
assert.equal(new URLSearchParams(window.location.search).get('q'), 'đại tín');
assert.equal(visibleRows().length, 0);
window.history.replaceState(null, '', '?status=all&sort=effective&page=2#finance-payment');
window.dispatchEvent(new window.PopStateEvent('popstate'));
assert.match(visibleRows()[0].textContent, /Ngân hàng Việt Thịnh/);
assert.equal(window.location.hash, '#finance-payment');
const attendance = window.document.querySelector('#attendance-handover-policy-proposal-form');
attendance.elements['proposed-value'].value = 'Bằng chứng ảnh bắt buộc khi ghi nhận có mặt';
attendance.elements['effective-date'].value = '2026-10-02';
attendance.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(dialog().textContent, /Xác nhận đề xuất Điểm danh/);
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
assert.match(window.document.querySelector('#policy-2 [data-policy-proposed]').textContent, /02\/10\/2026/);
dialog().querySelector('[data-close]').click();
attendance.elements.policy.value = 'policy-3';
attendance.elements['proposed-value'].value = 'Yêu cầu lý do khi điều chỉnh';
attendance.elements['effective-date'].value = '2026-10-03';
attendance.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(dialog().textContent, /Xác nhận đề xuất Bàn giao/);
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
assert.match(window.document.querySelector('#policy-3 [data-policy-proposed]').textContent, /03\/10\/2026/);
assert.match(window.document.querySelector('#policy-2 [data-policy-proposed]').textContent, /02\/10\/2026/);
dialog().querySelector('[data-close]').click();
for (const [tab, formId, row] of [['finance-payment', 'finance-policy-proposal-form', 'policy-1'], ['parent-access', 'parent-access-policy-proposal-form', 'policy-4']]) {
  window.location.hash = `#${tab}`;
  const form = window.document.querySelector(`#${formId}`);
  form.elements['effective-date'].value = '2026-10-02';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
  assert.match(window.document.querySelector(`#${row} [data-policy-proposed]`).textContent, /02\/10\/2026/);
  dialog().querySelector('[data-close]').click();
}
window.location.hash = '#calendar';
const holiday = window.document.querySelector('#holiday-form');
window.document.querySelector('[data-open-holiday-form]').click();
assert.equal(holiday.hidden, false);
holiday.elements['holiday-name'].value = 'Nghỉ Tết';
holiday.elements['holiday-start-date'].value = '2027-01-01';
holiday.elements['holiday-end-date'].value = '2027-01-03';
holiday.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(dialog().textContent, /Xác nhận thêm kỳ nghỉ Nghỉ Tết/);
assert.equal(window.document.querySelectorAll('[data-holiday-rows] tr').length, 1, 'no optimistic holiday row');
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
assert.equal(window.document.querySelectorAll('[data-holiday-rows] tr').length, 2);
assert.match(window.document.querySelector('[data-holiday-rows] tr:last-child').textContent, /Nghỉ Tết[\s\S]*01\/01\/2027[\s\S]*03\/01\/2027[\s\S]*3 ngày/);
dialog().querySelector('[data-close]').click();
holiday.elements['holiday-name'].value = 'Nghỉ đảo ngày';
holiday.elements['holiday-start-date'].value = '2027-02-03';
holiday.elements['holiday-end-date'].value = '2027-02-01';
holiday.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
assert.equal(holiday.querySelector('[data-error-summary]').hidden, false);
assert.equal(window.document.activeElement, holiday.querySelector('[data-error-summary]'));
assert.match(holiday.querySelector('[data-error-summary]').textContent, /Ngày kết thúc phải cùng hoặc sau ngày bắt đầu/);
assert.equal(holiday.elements['holiday-name'].value, 'Nghỉ đảo ngày');
assert.equal(window.document.querySelectorAll('[data-holiday-rows] tr').length, 2);
holiday.elements['holiday-name'].value = 'Nghỉ trùng Quốc khánh';
holiday.elements['holiday-start-date'].value = '2026-09-03';
holiday.elements['holiday-end-date'].value = '2026-09-04';
holiday.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
assert.match(holiday.querySelector('[data-error-summary]').textContent, /chồng lấn kỳ nghỉ Quốc khánh/);
assert.equal(holiday.elements['holiday-end-date'].value, '2026-09-04');
assert.equal(window.document.querySelectorAll('[data-holiday-rows] tr').length, 2);
assert.equal(window.document.querySelector('#policy-1 [data-policy-proposed]').textContent, 'Hoàn tiền cần School Admin khác duyệt từ 02/10/2026');
window.location.hash = '#finance-payment';
window.history.replaceState(null, '', '?status=active&page=1#finance-payment');
window.__rosterMock.renderSettings();
window.document.querySelector('[data-operation-lifecycle="deactivate"]').click();
dialog().querySelector('[data-idempotent-submit]').click(); dialog().querySelector('[data-reconcile]').click(); dialog().querySelector('[data-return-operation-outcome]').click();
const changedRow = window.document.querySelector('#bank-account-an-binh');
assert.equal(changedRow.dataset.status, 'inactive');
assert.equal(changedRow.querySelector('[data-bank-account-action] button').disabled, true);
assert.equal(window.location.hash, '#finance-payment');
assert.equal(window.document.querySelectorAll('[data-queue-filter], [data-queue-rows], [data-evidence]').length, 0);
console.log('School settings UX behavioral matrix passed');
