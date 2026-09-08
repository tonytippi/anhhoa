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
assert.match(window.document.querySelector('.teacher-progress').textContent, /2\/4.*Đã nhận xét/);
assert.match(window.document.querySelector('[data-journal-caption]').textContent, /Mầm 3-4 tuổi.*Tất cả 4 trẻ.*2\/4 đã có nhận xét/);
assert.equal(window.document.querySelectorAll('[data-journal-rows] [data-journal-status="missing"]').length, 2);
assert.equal(window.document.querySelector('#teacher-journal-khoa [data-journal-action]').textContent, 'Viết nhận xét');
assert.equal(window.document.querySelector('[data-class-day-journal-action="teacher-journal-khoa"]').textContent, 'Viết nhận xét');
assert.equal(window.document.querySelector('[data-class-day-journal-action="teacher-journal-thu"]').textContent, 'Viết nhận xét');
assert.equal(window.document.querySelector('[data-class-day-journal-action="teacher-journal-thu"]').getAttribute('href'), '#journal-thu');
assert.equal(window.document.querySelector('#teacher-journal-an [data-journal-action]').textContent, 'Xem/Sửa nhận xét');
const anClassDayCard = [...window.document.querySelectorAll('#class-day > .student-list > .student')].find(row => row.querySelector('h3')?.textContent === 'Bé An');
assert.equal(anClassDayCard.querySelector('a[href="#journal-an"]').textContent, window.document.querySelector('#teacher-journal-an [data-journal-action]').textContent);
const minhClassDayCard = [...window.document.querySelectorAll('#class-day > .student-list > .student')].find(row => row.querySelector('h3')?.textContent === 'Bé Minh');
assert.equal(minhClassDayCard.querySelector('a[href="#journal-minh"]').textContent, window.document.querySelector('#teacher-journal-minh [data-journal-action]').textContent);
assert.equal(window.document.querySelector('#teacher-journal-thu [data-journal-action]').getAttribute('href'), '#journal-thu');
assert.equal(window.document.querySelector('#teacher-journal-minh [data-journal-action]').getAttribute('href'), '#journal-minh');
for (const student of ['an', 'khoa', 'thu', 'minh']) assert.ok(window.document.querySelector(`#journal-${student}`));
for (const [student, target] of [['An', '#journal-an'], ['Khoa', '#journal-khoa'], ['Minh', '#journal-minh']]) {
  const card = [...window.document.querySelectorAll('#class-day > .student-list > .student')].find(row => row.querySelector('h3')?.textContent === `Bé ${student}`);
  assert.equal(card.querySelector('a[href^="#journal-"]').getAttribute('href'), target);
}
for (const section of window.document.querySelectorAll('[data-journal-list], .journal-editor')) {
  assert.doesNotMatch(section.textContent, /giáo viên|audit|lịch sử phiên bản|bằng chứng điểm danh|blob:|https?:\/\//i);
  assert.equal(section.querySelector('[src], [href^="http"], [href^="blob:"]'), null);
}
for (const rule of window.document.querySelectorAll('[data-journal-upload-rule]')) {
  assert.match(rule.textContent, /MIME, kích thước, Student\/ngày\/lớp, binding\/capability\/phân công Teacher và tenant graph/);
  assert.match(rule.textContent, /Trình duyệt không tự cấp quyền tải lên/);
}

const journalSearch = window.document.querySelector('[data-journal-search]');
journalSearch.value = 'AH-130';
journalSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelectorAll('[data-journal-rows] [data-journal-status]:not([hidden])').length, 1);
assert.equal(window.document.querySelector('#teacher-journal-khoa').hidden, false);
const journalFilter = window.document.querySelector('[data-journal-filter]');
journalFilter.value = 'current';
journalFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(window.document.querySelector('[data-journal-empty]').hidden, false);
assert.match(window.document.querySelector('[data-journal-empty]').textContent, /Mầm 3-4 tuổi · 05\/09\/2026/);
window.document.querySelector('[data-journal-reset]').click();
assert.equal(journalSearch.value, '');
assert.equal(journalFilter.value, 'all');
assert.equal(window.document.querySelectorAll('[data-journal-rows] [data-journal-status]:not([hidden])').length, 4);

