const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let knownOperation = null;

function dialog(title, content, actions = '', opener = document.activeElement) {
  const node = document.createElement('div');
  node.className = 'dialog-backdrop';
  node.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${title}</h2>${content}<div class="dialog-actions"><button class="button secondary" data-close>Hủy</button>${actions}</div></section>`;
  document.body.append(node);
  const close = () => { node.remove(); opener?.focus(); };
  node.closeDialog = close;
  const focusable = () => $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]', node);
  node.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $$('[data-close]', node).forEach(button => button.addEventListener('click', close));
  focusable()[0]?.focus();
  return node;
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.random() * 16 | 0;
    return (character === 'x' ? value : value & 3 | 8).toString(16);
  });
}

function reconcileOperation(opener = document.activeElement) {
  const operation = knownOperation;
  const node = dialog('Đang kiểm tra kết quả', `<div class="operation"><p>Hệ thống đang kiểm tra kết quả của thao tác này. Không gửi lại cho đến khi có kết quả.</p><details><summary>Thông tin đối soát</summary><p>Mã thao tác: <code>${operation.id}</code></p></details></div>`, '<button class="button" type="button" data-return-operation-outcome>Nhận kết quả từ hệ thống</button>', opener);
  $('[data-return-operation-outcome]', node).addEventListener('click', () => {
    if (!operation.terminal) {
      $('.dialog', node).innerHTML = '<h2 id="dialog-title">Vẫn đang kiểm tra kết quả</h2><p>Hệ thống chưa trả kết quả mới cho thao tác này. Không gửi lại hoặc thực hiện thao tác có tác động cao cho đến khi có kết quả cuối cùng.</p><div class="dialog-actions"><button class="button" type="button" data-reconcile>Tiếp tục kiểm tra</button></div>';
      $('[data-reconcile]', node).addEventListener('click', () => { node.remove(); reconcileOperation(opener); });
      $('[data-reconcile]', node).focus();
      return;
    }
    const row = operation.rowId && document.getElementById(operation.rowId);
    if (row) row.dataset.status = operation.outcome;
    if (operation.target) renderOperationResult(operation);
    renderQueue(window.location.hash || '#overview');
    knownOperation = null;
    $('.dialog', node).innerHTML = `<h2 id="dialog-title">Đã đối soát kết quả</h2><p>${operation.result}</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>`;
    $('[data-close]', node).addEventListener('click', node.closeDialog);
    $('[data-close]', node).focus();
  });
}

function showOperation(title, button, node) {
  knownOperation = {
    id: uuid(),
    rowId: button.dataset.operationRow,
    outcome: button.dataset.operationOutcome || 'complete',
    result: button.dataset.operationResult || 'Hệ thống đã xác nhận kết quả và làm mới danh sách.',
    resultTitle: button.dataset.operationResultTitle || 'Kết quả từ hệ thống',
    target: button.dataset.operationTarget,
    terminal: button.dataset.operationTerminal !== 'false'
  };
  $('.dialog', node).innerHTML = `<h2 id="dialog-title">${title}</h2><div class="operation"><p>Yêu cầu đã được gửi. Đang kiểm tra kết quả với hệ thống trước khi cho phép gửi lại.</p></div><div class="dialog-actions"><button class="button" type="button" data-reconcile>Đối soát kết quả</button></div>`;
  $('[data-reconcile]', node).addEventListener('click', () => { node.remove(); reconcileOperation(); });
  $('[data-reconcile]', node).focus();
}

function showIdempotentConfirmation(button) {
  if (knownOperation) { reconcileOperation(button); return; }
  const node = dialog(button.dataset.actionTitle, `<p>${button.dataset.actionConsequence}</p>`, `<button class="button" type="button" data-idempotent-submit>${button.dataset.actionLabel}</button>`, button);
  $('[data-idempotent-submit]', node).addEventListener('click', event => {
    event.stopPropagation();
    event.currentTarget.disabled = true;
    showOperation('Đã gửi thao tác', button, node);
  }, { once: true });
}

function showSchoolContextGuard(button) {
  const hasDirtyDraft = $$('[data-mock-form]').some(form => form.dataset.dirty === 'true');
  if (knownOperation) { reconcileOperation(button); return; }
  const detail = hasDirtyDraft
    ? '<p>Biểu mẫu chưa gửi có thay đổi. Chỉ nội dung chưa gửi mới có thể bỏ.</p>'
    : '<p>Không có biểu mẫu đang gửi. Bạn có thể ở lại hoặc bỏ nội dung chưa gửi trước khi đổi trường.</p>';
  const node = dialog('Đổi ngữ cảnh trường', detail, '<button class="button secondary" type="button" data-close>Ở lại Ánh Hoa</button><button class="button" type="button" data-discard-context>Bỏ nội dung chưa gửi và đổi trường</button>', button);
  $('[data-discard-context]', node).addEventListener('click', () => {
    $$('[data-mock-form]').forEach(form => {
      form.reset();
      delete form.dataset.dirty;
    });
    $('.dialog', node).innerHTML = '<h2 id="dialog-title">Sẵn sàng đổi trường</h2><p>Nội dung chưa gửi đã được bỏ trong mô phỏng. Chưa điều hướng hoặc thay đổi dữ liệu miền.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
    $('[data-close]', node).addEventListener('click', node.closeDialog);
    $('[data-close]', node).focus();
  });
}

function showNamedConfirmation(button) {
  const [title, content, label] = button.dataset.confirm.split('|');
  const node = dialog(title, `<p>${content}</p>`, `<button class="button" type="button" data-close>${label || 'Đã hiểu'}</button>`, button);
  $('[data-close]', node).addEventListener('click', node.closeDialog);
}

function rosterState(route = window.location.search) {
  const params = new URLSearchParams(route.replace(/^\?/, ''));
  return {
    q: (params.get('q') || '').trim().toLocaleLowerCase('vi'),
    year: params.get('year') || '2026-2027',
    className: params.get('class') || 'all',
    status: params.get('status') || 'all',
    sort: params.get('sort') || 'name',
    page: Math.max(1, Number(params.get('page')) || 1)
  };
}

function matchesRosterRow(row, state) {
  return (state.className === 'all' || row.dataset.class === state.className)
    && (state.status === 'all' || row.dataset.status === state.status)
    && (!state.q || row.dataset.name.includes(state.q));
}

function renderOperationResult(operation) {
  const target = document.getElementById(operation.target);
  if (!target) return;
  target.hidden = false;
  target.innerHTML = `<h2>${operation.resultTitle}</h2><p>${operation.result}</p><p class="muted">Kết quả chỉ được hiển thị sau khi hệ thống trả trạng thái cuối cùng.</p>`;
}

function renderRoster() {
  const section = $('#roster[data-route]');
  if (!section) return;
  const state = rosterState();
  const form = $('[data-roster-filter]', section);
  Object.entries({ q: state.q, year: state.year, class: state.className, status: state.status, sort: state.sort }).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
  const body = $('[data-roster-rows]', section);
  const rows = $$('tr', body).sort((left, right) => state.sort === 'class'
    ? left.dataset.class.localeCompare(right.dataset.class, 'vi')
    : left.dataset.name.localeCompare(right.dataset.name, 'vi'));
  rows.forEach(row => body.append(row));
  const matching = rows.filter(row => matchesRosterRow(row, state));
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(state.page, pageCount);
  const displayed = matching.slice((page - 1) * pageSize, page * pageSize);
  rows.forEach(row => { row.hidden = !displayed.includes(row); });
  $('[data-roster-empty]', section).hidden = matching.length !== 0;
  $('[data-roster-caption]', section).textContent = `Trường Ánh Hoa · Năm học ${state.year} · Trang ${page} / ${pageCount} · ${matching.length} học sinh`;
  $$('[data-roster-page]', section).forEach(button => {
    const current = Number(button.dataset.rosterPage) === page;
    button.hidden = Number(button.dataset.rosterPage) > pageCount;
    button.setAttribute('aria-current', current ? 'page' : 'false');
  });
}

function focusErrorSummary(form) {
  const summary = $('[data-error-summary]', form);
  if (!summary) return;
  summary.hidden = false;
  summary.focus();
}

function queueState(route) {
  const [name, query = ''] = route.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  return { name, className: params.get('class') || 'all', date: params.get('date') || '2026-09-05', status: params.get('status') || 'all' };
}

function labelForClass(value) {
  return { 'mam-3-4': 'Mầm 3-4 tuổi', 'choi-4-5': 'Chồi 4-5 tuổi', 'la-5-6': 'Lá 5-6 tuổi', all: 'Tất cả lớp' }[value] || 'Tất cả lớp';
}

function renderQueue(route) {
  const state = queueState(route);
  const section = $(`#${state.name}[data-route]`);
  if (!section) return;
  const form = $('[data-queue-filter]', section);
  if (!form) return;
  form.elements.class.value = state.className;
  form.elements.date.value = state.date;
  form.elements.status.value = state.status;
  $('[data-queue-context]', section).textContent = `Trường Ánh Hoa · ${state.date.split('-').reverse().join('/')} · ${labelForClass(state.className)}`;
  const rows = $$('[data-queue-rows] tr', section);
  const visible = rows.filter(row => {
    const matchesClass = state.className === 'all' || row.dataset.class === state.className;
    const matchesDate = row.dataset.date === state.date;
    const matchesStatus = state.status === 'all' || row.dataset.status === state.status;
    row.hidden = !(matchesClass && matchesDate && matchesStatus);
    return !row.hidden;
  });
  $('[data-queue-empty]', section).hidden = visible.length !== 0;
}

