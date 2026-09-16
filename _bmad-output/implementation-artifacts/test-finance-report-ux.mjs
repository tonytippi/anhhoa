import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../../apps/web/node_modules/jsdom/lib/api.js';

const root = '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups';
const [html, shell, prototype] = await Promise.all([
  readFile(`${root}/admin/finance-report.html`, 'utf8'),
  readFile(`${root}/admin/admin-shell.js`, 'utf8'),
  readFile(`${root}/prototype.js`, 'utf8')
]);
const interaction = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(interaction, 'report fixture includes its interaction script');

function load(query = '?workspace=overview&fixture=october') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `https://mock.test/admin/finance-report.html${query}` });
  dom.window.eval(shell); dom.window.eval(prototype); dom.window.eval(interaction);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom.window;
}

const window = load();
const document = window.document;
assert.equal(document.querySelector('[data-workspace="overview"]').getAttribute('aria-current'), 'page');
assert.match(document.querySelector('[data-report-rows]').textContent, /Thu đủ; coverage đã cấp/);
assert.match(document.querySelector('[data-normalized-filter]').textContent, /Tháng thu 10\/2026/);
assert.equal(document.querySelector('[data-report-export]').hidden, false);

for (const [workspace, required] of [
  ['runs', /Settlement difference mở[\s\S]*Carry đã materialize[\s\S]*Revision\/hủy[\s\S]*SHORTFALL[\s\S]*bản thay thế; nguồn đã hủy/],
  ['debt', /Prior debt[\s\S]*Carry chờ kỳ sau[\s\S]*Coverage còn hiệu lực[\s\S]*Hoàn tiền coverage/],
  ['ledger', /Receipt[\s\S]*\+4\.965\.000 đ[\s\S]*Hoàn tiền coverage[\s\S]*-1\.200\.000 đ[\s\S]*Reversal[\s\S]*-450\.000 đ/]
]) {
  const fixture = load(`?workspace=${workspace}&fixture=october`);
  assert.equal(fixture.document.querySelector(`[data-workspace="${workspace}"]`).getAttribute('aria-current'), 'page');
  assert.match(fixture.document.querySelector('[data-report-result]').textContent, required);
}
const ledger = load('?workspace=ledger&fixture=october');
assert.match(ledger.document.querySelector('[data-report-rows]').innerHTML, /finance-source-receipt\.html[\s\S]*finance-source-refund\.html[\s\S]*finance-source-reversal\.html/);
assert.doesNotMatch(ledger.document.querySelector('[data-report-rows]').innerHTML, /invoice-detail-review/);

const tab = document.querySelector('[data-workspace="ledger"]');
tab.click();
assert.equal(new URL(window.location.href).searchParams.get('workspace'), 'ledger');
assert.equal(document.querySelector('[data-report-loading]').hidden, false, 'workspace query waits for server result');
assert.equal(document.querySelector('[data-report-result]').hidden, true);
const form = document.querySelector('[data-report-filter]');
form.elements.billingMonth.value = '2026-09'; form.elements.collectionRun.value = 'run-october';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
assert.equal(new URL(window.location.href).searchParams.get('billingMonth'), '2026-09');
assert.equal(document.querySelector('[data-report-loading]').getAttribute('aria-busy'), 'true');
assert.match(document.querySelector('[data-filter-feedback]').textContent, /chờ kết quả được cấp quyền/);
assert.equal(document.querySelector('[data-report-result]').hidden, true, 'form values do not construct a browser result');

const invalid = load('?workspace=ledger&fixture=october&class=mam-4a');
assert.equal(invalid.document.querySelector('[data-report-result]').hidden, true);
assert.match(invalid.document.querySelector('[data-report-safe]').textContent, /chưa có fixture kết quả/);
assert.equal(invalid.document.querySelector('[data-as-of]').textContent, 'Không khả dụng');
const deepLink = load('?workspace=unknown&fixture=october');
assert.match(deepLink.document.querySelector('[data-report-safe]').textContent, /Liên kết hoặc bộ lọc này/);

const safe = load();
safe.document.querySelector('[data-report-state="empty"]').click();
assert.match(safe.document.querySelector('[data-report-safe]').textContent, /Không có hoạt động sổ cái phù hợp[\s\S]*không suy diễn 0 đã thu/);
assert.match(safe.document.querySelector('[data-as-of]').textContent, /31\/10\/2026/, 'empty retains safe asOf');
safe.document.querySelector('[data-report-state="error"]').click();
assert.match(safe.document.querySelector('[data-report-safe]').textContent, /Không thể tải báo cáo/);
assert.equal(safe.document.querySelector('[data-as-of]').textContent, 'Không khả dụng');

const expired = load();
expired.document.querySelector('[data-report-state="expired"]').click();
assert.equal(expired.document.querySelector('[data-report-export]').hidden, true);
expired.document.querySelector('[data-safe-reload]').click();
assert.equal(expired.document.querySelector('[data-report-result]').hidden, false, 'fresh authorized fixture reload restores result');
assert.equal(expired.document.querySelector('[data-report-export]').hidden, false, 'fresh authorized fixture reload restores CSV');
const revoked = load();
revoked.document.querySelector('[data-report-state="revoked"]').click();
revoked.dispatchEvent(new revoked.PopStateEvent('popstate'));
assert.equal(revoked.document.querySelector('[data-report-result]').hidden, true, 'revoke cannot revive stale fixture on navigation');
assert.equal(revoked.document.querySelector('[data-report-export]').hidden, true);

const unauthorizedHtml = html.replace(' data-finance-authorized="true"', '');
const unauthorized = new JSDOM(unauthorizedHtml, { runScripts: 'outside-only', url: 'https://mock.test/admin/finance-report.html' });
unauthorized.window.eval(shell);
assert.equal([...unauthorized.window.document.querySelectorAll('.side-link')].some(link => link.textContent === 'Báo cáo'), false, 'report navigation requires Finance fixture capability');

const schoolSwitch = load();
schoolSwitch.document.querySelector('[data-school-context]').click();
schoolSwitch.document.querySelector('[data-discard-context]').click();
assert.equal(schoolSwitch.document.querySelector('[data-finance-report]'), null, 'School switch clears prior report result before new context renders');
assert.match(schoolSwitch.document.querySelector('.workspace').textContent, /Ngữ cảnh cũ đã được xóa/);
console.log('Finance report fixture query, workspace, provenance and safe-state behavior passed');
