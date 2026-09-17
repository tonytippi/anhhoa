import { FormEvent, useEffect, useRef, useState } from 'react';

type SchoolYear = { id: string; name: string; startsOn: string; endsOn: string; isActive: boolean };
type Classroom = { id: string; schoolYearId: string; name: string; status: 'ACTIVE' | 'ARCHIVED'; activeStudentCount: number };
type Enrollment = { id: string; classId: string; lifecycle: string; effectiveFrom: string; endedOn: string | null; schoolYear: { name: string }; classroom: { name: string }; lifecycleHistory: { id: string; previousLifecycle: string | null; lifecycle: string; effectiveFrom: string; endedOn: string | null; changedAt: string }[] };
type Student = { id: string; studentCode: string; fullName: string; dateOfBirth: string; enrollments: Enrollment[] };
type Pending = { id: string; schoolId: string; kind: 'school-year' | 'class' | 'rename' | 'student' | 'archive' | 'lifecycle' };
type ErrorBody = { error?: { message?: string; fieldErrors?: Record<string, string> } };
type Status = { dirty: boolean; pending: boolean; reconcile?: () => void };

const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === 'undefined' ? 'app_csrf' : __CSRF_COOKIE_NAME__;
const pendingKey = 'passionedu.app.pending-roster-operation';
const lifecycleLabel: Record<string, string> = { TRIAL: 'Học thử', WAITING_FOR_CLASS: 'Chờ xếp lớp', SCHEDULED_TO_START: 'Đã hẹn nhập học', ENROLLED: 'Đang nhập học', ON_LEAVE: 'Tạm nghỉ', WITHDRAWN: 'Đã thôi học', GRADUATED: 'Đã tốt nghiệp' };
const csrf = () => document.cookie.split('; ').find((item) => item.startsWith(`${csrfName}=`))?.slice(csrfName.length + 1);
const deniedStatus = (status: number) => [401, 403, 404].includes(status);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const businessToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
};