function focusRoute() {
  const route = window.location.hash || '#overview';
  renderQueue(route);
  renderRoster();
  const state = queueState(route);
  const heading = $(`#${state.name}[data-route] h1`);
  heading?.focus();
}

function bindMockActions() {
  if (document.documentElement.dataset.mockActionsBound) return;
  document.documentElement.dataset.mockActionsBound = 'true';
  window.addEventListener('hashchange', focusRoute);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-operation], [data-confirm], [data-evidence], [data-provision], [data-idempotent-action], [data-school-context]');
    if (!button) return;
    if (button.dataset.operation) { knownOperation = { id: button.dataset.operation, result: 'Hệ thống chưa trả kết quả mới cho thao tác này.', terminal: false }; reconcileOperation(button); return; }
    if (button.dataset.schoolContext !== undefined) { showSchoolContextGuard(button); return; }
    if (button.dataset.confirm) { showNamedConfirmation(button); return; }
    if (button.hasAttribute('data-evidence')) {
      if (knownOperation) { reconcileOperation(button); return; }
      const node = dialog('Ghi nhận điểm danh cho Bé Khoa', '<form><label for="attendance-status">Trạng thái điểm danh</label><select id="attendance-status" name="status"><option>Có mặt</option><option>Nghỉ có phép</option></select><label for="attendance-evidence">Tệp hoặc bằng chứng</label><input id="attendance-evidence" name="evidence" type="file" required><p class="muted">Bằng chứng là bắt buộc và phụ huynh không thể xem tệp này.</p></form>', '<button class="button" type="button" data-submit-evidence disabled>Lưu ghi nhận</button>', button);
      const file = $('[type="file"]', node);
      const submit = $('[data-submit-evidence]', node);
      file.addEventListener('change', () => { submit.disabled = !file.files.length; });
      submit.addEventListener('click', () => showOperation('Đã gửi ghi nhận điểm danh', button, node));
      return;
    }
    if (button.hasAttribute('data-idempotent-action')) { showIdempotentConfirmation(button); return; }
  });
  $$('.filters').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.hasAttribute('data-roster-filter')) {
      const params = new URLSearchParams(new FormData(form));
      params.set('page', '1');
      window.history.replaceState(null, '', `?${params.toString()}`);
      renderRoster();
      return;
    }
    const route = form.dataset.queueFilter;
    const params = new URLSearchParams(new FormData(form));
    window.location.hash = `${route}?${params.toString()}`;
  }));
  $$('[data-roster-page]').forEach(button => button.addEventListener('click', () => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', button.dataset.rosterPage);
    window.history.replaceState(null, '', `?${params.toString()}`);
    renderRoster();
  }));
  $$('[data-mock-form]').forEach(form => {
    form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
    form.addEventListener('submit', event => { event.preventDefault(); focusErrorSummary(form); });
  });
  focusRoute();
}

if (typeof window !== 'undefined') window.__rosterMock = { rosterState, matchesRosterRow, renderRoster, focusErrorSummary };
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindMockActions);