const pendingDom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://mock.test/teacher/teacher.html#class-day' });
const pendingWindow = pendingDom.window;
pendingWindow.eval(script);
pendingWindow.document.dispatchEvent(new pendingWindow.Event('DOMContentLoaded'));
const pendingButton = pendingWindow.document.createElement('button');
pendingButton.type = 'button';
pendingButton.dataset.idempotentAction = '';
pendingButton.dataset.actionTitle = 'Lưu nhận xét của Bé Khoa';
pendingButton.dataset.actionLabel = 'Lưu nhận xét';
pendingButton.dataset.actionConsequence = 'Đang kiểm tra kết quả.';
pendingButton.dataset.operationRow = 'teacher-journal-khoa';
pendingButton.dataset.operationLifecycle = 'journal-save';
pendingButton.dataset.operationJournalOutcome = 'success';
pendingButton.dataset.operationTerminal = 'false';
pendingWindow.document.body.append(pendingButton);
pendingButton.click();
const pendingDialog = () => pendingWindow.document.querySelector('.dialog-backdrop:last-child');
pendingDialog().querySelector('[data-idempotent-submit]').click();
pendingDialog().querySelector('[data-reconcile]').click();
pendingDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(pendingDialog().textContent, /Vẫn đang kiểm tra kết quả/);
assert.equal(pendingWindow.document.querySelector('#teacher-journal-khoa').dataset.journalStatus, 'missing');
assert.equal(pendingWindow.document.querySelector('.teacher-progress article:last-child b').textContent, '2/4');
assert.equal(pendingWindow.document.querySelector('[data-class-day-journal-action="teacher-journal-khoa"]').textContent, 'Viết nhận xét');
pendingButton.click();
assert.match(pendingDialog().textContent, /Đang kiểm tra kết quả/);

const failureDom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://mock.test/teacher/teacher.html#journal-thu' });
const failureWindow = failureDom.window;
failureWindow.eval(script);
failureWindow.document.dispatchEvent(new failureWindow.Event('DOMContentLoaded'));
const failureDialog = () => failureWindow.document.querySelector('.dialog-backdrop:last-child');
const failureButton = failureWindow.document.createElement('button');
failureButton.type = 'button';
failureButton.dataset.idempotentAction = '';
failureButton.dataset.actionTitle = 'Lưu nhận xét của Bé Khoa';
failureButton.dataset.actionLabel = 'Lưu nhận xét';
failureButton.dataset.actionConsequence = 'Hệ thống chưa thể xác nhận.';
failureButton.dataset.operationRow = 'teacher-journal-khoa';
failureButton.dataset.operationLifecycle = 'journal-save';
failureButton.dataset.operationJournalOutcome = 'failure';
failureButton.dataset.operationJournalHref = '#journal-khoa';
failureButton.dataset.operationResult = 'Hệ thống chưa thể xác nhận nhận xét của Bé Khoa. Nội dung hiện hành chưa thay đổi.';
failureWindow.document.body.append(failureButton);
failureButton.click();
failureDialog().querySelector('[data-idempotent-submit]').click();
failureDialog().querySelector('[data-reconcile]').click();
failureDialog().querySelector('[data-return-operation-outcome]').click();
assert.match(failureDialog().textContent, /chưa thể xác nhận nhận xét của Bé Khoa/i);
assert.equal(failureWindow.document.querySelector('#teacher-journal-khoa').dataset.journalStatus, 'missing');
assert.match(failureWindow.document.querySelector('#teacher-journal-khoa [data-journal-status-label]').textContent, /Chưa có nhận xét/);
assert.match(failureWindow.document.querySelector('#teacher-journal-khoa [data-journal-update]').textContent, /Chưa có nhận xét được hệ thống xác nhận/);
assert.equal(failureWindow.document.querySelector('#teacher-journal-khoa [data-journal-action]').textContent, 'Viết nhận xét');
assert.equal(failureWindow.document.querySelector('[data-class-day-journal-action="teacher-journal-khoa"]').textContent, 'Viết nhận xét');
assert.equal(failureButton.disabled, false);
assert.equal(failureButton.textContent, 'Sửa và gửi lại');
failureButton.click();
assert.match(failureDialog().textContent, /Lưu nhận xét của Bé Khoa/);
failureDialog().querySelector('[data-idempotent-submit]').click();
assert.match(failureDialog().textContent, /Đã gửi thao tác/);
assert.equal(failureWindow.document.querySelector('.teacher-progress article:last-child b').textContent, '2/4');