export function RosterWorkspace({ schoolId, schoolName, denied, onStatusChange }: { schoolId: string; schoolName: string; denied: () => void; onStatusChange?: (status: Status) => void }) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [year, setYear] = useState({ name: '', startsOn: '', endsOn: '' });
  const [className, setClassName] = useState('');
  const [rename, setRename] = useState<Classroom>();
  const [renameName, setRenameName] = useState('');
  const [student, setStudent] = useState({ fullName: '', dateOfBirth: '', classId: '', lifecycle: 'ENROLLED', effectiveFrom: '', endedOn: '' });
  const [yearErrors, setYearErrors] = useState<Record<string, string>>({});
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [studentErrors, setStudentErrors] = useState<Record<string, string>>({});
  const [endedOnByEnrollment, setEndedOnByEnrollment] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Pending>();
  const summary = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const currentSchool = useRef(schoolId);
  const selectedYear = useRef('');
  const valid = (school: string, requestGeneration: number) => currentSchool.current === school && generation.current === requestGeneration;
  const stop = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = undefined; };
  const dirty = Boolean(year.name || year.startsOn || year.endsOn || className || renameName || student.fullName || student.dateOfBirth || student.classId || student.effectiveFrom || student.endedOn);

  useEffect(() => { onStatusChange?.({ dirty, pending: Boolean(pending), reconcile: pending ? () => void reconcile(pending) : undefined }); }, [dirty, pending, onStatusChange]);

  const read = async <T,>(path: string, requestGeneration = generation.current): Promise<T | undefined> => {
    const response = await fetch(`${apiUrl}${path}`, { credentials: 'include' });
    if (!valid(schoolId, requestGeneration)) return;
    if (deniedStatus(response.status)) { denied(); return; }
    if (!response.ok) throw new Error('Không thể tải danh bộ.');
    return (await response.json() as { data: T }).data;
  };
  const loadYear = async (selected: string, requestGeneration = generation.current) => {
    setClasses([]); setStudents([]);
    const [nextClasses, nextStudents] = await Promise.all([
      read<Classroom[]>(`/api/app/schools/${schoolId}/roster/school-years/${selected}/classes`, requestGeneration),
      read<Student[]>(`/api/app/schools/${schoolId}/roster/school-years/${selected}/students`, requestGeneration),
    ]);
    if (!valid(schoolId, requestGeneration) || selectedYear.current !== selected) return;
    setClasses(nextClasses ?? []);
    setStudents(nextStudents ?? []);
    setStudent((current) => current.classId ? current : { ...current, classId: (nextClasses ?? []).find((item) => item.status === 'ACTIVE')?.id ?? '' });
  };
  const refresh = async (requestGeneration = generation.current) => {
    const nextYears = await read<SchoolYear[]>(`/api/app/schools/${schoolId}/roster/school-years`, requestGeneration);
    if (!nextYears || !valid(schoolId, requestGeneration)) return;
    setYears(nextYears);
    const selected = nextYears.some((item) => item.id === selectedYear.current) ? selectedYear.current : nextYears[0]?.id ?? '';
    if (selected !== selectedYear.current) { selectedYear.current = selected; setYearId(selected); }
    if (!selected) { setClasses([]); setStudents([]); return; }
    if (selected === yearId) await loadYear(selected, requestGeneration);
  };
  const reconcile = async (operation: Pending, requestGeneration = generation.current) => {
    if (!valid(operation.schoolId, requestGeneration)) return;
    setPending(operation);
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${operation.schoolId}/operations/${operation.id}`, { credentials: 'include' });
      if (!valid(operation.schoolId, requestGeneration)) return;
      if (deniedStatus(response.status)) { denied(); return; }
      if (!response.ok) throw new Error();
      const result = (await response.json() as { data: { status: string } }).data;
      if (result.status === 'PENDING') { timer.current = window.setTimeout(() => void reconcile(operation, requestGeneration), 750); return; }
      sessionStorage.removeItem(pendingKey); setPending(undefined);
      if (result.status === 'COMPLETED') await refresh(requestGeneration); else setMessage('Thao tác không thành công.');
    } catch { if (valid(operation.schoolId, requestGeneration)) timer.current = window.setTimeout(() => void reconcile(operation, requestGeneration), 750); }
  };
  useEffect(() => {
    const requestGeneration = ++generation.current;
    currentSchool.current = schoolId; selectedYear.current = ''; stop(); setYears([]); setYearId(''); setClasses([]); setStudents([]);
    setYear({ name: '', startsOn: '', endsOn: '' }); setClassName(''); setRename(undefined); setRenameName(''); setStudent({ fullName: '', dateOfBirth: '', classId: '', lifecycle: 'ENROLLED', effectiveFrom: '', endedOn: '' });
    setYearErrors({}); setClassErrors({}); setRenameErrors({}); setStudentErrors({}); setMessage(''); setPending(undefined);
    void refresh(requestGeneration).catch((error: Error) => valid(schoolId, requestGeneration) && setMessage(error.message));
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) { const saved = JSON.parse(raw) as Pending; if (saved.schoolId === schoolId) void reconcile(saved, requestGeneration); }
    return stop;
  }, [schoolId]);
  useEffect(() => {
    if (!yearId) return;
    const requestGeneration = generation.current;
    void loadYear(yearId, requestGeneration).catch((error: Error) => valid(schoolId, requestGeneration) && selectedYear.current === yearId && setMessage(error.message));
  }, [yearId, schoolId]);
  useEffect(() => { if (Object.keys(yearErrors).length || Object.keys(classErrors).length || Object.keys(renameErrors).length || Object.keys(studentErrors).length) summary.current?.focus(); }, [yearErrors, classErrors, renameErrors, studentErrors]);

  const post = async (path: string, body: object, kind: Pending['kind']) => {
    if (pending) return false;
    const requestGeneration = generation.current;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, kind };
    setMessage('');
    if (kind === 'school-year') setYearErrors({}); else if (kind === 'class' || kind === 'archive') setClassErrors({}); else if (kind === 'rename') setRenameErrors({}); else setStudentErrors({});
    try {
      const response = await fetch(`${apiUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf() ?? ''), 'idempotency-key': crypto.randomUUID(), 'x-operation-id': operation.id }, body: JSON.stringify(body) });
      if (!valid(schoolId, requestGeneration)) return false;
      if (deniedStatus(response.status)) { denied(); return false; }
      if (uncertain(response.status)) throw new TypeError('Mutation outcome is uncertain.');
      if (!response.ok) {
        const data = await response.json() as ErrorBody;
        const errors = data.error?.fieldErrors ?? {};
        if (kind === 'school-year') setYearErrors(errors); else if (kind === 'class' || kind === 'archive') setClassErrors(errors); else if (kind === 'rename') setRenameErrors(errors); else setStudentErrors(errors);
        setMessage(data.error?.message ?? 'Thao tác không thành công.');
        return false;
      }
      await refresh(requestGeneration);
      return valid(schoolId, requestGeneration);
    } catch (error) {
      if (!valid(schoolId, requestGeneration)) return false;
      if (error instanceof TypeError) { sessionStorage.setItem(pendingKey, JSON.stringify(operation)); setPending(operation); void reconcile(operation, requestGeneration); } else setMessage('Thao tác không thành công.');
      return false;
    }
  };
  const createYear = async (event: FormEvent) => { event.preventDefault(); if (await post(`/api/app/schools/${schoolId}/roster/school-years`, year, 'school-year')) setYear({ name: '', startsOn: '', endsOn: '' }); };
  const createClass = async (event: FormEvent) => { event.preventDefault(); if (yearId && await post(`/api/app/schools/${schoolId}/roster/school-years/${yearId}/classes`, { name: className }, 'class')) setClassName(''); };
  const submitRename = async (event: FormEvent) => { event.preventDefault(); if (rename && await post(`/api/app/schools/${schoolId}/roster/classes/${rename.id}/name`, { name: renameName }, 'rename')) { setRename(undefined); setRenameName(''); } };
  const createStudent = async (event: FormEvent) => { event.preventDefault(); if (yearId && await post(`/api/app/schools/${schoolId}/roster/students`, { ...student, schoolYearId: yearId, endedOn: student.endedOn || null }, 'student')) setStudent({ fullName: '', dateOfBirth: '', classId: classes.find((item) => item.status === 'ACTIVE')?.id ?? '', lifecycle: 'ENROLLED', effectiveFrom: '', endedOn: '' }); };
  const changeLifecycle = async (enrollment: Enrollment, lifecycle: string) => { await post(`/api/app/schools/${schoolId}/roster/enrollments/${enrollment.id}/lifecycle`, { lifecycle, endedOn: lifecycle === 'ON_LEAVE' || lifecycle === 'WITHDRAWN' || lifecycle === 'GRADUATED' ? endedOnByEnrollment[enrollment.id] || enrollment.endedOn || businessToday() : null }, 'lifecycle'); };
  const selected = years.find((item) => item.id === yearId);
  const disabled = Boolean(pending);
  const field = (errors: Record<string, string>, name: string) => errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};

  return <section className="roster-workspace" aria-labelledby="roster-title">
    <h2 id="roster-title">Danh bộ</h2><p>{schoolName}{selected ? ` / ${selected.name}` : ' / Chưa có năm học'}</p>
    {message && <div ref={summary} tabIndex={-1} role="alert">{message}</div>}
    <form className="roster-form" onSubmit={createYear}><h3>Tạo năm học</h3><label>Tên năm học<input value={year.name} onChange={(event) => setYear({ ...year, name: event.target.value })} {...field(yearErrors, 'name')} /></label>{yearErrors.name && <small id="name-error">{yearErrors.name}</small>}<label>Ngày bắt đầu<input type="date" value={year.startsOn} onChange={(event) => setYear({ ...year, startsOn: event.target.value })} {...field(yearErrors, 'startsOn')} /></label>{yearErrors.startsOn && <small id="startsOn-error">{yearErrors.startsOn}</small>}<label>Ngày kết thúc<input type="date" value={year.endsOn} onChange={(event) => setYear({ ...year, endsOn: event.target.value })} {...field(yearErrors, 'endsOn')} /></label>{yearErrors.endsOn && <small id="endsOn-error">{yearErrors.endsOn}</small>}<button disabled={disabled}>Tạo năm học</button></form>
    <div className="table-scroll"><table><caption>Năm học của {schoolName}</caption><thead><tr><th>Tên</th><th>Khoảng thời gian</th><th>Trạng thái</th></tr></thead><tbody>{years.length ? years.map((item) => <tr key={item.id}><th scope="row"><button onClick={() => { selectedYear.current = item.id; setClasses([]); setStudents([]); setYearId(item.id); }}>{item.name}</button></th><td>{item.startsOn} - {item.endsOn}</td><td>{item.isActive ? 'Đang hoạt động' : 'Không hoạt động'}</td></tr>) : <tr><td colSpan={3}>Chưa có năm học. Tạo năm học đầu tiên để quản lý lớp.</td></tr>}</tbody></table></div>
    {yearId && <><form className="roster-form" onSubmit={createClass}><h3>Thêm lớp cho {selected?.name}</h3><label>Tên lớp<input value={className} onChange={(event) => setClassName(event.target.value)} {...field(classErrors, 'name')} /></label>{classErrors.name && <small id="name-error">{classErrors.name}</small>}<button disabled={disabled}>Tạo lớp</button></form>
      <div className="table-scroll"><table><caption>Lớp thuộc {selected?.name}</caption><thead><tr><th>Tên lớp</th><th>Trạng thái</th><th>Học sinh đang nhập học</th><th>Thao tác</th></tr></thead><tbody>{classes.length ? classes.map((item) => <tr key={item.id}><th scope="row">{item.name}</th><td>{item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}</td><td>{item.activeStudentCount}</td><td>{item.status === 'ACTIVE' && <><button disabled={disabled} onClick={() => { setRename(item); setRenameName(item.name); setRenameErrors({}); }}>Đổi tên</button><button disabled={disabled} onClick={() => { if (window.confirm(`Lưu trữ lớp ${item.name}?`)) void post(`/api/app/schools/${schoolId}/roster/classes/${item.id}/archive`, {}, 'archive'); }}>Lưu trữ</button></>}</td></tr>) : <tr><td colSpan={4}>Năm học này chưa có lớp.</td></tr>}</tbody></table></div>
      {selected?.isActive ? <form className="roster-form" onSubmit={createStudent}><h3>Tạo học sinh và enrollment</h3><label>Họ và tên<input value={student.fullName} onChange={(event) => setStudent({ ...student, fullName: event.target.value })} {...field(studentErrors, 'fullName')} /></label>{studentErrors.fullName && <small id="fullName-error">{studentErrors.fullName}</small>}<label>Ngày sinh<input type="date" value={student.dateOfBirth} onChange={(event) => setStudent({ ...student, dateOfBirth: event.target.value })} {...field(studentErrors, 'dateOfBirth')} /></label>{studentErrors.dateOfBirth && <small id="dateOfBirth-error">{studentErrors.dateOfBirth}</small>}<label>Lớp<select value={student.classId} onChange={(event) => setStudent({ ...student, classId: event.target.value })} {...field(studentErrors, 'classId')}><option value="">Chọn lớp</option>{classes.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{studentErrors.classId && <small id="classId-error">{studentErrors.classId}</small>}<label>Trạng thái<select value={student.lifecycle} onChange={(event) => setStudent({ ...student, lifecycle: event.target.value })}>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Ngày hiệu lực<input type="date" value={student.effectiveFrom} onChange={(event) => setStudent({ ...student, effectiveFrom: event.target.value })} {...field(studentErrors, 'effectiveFrom')} /></label>{studentErrors.effectiveFrom && <small id="effectiveFrom-error">{studentErrors.effectiveFrom}</small>}<label>Ngày kết thúc<input type="date" value={student.endedOn} onChange={(event) => setStudent({ ...student, endedOn: event.target.value })} {...field(studentErrors, 'endedOn')} /></label>{studentErrors.endedOn && <small id="endedOn-error">{studentErrors.endedOn}</small>}<button disabled={disabled}>Tạo học sinh</button></form> : <p role="status">Chỉ có thể tạo enrollment trong năm học đang hoạt động.</p>}
      <div className="table-scroll"><table><caption>Học sinh của {selected?.name}</caption><thead><tr><th>Mã</th><th>Họ tên</th><th>Enrollment hiện tại</th><th>Lịch sử</th></tr></thead><tbody>{students.length ? students.map((item) => <tr key={item.id}><td>{item.studentCode}</td><th scope="row">{item.fullName}</th><td>{item.enrollments.at(-1) && lifecycleLabel[item.enrollments.at(-1)!.lifecycle]}</td><td>{item.enrollments.map((enrollment) => <div key={enrollment.id}>{enrollment.schoolYear.name} / {enrollment.classroom.name} / {lifecycleLabel[enrollment.lifecycle]} ({enrollment.effectiveFrom}{enrollment.endedOn ? ` - ${enrollment.endedOn}` : ''}) <label>Ngày kết thúc<input aria-label={`Ngày kết thúc ${item.fullName}`} type="date" value={endedOnByEnrollment[enrollment.id] ?? enrollment.endedOn ?? ''} onChange={(event) => setEndedOnByEnrollment({ ...endedOnByEnrollment, [enrollment.id]: event.target.value })} /></label> <label>Đổi trạng thái<select aria-label={`Trạng thái ${item.fullName}`} value={enrollment.lifecycle} disabled={disabled} onChange={(event) => void changeLifecycle(enrollment, event.target.value)} {...field(studentErrors, 'lifecycle')}>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{(enrollment.lifecycleHistory ?? []).map((history) => <div key={history.id}>Chuyển từ {history.previousLifecycle ? lifecycleLabel[history.previousLifecycle] : 'Khởi tạo'} sang {lifecycleLabel[history.lifecycle]} ({history.effectiveFrom}{history.endedOn ? ` - ${history.endedOn}` : ''})</div>)}{studentErrors.lifecycle && <small id="lifecycle-error">{studentErrors.lifecycle}</small>}</div>)}</td></tr>) : <tr><td colSpan={4}>Năm học này chưa có học sinh.</td></tr>}</tbody></table></div>
    </>}
    {rename && <div role="dialog" aria-modal="true" aria-labelledby="rename-title"><form onSubmit={submitRename}><h3 id="rename-title">Đổi tên lớp</h3><label>Tên lớp<input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} {...field(renameErrors, 'name')} /></label>{renameErrors.name && <small id="name-error">{renameErrors.name}</small>}<button type="button" onClick={() => setRename(undefined)}>Hủy</button><button disabled={disabled}>Lưu tên lớp</button></form></div>}
  </section>;
}
