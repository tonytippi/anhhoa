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
    if (operation.lifecycle === 'journal-save' && operation.journalOutcome !== 'success') {
      operation.sourceButton.disabled = false;
      operation.sourceButton.textContent = 'Sửa và gửi lại';
      operation.sourceButton.dataset.actionLabel = 'Sửa và gửi lại';
    }
    const row = operation.rowId && document.getElementById(operation.rowId);
    if (row) {
      row.dataset.status = operation.outcome;
      if (operation.lifecycle === 'deactivate') {
        const status = $('[data-bank-account-status]', row);
        const action = $('[data-bank-account-action]', row);
        if (status) status.innerHTML = '<span class="badge neutral">Ngừng dùng</span>';
        if (action) action.innerHTML = '<button class="button secondary" type="button" disabled>Đã ngừng dùng</button>';
      }
      if (operation.lifecycle === 'policy-version') {
        const proposed = $('[data-policy-proposed]', row);
        if (proposed) proposed.textContent = `${operation.value} từ ${operation.effectiveDate}`;
      }
      if (operation.lifecycle === 'attendance-present') {
        const status = $('[data-attendance-status]', row);
        const update = $('[data-attendance-update]', row);
        const action = $('[data-attendance-action]', row);
        if (status) status.innerHTML = '<span class="badge success">Có mặt</span>';
        if (update) update.textContent = 'AH-130 · Đã nhận trẻ theo xác nhận hệ thống';
        if (action) action.innerHTML = '<button class="button secondary" type="button" disabled>Đã ghi nhận</button>';
      }
      if (operation.lifecycle === 'journal-save' && operation.journalOutcome === 'success' && !operation.conflict) {
        const status = $('[data-journal-status-label]', row);
        const update = $('[data-journal-update]', row);
        const action = $('[data-journal-action]', row);
        row.dataset.journalStatus = 'current';
        if (status) status.innerHTML = '<span class="badge success">Đã có nhận xét</span>';
        if (update) update.textContent = `${row.dataset.journalCode.toUpperCase()} · Hệ thống xác nhận lúc ${operation.confirmedAt}`;
        if (action) {
          action.textContent = 'Xem/Sửa nhận xét';
          action.setAttribute('href', operation.journalHref);
        }
        const classDayAction = $(`[data-class-day-journal-action="${row.id}"]`);
        if (classDayAction) {
          classDayAction.textContent = 'Xem/Sửa nhận xét';
          classDayAction.setAttribute('href', operation.journalHref);
          classDayAction.closest('[data-class-day-journal-status]')?.setAttribute('data-class-day-journal-status', 'current');
        }
        renderTeacherJournals();
      }
    }
    if (operation.target) renderOperationResult(operation);
    if (operation.conflict) {
      const form = document.getElementById(operation.formId);
      const proposed = row && $('[data-policy-proposed]', row);
      if (proposed) proposed.textContent = `Xung đột: ${operation.value} từ ${operation.effectiveDate}; phiên bản đang áp dụng vẫn giữ nguyên.`;
      if (form) focusErrorSummary(form);
      knownOperation = null;
      node.remove();
      return;
    }
    if (operation.refresh === 'settings') renderSettings();
    else if (operation.refresh === 'roster') renderRoster();
    else renderQueue(window.location.hash || '#overview');
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
    terminal: button.dataset.operationTerminal !== 'false',
    lifecycle: button.dataset.operationLifecycle,
    refresh: button.dataset.operationRefresh || 'queue',
    value: button.dataset.operationValue,
    effectiveDate: button.dataset.operationEffectiveDate,
    conflict: button.dataset.operationConflict === 'true',
    formId: button.dataset.operationForm,
    journalHref: button.dataset.operationJournalHref,
    confirmedAt: button.dataset.operationConfirmedAt,
    journalOutcome: button.dataset.operationJournalOutcome,
    sourceButton: button
  };
  $('.dialog', node).innerHTML = `<h2 id="dialog-title">${title}</h2><div class="operation"><p>Yêu cầu đã được gửi. Đang kiểm tra kết quả với hệ thống trước khi cho phép gửi lại.</p></div><div class="dialog-actions"><button class="button" type="button" data-reconcile>Đối soát kết quả</button></div>`;
  $('[data-reconcile]', node).addEventListener('click', () => { node.remove(); reconcileOperation(); });
  $('[data-reconcile]', node).focus();
}

