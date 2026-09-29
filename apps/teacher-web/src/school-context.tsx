import { useEffect, useRef, useState } from 'react';
import { AttendanceWorkspace } from './attendance/attendance-workspace';
import { HandoverWorkspace } from './handover/handover-workspace';
import { DailyJournalWorkspace } from './daily-journal/daily-journal-workspace';
import { OperationalQueueWorkspace } from './attendance/operational-queue-workspace';

type School = { schoolId: string; schoolSlug: string; schoolName: string };
type Context = School & { navigation: Array<{ id: string; label: string }> };
type Destination = { schoolSlug: string };
type WorkspaceStatus = { dirty: boolean; pending: boolean; reconcile: () => Promise<void> };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const denied = (status: number) => [401, 403, 404].includes(status);
const destinationFromPath = (pathname: string): Destination | undefined => {
  const match = /^\/schools\/([^/]+)$/.exec(pathname);
  return match ? { schoolSlug: match[1]! } : undefined;
};
const pathFor = (destination: Destination) => `/schools/${destination.schoolSlug}`;
const isSchool = (value: unknown): value is School => Boolean(value && typeof value === 'object' && typeof (value as School).schoolId === 'string' && typeof (value as School).schoolSlug === 'string' && typeof (value as School).schoolName === 'string');
const isContext = (value: unknown): value is Context => isSchool(value) && Array.isArray((value as Context).navigation) && (value as Context).navigation.every((item) => item && typeof item.id === 'string' && typeof item.label === 'string');

