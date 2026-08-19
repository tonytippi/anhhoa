import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, ApiTimeoutError, createOperationId } from '../../app/api/client';
import { useStudentsInClass } from '../students/api';
import { getOperation, type TransferResult, useActiveClassesForPicker, useClass, useTransferClass } from './api';

const reconciliationAttempts = 3;
const pendingTransferKey = 'anhhoa.pending-class-transfer';
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
type PendingTransfer = { sourceClassId: string; destinationClassId: string; operationId: string };

function loadPendingTransfer(sourceClassId: string): PendingTransfer | null {
  try {
    const raw = sessionStorage.getItem(pendingTransferKey);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingTransfer>;
    return pending.sourceClassId === sourceClassId && typeof pending.destinationClassId === 'string' && typeof pending.operationId === 'string' ? pending as PendingTransfer : null;
  } catch { return null; }
}

export function ClassDetailPage(): React.JSX.Element {
  const id = useLocation().pathname.split('/')[2] ?? '';
  return <ClassDetailContent key={id} id={id} />;
}

function ClassDetailContent({ id }: { id: string }): React.JSX.Element {
  const savedTransfer = loadPendingTransfer(id);
  const queryClient = useQueryClient();
  const schoolClass = useClass(id);
  const [page, setPage] = useState(1);
  const students = useStudentsInClass(id, page);
  const [destinationId, setDestinationId] = useState(savedTransfer?.destinationClassId ?? '');
  const [checking, setChecking] = useState(false);
  const [unknown, setUnknown] = useState(Boolean(savedTransfer));
  const [canRetry, setCanRetry] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<TransferResult | null>(null);
  const [open, setOpen] = useState(Boolean(savedTransfer));
  const trigger = useRef<HTMLButtonElement>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(savedTransfer);
  const [finalizing, setFinalizing] = useState(false);
  const picker = useActiveClassesForPicker(open);
  const transfer = useTransferClass();
  const locked = transfer.isPending || checking || finalizing || (unknown && !canRetry);

  useEffect(() => { if (!open) requestAnimationFrame(() => trigger.current?.focus()); }, [open]);
  const item = schoolClass.data;
  const clearPending = () => { sessionStorage.removeItem(pendingTransferKey); setPendingTransfer(null); };
  const refreshAfterConfirmedResult = async (result: TransferResult) => {
    setFinalizing(true);
    clearPending();
    setSuccess(result);
    setOpen(false);
    try {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['classes'] }), queryClient.invalidateQueries({ queryKey: ['students'] })]);
    } finally { setFinalizing(false); }
  };
  const reconcile = async (operationId: string) => {
    setChecking(true); setUnknown(false); setCanRetry(false); setError('');
    for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
      try {
        const outcome = await getOperation(operationId);
        if ('state' in outcome) {
          if (attempt < reconciliationAttempts - 1) { await delay(300 * (attempt + 1)); continue; }
          setError('Thao tác đang được xử lý. Bạn có thể kiểm tra lại kết quả sau hoặc gửi lại cùng thao tác này.'); setUnknown(true); setCanRetry(true); setChecking(false); return;
        }
        await refreshAfterConfirmedResult(outcome); return;
      } catch (cause) {
        const message = cause instanceof ApiError && cause.status === 404
          ? 'Chưa xác định được kết quả thao tác. Bạn có thể kiểm tra lại hoặc gửi lại cùng thao tác này.'
          : 'Chưa thể kiểm tra kết quả. Bạn có thể kiểm tra lại hoặc gửi lại cùng thao tác này.';
        setError(message); setUnknown(true); setCanRetry(true); setChecking(false); return;
      }
    }
  };
  const submit = () => {
    const pending = pendingTransfer;
    if (!pending && !destinationId) return setError('Hãy chọn lớp đích.');
    const request = pending ?? { sourceClassId: item!.id, destinationClassId: destinationId, operationId: createOperationId() };
    if (!pending) { sessionStorage.setItem(pendingTransferKey, JSON.stringify(request satisfies PendingTransfer)); setPendingTransfer(request); }
    setDestinationId(request.destinationClassId); setCanRetry(false); setError('');
    transfer.mutate(request, {
      onSuccess: (result) => { if ('state' in result) void reconcile(result.operationId); else void refreshAfterConfirmedResult(result); },
      onError: (cause) => {
        if (cause instanceof ApiTimeoutError) void reconcile(request.operationId);
        else if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.code !== 'IDEMPOTENCY_CONFLICT') {
          clearPending(); setUnknown(false); setCanRetry(false); setError(cause.message);
        } else { setUnknown(true); setCanRetry(true); setError(cause instanceof ApiError ? cause.message : 'Không thể chuyển học sinh.'); }
      },
    });
  };
  const reconcileSavedTransfer = useEffectEvent((operationId: string) => { void reconcile(operationId); });
  useEffect(() => {
    if (!pendingTransfer) return;
    const timer = setTimeout(() => reconcileSavedTransfer(pendingTransfer.operationId), 0);
    return () => clearTimeout(timer);
  }, [pendingTransfer]);
  if (schoolClass.isPending) return <section className="page"><p aria-live="polite">Đang tải lớp...</p></section>;
  if (schoolClass.error) return <section className="page"><h1>Không thể tải lớp</h1><p role="alert">Không thể kết nối để tải lớp.</p><Link to="/lop">Quay lại danh sách lớp</Link></section>;
  if (!item) return <section className="page"><h1>Không tìm thấy lớp</h1><Link to="/lop">Quay lại danh sách lớp</Link></section>;

  return <section className="page classes-page">
    <div className="page-heading"><div><h1>{item.name}</h1><p>{item.activeStudentCount} học sinh đang học. Học sinh nghỉ học không bị chuyển.</p></div><Link to="/lop">Quay lại danh sách lớp</Link></div>
    {success && <p role="status">Đã chuyển {success.affectedStudentCount} học sinh sang <Link to={`/lop/${success.destination.id}`}>{success.destination.name}</Link>.</p>}
    {item.status === 'ACTIVE' && <button ref={trigger} className="primary-action" type="button" onClick={() => setOpen(true)}>Chuyển cả lớp</button>}
    <div className="table-card table-scroll"><table aria-label="Học sinh thuộc lớp"><caption className="sr-only">Học sinh thuộc {item.name}</caption><thead><tr><th>Họ tên</th><th>Tên gọi</th><th>Trạng thái</th></tr></thead><tbody>{students.data?.data.map((student) => <tr key={student.id}><th scope="row">{student.fullName}</th><td>{student.nickname ?? '-'}</td><td>{student.status === 'ACTIVE' ? 'Đang học' : 'Nghỉ học'}</td></tr>)}</tbody></table>{students.isPending && <p aria-live="polite">Đang tải học sinh...</p>}{students.error && <p role="alert">Không thể tải học sinh.</p>}{students.data?.data.length === 0 && <p>Chưa có học sinh trong lớp.</p>}</div>
    {students.data && <div className="pagination"><span>Trang {students.data.meta.page} / {students.data.meta.pageCount}</span><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><button type="button" disabled={page >= students.data.meta.pageCount} onClick={() => setPage(page + 1)}>Sau</button></div>}
    {open && <Dialog.Root open onOpenChange={(next) => { if (!locked) setOpen(next); }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog"><Dialog.Title>Chuyển học sinh đang học</Dialog.Title><p>{item.activeStudentCount} học sinh đang học sẽ được chuyển. Học sinh nghỉ học vẫn ở lại {item.name}.</p>{picker.isPending ? <p aria-live="polite">Đang tải lớp đích...</p> : <label>Lớp đích<select aria-label="Lớp đích" disabled={locked || Boolean(pendingTransfer)} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Chọn lớp đích</option>{picker.data?.data.filter((schoolClass) => schoolClass.id !== item.id).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>}{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button type="button" disabled={locked} onClick={() => setOpen(false)}>Hủy</button>{unknown && !checking && <button type="button" onClick={() => { if (pendingTransfer) void reconcile(pendingTransfer.operationId); }}>Kiểm tra lại kết quả</button>}<button type="button" className="primary-action" disabled={locked || picker.isPending || !destinationId} onClick={submit}>{canRetry ? 'Gửi lại' : 'Xác nhận chuyển'}</button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>}
  </section>;
}
