import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, ApiTimeoutError, createOperationId } from '../../app/api/client';
import { useStudentsInClass } from '../students/api';
import { getOperation, type TransferResult, useActiveClassesForPicker, useClass, useTransferClass } from './api';

const reconciliationAttempts = 3;
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function ClassDetailPage(): React.JSX.Element {
  const id = useLocation().pathname.split('/')[2] ?? '';
  return <ClassDetailContent key={id} id={id} />;
}

function ClassDetailContent({ id }: { id: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const schoolClass = useClass(id);
  const [page, setPage] = useState(1);
  const students = useStudentsInClass(id, page);
  const [destinationId, setDestinationId] = useState('');
  const [checking, setChecking] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<TransferResult | null>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useActiveClassesForPicker(open);
  const transfer = useTransferClass();

  useEffect(() => { if (!open) requestAnimationFrame(() => trigger.current?.focus()); }, [open]);
  if (schoolClass.isPending) return <section className="page"><p aria-live="polite">Đang tải lớp...</p></section>;
  if (schoolClass.error) return <section className="page"><h1>Không thể tải lớp</h1><p role="alert">{schoolClass.error instanceof ApiError && schoolClass.error.status === 404 ? 'Lớp không tồn tại hoặc đã bị xóa.' : 'Không thể kết nối để tải lớp.'}</p><button type="button" onClick={() => void schoolClass.refetch()}>Thử lại</button><Link to="/lop">Quay lại danh sách lớp</Link></section>;
  if (!schoolClass.data) return <section className="page"><h1>Không tìm thấy lớp</h1><Link to="/lop">Quay lại danh sách lớp</Link></section>;
  const item = schoolClass.data;
  const locked = transfer.isPending || checking || unknown;
  const refreshAfterConfirmedResult = async (result: TransferResult) => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['classes'] }), queryClient.invalidateQueries({ queryKey: ['students'] })]);
    setSuccess(result); setOpen(false);
  };
  const reconcile = async (operationId: string) => {
    setChecking(true); setUnknown(false); setError('');
    for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
      try { await refreshAfterConfirmedResult(await getOperation(operationId)); return; }
      catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404) { setError('Chưa thể kiểm tra kết quả. Modal vẫn bị khóa để tránh gửi trùng.'); setUnknown(true); setChecking(false); return; }
        if (attempt < reconciliationAttempts - 1) await delay(300 * (attempt + 1));
      }
    }
    setError('Kết quả vẫn chưa xác định. Vui lòng chờ rồi tải lại trang để đối soát; không gửi lại thao tác này.'); setUnknown(true); setChecking(false);
  };
  const submit = () => {
    if (!destinationId) return setError('Hãy chọn lớp đích.');
    const operationId = createOperationId(); setError('');
    transfer.mutate({ sourceClassId: item.id, destinationClassId: destinationId, operationId }, { onSuccess: (result) => { void refreshAfterConfirmedResult(result); }, onError: (cause) => { if (cause instanceof ApiTimeoutError) void reconcile(operationId); else setError(cause instanceof ApiError ? cause.message : 'Không thể chuyển học sinh.'); } });
  };
  return <section className="page classes-page"><div className="page-heading"><div><h1>{item.name}</h1><p>{item.activeStudentCount} học sinh đang học. Học sinh nghỉ học không bị chuyển.</p></div><Link to="/lop">Quay lại danh sách lớp</Link></div>{success && <p role="status">Đã chuyển {success.affectedStudentCount} học sinh sang <Link to={`/lop/${success.destination.id}`}>{success.destination.name}</Link>.</p>}{item.status === 'ACTIVE' && <button ref={trigger} className="primary-action" type="button" onClick={() => setOpen(true)}>Chuyển cả lớp</button>}<div className="table-card table-scroll"><table aria-label="Học sinh thuộc lớp"><caption className="sr-only">Học sinh thuộc {item.name}</caption><thead><tr><th>Họ tên</th><th>Tên gọi</th><th>Trạng thái</th></tr></thead><tbody>{students.data?.data.map((student) => <tr key={student.id}><th scope="row">{student.fullName}</th><td>{student.nickname ?? '-'}</td><td>{student.status === 'ACTIVE' ? 'Đang học' : 'Nghỉ học'}</td></tr>)}</tbody></table>{students.isPending && <p aria-live="polite">Đang tải học sinh...</p>}{students.error && <p role="alert">Không thể tải học sinh. <button type="button" onClick={() => void students.refetch()}>Thử lại</button></p>}{students.data?.data.length === 0 && <p>Chưa có học sinh trong lớp.</p>}</div>{students.data && <div className="pagination"><span>Trang {students.data.meta.page} / {students.data.meta.pageCount}</span><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><button type="button" disabled={page >= students.data.meta.pageCount} onClick={() => setPage(page + 1)}>Sau</button></div>}{open && <Dialog.Root open onOpenChange={(next) => { if (!locked) setOpen(next); }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog"><Dialog.Title>Chuyển học sinh đang học</Dialog.Title><p>{item.activeStudentCount} học sinh đang học sẽ được chuyển. Học sinh nghỉ học vẫn ở lại {item.name}.</p>{picker.isPending ? <p aria-live="polite">Đang tải lớp đích...</p> : picker.error ? <p role="alert">Không thể tải lớp đích. <button type="button" onClick={() => void picker.refetch()} disabled={locked}>Thử lại</button></p> : <label>Lớp đích<select value={destinationId} disabled={locked} onChange={(event) => setDestinationId(event.target.value)}><option value="">Chọn lớp đích</option>{picker.data?.data.filter((target) => target.id !== item.id).map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>}{checking && <p aria-live="polite">Đang kiểm tra kết quả</p>}{error && <p role="alert">{error}</p>}<div className="dialog-actions"><Dialog.Close render={<button type="button" disabled={locked}>Hủy</button>} /><button className="primary-action" type="button" disabled={locked || picker.isPending || Boolean(picker.error) || !destinationId} onClick={submit}>{transfer.isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}</button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>}</section>;
}
