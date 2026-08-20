import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, ApiTimeoutError, createOperationId } from '../../app/api/client';
import { useBankAccounts } from '../bank-accounts/api';
import { completeInvoice, getInvoiceCompletionOperation, type UpdateInvoiceInput, useInvoice, useInvoiceLifecycle, useUpdateInvoice } from './api';

function formatVnd(amount: number): string { return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`; }
function statusLabel(status: string): string { return status === 'DRAFT' ? 'Nháp' : status === 'PENDING' ? 'Chờ xác nhận' : 'Đã hoàn tất'; }

export function InvoiceDetailPage(): React.JSX.Element {
  const id = useLocation().pathname.split('/')[2] ?? ''; const invoice = useInvoice(id);
  if (invoice.isPending) return <section className="page"><h1>Hóa đơn</h1><div className="table-card skeleton" aria-live="polite">Đang tải hóa đơn...</div></section>;
  if (invoice.error instanceof ApiError && invoice.error.status === 404) return <section className="page"><h1>Không tìm thấy hóa đơn</h1><div className="table-card empty-state"><p>Hóa đơn này không tồn tại hoặc đã không còn khả dụng.</p><Link to="/hoa-don">Quay lại danh sách hóa đơn</Link></div></section>;
  if (invoice.error) return <section className="page"><h1>Hóa đơn</h1><div className="table-card error-state" role="alert"><p>Không thể tải hóa đơn.</p><button type="button" onClick={() => void invoice.refetch()}>Thử lại</button></div></section>;
  return <InvoiceDetail key={invoice.data!.id} invoice={invoice.data!} />;
}

function InvoiceDetail({ invoice }: { invoice: NonNullable<ReturnType<typeof useInvoice>['data']> }): React.JSX.Element {
  const update = useUpdateInvoice(); const lifecycle = useInvoiceLifecycle(); const editable = invoice.status === 'DRAFT'; const accounts = useBankAccounts({ search: '', status: 'ACTIVE', page: 1, pageSize: 100 }, editable);
  const queryClient = useQueryClient();
  const [items, setItems] = useState(() => invoice.items.map(({ id, description, feeGroup, amount }) => ({ key: id, description, feeGroup: feeGroup ?? '', amount })));
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>(() => invoice.payment.method ?? 'CASH');
  const [bankAccountId, setBankAccountId] = useState(() => invoice.payment.bankAccount?.id ?? '');
  const [error, setError] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionState, setCompletionState] = useState<'idle' | 'submitting' | 'reconciling'>('idle');
  const [completionOperationId, setCompletionOperationId] = useState<string | null>(null);
  const completionTrigger = useRef<HTMLButtonElement>(null);
  const completionDialog = useRef<HTMLDivElement>(null);
  const completionCancel = useRef<HTMLButtonElement>(null);
  const completionPoll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedCompletion = completionState !== 'idle';
  useEffect(() => { if (!completionOpen) return; completionCancel.current?.focus(); const dialog = completionDialog.current; const onKeyDown = (event: KeyboardEvent) => { if (!dialog) return; if (event.key === 'Escape' && !lockedCompletion) { event.preventDefault(); setCompletionOpen(false); completionTrigger.current?.focus(); return; } if (event.key !== 'Tab') return; const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')]; if (!focusable.length) return; const first = focusable[0]!; const last = focusable.at(-1)!; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [completionOpen, lockedCompletion]);
  useEffect(() => () => { if (completionPoll.current) clearTimeout(completionPoll.current); }, []);
  const total = items.reduce((sum, item) => sum + (Number.isSafeInteger(item.amount) ? item.amount : 0), 0);
  const change = (index: number, field: 'description' | 'feeGroup' | 'amount', value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'amount' ? Number(value) : value } : item));
  const remove = (index: number) => { if (items[index]!.amount !== 0 && !window.confirm('Xóa dòng có giá trị khác 0?')) return; setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); };
  const move = (index: number, direction: -1 | 1) => setItems((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; const source = next[index]!; next[index] = next[target]!; next[target] = source; return next; });
  const save = () => {
    if (items.some((item) => !item.description.trim() || !Number.isSafeInteger(item.amount) || item.amount < -100000000 || item.amount > 100000000)) { setError('Kiểm tra mô tả và số tiền nguyên VND của từng dòng.'); return; }
    if (paymentMethod === 'TRANSFER' && !bankAccountId) { setError('Chọn tài khoản nhận tiền cho chuyển khoản.'); return; }
    setError(''); const input: UpdateInvoiceInput = { items: items.map(({ description, feeGroup, amount }) => ({ description, feeGroup, amount })), paymentMethod, ...(paymentMethod === 'TRANSFER' ? { bankAccountId } : {}) };
    update.mutate({ id: invoice.id, input }, { onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Không thể lưu hóa đơn.') });
  };
  const draftHasUnsavedChanges = editable && (items.length !== invoice.items.length || items.some((item, index) => item.description !== invoice.items[index]?.description || item.feeGroup !== (invoice.items[index]?.feeGroup ?? '') || item.amount !== invoice.items[index]?.amount) || paymentMethod !== invoice.payment.method || (paymentMethod === 'TRANSFER' && bankAccountId !== invoice.payment.bankAccount?.id));
  const transition = (target: 'pending' | 'draft') => {
    setCopyNotice('');
    if (target === 'pending' && draftHasUnsavedChanges) { setError('Lưu hóa đơn nháp trước khi chuyển sang chờ xác nhận.'); return; }
    setError(''); lifecycle.mutate({ id: invoice.id, target }, { onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'Không thể chuyển trạng thái hóa đơn.') });
  };
  const paymentDescription = invoice.payment.method === 'CASH' ? 'Tiền mặt' : invoice.payment.bankAccount ? `${invoice.payment.bankAccount.bankCode} - ${invoice.payment.bankAccount.accountNumber} (${invoice.payment.bankAccount.accountHolderName})` : 'Chưa chọn';
  const copyTransferContent = async () => { if (!invoice.qr) return; setCopyNotice(''); try { await navigator.clipboard.writeText(invoice.qr.transferContent); setError(''); setCopyNotice('Đã sao chép nội dung chuyển khoản.'); } catch { setError('Không thể sao chép nội dung chuyển khoản.'); } };
  const finishCompletion = (result: typeof invoice) => { queryClient.setQueryData(['invoices', result.id], result); queryClient.invalidateQueries({ queryKey: ['invoices'] }); setCompletionOpen(false); setCompletionOperationId(null); setCompletionState('idle'); completionTrigger.current?.focus(); };
  const reconcileCompletion = async (operationId: string) => {
    setCompletionState('reconciling');
    try {
      const result = await getInvoiceCompletionOperation(operationId);
      if ('state' in result) { completionPoll.current = setTimeout(() => void reconcileCompletion(operationId), 1000); return; }
      finishCompletion(result);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) { setCompletionOperationId(null); setCompletionState('idle'); setError('Không tìm thấy kết quả xác nhận. Bạn có thể thử lại.'); return; }
      setError(reason instanceof ApiError ? reason.message : 'Không thể kiểm tra kết quả xác nhận.');
      completionPoll.current = setTimeout(() => void reconcileCompletion(operationId), 1000);
    }
  };
  const submitCompletion = async () => {
    const operationId = completionOperationId ?? createOperationId();
    setCompletionOperationId(operationId); setCompletionState('submitting'); setError('');
    try { finishCompletion(await completeInvoice(invoice.id, operationId)); }
    catch (reason) {
      if (reason instanceof ApiTimeoutError) { await reconcileCompletion(operationId); return; }
      setCompletionState('idle'); setError(reason instanceof ApiError ? reason.message : 'Không thể xác nhận đã nhận tiền.');
    }
  };
  const closeCompletion = () => { if (lockedCompletion) return; setCompletionOpen(false); completionTrigger.current?.focus(); };
  return <section className="page invoice-detail-page"><Link className="back-link" to={`/hoa-don?month=${invoice.billingMonth}`}>Quay lại danh sách</Link><h1>Hóa đơn {invoice.student.name}</h1><div className="invoice-detail-grid">
    <div className="invoice-editor table-card">
      <h2>{editable ? 'Dòng thu' : 'Dòng thu đã khóa'}</h2>
      <div className="invoice-lines">{items.map((item, index) => editable ? <fieldset key={item.key} className="invoice-line"><legend>Dòng {index + 1}</legend><label>Mô tả<input value={item.description} onChange={(event) => change(index, 'description', event.target.value)} /></label><label>Nhóm thu<input value={item.feeGroup} onChange={(event) => change(index, 'feeGroup', event.target.value)} /></label><label>Số tiền (VND)<input type="number" min={-100000000} max={100000000} step="1" value={item.amount} onChange={(event) => change(index, 'amount', event.target.value)} /></label><div className="line-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>Lên</button><button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1}>Xuống</button><button type="button" onClick={() => remove(index)}>Xóa</button></div></fieldset> : <div key={item.key} className="invoice-line readonly-line"><span>{item.description}</span><span>{item.feeGroup || 'Không phân nhóm'}</span><strong className="money">{formatVnd(item.amount)}</strong></div>)}</div>
      {editable && <><button type="button" className="row-add" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), description: '', feeGroup: '', amount: 0 }])}>Thêm dòng</button><p className="editor-total">Tổng xem trước: <strong>{formatVnd(total)}</strong></p><div className="payment-editor"><h2>Phương thức thanh toán</h2><label><input type="radio" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} /> Tiền mặt</label><label><input type="radio" checked={paymentMethod === 'TRANSFER'} onChange={() => setPaymentMethod('TRANSFER')} /> Chuyển khoản</label>{paymentMethod === 'TRANSFER' && <label>Tài khoản nhận tiền<select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}><option value="">Chọn tài khoản</option>{accounts.data?.data.map((account) => <option key={account.id} value={account.id}>{account.bankCode} - {account.accountNumber} ({account.accountHolderName})</option>)}</select></label>}</div><div className="invoice-lifecycle-actions"><button type="button" className="primary-action" disabled={update.isPending || accounts.isPending || accounts.isError} onClick={save}>{update.isPending ? 'Đang lưu...' : 'Lưu hóa đơn nháp'}</button><button type="button" className="primary-action" disabled={lifecycle.isPending || accounts.isPending || accounts.isError} onClick={() => transition('pending')}>{lifecycle.isPending ? 'Đang chuyển...' : 'Chuyển sang chờ xác nhận'}</button></div></>}
    </div>
    <aside className="invoice-summary"><dl><dt>Tháng</dt><dd>{invoice.billingMonth.slice(5)}/{invoice.billingMonth.slice(0, 4)}</dd><dt>Học sinh snapshot</dt><dd>{invoice.student.name}{invoice.student.nickname ? ` (${invoice.student.nickname})` : ''}</dd><dt>Lớp snapshot</dt><dd>{invoice.schoolClass.name}</dd><dt>Trạng thái</dt><dd><span className={`status invoice-${invoice.status.toLowerCase()}`}>{statusLabel(invoice.status)}</span></dd><dt>Tổng cộng</dt><dd className="money">{formatVnd(invoice.total)}</dd><dt>Thanh toán</dt><dd>{editable ? (paymentMethod === 'CASH' ? 'Tiền mặt' : accounts.data?.data.find((account) => account.id === bankAccountId) ? `${accounts.data.data.find((account) => account.id === bankAccountId)!.bankCode} - ${accounts.data.data.find((account) => account.id === bankAccountId)!.accountNumber}` : 'Chưa chọn') : paymentDescription}</dd><dt>Người tạo</dt><dd>{invoice.createdBy.displayName}</dd><dt>Thời gian tạo</dt><dd>{new Date(invoice.createdAt).toLocaleString('vi-VN')}</dd>{invoice.status === 'COMPLETED' && <><dt>Người xác nhận</dt><dd>{invoice.completedBy!.displayName}</dd><dt>Thời gian xác nhận</dt><dd>{new Date(invoice.completedAt!).toLocaleString('vi-VN')}</dd></>}</dl>{error && <p role="alert" className="field-error">{error}</p>}{copyNotice && <p className="action-notice" aria-live="polite">{copyNotice}</p>}{invoice.status === 'PENDING' && <><button type="button" className="row-add return-draft" disabled={lifecycle.isPending || lockedCompletion} onClick={() => transition('draft')}>{lifecycle.isPending ? 'Đang trả nháp...' : 'Trả về nháp'}</button><button ref={completionTrigger} type="button" className="primary-action" disabled={lockedCompletion} onClick={() => setCompletionOpen(true)}>Xác nhận đã nhận tiền</button></>}{invoice.qr && <section className="qr-card" aria-label="Thông tin chuyển khoản"><img src={invoice.qr.url} alt={`Mã QR chuyển khoản ${formatVnd(invoice.total)}`} /><p><strong>{formatVnd(invoice.total)}</strong></p><p>{invoice.payment.bankAccount?.bankCode} - {invoice.payment.bankAccount?.accountNumber}</p><p>{invoice.payment.bankAccount?.accountHolderName}</p><p>{invoice.qr.transferContent}</p><button type="button" className="row-add" onClick={() => void copyTransferContent()}>Sao chép nội dung chuyển khoản</button></section>}</aside>
  </div>{completionOpen && <><div className="dialog-backdrop" onClick={closeCompletion} /><div ref={completionDialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="completion-title"><h2 id="completion-title">Xác nhận đã nhận tiền</h2><p>Học sinh: <strong>{invoice.student.name}</strong></p><p>Tháng: <strong>{invoice.billingMonth}</strong></p><p>Thanh toán: <strong>{paymentDescription}</strong></p><p>Tổng cộng: <strong>{formatVnd(invoice.total)}</strong></p>{completionState === 'reconciling' && <p aria-live="polite">Đang kiểm tra kết quả</p>}<div className="dialog-actions"><button ref={completionCancel} type="button" disabled={lockedCompletion} onClick={closeCompletion}>Hủy</button><button type="button" className="primary-action" disabled={lockedCompletion} onClick={() => void submitCompletion()}>{completionState === 'submitting' ? 'Đang xác nhận...' : 'Xác nhận đã nhận tiền'}</button></div></div></>}</section>;
}