export function SchoolContext({ clear }: { clear: () => void }) {
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [attendanceStatus, setAttendanceStatus] = useState<WorkspaceStatus>();
  const [handoverStatus, setHandoverStatus] = useState<WorkspaceStatus>();
  const [journalStatus, setJournalStatus] = useState<WorkspaceStatus>();
  const [leaveTo, setLeaveTo] = useState<string>();
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const committed = useRef<string | undefined>(undefined);

  const clearContext = () => {
    loadVersion.current += 1;
    committed.current = undefined;
    if (mounted.current) { setContext(undefined); setAttendanceStatus(undefined); setHandoverStatus(undefined); setJournalStatus(undefined); setLeaveTo(undefined); }
  };
  const chooser = async () => {
    const response = await fetch(`${apiUrl}/api/teacher/schools`, { credentials: 'include' });
    if (response.status === 401) { clearContext(); clear(); return; }
    if (!response.ok) throw new Error('Không thể tải danh sách trường.');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data) || !payload.data.every(isSchool)) throw new Error('Không thể tải danh sách trường.');
    if (mounted.current) setSchools(payload.data);
  };
  const safeHome = () => { clearContext(); window.history.replaceState(null, '', '/'); void chooser().catch((cause: Error) => setError(cause.message)); };
  const load = async (destination: Destination, school: School) => {
    clearContext();
    const version = ++loadVersion.current;
    const response = await fetch(`${apiUrl}/api/teacher/schools/${school.schoolId}`, { credentials: 'include' });
    if (!mounted.current || version !== loadVersion.current) return;
    if (response.status === 401) { clearContext(); clear(); return; }
    if (denied(response.status)) { safeHome(); return; }
    if (!response.ok) throw new Error('Không thể tải ngữ cảnh trường.');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !isContext(payload.data)) { safeHome(); return; }
    const next = payload.data;
    if (next.schoolId !== school.schoolId || next.schoolSlug !== school.schoolSlug) { safeHome(); return; }
    setContext(next);
    committed.current = pathFor(destination);
    if (window.location.pathname !== pathFor(destination)) window.history.replaceState(null, '', pathFor(destination));
  };
  const requestPath = (path: string) => {
    if (context && (attendanceStatus?.dirty || attendanceStatus?.pending || handoverStatus?.dirty || handoverStatus?.pending || journalStatus?.dirty || journalStatus?.pending)) { setLeaveTo(path); return; }
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    mounted.current = true;
    void chooser().catch((cause: Error) => setError(cause.message));
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!schools) return;
    const route = () => {
      const destination = destinationFromPath(window.location.pathname);
      if (!destination) { if (context && (attendanceStatus?.dirty || attendanceStatus?.pending || handoverStatus?.dirty || handoverStatus?.pending || journalStatus?.dirty || journalStatus?.pending)) { setLeaveTo(window.location.pathname); return; } clearContext(); return; }
      const school = schools.find((item) => item.schoolSlug === destination.schoolSlug || item.schoolId === destination.schoolSlug);
      if (!school) { safeHome(); return; }
      if (school.schoolId === context?.schoolId) return;
      if (context && (attendanceStatus?.dirty || attendanceStatus?.pending || handoverStatus?.dirty || handoverStatus?.pending || journalStatus?.dirty || journalStatus?.pending)) { setLeaveTo(window.location.pathname); return; }
      if (school.schoolId !== destination.schoolSlug) window.history.replaceState(null, '', pathFor({ schoolSlug: school.schoolSlug }));
      void load({ schoolSlug: school.schoolSlug }, school).catch((cause: Error) => setError(cause.message));
    };
    route();
    window.addEventListener('popstate', route);
    return () => window.removeEventListener('popstate', route);
  }, [schools, context?.schoolId, attendanceStatus, handoverStatus, journalStatus]);
  useEffect(() => { heading.current?.focus(); }, [context?.schoolId]);

  if (!schools) return <p role={error ? 'alert' : undefined}>{error || 'Đang tải ngữ cảnh trường...'}</p>;
  if (!schools.length) return <section><h1>Chưa có trường được cấp quyền</h1><p>Không có trường nào đang cấp quyền cho tài khoản này.</p></section>;
  return <section>
    {!context && <label>Chọn trường <select aria-label="Chọn trường" value="" onChange={(event) => { const school = schools.find((item) => item.schoolId === event.target.value); if (school) requestPath(pathFor({ schoolSlug: school.schoolSlug })); }}><option value="" disabled>Chọn trường</option>{schools.map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></label>}
    {context && <><header><p>Trường đang làm việc: <strong>{context.schoolName}</strong></p><button type="button" onClick={() => requestPath('/')}>Về trang chủ</button></header><h1 ref={heading} tabIndex={-1}>PassionEdu - Giáo viên - {context.schoolName}</h1><nav aria-label="Điều hướng trường">{context.navigation.filter((item) => item.id !== 'access').map((item) => <span key={item.id}>{item.label} </span>)}</nav>{context.navigation.some((item) => item.id === 'overview') && <OperationalQueueWorkspace schoolId={context.schoolId} denied={safeHome} />}{context.navigation.some((item) => item.id === 'attendance') && <AttendanceWorkspace schoolId={context.schoolId} onStatusChange={setAttendanceStatus} />}{context.navigation.some((item) => item.id === 'handover') && <HandoverWorkspace schoolId={context.schoolId} onStatusChange={setHandoverStatus} />}{context.navigation.some((item) => item.id === 'daily-journal') && <DailyJournalWorkspace schoolId={context.schoolId} onStatusChange={setJournalStatus} />}</>}
    {leaveTo && <><div className="dialog-backdrop" /><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-leave-title"><h2 id="teacher-leave-title">Rời không gian làm việc?</h2><p>Thay đổi chưa gửi sẽ không được tự lưu.</p><div className="dialog-actions"><button onClick={() => { setLeaveTo(undefined); if (committed.current) window.history.replaceState(null, '', committed.current); }}>Ở lại</button>{attendanceStatus?.pending || handoverStatus?.pending || journalStatus?.pending ? <button onClick={() => void Promise.all([attendanceStatus, handoverStatus, journalStatus].filter((status): status is WorkspaceStatus => Boolean(status?.pending)).map((status) => status.reconcile()))}>Đối soát thao tác</button> : <button className="danger-action" onClick={() => { const next = leaveTo; clearContext(); window.history.pushState(null, '', next); window.dispatchEvent(new PopStateEvent('popstate')); }}>Bỏ thay đổi</button>}</div></div></>}
  </section>;
}
