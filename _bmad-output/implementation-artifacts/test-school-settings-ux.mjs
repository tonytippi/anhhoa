import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../../apps/web/node_modules/jsdom/lib/api.js';

const root = '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups';
const html = await readFile(`${root}/admin/school-settings.html`, 'utf8');
const rosterHtml = await readFile(`${root}/admin/roster/roster.html`, 'utf8');
const shell = await readFile(`${root}/admin/admin-shell.js`, 'utf8');
const script = await readFile(`${root}/prototype.js`, 'utf8');

function load(markup, url) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url });
  dom.window.eval(shell);
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom.window;
}

const roster = load(rosterHtml, 'https://mock.test/admin/roster/roster.html');
assert.equal([...roster.document.querySelectorAll('.side-link')].find(link => link.textContent === 'Cấu hình trường').getAttribute('href'), '../school-settings.html');

const window = load(html, 'https://mock.test/admin/school-settings.html?status=active&sort=bank&page=1');
const activeDialog = () => window.document.querySelector('.dialog-backdrop:last-child');
const visibleRows = () => [...window.document.querySelectorAll('[data-bank-account-rows] tr')].filter(row => !row.hidden);
const attendancePolicy = [...window.document.querySelectorAll('#policy-proposal-form [name="policy"] option')].find(option => option.textContent === 'Điểm danh');

assert.ok(attendancePolicy);
assert.match(window.document.querySelector('#policy-2').textContent, /Bằng chứng ảnh/);
assert.match(window.document.querySelector('#policy-2 [data-policy-proposed]').textContent, /tùy chọn/);
assert.equal(window.document.querySelectorAll('[data-queue-filter], [data-queue-rows], [data-evidence]').length, 0);
assert.equal([...window.document.querySelectorAll('button')].some(button => /điểm danh/i.test(button.dataset.actionTitle || '')), false);

const policyForm = window.document.querySelector('#policy-proposal-form');
policyForm.elements.policy.selectedIndex = [...policyForm.elements.policy.options].indexOf(attendancePolicy);
policyForm.elements['proposed-value'].value = 'Bằng chứng ảnh bắt buộc khi ghi nhận có mặt';
policyForm.elements['effective-date'].value = '2026-10-02';
policyForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(activeDialog().textContent, /Xác nhận đề xuất Điểm danh/);
activeDialog().querySelector('[data-idempotent-submit]').click();
activeDialog().querySelector('[data-reconcile]').click();
activeDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(window.document.querySelector('#policy-version-result').textContent, /Hệ thống đã ghi nhận/);
assert.match(window.document.querySelector('#policy-2 [data-policy-proposed]').textContent, /02\/10\/2026/);
activeDialog().querySelector('[data-close]').click();
policyForm.elements.policy.selectedIndex = 0;

assert.equal(visibleRows().length, 2);
window.document.querySelector('[name="q"]').value = 'đại tín';
window.document.querySelector('[data-bank-account-filter]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.equal(new URLSearchParams(window.location.search).get('q'), 'đại tín');
assert.equal(visibleRows().length, 0);
assert.equal(window.document.querySelector('[data-bank-account-empty]').hidden, false);
window.history.replaceState(null, '', '?status=all&sort=effective&page=2');
window.__rosterMock.renderSettings();
assert.match(visibleRows()[0].textContent, /Ngân hàng Việt Thịnh/);
assert.match(window.document.querySelector('[data-bank-account-caption]').textContent, /Trang 2 \/ 2/);
window.history.replaceState(null, '', '?status=inactive&sort=bank&page=1');
window.dispatchEvent(new window.PopStateEvent('popstate'));
assert.equal(window.document.querySelector('[name="status"]').value, 'inactive');
assert.equal(visibleRows().length, 1);
assert.match(visibleRows()[0].textContent, /Ngân hàng Đại Tín/);

const form = window.document.querySelector('[data-mock-form]');
const proposed = form.elements['proposed-value'];
proposed.value = 'Thứ hai đến chủ nhật';
proposed.dispatchEvent(new window.Event('input', { bubbles: true }));
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(activeDialog().textContent, /Xác nhận đề xuất Lịch hoạt động/);
activeDialog().querySelector('[data-idempotent-submit]').click();
activeDialog().querySelector('[data-reconcile]').click();
activeDialog().querySelector('[data-return-operation-outcome]').click();
const summary = window.document.querySelector('[data-error-summary]');
const date = window.document.querySelector('#effective-date');
assert.equal(summary.hidden, false);
assert.equal(window.document.querySelector('[data-field-error]').hidden, false);
assert.equal(proposed.value, 'Thứ hai đến chủ nhật');
assert.match(window.document.querySelector('#policy-0 [data-policy-proposed]').textContent, /Xung đột/);
summary.querySelector('a').click();
assert.equal(window.document.activeElement, date);

window.document.querySelector('[data-school-context]').click();
assert.match(activeDialog().textContent, /Biểu mẫu chưa gửi/);
activeDialog().querySelector('[data-discard-context]').click();
assert.equal(form.dataset.dirty, undefined);

form.elements.policy.selectedIndex = 1;
date.value = '2026-10-02';
proposed.value = 'Thứ hai đến chủ nhật';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.match(activeDialog().textContent, /Xác nhận đề xuất Chính sách tài chính/);
assert.equal(summary.hidden, true);
activeDialog().querySelector('[data-idempotent-submit]').click();
activeDialog().querySelector('[data-reconcile]').click();
activeDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(window.document.querySelector('#policy-version-result').textContent, /Hệ thống đã ghi nhận/);
assert.match(window.document.querySelector('#policy-1 [data-policy-proposed]').textContent, /02\/10\/2026/);
activeDialog().querySelector('[data-close]').click();

window.history.replaceState(null, '', '?status=active&page=1');
window.__rosterMock.renderSettings();
const deactivate = window.document.querySelector('[data-operation-lifecycle="deactivate"]');
deactivate.click();
activeDialog().querySelector('[data-idempotent-submit]').click();
activeDialog().querySelector('[data-reconcile]').click();
activeDialog().querySelector('[data-return-operation-outcome]').click();
const changedRow = window.document.querySelector('#bank-account-an-binh');
assert.equal(changedRow.dataset.status, 'inactive');
assert.match(changedRow.textContent, /Ngừng dùng/);
assert.equal(changedRow.querySelector('[data-bank-account-action] button').disabled, true);
assert.equal(visibleRows().length, 1);
assert.equal(window.document.querySelector('#bank-account-an-binh-result').hidden, false);
activeDialog().querySelector('[data-close]').click();

const pending = window.document.querySelector('[data-action-title="Thêm tài khoản nhận tiền"]');
pending.dataset.operationTerminal = 'false';
pending.click();
activeDialog().querySelector('[data-idempotent-submit]').click();
activeDialog().querySelector('[data-reconcile]').click();
activeDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(activeDialog().textContent, /Vẫn đang kiểm tra kết quả/);
window.document.querySelector('[data-school-context]').click();
assert.match(activeDialog().textContent, /Đang kiểm tra kết quả/);
console.log('School settings UX behavioral matrix passed');
