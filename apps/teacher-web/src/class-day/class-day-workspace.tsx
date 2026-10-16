import { useEffect, useRef, useState } from 'react';
import { acceptedImages, apiGet, apiMutate, clock, fullDay, hcmLocalMinute, hcmToday, longDay } from '../api';
import { DateControls, Dialog, ErrorNotice } from '../components';
import { ClassPicker, type WorkspaceProps } from '../school-context';
import { checkingMessage, unknownMessage, useOperation } from '../use-operation';

type AttendanceState = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'NOT_RECORDED';
type AttendanceRow = { studentId: string; fullName: string; studentCode?: string; state: AttendanceState; evidenceId: string | null; updatedAt: string | null };
type AttendanceRoster = { photoEvidenceMode: 'REQUIRED' | 'OPTIONAL'; students: AttendanceRow[] };
type HandoverRow = { studentId: string; pickedUpAt: string | null; evidenceId: string | null };
type HandoverRoster = { photoEvidenceMode: 'REQUIRED' | 'OPTIONAL'; students: HandoverRow[] };
type JournalRow = { studentId: string; status: 'CURRENT' | 'MISSING' };
type Data = { attendance: AttendanceRoster; handover?: HandoverRoster; journals?: Map<string, JournalRow>; loadedAt: string };
type Action = { kind: 'receive' | 'handover'; student: AttendanceRow };

const stateBadge: Record<AttendanceState, [string, string]> = {
  PRESENT: ['success', 'Có mặt'],
  ABSENT: ['danger', 'Vắng mặt'],
  ON_LEAVE: ['info', 'Đang nghỉ'],
  NOT_RECORDED: ['neutral', 'Chưa ghi nhận'],
};

