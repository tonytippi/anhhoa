const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function bindMockActions() {
  $$('[data-operation]').forEach(button => button.addEventListener('click', () => {
    const operationId = button.dataset.operation || 'OP-20260905-0812';
    dialog('Đang đối soát kết quả', `<div class="operation"><b>Thao tác ${operationId}</b><p>Gọi GET /operations/${operationId} để máy chủ trả về kết quả đã ghi nhận. Không gửi lại thao tác cho đến khi có kết quả.</p></div>`, '<button class="button" data-close>Đã hiểu</button>');
  }));
  $$('[data-confirm]').forEach(button => button.addEventListener('click', () => {
    const [title, detail] = button.dataset.confirm.split('|');
    dialog(title, `<p>${detail}</p>`, '<button class="button" data-close>Xác nhận</button>');
  }));
  $$('[data-evidence]').forEach(button => button.addEventListener('click', () => {
    const node = dialog('Ghi nhận điểm danh cho Bé Khoa', '<form><label for="attendance-status">Trạng thái điểm danh</label><select id="attendance-status" name="status"><option>Có mặt</option><option>Nghỉ có phép</option><option>Nghỉ không phép</option></select><label for="attendance-evidence">Tệp hoặc bằng chứng</label><input id="attendance-evidence" name="evidence" type="file" required aria-describedby="evidence-note"><p id="evidence-note" class="muted">Bằng chứng là bắt buộc và phụ huynh không thể xem tệp này.</p></form>', '<button class="button" type="button" data-submit-evidence disabled>Lưu ghi nhận</button>');
    const file = $('[type="file"]', node);
    const submit = $('[data-submit-evidence]', node);
    file.addEventListener('change', () => { submit.disabled = !file.files.length; });
    submit.addEventListener('click', () => {
      $('.dialog', node).innerHTML = '<h2 id="dialog-title">Đã gửi ghi nhận điểm danh</h2><p>Bằng chứng đã được chọn. Hệ thống sẽ kiểm tra và lưu kết quả.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
      $('[data-close]', node).addEventListener('click', node.closeDialog);
      $('[data-close]', node).focus();
    });
  }));
  $$('[data-provision]').forEach(button => button.addEventListener('click', () => {
    const node = dialog('Khởi tạo trường mới', '<form><label for="school-name">Tên trường</label><input id="school-name" value="Trường MN Mặt Trời" required><label for="owner-email">Email chủ sở hữu ban đầu</label><input id="owner-email" type="email" value="chutruong@mattroi.edu.vn" required></form>', '<button class="button" type="button" data-submit-provision>Gửi yêu cầu khởi tạo</button>');
    $('[data-submit-provision]', node).addEventListener('click', () => {
      $('.dialog', node).innerHTML = '<h2 id="dialog-title">Đã gửi yêu cầu khởi tạo</h2><p>Biểu mẫu đã được gửi. Trường và lời mời chủ sở hữu ban đầu sẽ được tạo sau khi hệ thống xử lý.</p><div class="dialog-actions"><button class="button" data-close>Đã hiểu</button></div>';
      $('[data-close]', node).addEventListener('click', node.closeDialog);
      $('[data-close]', node).focus();
    });
  }));
}
document.addEventListener('DOMContentLoaded', bindMockActions);
