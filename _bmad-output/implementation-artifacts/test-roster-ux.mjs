import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from '../../apps/web/node_modules/jsdom/lib/api.js';

const root = '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups';
const script = await readFile(`${root}/prototype.js`, 'utf8');

async function load(page, search = '') {
  const html = await readFile(`${root}/admin/roster/${page}`, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `https://mock.test/${page}${search}` });
  const { window } = dom;
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

function visibleRows(window) {
  return [...window.document.querySelectorAll('[data-roster-rows] tr')]
    .filter(row => !row.hidden)
    .map(row => row.cells[0].textContent.trim());
}

function click(window, selector) {
  window.document.querySelector(selector).click();
}

const roster = await load('roster.html', '?class=mam&sort=name&page=1');
assert.deepEqual(visibleRows(roster), ['Bé An', 'Bé Bình']);
click(roster, '[data-roster-page="2"]');
assert.match(roster.location.search, /page=2/);
assert.deepEqual(visibleRows(roster), ['Bé Dung']);

roster.history.replaceState(null, '', '?sort=class&page=1');
roster.__rosterMock.renderRoster();
assert.deepEqual(visibleRows(roster), ['Bé Chi', 'Bé Minh']);
roster.history.replaceState(null, '', '?q=khong-co&page=1');
roster.__rosterMock.renderRoster();
assert.equal(roster.document.querySelector('[data-roster-empty]').hidden, false);
assert.deepEqual(visibleRows(roster), []);

const classes = await load('school-year-classes.html');
const form = classes.document.querySelector('[data-mock-form]');
form.dispatchEvent(new classes.Event('submit', { bubbles: true, cancelable: true }));
const summary = classes.document.querySelector('[data-error-summary]');
assert.equal(summary.hidden, false);
assert.equal(classes.document.activeElement, summary);
assert.equal(summary.querySelector('a').getAttribute('href'), '#class-name');
const name = classes.document.querySelector('#class-name');
name.value = 'Lớp thử';
name.dispatchEvent(new classes.Event('input', { bubbles: true }));
assert.equal(form.dataset.dirty, 'true');
const guard = classes.document.createElement('button');
guard.dataset.schoolContext = '';
classes.document.body.append(guard);
click(classes, '[data-school-context]');
click(classes, '[data-discard-context]');
assert.equal(form.dataset.dirty, undefined);
assert.equal(name.value, '');

const transition = await load('roster-transition.html');
const action = transition.document.querySelector('[data-idempotent-action]');
click(transition, '[data-idempotent-action]');
click(transition, '[data-idempotent-submit]');
click(transition, '[data-reconcile]');
click(transition, '[data-return-operation-outcome]');
assert.match(transition.document.querySelector('.dialog').textContent, /Đã đối soát kết quả/);
assert.equal(transition.document.querySelector('#transition-result').hidden, false);
assert.match(transition.document.querySelector('#transition-result').textContent, /Bé An/);
assert.match(transition.document.body.textContent, /Lịch sử nguồn vẫn được giữ/);

click(transition, '[data-close]');
action.dataset.operationTerminal = 'false';
click(transition, '[data-idempotent-action]');
click(transition, '[data-idempotent-submit]');
click(transition, '[data-reconcile]');
click(transition, '[data-return-operation-outcome]');
assert.match(transition.document.querySelector('.dialog').textContent, /Vẫn đang kiểm tra kết quả/);
assert.match(transition.document.querySelector('.dialog').textContent, /Không gửi lại/);
console.log('Roster UX behavioral matrix passed');
