const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let knownOperationId = null;

function dialog(title, content, actions = '', opener = document.activeElement) {
  const node = document.createElement('div');
  node.className = 'dialog-backdrop';
  node.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${title}</h2>${content}<div class="dialog-actions"><button class="button secondary" data-close>Hủy</button>${actions}</div></section>`;
  document.body.append(node);
  const close = () => {
    node.remove();
    opener?.focus();
  };
  node.closeDialog = close;
  const focusable = () => $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]', node);
  node.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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

function showOperation(title, operationId, key, node) {
  knownOperationId = operationId;
  const content = `<div class="operation"><p><b>Mã thao tác:</b> <code>${operationId}</code></p><p><b>Khóa idempotency:</b> <code>${key}</code></p><p>Yêu cầu đã được gửi; kết quả có thể chưa chắc chắn. Đối soát bằng <code>GET /operations/${operationId}</code> trước khi thử lại. Nút gửi lại đã bị khóa trong mô phỏng này.</p></div>`;
  if (node) {
    $('.dialog', node).innerHTML = `<h2 id="dialog-title">${title}</h2>${content}<div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>`;
    $('[data-close]', node).addEventListener('click', node.closeDialog);
    $('[data-close]', node).focus();
  } else {
    dialog(title, content, '<button class="button" data-close>Đã hiểu</button>');
  }
}

function showIdempotentConfirmation(button) {
  const title = button.dataset.actionTitle;
  const consequence = button.dataset.actionConsequence;
  const action = button.dataset.actionLabel;
  const key = uuid();
  const node = dialog(title, `<p>${consequence}</p><p><b>Khóa idempotency:</b> <code>${key}</code></p><p class="muted">Khóa này chỉ dùng cho lần gửi này.</p>`, `<button class="button" type="button" data-idempotent-submit>${action}</button>`);
  $('[data-idempotent-submit]', node).addEventListener('click', event => {
    event.currentTarget.disabled = true;
    showOperation('Đã gửi thao tác', uuid(), key, node);
  }, { once: true });
}

function showSchoolContextGuard(button) {
  const hasDirtyDraft = $$('[data-mock-form]').some(form => form.dataset.dirty === 'true');
  const state = knownOperationId ? 'operation' : hasDirtyDraft ? 'dirty' : button.dataset.schoolContext;
  const actions = state === 'operation'
    ? '<button class="button" type="button" data-reconcile-context>Đối soát thao tác đang biết</button>'
    : '<button class="button secondary" type="button" data-remain>Ở lại Ánh Hoa</button><button class="button" type="button" data-discard-context>Bỏ nội dung chưa gửi và đổi trường</button>';
  const detail = state === 'operation'
    ? '<p>Một thao tác đã gửi đang chờ kết quả. Không đổi ngữ cảnh trước khi đối soát thao tác đó.</p>'
    : state === 'dirty'
      ? '<p>Biểu mẫu chưa gửi có thay đổi. Chỉ nội dung chưa gửi mới có thể bỏ; dữ liệu đã gửi không bị thay đổi tại trình duyệt.</p>'
      : '<p>Không có biểu mẫu đang gửi. Bạn có thể ở lại hoặc bỏ nội dung chưa gửi trước khi đổi trường.</p>';
  const node = dialog('Đổi ngữ cảnh trường', detail, actions);
  $('[data-remain]', node)?.addEventListener('click', node.closeDialog);
  $('[data-discard-context]', node)?.addEventListener('click', () => {
    $('.dialog', node).innerHTML = '<h2 id="dialog-title">Sẵn sàng đổi trường</h2><p>Nội dung chưa gửi đã được bỏ trong mô phỏng. Chưa điều hướng hoặc thay đổi dữ liệu miền.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
    $('[data-close]', node).addEventListener('click', node.closeDialog);
    $('[data-close]', node).focus();
  });
  $('[data-reconcile-context]', node)?.addEventListener('click', () => showOperation('Đang đối soát kết quả', knownOperationId, 'Đã dùng khi gửi thao tác', node));
}

function bindMockActions() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-operation], [data-confirm], [data-evidence], [data-provision], [data-idempotent-action], [data-school-context]');
    if (!button) return;

    if (button.dataset.operation) {
      const operationId = button.dataset.operation || 'OP-20260905-0812';
      dialog('Đang đối soát kết quả', `<div class="operation"><b>Thao tác ${operationId}</b><p>Gọi GET /operations/${operationId} để máy chủ trả về kết quả đã ghi nhận. Không gửi lại thao tác cho đến khi có kết quả.</p></div>`, '<button class="button" data-close>Đã hiểu</button>');
      return;
    }
    if (button.dataset.schoolContext !== undefined) {
      showSchoolContextGuard(button);
      return;
    }
    if (button.hasAttribute('data-idempotent-action')) {
      showIdempotentConfirmation(button);
      return;
    }
    if (button.dataset.confirm) {
      const [title, detail, label = 'Xác nhận'] = button.dataset.confirm.split('|');
      dialog(title, `<p>${detail}</p>`, `<button class="button" data-close>${label}</button>`);
      return;
    }
    if (button.hasAttribute('data-evidence')) {
      const node = dialog('Ghi nhận điểm danh cho Bé Khoa', '<form><label for="attendance-status">Trạng thái điểm danh</label><select id="attendance-status" name="status"><option>Có mặt</option><option>Nghỉ có phép</option><option>Nghỉ không phép</option></select><label for="attendance-evidence">Tệp hoặc bằng chứng</label><input id="attendance-evidence" name="evidence" type="file" required aria-describedby="evidence-note"><p id="evidence-note" class="muted">Bằng chứng là bắt buộc và phụ huynh không thể xem tệp này.</p></form>', '<button class="button" type="button" data-submit-evidence disabled>Lưu ghi nhận</button>');
      const file = $('[type="file"]', node);
    const submit = $('[data-submit-evidence]', node);
    file.addEventListener('change', () => { submit.disabled = !file.files.length; });
    submit.addEventListener('click', () => {
      $('.dialog', node).innerHTML = '<h2 id="dialog-title">Đã gửi ghi nhận điểm danh</h2><p>Bằng chứng đã được chọn. Hệ thống sẽ kiểm tra và lưu kết quả.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
      $('[data-close]', node).addEventListener('click', node.closeDialog);
        $('[data-close]', node).focus();
      });
      return;
    }
    if (button.hasAttribute('data-provision')) {
      const node = dialog('Khởi tạo trường mới', '<form><label for="school-name">Tên trường</label><input id="school-name" value="Trường MN Mặt Trời" required><label for="owner-email">Email chủ sở hữu ban đầu</label><input id="owner-email" type="email" value="chutruong@mattroi.edu.vn" required></form>', '<button class="button" type="button" data-submit-provision>Gửi yêu cầu khởi tạo</button>');
    $('[data-submit-provision]', node).addEventListener('click', () => {
      $('.dialog', node).innerHTML = '<h2 id="dialog-title">Đã gửi yêu cầu khởi tạo</h2><p>Biểu mẫu đã được gửi. Trường và lời mời chủ sở hữu ban đầu sẽ được tạo sau khi hệ thống xử lý.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
      $('[data-close]', node).addEventListener('click', node.closeDialog);
        $('[data-close]', node).focus();
      });
    }
  });

  $$('[data-mock-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const summary = $('[data-error-summary]', form);
    if (summary) {
      summary.focus();
      return;
    }
    dialog('Đã gửi biểu mẫu', '<p>Đây là mô phỏng giao diện. Trình duyệt không tạo hoặc thay đổi dữ liệu miền.</p>', '<button class="button" data-close>Đã hiểu</button>');
  }));
  $$('[data-mock-form] input, [data-mock-form] select, [data-mock-form] textarea]').forEach(field => field.addEventListener('input', () => {
    field.form.dataset.dirty = 'true';
  }));

  const summary = $('[data-focus-error-summary]');
  if (summary) summary.focus();
}
document.addEventListener('DOMContentLoaded', bindMockActions);
