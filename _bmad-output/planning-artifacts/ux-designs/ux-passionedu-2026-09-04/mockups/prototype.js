const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function dialog(title, content, actions = '') {
  const node = document.createElement('div');
  node.className = 'dialog-backdrop';
  node.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${title}</h2>${content}<div class="dialog-actions"><button class="button secondary" data-close>Huy</button>${actions}</div></section>`;
  document.body.append(node);
  $('[data-close]', node).focus();
  $$('[data-close]', node).forEach(button => button.addEventListener('click', () => node.remove()));
  return node;
}

function bindMockActions() {
  $$('[data-operation]').forEach(button => button.addEventListener('click', () => {
    dialog('Dang doi soat ket qua', `<div class="operation"><b>Operation OP-20260905-0812</b><p>He thong dang kiem tra ket qua da ghi nhan. Khong gui lai thao tac cho den khi co ket qua.</p></div>`, '<button class="button" data-close>Da hieu</button>');
  }));
  $$('[data-confirm]').forEach(button => button.addEventListener('click', () => {
    const [title, detail] = button.dataset.confirm.split('|');
    dialog(title, `<p>${detail}</p><p class="muted">Thao tac nay dung Operation idempotent va ket qua se duoc lay lai tu he thong.</p>`, '<button class="button" data-close>Xac nhan</button>');
  }));
}
document.addEventListener('DOMContentLoaded', bindMockActions);