function showIdempotentConfirmation(button) {
  if (knownOperation) { reconcileOperation(button); return; }
  const node = dialog(button.dataset.actionTitle, `<p>${button.dataset.actionConsequence}</p>`, `<button class="button" type="button" data-idempotent-submit>${button.dataset.actionLabel}</button>`, button);
  $('[data-idempotent-submit]', node).addEventListener('click', event => {
    event.stopPropagation?.();
    event.currentTarget.disabled = true;
    showOperation('Đã gửi thao tác', button, node);
  }, { once: true });
}

function showSchoolContextGuard(button) {
  const hasDirtyDraft = $$('[data-mock-form], [data-mock-receipt], #bank-account').some(control => control.dataset.dirty === 'true');
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
    $$('[data-mock-receipt]').forEach(form => form.reset());
    const oldBankAccount = $('#bank-account');
    if (oldBankAccount) { oldBankAccount.value = ''; delete oldBankAccount.dataset.dirty; }
    const parentShell = $('.mobile-shell');
    const adminWorkspace = $('.workspace');
    if (parentShell) {
      $$(':scope > :not(header)', parentShell).forEach(section => section.remove());
      const safe = document.createElement('main');
      safe.id = 'home'; safe.dataset.parentRoute = '';
      safe.innerHTML = '<section class="empty"><h1 tabindex="-1">Mầm non Bình Minh</h1><p>Chưa có nội dung học sinh trong ngữ cảnh trường này.</p></section>';
      parentShell.append(safe);
    }
    if (adminWorkspace) {
      $$(':scope > :not(header)', adminWorkspace).forEach(section => section.remove());
      const safe = document.createElement('section');
      safe.className = 'empty'; safe.innerHTML = '<h1 tabindex="-1">Mầm non Bình Minh · Năm học 2026-2027</h1><p>Ngữ cảnh cũ đã được xóa. Chọn một nghiệp vụ để tải dữ liệu được cấp quyền của trường mới.</p>';
      adminWorkspace.append(safe);
    }
    $$('[data-school-context]').forEach(context => { context.textContent = 'Mầm non Bình Minh · Năm học 2026-2027 ▾'; });
    window.location.hash = parentShell ? '#home' : '#overview';
    $('.dialog', node).innerHTML = '<h2 id="dialog-title">Đã đổi trường</h2><p>Đã bỏ nội dung chưa gửi, xóa ngữ cảnh cũ và tải Mầm non Bình Minh · Năm học 2026-2027.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
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

function settingsState(route = window.location.search) {
  const params = new URLSearchParams(route.replace(/^\?/, ''));
  return {
    q: (params.get('q') || '').trim().toLocaleLowerCase('vi'),
    status: params.get('status') || 'all',
    sort: params.get('sort') || 'bank',
    page: Math.max(1, Number(params.get('page')) || 1)
  };
}

function renderSettings() {
  const section = $('#school-settings[data-route]');
  if (!section) return;
  const state = settingsState();
  const form = $('[data-bank-account-filter]', section);
  Object.entries({ q: state.q, status: state.status, sort: state.sort }).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
  const body = $('[data-bank-account-rows]', section);
  const rows = $$('tr', body).sort((left, right) => {
    const key = state.sort === 'effective' ? 'effective' : 'bank';
    return left.dataset[key].localeCompare(right.dataset[key], 'vi');
  });
  rows.forEach(row => body.append(row));
  const matching = rows.filter(row => (state.status === 'all' || row.dataset.status === state.status)
    && (!state.q || row.dataset.search.includes(state.q)));
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(state.page, pageCount);
  const displayed = matching.slice((page - 1) * pageSize, page * pageSize);
  rows.forEach(row => { row.hidden = !displayed.includes(row); });
  $('[data-bank-account-empty]', section).hidden = matching.length !== 0;
  $('[data-bank-account-caption]', section).textContent = `Tài khoản nhận tiền · Trường Ánh Hoa · Trang ${page} / ${pageCount} · ${matching.length} tài khoản`;
  $$('[data-bank-account-page]', section).forEach(button => {
    const current = Number(button.dataset.bankAccountPage) === page;
    button.hidden = Number(button.dataset.bankAccountPage) > pageCount;
    button.setAttribute('aria-current', current ? 'page' : 'false');
  });
}

function focusErrorSummary(form) {
  const summary = $('[data-error-summary]', form);
  if (!summary) return;
  $$('[data-field-error]', form).forEach(error => { error.hidden = false; });
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

function renderTeacherJournals() {
  const section = $('[data-journal-list]');
  if (!section) return;
  const search = ($('[data-journal-search]', section)?.value || '').trim().toLocaleLowerCase('vi');
  const filter = $('[data-journal-filter]', section)?.value || 'all';
  const rows = $$('[data-journal-rows] [data-journal-status]', section);
  const visible = rows.filter(row => {
    const matchesSearch = !search || row.dataset.journalName.includes(search) || row.dataset.journalCode.includes(search);
    const matchesFilter = filter === 'all' || row.dataset.journalStatus === filter;
    row.hidden = !(matchesSearch && matchesFilter);
    return !row.hidden;
  });
  const confirmed = rows.filter(row => row.dataset.journalStatus === 'current').length;
  $('[data-journal-caption]', section).textContent = `Mầm 3-4 tuổi · 05/09/2026 · Tất cả ${rows.length} trẻ · ${confirmed}/${rows.length} đã có nhận xét`;
  $('[data-journal-count]', section).textContent = `Hiển thị ${visible.length} trẻ · ${confirmed} đã có nhận xét`;
  const progress = $('[data-teacher-class-context] .teacher-progress article:last-child b');
  if (progress) progress.textContent = `${confirmed}/${rows.length}`;
  $('[data-journal-empty]', section).hidden = visible.length !== 0;
}

function focusRoute() {
  const revokedState = $('#teacher-access-revoked');
  if (revokedState) {
    $('h1', revokedState)?.focus();
    return;
  }
  const route = window.location.hash || '#overview';
  const state = queueState(route);
  const receivableTabs = $$('[data-receivable-tabs] a');
  const receivableStates = $$('.route-state');
  if (receivableStates.length) {
    const selected = receivableStates.find(section => section.id === state.name) || receivableStates[0];
    receivableStates.forEach(section => { section.hidden = section !== selected; });
    receivableTabs.forEach(link => {
      const active = link.getAttribute('href') === `#${selected.id}`;
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (window.location.hash) {
      const heading = $('h2', selected);
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    }
    return;
  }
  const invoiceRoutes = $$('[data-invoice-state]');
  if (invoiceRoutes.length) {
    const invoiceState = ['draft', 'receipt', 'issued'].includes(state.name) ? state.name : 'draft';
    invoiceRoutes.forEach(section => { section.hidden = section.dataset.invoiceState !== invoiceState; });
    const activeInvoice = invoiceRoutes.find(section => !section.hidden);
    const heading = $('h1', activeInvoice) || $('h2', activeInvoice);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    return;
  }
  if ($('[data-admin-shell][data-admin-route="overview"]') && !['overview', 'leave', 'handover'].includes(state.name)) {
    window.location.hash = '#overview';
    return;
  }
  const localRoute = document.getElementById(state.name);
  if (localRoute && localRoute.matches('[data-parent-route], [data-invoice-state], .route-state')) {
    const routeGroup = localRoute.matches('[data-parent-route]') ? '[data-parent-route]' : localRoute.matches('[data-invoice-state]') ? '[data-invoice-state]' : '.route-state';
    $$(routeGroup).forEach(section => { section.hidden = section !== localRoute; });
    const heading = $('h1', localRoute) || $('h2', localRoute);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    $$('.bottom-nav a').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${state.name}`));
    return;
  }
  if ($('[data-parent-route]')) {
    window.location.hash = '#home';
    return;
  }
  const payrollDetails = $$('.payroll-detail');
  if (payrollDetails.length) {
    payrollDetails.forEach(section => { section.hidden = section.id !== state.name; });
    const selected = payrollDetails.find(section => !section.hidden);
    if (selected) { $('h2', selected)?.focus(); return; }
  }
  renderQueue(route);
  renderRoster();
  renderSettings();
  renderTeacherJournals();
  const heading = $(`#${state.name}[data-route] h1`);
  heading?.focus();
}

function showTeacherAccessRevoked() {
  const main = $('.teacher-main');
  if (!main || $('#teacher-access-revoked')) return;
  $$('.dialog-backdrop').forEach(dialog => dialog.remove());
  knownOperation = null;
  main.replaceChildren();
  const safeState = document.createElement('section');
  safeState.className = 'notice warning';
  safeState.id = 'teacher-access-revoked';
  safeState.setAttribute('role', 'status');
  safeState.innerHTML = '<h1 tabindex="-1">Bạn không còn quyền xem nội dung này</h1><p>Nội dung và thao tác đã được xóa vì binding, capability hoặc phân công lớp không còn hiệu lực.</p>';
  main.append(safeState);
  $$('.teacher-tabs').forEach(navigation => navigation.replaceChildren());
  $$('[data-school-context]').forEach(button => button.remove());
  $('h1', safeState)?.focus();
}

function bindMockActions() {
  const bindingRoot = document.documentElement || document.body || document;
  if (bindingRoot.dataset?.mockActionsBound) return;
  if (bindingRoot.dataset) bindingRoot.dataset.mockActionsBound = 'true';
  window.addEventListener('hashchange', focusRoute);
  window.addEventListener('teacher-access-revoked', showTeacherAccessRevoked);
  window.addEventListener('popstate', () => {
    if ($('#roster[data-route]')) renderRoster();
    else if ($('#school-settings[data-route]')) renderSettings();
  });
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
    if (button.hasAttribute('data-idempotent-action')) {
      const receipt = button.closest('[data-mock-receipt]');
      if (receipt && !receipt.reportValidity()) return;
      showIdempotentConfirmation(button); return;
    }
  });
  $$('.filters').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.hasAttribute('data-roster-filter')) {
      const params = new URLSearchParams(new FormData(form));
      params.set('page', '1');
      window.history.pushState(null, '', `?${params.toString()}`);
      renderRoster();
      return;
    }
    if (form.hasAttribute('data-bank-account-filter')) {
      const params = new URLSearchParams(new FormData(form));
      params.set('page', '1');
      window.history.pushState(null, '', `?${params.toString()}`);
      renderSettings();
      return;
    }
    if (form.hasAttribute('data-static-filter')) {
      const feedback = $('[data-filter-feedback]', form.parentElement);
      if (feedback) feedback.textContent = 'Bộ lọc đã được gửi để hệ thống trả fixture phù hợp; bản mẫu không thay đổi dữ liệu cục bộ.';
      return;
    }
    const route = form.dataset.queueFilter;
    const params = new URLSearchParams(new FormData(form));
    window.location.hash = `${route}?${params.toString()}`;
  }));
  $$('[data-roster-page]').forEach(button => button.addEventListener('click', () => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', button.dataset.rosterPage);
    window.history.pushState(null, '', `?${params.toString()}`);
    renderRoster();
  }));
  $$('[data-bank-account-page]').forEach(button => button.addEventListener('click', () => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', button.dataset.bankAccountPage);
    window.history.pushState(null, '', `?${params.toString()}`);
    renderSettings();
  }));
  $$('[data-journal-search], [data-journal-filter]').forEach(control => control.addEventListener(control.matches('select') ? 'change' : 'input', renderTeacherJournals));
  $$('[data-open-receivable-form]').forEach(button => button.addEventListener('click', () => {
    const section = button.closest('#receivables');
    const list = $('[data-receivable-list]', section);
    const form = $('[data-receivable-form]', section);
    form.reset();
    $$('[data-charge-scope-options]').forEach(options => { options.hidden = options.dataset.chargeScopeOptions !== 'school'; });
    const isNew = button.dataset.openReceivableForm === 'new';
    $('[data-receivable-form-title]', form).textContent = isNew ? 'Thêm khoản thu' : `Sửa ${button.dataset.receivableName}`;
    if (isNew) {
      ['receivable-name', 'receivable-code', 'receivable-price', 'receivable-period'].forEach(name => { form.elements[name].value = ''; });
    } else {
      form.elements['receivable-name'].value = button.dataset.receivableName;
      form.elements['receivable-code'].value = button.dataset.receivableCode;
      form.elements['receivable-price'].value = button.dataset.receivablePrice;
      form.elements['receivable-period'].value = button.dataset.receivablePeriod;
      if (button.dataset.receivableScope) {
        form.elements['charge-scope'].value = button.dataset.receivableScope;
        $$('[data-charge-scope-options]').forEach(options => { options.hidden = options.dataset.chargeScopeOptions !== button.dataset.receivableScope; });
      }
    }
    list.hidden = true;
    form.hidden = false;
    $('h2', form)?.focus();
  }));
  $$('[data-close-receivable-form]').forEach(button => button.addEventListener('click', () => {
    const section = button.closest('#receivables');
    $('[data-receivable-form]', section).hidden = true;
    $('[data-receivable-list]', section).hidden = false;
    $('h2', section)?.focus();
  }));
  $$('input[name="charge-scope"]').forEach(scope => scope.addEventListener('change', () => {
    $$('[data-charge-scope-options]').forEach(options => { options.hidden = options.dataset.chargeScopeOptions !== scope.value; });
  }));
  const bankAccount = $('#bank-account');
  const issueButton = $('[aria-describedby="bank-account-required"]');
  if (bankAccount && issueButton) bankAccount.addEventListener('change', () => {
    issueButton.disabled = !bankAccount.value;
    if (!bankAccount.value) {
      delete issueButton.dataset.idempotentAction; delete issueButton.dataset.actionTitle; delete issueButton.dataset.actionLabel; delete issueButton.dataset.actionConsequence;
      return;
    }
    issueButton.dataset.idempotentAction = '';
    issueButton.dataset.actionTitle = 'Phát hành hóa đơn';
    issueButton.dataset.actionLabel = 'Gửi phát hành';
    issueButton.dataset.actionConsequence = 'Hệ thống phát hành hóa đơn 2.100.000 đ với tài khoản đang chọn. Nếu quá thời gian chờ, hãy kiểm tra kết quả trước khi gửi lại.';
  });
  $$('[data-fixture-complete]').forEach(button => button.addEventListener('click', () => {
    const target = $(button.dataset.fixtureComplete);
    if (target) {
      target.disabled = false; target.removeAttribute('aria-describedby');
      if (button.dataset.fixtureComplete.includes('calculate-blocked')) target.addEventListener('click', () => { window.location.href = 'payroll-run-review.html'; }, { once: true });
      else {
        target.dataset.idempotentAction = ''; target.dataset.actionTitle = 'Gửi bảng lương để phê duyệt'; target.dataset.actionLabel = 'Gửi School Admin'; target.dataset.actionConsequence = 'Hệ thống gửi bảng lương tháng 09/2026 sau khi tất cả đối soát hoàn tất.';
      }
    }
    button.disabled = true;
    const count = $(button.dataset.fixtureCount);
    if (count) count.textContent = 'Đã xử lý hết; thao tác tiếp theo đã mở.';
  }));
  $$('[data-mock-receipt] :is(input,select), #bank-account').forEach(control => control.addEventListener('input', () => {
    const owner = control.closest('[data-mock-receipt]') || control;
    owner.dataset.dirty = 'true';
  }));
  $$('[data-journal-reset]').forEach(button => button.addEventListener('click', () => {
    const section = button.closest('[data-journal-list]');
    $('[data-journal-search]', section).value = '';
    $('[data-journal-filter]', section).value = 'all';
    renderTeacherJournals();
    $('[data-journal-search]', section).focus();
  }));
  $$('[data-mock-form]').forEach(form => {
    form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.classList.contains('journal-editor')) return;
      if (!form.hasAttribute('data-policy-proposal')) {
        focusErrorSummary(form);
        return;
      }
      const date = $('#effective-date', form);
      const summary = $('[data-error-summary]', form);
      if (summary) summary.hidden = true;
      $$('[data-field-error]', form).forEach(error => { error.hidden = true; });
      const policy = form.elements.policy.value;
      const value = form.elements['proposed-value'].value;
      const button = document.createElement('button');
      button.dataset.actionTitle = `Xác nhận đề xuất ${policy}`;
      button.dataset.actionLabel = 'Xác nhận gửi đề xuất';
      button.dataset.actionConsequence = `Trường Ánh Hoa sẽ gửi ${policy}: ${value}, hiệu lực từ ${date.value.split('-').reverse().join('/')}. Hệ thống sẽ đối soát kết quả trước khi cho phép gửi lại.`;
      const fixture = form.elements.policy.options[form.elements.policy.selectedIndex].dataset.conflictFixture;
      button.dataset.operationLifecycle = fixture ? 'policy-conflict' : 'policy-version';
      button.dataset.operationRow = `policy-${form.elements.policy.selectedIndex}`;
      button.dataset.operationValue = value;
      button.dataset.operationEffectiveDate = date.value.split('-').reverse().join('/');
      button.dataset.operationTarget = 'policy-version-result';
      button.dataset.operationResultTitle = 'Phiên bản chính sách từ hệ thống';
      button.dataset.operationResult = `Hệ thống đã ghi nhận phiên bản dự kiến cho ${policy}; phiên bản đang áp dụng và lịch sử vẫn được giữ.`;
      button.dataset.operationRefresh = 'settings';
      button.dataset.operationForm = form.id;
      if (fixture) {
        button.dataset.operationConflict = 'true';
        button.dataset.operationResultTitle = 'Xung đột phiên bản từ hệ thống';
        button.dataset.operationResult = `Hệ thống không thể ghi nhận ${policy} vì đã có phiên bản hiệu lực chồng lấn.`;
      }
      showIdempotentConfirmation(button);
    });
  });
  $$('[data-error-summary] a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const input = $(link.getAttribute('href'));
    if (!input) return;
    event.preventDefault();
    input.focus();
  }));
  focusRoute();
}

if (typeof window !== 'undefined') window.__rosterMock = { rosterState, matchesRosterRow, renderRoster, settingsState, renderSettings, focusErrorSummary, renderTeacherJournals };
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindMockActions);
