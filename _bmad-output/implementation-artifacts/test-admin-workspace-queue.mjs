import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/', import.meta.url);
const workspace = await readFile(new URL('admin/admin-staff.html', root), 'utf8');
const shellSource = await readFile(new URL('admin/admin-shell.js', root), 'utf8');
const prototypeSource = await readFile(new URL('prototype.js', root), 'utf8');

function element(attributes = {}) {
  const listeners = new Map();
  return {
    attributes: new Map(Object.entries(attributes)), classList: { toggle() {} }, dataset: {}, elements: {}, textContent: '', hidden: false, focused: false,
    getAttribute(name) { return this.attributes.get(name) ?? null; }, setAttribute(name, value) { this.attributes.set(name, value); }, removeAttribute(name) { this.attributes.delete(name); },
    hasAttribute(name) { return this.attributes.has(name); }, addEventListener(name, callback) { listeners.set(name, callback); },
    dispatch(name, event = {}) { listeners.get(name)?.({ preventDefault() {}, currentTarget: this, ...event }); }, focus() { this.focused = true; },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}

function row(id, className, date, status) {
  const value = element();
  value.id = id;
  value.dataset = { class: className, date, status };
  return value;
}

function harness() {
  const windowListeners = {};
  const documentListeners = {};
  const routes = ['overview', 'leave'];
  const sections = Object.fromEntries(routes.map(name => [name, element({ 'data-route': '' })]));
  const headings = Object.fromEntries(routes.map(name => [name, element({ tabindex: '-1' })]));
  const contexts = Object.fromEntries(routes.slice(1).map(name => [name, element()]));
  const empty = Object.fromEntries(routes.slice(1).map(name => [name, element()]));
  const rows = { leave: [row('leave-thu', 'mam-3-4', '2026-09-05', 'approved'), row('leave-an', 'choi-4-5', '2026-09-05', 'approved')] };
  const filters = Object.fromEntries(routes.slice(1).map(name => {
    const form = element({ 'data-queue-filter': name });
    form.dataset.queueFilter = name;
    form.elements = { class: { value: 'all' }, date: { value: '2026-09-05' }, status: { value: 'all' } };
    return [name, form];
  }));
  routes.slice(1).forEach(name => {
    sections[name].querySelector = selector => ({ '[data-queue-filter]': filters[name], '[data-queue-context]': contexts[name], '[data-queue-empty]': empty[name] }[selector] ?? null);
    sections[name].querySelectorAll = selector => selector === '[data-queue-rows] tr' ? rows[name] : [];
  });
  const sideLinks = routes.map(name => element({ href: `#${name}` }));
  const host = element({ 'data-admin-route': 'overview' });
  host.innerHTML = '<section></section>';
  host.insertAdjacentHTML = () => {};
  const document = {
    activeElement: element(), body: { append() {} }, createElement: () => element(), getElementById(id) { return Object.values(rows).flat().find(value => value.id === id) ?? null; },
    querySelector(selector) {
      if (selector === '[data-admin-shell]') return host;
      const route = selector.match(/^#([\w-]+)\[data-route\]$/)?.[1];
      if (route) return sections[route];
      const heading = selector.match(/^#([\w-]+)\[data-route\] h1$/)?.[1];
      if (heading) return headings[heading];
      return null;
    },
    querySelectorAll(selector) { return selector === '.side-link' ? sideLinks : []; },
    addEventListener(name, callback) { documentListeners[name] = callback; }
  };
  const window = { location: { hash: '#overview' }, addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); } };
  const dialogs = [];
  const context = { document, window, URLSearchParams, FormData: class { constructor(form) { return Object.entries(form.elements).map(([key, value]) => [key, value.value]); } }, crypto: { randomUUID: () => 'operation-1' }, console, dialogs };
  return { context, headings, contexts, filters, sideLinks, rows, empty, windowListeners, documentListeners };
}

assert.match(workspace, /#leave\?date=2026-09-05&amp;status=approved/);
assert.match(workspace, /#leave\?date=2026-09-05">Danh sách đơn xin nghỉ/);
assert.doesNotMatch(workspace, /data-evidence|Ghi nhận điểm danh/i);
assert.doesNotMatch(shellSource, /attendance|Điểm danh/i);
assert.doesNotMatch(shellSource, /Xin nghỉ|Bàn giao/);
assert.doesNotMatch(workspace, /Ghi nhận giờ đón|Bàn giao/);
assert.match(workspace, /data-overview-date="2026-09-05"[\s\S]*?Chưa đến lớp[\s\S]*?Nghỉ có đơn[\s\S]*?Đã được đón/);
assert.match(workspace, /Trẻ chưa có điểm danh có mặt hoặc vắng được xác nhận hôm nay/);
assert.match(workspace, /data-overview-date="2026-09-04"[\s\S]*?Nghỉ không phép[\s\S]*?Chưa ghi nhận[\s\S]*?Nghỉ có đơn[\s\S]*?Đã được đón/);
assert.doesNotMatch(workspace.match(/data-overview-date="2026-09-05"[\s\S]*?<\/div>\n        <div data-overview-date="2026-09-04"/)?.[0] || '', /Nghỉ không phép|Chưa ghi nhận/);
assert.match(prototypeSource, /adminRoutes\.forEach\(section => \{ section\.hidden = section !== selected; \}\)/);
assert.match(workspace, /data-overview-empty hidden>Chưa có số liệu vận hành/);
assert.match(prototypeSource, /empty\.hidden = overviewDates\.some/);
assert.match(shellSource, /targetHash === 'overview' && isWorkspace && \['overview', 'leave'\]/);
const app = harness();
const dialogMock = `function dialog(title, content, actions = '', opener) {
  const node = { buttons: {}, closeDialog() { opener?.focus(); }, remove() {}, querySelector(selector) { return selector === '.dialog' ? this.panel : this.buttons[selector.slice(1, -1)] || null; }, querySelectorAll() { return []; } };
  node.panel = {};
  Object.defineProperty(node.panel, 'innerHTML', { set(value) { ['data-idempotent-submit','data-reconcile','data-return-operation-outcome','data-close'].forEach(name => { if (value.includes(name)) node.buttons[name] ||= { disabled: false, focus() {}, addEventListener(event, callback) { this.callback = callback; } }; }); } });
  node.panel.innerHTML = actions;
  globalThis.dialogs.push(node);
  return node;
}`;
const executablePrototype = prototypeSource.replace(/function dialog\([\s\S]*?\n}\n\nfunction uuid/, `${dialogMock}\nfunction uuid`);
vm.runInNewContext(shellSource, app.context);
vm.runInNewContext(`${executablePrototype}\nglobalThis.__queueTest = { showIdempotentConfirmation, showOperation };`, app.context);
app.documentListeners.DOMContentLoaded();

function navigate(hash) {
  app.context.window.location.hash = hash;
  app.windowListeners.hashchange.forEach(callback => callback());
}

navigate('#attendance?class=choi-4-5&date=2026-09-05&status=missing');
assert.equal(app.context.window.location.hash, '#overview');
assert.equal(app.sideLinks[0].getAttribute('aria-current'), 'page');

navigate('#leave?class=mam-3-4&date=2026-09-05&status=approved');
assert.equal(app.rows.leave[0].hidden, false);
assert.equal(app.rows.leave[1].hidden, true);
assert.equal(app.empty.leave.hidden, true);

navigate('#handover?date=2026-09-05');
assert.equal(app.context.window.location.hash, '#overview');

console.log('Admin daily overview routes, filters and date-state semantics passed.');
