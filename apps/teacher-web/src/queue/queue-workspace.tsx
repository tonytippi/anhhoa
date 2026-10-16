import { useEffect, useRef, useState } from 'react';
import { apiGet, fullDay, hcmToday } from '../api';
import { DateControls } from '../components';
import type { WorkspaceProps } from '../school-context';

type Status = 'NOT_RECORDED' | 'PENDING';
type QueueClass = { classId: string; className: string; attendanceGapCount: number; pendingLeaveCount: number };
type Queue = { attendanceOn: string; operating: boolean; explanation: string; classes: QueueClass[] };
type Items = { attendanceOn: string; classId: string; className: string; status: Status; students: Array<{ studentId: string; studentName: string; studentCode: string }> };
const labels: Record<Status, { title: string; unit: string; copy: string; row: string; badge: string }> = {
  NOT_RECORDED: { title: 'Chưa ghi nhận', unit: 'trẻ', copy: 'Hệ thống chưa nhận được trạng thái điểm danh hôm nay.', row: 'Hệ thống chưa có trạng thái điểm danh.', badge: 'neutral' },
  PENDING: { title: 'Đơn nghỉ chờ xử lý', unit: 'đơn', copy: 'Đơn đang chờ quyết định theo chính sách của Trường.', row: 'Hệ thống chờ quyết định hợp lệ.', badge: 'info' },
};
const readQuery = () => {
  const query = new URLSearchParams(window.location.search);
  const status = query.get('status');
  return { date: query.get('date') ?? hcmToday(), classId: query.get('classId') ?? undefined, status: status === 'NOT_RECORDED' || status === 'PENDING' ? (status as Status) : undefined };
};

// Read-only: the queue never records attendance or decides leave; it only links into filtered lists kept on the URL.
export function QueueWorkspace({ schoolId, base, navigate }: WorkspaceProps) {
  const [query, setQuery] = useState(readQuery);
  const [queue, setQueue] = useState<Queue>();
  const [items, setItems] = useState<Items>();
  const [error, setError] = useState('');
  const version = useRef(0);

  const open = (next: { date: string; classId?: string; status?: Status }) => {
    const params = new URLSearchParams({ date: next.date, ...(next.classId && next.status ? { classId: next.classId, status: next.status } : {}) });
    navigate(`${base}/queue?${params}`);
    setQuery({ classId: undefined, status: undefined, ...next });
  };
  useEffect(() => {
    const restore = () => setQuery(readQuery());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const current = ++version.current;
    setQueue(undefined); setItems(undefined); setError('');
    void (async () => {
      const result = await apiGet<Queue>(`/api/teacher/schools/${schoolId}/operational-queue?date=${query.date}`, 'Không thể tải hàng đợi lớp.');
      if (current !== version.current) return;
      if (!result.ok) { setError(result.error.message); return; }
      setQueue(result.data);
      if (!query.classId || !query.status) return;
      const detail = await apiGet<Items>(`/api/teacher/schools/${schoolId}/operational-queue/items?${new URLSearchParams({ date: query.date, classId: query.classId, status: query.status })}`, 'Không thể tải danh sách đã lọc.');
      if (current !== version.current) return;
      if (!detail.ok) { setError(detail.error.message); return; }
      setItems(detail.data);
    })();
  }, [schoolId, query.date, query.classId, query.status]);

  const filtered = Boolean(query.classId && query.status);
  return (
    <section className="teacher-route active" aria-labelledby="queue-title">
      <div className="route-head">
        <div>
          <p className="eyebrow">HÀNG ĐỢI VẬN HÀNH · {fullDay(query.date)}</p>
          <h1 id="queue-title">Hàng đợi lớp</h1>
          <p className="muted">Các việc cần theo dõi trong lớp được phân công. Số liệu do hệ thống xác nhận.</p>
        </div>
        <DateControls day={query.date} onChange={(date) => open({ date })} />
      </div>
      <p className="queue-detail-note">
        {filtered && items ? `Danh sách được lọc theo URL: ngày ${fullDay(items.attendanceOn)} · ${items.className} · ${labels[items.status].title.toLocaleLowerCase('vi')}. Không có thao tác ghi nhận tại đây.` : 'Chọn một thẻ để xem danh sách đã lọc. Hàng đợi chỉ để theo dõi, không ghi nhận thay điểm danh hay đơn nghỉ.'}
      </p>
      {error && <div className="notice warning" role="alert">{error}</div>}
      {!queue && !error && <p className="teacher-loading" role="status">Đang tải hàng đợi lớp...</p>}
      {queue && !queue.operating && <div className="empty"><h2>Ngày không vận hành</h2><p className="muted">{queue.explanation}</p></div>}
      {queue?.operating && !filtered && (
        queue.classes.length ? (
          <div className="queue-grid">
            {queue.classes.flatMap((row) => (['NOT_RECORDED', 'PENDING'] as Status[]).map((status) => {
              const count = status === 'NOT_RECORDED' ? row.attendanceGapCount : row.pendingLeaveCount;
              const href = `${base}/queue?${new URLSearchParams({ date: query.date, classId: row.classId, status })}`;
              return (
                <a key={`${row.classId}-${status}`} className="queue-card" href={href} onClick={(event) => { event.preventDefault(); open({ date: query.date, classId: row.classId, status }); }}>
                  <p className="eyebrow">{row.className.toLocaleUpperCase('vi')}</p>
                  <h2>{labels[status].title}</h2>
                  <b>{count} {labels[status].unit}</b>
                  <p>{labels[status].copy}</p>
                </a>
              );
            }))}
          </div>
        ) : <div className="empty"><h2>Không có việc cần theo dõi</h2><p className="muted">Không có lớp trong phạm vi được cấp quyền.</p></div>
      )}
      {queue?.operating && filtered && items && (
        <>
          <div className="table-wrap">
            <table className="teacher-table stack-on-phone">
              <caption>{items.students.length} {labels[items.status].unit} {labels[items.status].title.toLocaleLowerCase('vi')} · {items.className} · {fullDay(items.attendanceOn)}</caption>
              <thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {items.students.length ? items.students.map((student) => (
                  <tr key={student.studentId}>
                    <td><span className="student-name">{student.studentName}</span><span className="student-code">{student.studentCode}</span></td>
                    <td data-label="Trạng thái"><span className={`badge ${labels[items.status].badge}`}>{items.status === 'PENDING' ? 'Đang chờ xử lý' : 'Chưa ghi nhận'}</span></td>
                    <td className="muted">{labels[items.status].row}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="muted">Không có học sinh phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="teacher-note"><button className="button secondary" type="button" onClick={() => open({ date: query.date })}>‹ Quay lại hàng đợi</button></p>
        </>
      )}
    </section>
  );
}