window.document.querySelector('#journal-khoa [data-idempotent-action]').click();
const activeDialog = () => window.document.querySelector('.dialog-backdrop:last-child');
assert.match(activeDialog().textContent, /Lưu nhận xét của Bé Khoa/);
activeDialog().querySelector('[data-idempotent-submit]').click();
assert.equal(window.document.querySelector('#teacher-journal-khoa').dataset.journalStatus, 'missing');
activeDialog().querySelector('[data-reconcile]').click();
assert.match(activeDialog().textContent, /Đang kiểm tra kết quả/);
activeDialog().querySelector('[data-return-operation-outcome]').click();
assert.equal(window.document.querySelector('#teacher-journal-khoa').dataset.journalStatus, 'current');
assert.match(window.document.querySelector('#teacher-journal-khoa [data-journal-status-label]').textContent, /Đã có nhận xét/);
assert.match(window.document.querySelector('#teacher-journal-khoa [data-journal-update]').textContent, /Hệ thống xác nhận lúc/);
assert.equal(window.document.querySelector('#teacher-journal-khoa [data-journal-action]').textContent, 'Xem/Sửa nhận xét');
assert.equal(window.document.querySelector('#teacher-journal-khoa [data-journal-action]').getAttribute('href'), '#journal-khoa');
assert.equal(window.document.querySelector('[data-class-day-journal-action="teacher-journal-khoa"]').textContent, 'Xem/Sửa nhận xét');
assert.equal(window.document.querySelector('[data-class-day-journal-action="teacher-journal-khoa"]').getAttribute('href'), '#journal-khoa');
assert.equal(window.document.querySelector('#teacher-attendance-khoa').dataset.classDayJournalStatus, 'current');
assert.match(window.document.querySelector('[data-journal-caption]').textContent, /3\/4 đã có nhận xét/);
assert.match(window.document.querySelector('[data-journal-count]').textContent, /3 đã có nhận xét/);
assert.equal(window.document.querySelector('.teacher-progress article:last-child b').textContent, '3/4');
activeDialog().querySelector('[data-close]').click();

const thuSuccessDom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://mock.test/teacher/teacher.html#journal-thu' });
const thuSuccessWindow = thuSuccessDom.window;
thuSuccessWindow.eval(script);
thuSuccessWindow.document.dispatchEvent(new thuSuccessWindow.Event('DOMContentLoaded'));
const thuSuccessButton = thuSuccessWindow.document.createElement('button');
thuSuccessButton.type = 'button';
thuSuccessButton.dataset.idempotentAction = '';
thuSuccessButton.dataset.actionTitle = 'Lưu nhận xét của Bé Thu';
thuSuccessButton.dataset.actionLabel = 'Lưu nhận xét';
thuSuccessButton.dataset.actionConsequence = 'Hệ thống đang kiểm tra kết quả.';
thuSuccessButton.dataset.operationRow = 'teacher-journal-thu';
thuSuccessButton.dataset.operationLifecycle = 'journal-save';
thuSuccessButton.dataset.operationJournalOutcome = 'success';
thuSuccessButton.dataset.operationJournalHref = '#journal-thu';
thuSuccessButton.dataset.operationConfirmedAt = '16:05';
thuSuccessWindow.document.body.append(thuSuccessButton);
thuSuccessButton.click();
const thuSuccessDialog = () => thuSuccessWindow.document.querySelector('.dialog-backdrop:last-child');
thuSuccessDialog().querySelector('[data-idempotent-submit]').click();
thuSuccessDialog().querySelector('[data-reconcile]').click();
thuSuccessDialog().querySelector('[data-return-operation-outcome]').click();
assert.equal(thuSuccessWindow.document.querySelector('#teacher-journal-thu').dataset.journalStatus, 'current');
assert.equal(thuSuccessWindow.document.querySelector('#teacher-journal-thu [data-journal-action]').textContent, 'Xem/Sửa nhận xét');
assert.equal(thuSuccessWindow.document.querySelector('[data-class-day-journal-action="teacher-journal-thu"]').textContent, 'Xem/Sửa nhận xét');
assert.equal(thuSuccessWindow.document.querySelector('[data-class-day-journal-action="teacher-journal-thu"]').getAttribute('href'), '#journal-thu');
assert.equal(thuSuccessWindow.document.querySelector('[data-class-day-journal-action="teacher-journal-thu"]').closest('[data-class-day-journal-status]').dataset.classDayJournalStatus, 'current');

const receiveChild = [...window.document.querySelectorAll('[data-evidence]')].find(button => button.textContent === 'Nhận trẻ');
assert.ok(receiveChild);
receiveChild.click();

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
const revokedFilter = revokedWindow.document.querySelector('[data-journal-filter]');
revokedFilter.value = 'missing';
revokedFilter.dispatchEvent(new revokedWindow.Event('change', { bubbles: true }));
assert.equal(revokedFilter.value, 'missing');
revokedWindow.location.hash = '#journal-khoa';
revokedWindow.dispatchEvent(new revokedWindow.Event('hashchange'));
assert.ok(revokedWindow.document.querySelector('#journal-khoa'));
revokedWindow.document.querySelector('#journal-khoa [data-idempotent-action]').click();
const revokedDialog = () => revokedWindow.document.querySelector('.dialog-backdrop:last-child');
assert.match(revokedDialog().textContent, /Lưu nhận xét của Bé Khoa/);

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
assert.equal(window.document.querySelector('[data-journal-list]'), null);
assert.equal(window.document.querySelector('[data-journal-search], [data-journal-filter], [data-journal-empty]'), null);
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