export function ClassDayWorkspace({ schoolId, classes, classId, chooseClass, features, setGuard, navigate, base }: WorkspaceProps) {
  const [day, setDay] = useState(hcmToday());
  const [data, setData] = useState<Data>();
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState<Action>();
  const [working, setWorking] = useState<string>();
  const operation = useOperation(schoolId);
  const version = useRef(0);
  const classroom = classes.find((item) => item.classId === classId);
  const today = hcmToday();

  const load = async () => {
    const current = ++version.current;
    setLoadError('');
    const attendance = await apiGet<AttendanceRoster>(`/api/teacher/schools/${schoolId}/attendance-roster?classId=${classId}&attendanceOn=${day}`, 'Không thể tải danh sách lớp.');
    const [handover, journals] = await Promise.all([
      features.handover && attendance.ok ? apiGet<HandoverRoster>(`/api/teacher/schools/${schoolId}/handover-roster?handoverOn=${day}`, '') : undefined,
      features.dailyJournal && attendance.ok && day === today ? apiGet<{ students: JournalRow[] }>(`/api/teacher/schools/${schoolId}/daily-journal-roster?classId=${classId}&journalDate=${day}`, '') : undefined,
    ]);
    if (current !== version.current) return;
    if (!attendance.ok) { setData(undefined); setLoadError(attendance.error.message); return; }
    setData({
      attendance: attendance.data,
      handover: handover?.ok ? handover.data : undefined,
      journals: journals?.ok ? new Map(journals.data.students.map((row) => [row.studentId, row])) : undefined,
      loadedAt: new Date().toISOString(),
    });
  };
  useEffect(() => { setData(undefined); void load(); }, [schoolId, classId, day]);
  useEffect(() => { setGuard({ dirty: operation.unresolved, message: 'Một thao tác chưa được hệ thống xác nhận. Hãy kiểm tra lại kết quả trước khi rời.' }); }, [operation.unresolved]);

  const finish = async (outcome: Awaited<ReturnType<typeof operation.run>>, failure: string) => {
    if (outcome.ok === 'unknown') { setError(unknownMessage); return false; }
    if (!outcome.ok) { setError(outcome.error.fieldErrors ? Object.values(outcome.error.fieldErrors)[0] ?? outcome.error.message : outcome.error.message || failure); await load(); return false; }
    setError('');
    await load();
    return true;
  };
  const uploadEvidence = async (path: string, file: File) => {
    const outcome = await operation.run<{ id: string }>((pending) => apiMutate(path, pending, file, 'Không thể tải ảnh.', file.type));
    if (outcome.ok === true) return outcome.operation.outcome.id;
    await finish(outcome, 'Không thể tải ảnh.');
    return undefined;
  };
  const record = async (student: AttendanceRow, state: 'PRESENT' | 'ABSENT', file?: File) => {
    setWorking(student.studentId);
    try {
      const evidenceId = file ? await uploadEvidence(`/api/teacher/schools/${schoolId}/attendance-evidence?classId=${classId}&attendanceOn=${day}`, file) : null;
      if (file && !evidenceId) return false;
      const outcome = await operation.run((pending) => apiMutate(`/api/teacher/schools/${schoolId}/attendance`, pending, { classId, studentId: student.studentId, attendanceOn: day, state, evidenceId }, 'Không thể ghi điểm danh.'));
      return await finish(outcome, 'Không thể ghi điểm danh.');
    } finally {
      setWorking(undefined);
    }
  };
  const handover = async (student: AttendanceRow, localTime: string, file?: File) => {
    setWorking(student.studentId);
    try {
      const evidenceId = file ? await uploadEvidence(`/api/teacher/schools/${schoolId}/handover-evidence?handoverOn=${day}`, file) : null;
      if (file && !evidenceId) return false;
      const pickedUpAt = new Date(`${localTime}:00+07:00`).toISOString();
      const outcome = await operation.run((pending) => apiMutate(`/api/teacher/schools/${schoolId}/handovers`, pending, { studentId: student.studentId, handoverOn: day, pickedUpAt, evidenceId }, 'Không thể ghi nhận trả trẻ.'));
      return await finish(outcome, 'Không thể ghi nhận trả trẻ.');
    } finally {
      setWorking(undefined);
    }
  };
  const retry = async () => { setError(checkingMessage); await finish(await operation.retry(), 'Không thể ghi nhận.'); };
  const receive = (student: AttendanceRow) => {
    if (data?.attendance.photoEvidenceMode === 'REQUIRED') setAction({ kind: 'receive', student });
    else void record(student, 'PRESENT');
  };

  const students = data?.attendance.students ?? [];
  const handoverBy = new Map(data?.handover?.students.map((row) => [row.studentId, row]) ?? []);
  const present = students.filter((student) => student.state === 'PRESENT').length;
  const pickedUp = students.filter((student) => handoverBy.get(student.studentId)?.pickedUpAt).length;
  const journaled = students.filter((student) => data?.journals?.get(student.studentId)?.status === 'CURRENT').length;
  const nonOperating = loadError && /không vận hành/i.test(loadError);
  const busy = Boolean(working) || operation.busy;

  return (
    <section className="teacher-route active" aria-labelledby="class-day-title">
      <div className="route-head">
        <div>
          <p className="eyebrow">LỚP ĐƯỢC PHÂN CÔNG · {longDay(day).toLocaleUpperCase('vi')}</p>
          <h1 id="class-day-title">{classroom?.className ?? 'Lớp hôm nay'}</h1>
          <p className="muted">Vận hành điểm danh{features.handover ? ' và bàn giao' : ''} cho lớp được phân công hiệu lực {day === today ? 'hôm nay' : `ngày ${fullDay(day)}`}.</p>
        </div>
        <div className="route-tools">
          <ClassPicker classes={classes} classId={classId} chooseClass={chooseClass} />
          <DateControls day={day} onChange={setDay} maxDay={today} />
        </div>
      </div>
      <ErrorNotice message={error} onRetry={operation.unresolved ? () => void retry() : undefined} />
      {busy && <p className="teacher-status" aria-live="polite">{operation.busy ? checkingMessage : 'Đang ghi nhận...'}</p>}
      {loadError ? (
        <div className="empty"><h2>{nonOperating ? 'Ngày không vận hành' : 'Không thể tải danh sách lớp'}</h2><p className="muted">{loadError}</p>{!nonOperating && <button className="button secondary" type="button" onClick={() => void load()}>Thử lại</button>}</div>
      ) : !data ? (
        <p className="teacher-loading" role="status">Đang tải danh sách lớp...</p>
      ) : (
        <>
          <div className="teacher-summary" data-columns={1 + Number(Boolean(data.handover)) + Number(Boolean(data.journals))}>
            <article><b>{present}/{students.length}</b><span>Đã nhận trẻ</span></article>
            {data.handover && <article><b>{pickedUp}/{students.length}</b><span>Đã trả trẻ</span></article>}
            {data.journals && <article><b>{journaled}/{students.length}</b><span>Đã có nhận xét</span></article>}
          </div>
          <div className="teacher-toolbar">
            <div><h2>Danh sách {day === today ? 'hôm nay' : `ngày ${fullDay(day)}`}</h2><p>Cập nhật bởi hệ thống lúc {clock(data.loadedAt)}</p></div>
            {data.journals && <a className="button secondary" href={`${base}/journals`} onClick={(event) => { event.preventDefault(); navigate(`${base}/journals`); }}>Hoàn tất nhận xét</a>}
          </div>
          {students.length ? (
            <div className="table-wrap">
              <table className="teacher-table stack-on-phone">
                <caption>Học sinh lớp {classroom?.className} · {fullDay(day)}</caption>
                <thead><tr><th>Học sinh</th><th>Trạng thái hôm nay</th>{data.journals && <th>Tiến độ nhận xét</th>}<th>Thao tác</th></tr></thead>
                <tbody>
                  {students.map((student) => {
                    const picked = handoverBy.get(student.studentId)?.pickedUpAt;
                    const [tone, label] = picked ? ['success', 'Đã trả trẻ'] : stateBadge[student.state];
                    const detail = picked ? `Trả lúc ${clock(picked)}` : student.state === 'PRESENT' && student.updatedAt ? `Nhận lúc ${clock(student.updatedAt)}` : student.state === 'ON_LEAVE' ? 'Đơn nghỉ đã duyệt' : student.state === 'ABSENT' ? 'Đã ghi vắng' : 'Chưa ghi nhận';
                    const journal = data.journals?.get(student.studentId)?.status === 'CURRENT';
                    return (
                      <tr key={student.studentId}>
                        <td><span className="student-name">{student.fullName}</span><span className="student-code">{[student.studentCode, detail].filter(Boolean).join(' · ')}</span></td>
                        <td data-label="Trạng thái"><span className={`badge ${tone}`}>{label}</span></td>
                        {data.journals && <td data-label="Nhận xét"><span className={`badge ${journal ? 'success' : 'neutral'}`}>{journal ? 'Đã có nhận xét' : 'Chưa có nhận xét'}</span></td>}
                        <td className="row-actions">
                          {student.state === 'ON_LEAVE' ? <span className="muted">Không có thao tác</span>
                            : student.state === 'PRESENT' ? (picked ? <span className="muted">Đã bàn giao</span> : data.handover ? <button className="button secondary" type="button" disabled={busy} onClick={() => setAction({ kind: 'handover', student })}>Bàn giao</button> : <span className="muted">Đã nhận trẻ</span>)
                              : (
                                <>
                                  <button className="button" type="button" disabled={busy} onClick={() => receive(student)}>{working === student.studentId ? 'Đang ghi...' : 'Nhận trẻ'}</button>
                                  {student.state === 'NOT_RECORDED' && <button className="button secondary" type="button" disabled={busy} onClick={() => void record(student, 'ABSENT')}>Vắng</button>}
                                </>
                              )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="empty"><h2>Lớp chưa có học sinh</h2><p className="muted">Không có học sinh đang học trong lớp vào ngày này.</p></div>}
          <p className="teacher-note"><strong>Quyền thao tác:</strong> Khi phân công lớp thay đổi, nội dung và thao tác đang mở sẽ không còn khả dụng.</p>
        </>
      )}
      {action?.kind === 'receive' && data && <ReceiveDialog student={action.student} onClose={() => setAction(undefined)} onConfirm={async (file) => { if (await record(action.student, 'PRESENT', file)) setAction(undefined); }} busy={busy} />}
      {action?.kind === 'handover' && data?.handover && <HandoverDialog student={action.student} required={data.handover.photoEvidenceMode === 'REQUIRED'} day={day} onClose={() => setAction(undefined)} onConfirm={async (time, file) => { if (await handover(action.student, time, file)) setAction(undefined); }} busy={busy} />}
    </section>
  );
}

function PhotoField({ label, required, file, setFile }: { label: string; required: boolean; file?: File; setFile: (file?: File) => void }) {
  const [problem, setProblem] = useState('');
  return (
    <label>
      {label} {required ? '(bắt buộc)' : '(tùy chọn)'}
      <input type="file" accept={acceptedImages.join(',')} capture="environment" onChange={(event) => {
        const next = event.target.files?.[0];
        if (next && (!acceptedImages.includes(next.type) || next.size > 5 * 1024 * 1024)) { setProblem('Chỉ nhận ảnh JPEG, PNG hoặc WebP tối đa 5 MB.'); setFile(undefined); return; }
        setProblem('');
        setFile(next);
      }} />
      {file && <span className="field-hint">Đã chọn: {file.name}</span>}
      {problem && <span className="field-error">{problem}</span>}
    </label>
  );
}

function ReceiveDialog({ student, onClose, onConfirm, busy }: { student: AttendanceRow; onClose: () => void; onConfirm: (file?: File) => Promise<void>; busy: boolean }) {
  const [file, setFile] = useState<File>();
  return (
    <Dialog title={`Nhận trẻ ${student.fullName}`} eyebrow="ĐIỂM DANH ĐẦU NGÀY" labelledBy="receive-title" onClose={onClose}>
      <p>Trường yêu cầu ảnh khi ghi nhận có mặt. Ảnh chỉ dùng làm bằng chứng vận hành, phụ huynh không xem được.</p>
      <PhotoField label="Ảnh nhận trẻ" required file={file} setFile={setFile} />
      <div className="handover-actions">
        <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
        <button className="button" type="button" disabled={!file || busy} onClick={() => void onConfirm(file)}>{busy ? 'Đang ghi...' : 'Xác nhận có mặt'}</button>
      </div>
    </Dialog>
  );
}

function HandoverDialog({ student, required, day, onClose, onConfirm, busy }: { student: AttendanceRow; required: boolean; day: string; onClose: () => void; onConfirm: (time: string, file?: File) => Promise<void>; busy: boolean }) {
  const now = hcmLocalMinute();
  const [time, setTime] = useState(now.startsWith(day) ? now.slice(11) : '16:30');
  const [file, setFile] = useState<File>();
  return (
    <Dialog title={`Bàn giao ${student.fullName}`} eyebrow="BÀN GIAO CUỐI NGÀY" labelledBy="handover-title" onClose={onClose}>
      <p>Ghi nhận thời điểm trả trẻ cho {student.fullName}. Đây là tham chiếu vận hành, không phải ủy quyền đón trẻ.</p>
      <label>Giờ trả trẻ<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
      <PhotoField label="Ảnh bàn giao" required={required} file={file} setFile={setFile} />
      <div className="handover-actions">
        <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
        <button className="button" type="button" disabled={busy || !time || (required && !file)} onClick={() => void onConfirm(`${day}T${time}`, file)}>{busy ? 'Đang ghi...' : 'Xác nhận bàn giao'}</button>
      </div>
    </Dialog>
  );
}
