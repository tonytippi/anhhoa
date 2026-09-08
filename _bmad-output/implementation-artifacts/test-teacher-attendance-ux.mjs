import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../../apps/web/node_modules/jsdom/lib/api.js';

const root = '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups';
const html = await readFile(`${root}/teacher/teacher.html`, 'utf8');
const script = await readFile(`${root}/prototype.js`, 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://mock.test/teacher/teacher.html#class-day' });
const { window } = dom;

window.eval(script);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

assert.match(window.document.querySelector('.privacy-note').textContent, /binding, capability hoặc phân công lớp bị thu hồi/);
assert.match(window.document.querySelector('#class-day').textContent, /lớp được phân công hiệu lực hôm nay/);

const receiveChild = [...window.document.querySelectorAll('[data-evidence]')].find(button => button.textContent === 'Nhận trẻ');
assert.ok(receiveChild);
receiveChild.click();

const activeDialog = () => window.document.querySelector('.dialog-backdrop:last-child');
assert.match(activeDialog().textContent, /Ghi nhận điểm danh cho Bé Khoa/);
assert.match(activeDialog().textContent, /Bằng chứng là bắt buộc/);

const evidence = activeDialog().querySelector('[type="file"]');
const submit = activeDialog().querySelector('[data-submit-evidence]');
assert.equal(submit.disabled, true);
Object.defineProperty(evidence, 'files', { configurable: true, value: [new window.File(['evidence'], 'evidence.jpg', { type: 'image/jpeg' })] });
evidence.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(submit.disabled, false);
submit.click();
assert.match(activeDialog().textContent, /Đã gửi ghi nhận điểm danh/);
assert.match(activeDialog().textContent, /Đối soát kết quả/);
activeDialog().querySelector('[data-reconcile]').click();
assert.match(activeDialog().textContent, /Đang kiểm tra kết quả/);
activeDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(activeDialog().textContent, /Đã đối soát kết quả/);
assert.match(activeDialog().textContent, /Hệ thống đã xác nhận Bé Khoa có mặt/);
const khoa = window.document.querySelector('#teacher-attendance-khoa');
assert.equal(khoa.dataset.status, 'present');
assert.match(khoa.querySelector('[data-attendance-status]').textContent, /Có mặt/);
assert.match(khoa.querySelector('[data-attendance-update]').textContent, /xác nhận hệ thống/);
assert.equal(khoa.querySelector('[data-attendance-action] [data-evidence]'), null);
assert.equal(khoa.querySelector('[data-attendance-action] button').disabled, true);
activeDialog().querySelector('[data-close]').click();

const secondDom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://mock.test/teacher/teacher.html#class-day' });
const revokedWindow = secondDom.window;
revokedWindow.eval(script);
revokedWindow.document.dispatchEvent(new revokedWindow.Event('DOMContentLoaded'));
const revokedReceiveChild = [...revokedWindow.document.querySelectorAll('[data-evidence]')].find(button => button.textContent === 'Nhận trẻ');
revokedReceiveChild.click();
const revokedDialog = () => revokedWindow.document.querySelector('.dialog-backdrop:last-child');
const revokedEvidence = revokedDialog().querySelector('[type="file"]');
Object.defineProperty(revokedEvidence, 'files', { configurable: true, value: [new revokedWindow.File(['evidence'], 'evidence.jpg', { type: 'image/jpeg' })] });
revokedEvidence.dispatchEvent(new revokedWindow.Event('change', { bubbles: true }));
revokedDialog().querySelector('[data-submit-evidence]').click();
assert.match(revokedDialog().textContent, /Đã gửi ghi nhận điểm danh/);

revokedWindow.dispatchEvent(new revokedWindow.Event('teacher-access-revoked'));
assert.equal(revokedWindow.document.querySelector('.dialog-backdrop, .dialog'), null);
assert.ok(revokedWindow.document.querySelector('#teacher-access-revoked'));

const retry = revokedWindow.document.createElement('button');
retry.type = 'button';
retry.dataset.idempotentAction = '';
retry.dataset.actionTitle = 'Thao tác mới';
retry.dataset.actionLabel = 'Xác nhận thao tác mới';
retry.dataset.actionConsequence = 'Thao tác mới bắt đầu với ngữ cảnh mới.';
revokedWindow.document.body.append(retry);
retry.click();
assert.match(revokedDialog().textContent, /Thao tác mới/);
assert.doesNotMatch(revokedDialog().textContent, /Bé Khoa|điểm danh/);
assert.ok(revokedDialog().querySelector('[data-idempotent-submit]'));

window.dispatchEvent(new window.Event('teacher-access-revoked'));
const safeState = window.document.querySelector('#teacher-access-revoked');
assert.ok(safeState);
assert.match(safeState.textContent, /Bạn không còn quyền xem nội dung này/);
assert.equal(window.document.querySelector('#teacher-attendance-khoa'), null);
assert.equal(window.document.querySelector('[data-evidence]'), null);
assert.equal(window.document.querySelectorAll('#class-day, #journal-an, #journal-khoa, #handover').length, 0);
assert.equal(window.document.querySelectorAll('.teacher-tabs a, .teacher-main button, .teacher-main input, .teacher-main textarea').length, 0);
assert.equal(window.document.querySelector('[data-school-context]'), null);

for (const route of ['#journal-an', '#journal-khoa', '#handover']) {
  window.location.hash = route;
  window.dispatchEvent(new window.Event('hashchange'));
  assert.ok(window.document.querySelector('#teacher-access-revoked'));
  assert.equal(window.document.querySelectorAll('#class-day, #journal-an, #journal-khoa, #handover').length, 0);
  assert.equal(window.document.querySelectorAll('.teacher-tabs a, .teacher-main button, .teacher-main input, .teacher-main textarea').length, 0);
  assert.doesNotMatch(window.document.querySelector('.teacher-main').textContent, /Bé An|Bé Khoa|Bé Minh|AH-129|AH-130|AH-141/);
}

console.log('Teacher attendance evidence and safe-state checks passed.');
