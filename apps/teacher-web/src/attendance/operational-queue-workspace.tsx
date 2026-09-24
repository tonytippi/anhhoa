import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type QueueClass = { classId: string; className: string; attendanceGapCount: number; pendingLeaveCount: number };
type Queue = { attendanceOn: string; operating: boolean; explanation: string; classes: QueueClass[] };
type Student = { studentId: string; studentName: string; studentCode: string };
type Items = { attendanceOn: string; classId: string; className: string; status: 'NOT_RECORDED' | 'PENDING'; operating: boolean; explanation: string; students: Student[] };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function OperationalQueueWorkspace({ schoolId, denied }: { schoolId: string; denied: () => void }) {
  const [date, setDate] = useState(today()); const [queue, setQueue] = useState<Queue>(); const [items, setItems] = useState<Items>(); const [error, setError] = useState(''); const request = useRef(0); const errorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const params = (nextDate = date, classId?: string, status?: 'NOT_RECORDED' | 'PENDING') => new URLSearchParams({ date: nextDate, ...(classId ? { classId } : {}), ...(status ? { status } : {}) });
  const load = async (nextDate: string, classId?: string, status?: 'NOT_RECORDED' | 'PENDING') => {
    const current = ++request.current; setQueue(undefined); setItems(undefined); setError('');
    const query = params(nextDate, classId, status);
    window.history.pushState(null, '', `${window.location.pathname}?${query}`);
    try {
      const response = await fetch(`${apiUrl}/api/teacher/schools/${schoolId}/operational-queue?${params(nextDate)}`, { credentials: 'include' });
      if (current !== request.current) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { if ([401, 403, 404].includes(response.status)) denied(); throw new Error(payload.error?.message ?? payload.message ?? 'Không thể tải hàng đợi lớp.'); }
      setQueue(payload.data);
      if (!classId || !status) return;
      const detail = await fetch(`${apiUrl}/api/teacher/schools/${schoolId}/operational-queue/items?${query}`, { credentials: 'include' });
      if (current !== request.current) return;
      const detailPayload = await detail.json().catch(() => ({}));
      if (!detail.ok) { if ([401, 403, 404].includes(detail.status)) denied(); throw new Error(detailPayload.error?.message ?? detailPayload.message ?? 'Không thể tải danh sách đã lọc.'); }
      setItems(detailPayload.data);
    } catch (cause) { if (current === request.current) setError(cause instanceof Error ? cause.message : 'Không thể tải hàng đợi lớp.'); }
  };
  useEffect(() => {
    const query = new URLSearchParams(window.location.search); const nextDate = query.get('date') ?? today(); const classId = query.get('classId') ?? undefined; const status = query.get('status'); const nextStatus = status === 'NOT_RECORDED' || status === 'PENDING' ? status : undefined;
    setDate(nextDate); void load(nextDate, classId, nextStatus);
    return () => { request.current += 1; };
  }, [schoolId]);
  useEffect(() => {
    const restore = () => { const query = new URLSearchParams(window.location.search); const status = query.get('status'); void load(query.get('date') ?? today(), query.get('classId') ?? undefined, status === 'NOT_RECORDED' || status === 'PENDING' ? status : undefined); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [schoolId, date]);
  const label = (status: 'NOT_RECORDED' | 'PENDING') => status === 'NOT_RECORDED' ? 'Chưa ghi nhận' : 'Đơn nghỉ chờ xử lý';
  return <section aria-labelledby="teacher-queue-title"><h2 id="teacher-queue-title">Hàng đợi lớp</h2><p>Hàng đợi chỉ để theo dõi trong Class được phân công. Số liệu do hệ thống xác nhận.</p><label>Ngày hàng đợi <input type="date" value={date} onChange={(event) => { setDate(event.target.value); void load(event.target.value); }} /></label>{error && <div ref={errorRef} role="alert" tabIndex={-1}>{error}</div>}{!queue && !error && <p aria-live="polite">Đang tải hàng đợi lớp...</p>}{queue && <><p>{queue.attendanceOn} / {queue.explanation}</p>{!queue.operating ? <p>Ngày đã chọn không vận hành.</p> : !items ? <div className="table-scroll"><table><caption>Việc cần theo dõi theo lớp</caption><thead><tr><th>Lớp</th><th>Chưa ghi nhận</th><th>Đơn nghỉ chờ xử lý</th></tr></thead><tbody>{queue.classes.length ? queue.classes.map((row) => <tr key={row.classId}><td>{row.className}</td><td><button type="button" onClick={() => void load(date, row.classId, 'NOT_RECORDED')}>{row.attendanceGapCount} trẻ</button></td><td><button type="button" onClick={() => void load(date, row.classId, 'PENDING')}>{row.pendingLeaveCount} đơn</button></td></tr>) : <tr><td colSpan={3}>Không có lớp trong phạm vi được cấp quyền.</td></tr>}</tbody></table></div> : <div className="table-scroll"><p>Danh sách được lọc theo URL. Không có thao tác ghi nhận tại đây.</p><table><caption>{items.className} / {label(items.status)} / {items.attendanceOn}</caption><thead><tr><th>Học sinh</th><th>Mã học sinh</th><th>Trạng thái</th></tr></thead><tbody>{items.students.length ? items.students.map((student) => <tr key={student.studentId}><td>{student.studentName}</td><td>{student.studentCode}</td><td>{label(items.status)}</td></tr>) : <tr><td colSpan={3}>Không có học sinh phù hợp.</td></tr>}</tbody></table><button type="button" onClick={() => void load(date)}>Quay lại hàng đợi</button></div>}</>}</section>;
}
