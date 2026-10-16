import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, hcmToday } from './api';
import type { Session } from './auth-session';
import { ClassDayWorkspace } from './class-day/class-day-workspace';
import { JournalsWorkspace } from './journals/journals-workspace';
import { MessagesWorkspace } from './messages/messages-workspace';
import { QueueWorkspace } from './queue/queue-workspace';

type School = { schoolId: string; schoolSlug: string; schoolName: string };
type Features = { dailyJournal?: boolean; handover?: boolean };
type Context = School & { navigation: Array<{ id: string; label: string }>; features?: Features };
export type TeacherClass = { classId: string; className: string; schoolYearName: string };
type RouteId = 'class-day' | 'queue' | 'journals' | 'messages';
export type Guard = { dirty: boolean; message?: string };
export type WorkspaceProps = { schoolId: string; classes: TeacherClass[]; classId: string; chooseClass: (classId: string) => void; features: Required<Features>; setGuard: (guard: Guard) => void; navigate: (path: string) => void; base: string };

const routes: Array<{ id: RouteId; path: string; label: string; navigation: string[] }> = [
  { id: 'class-day', path: '', label: 'Lớp hôm nay', navigation: ['attendance'] },
  { id: 'queue', path: '/queue', label: 'Hàng đợi lớp', navigation: ['overview'] },
  { id: 'journals', path: '/journals', label: 'Nhận xét trong ngày', navigation: ['daily-journal'] },
  { id: 'messages', path: '/messages', label: 'Tin nhắn phụ huynh', navigation: ['messages'] },
];
const isSchool = (value: unknown): value is School => Boolean(value && typeof value === 'object' && typeof (value as School).schoolId === 'string' && typeof (value as School).schoolSlug === 'string' && typeof (value as School).schoolName === 'string');
const isContext = (value: unknown): value is Context => isSchool(value) && Array.isArray((value as Context).navigation) && (value as Context).navigation.every((item) => item && typeof item.id === 'string' && typeof item.label === 'string');
const parsePath = (pathname: string) => {
  const match = /^\/schools\/([^/]+)(\/queue|\/journals|\/messages)?\/?$/.exec(pathname);
  if (!match) return undefined;
  return { schoolSlug: match[1]!, route: (routes.find((route) => route.path === (match[2] ?? ''))?.id ?? 'class-day') as RouteId };
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]!.toLocaleUpperCase('vi')).join('');
const classKey = (schoolId: string) => `passionedu.teacher.class.${schoolId}`;

export function SchoolContext({ clear, session, onLogout }: { clear: () => void; session?: Session; onLogout?: () => void }) {
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [classes, setClasses] = useState<TeacherClass[]>();
  const [teacherName, setTeacherName] = useState('');
  const [classId, setClassId] = useState('');
  const [route, setRoute] = useState<RouteId>('class-day');
  const [error, setError] = useState('');
  const [leaveTo, setLeaveTo] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setPathVersion] = useState(0);
  const guard = useRef<Guard>({ dirty: false });
  const committed = useRef('/');
  const heading = useRef<HTMLHeadingElement>(null);
  const loadVersion = useRef(0);

  const visible = context ? routes.filter((item) => item.navigation.some((id) => context.navigation.some((entry) => entry.id === id)) && !(item.id === 'journals' && context.features?.dailyJournal === false)) : [];
  const features: Required<Features> = { dailyJournal: context?.features?.dailyJournal !== false, handover: context?.features?.handover !== false && Boolean(context?.navigation.some((item) => item.id === 'handover')) };
  const setGuard = useCallback((next: Guard) => { guard.current = next; }, []);

  const loadSchools = async () => {
    const result = await apiGet<unknown>('/api/teacher/schools', 'Không thể tải danh sách trường.');
    if (!result.ok) { if (result.error.status === 401) clear(); else setError(result.error.message); return; }
    if (!Array.isArray(result.data) || !result.data.every(isSchool)) { setError('Không thể tải danh sách trường.'); return; }
    setSchools(result.data);
  };
  const goHome = (replace = true) => {
    loadVersion.current += 1;
    guard.current = { dirty: false };
    setContext(undefined); setClasses(undefined); setClassId('');
    committed.current = '/';
    window.history[replace ? 'replaceState' : 'pushState'](null, '', '/');
    setPathVersion((value) => value + 1);
  };
  const loadSchool = async (school: School) => {
    const version = ++loadVersion.current;
    setContext(undefined); setClasses(undefined); setError('');
    const result = await apiGet<unknown>(`/api/teacher/schools/${school.schoolId}`, 'Không thể tải ngữ cảnh trường.');
    if (version !== loadVersion.current) return;
    if (!result.ok) { if (result.error.status === 401) { clear(); return; } if ([403, 404].includes(result.error.status)) { goHome(); return; } setError(result.error.message); return; }
    if (!isContext(result.data) || result.data.schoolId !== school.schoolId || result.data.schoolSlug !== school.schoolSlug) { goHome(); return; }
    const next = result.data;
    const assigned = await apiGet<{ teacherName: string; classes: TeacherClass[] }>(`/api/teacher/schools/${school.schoolId}/classes?date=${hcmToday()}`, 'Không thể tải lớp được phân công.');
    if (version !== loadVersion.current) return;
    const list = assigned.ok ? assigned.data.classes : [];
    const remembered = localStorage.getItem(classKey(school.schoolId));
    const requested = new URLSearchParams(window.location.search).get('classId');
    setContext(next);
    setClasses(list);
    setTeacherName(assigned.ok ? assigned.data.teacherName : '');
    setClassId(list.find((item) => item.classId === requested)?.classId ?? list.find((item) => item.classId === remembered)?.classId ?? list[0]?.classId ?? '');
  };
  const route_ = () => {
    if (!schools) return;
    const target = parsePath(window.location.pathname);
    if (!target) { if (context) goHome(); return; }
    const school = schools.find((item) => item.schoolSlug === target.schoolSlug || item.schoolId === target.schoolSlug);
    if (!school) { goHome(); return; }
    setRoute(target.route);
    committed.current = `${window.location.pathname}${window.location.search}`;
    setMenuOpen(false);
    if (school.schoolId !== context?.schoolId) void loadSchool(school);
  };
  const navigate = (path: string) => {
    if (guard.current.dirty) { setLeaveTo(path); return; }
    window.history.pushState(null, '', path);
    route_();
  };

  useEffect(() => { void loadSchools(); }, []);
  useEffect(() => {
    route_();
    const onPop = () => {
      if (guard.current.dirty) { setLeaveTo(`${window.location.pathname}${window.location.search}`); window.history.pushState(null, '', committed.current); return; }
      route_();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [schools, context?.schoolId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (guard.current.dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [context?.schoolId]);
  useEffect(() => { if (context && visible.length && !visible.some((item) => item.id === route)) navigate(`/schools/${context.schoolSlug}${visible[0]!.path}`); }, [context, route]);

  const chooseClass = (next: string) => {
    if (!context || next === classId) return;
    if (guard.current.dirty && !window.confirm(`${guard.current.message ?? 'Thay đổi chưa lưu.'} Vẫn đổi lớp?`)) return;
    guard.current = { dirty: false };
    setClassId(next);
    localStorage.setItem(classKey(context.schoolId), next);
  };

  if (!schools) return <div className="teacher-loading" role={error ? 'alert' : 'status'}>{error || 'Đang tải ngữ cảnh trường...'}</div>;
  if (!context) {
    const target = parsePath(window.location.pathname);
    if (target && !error) return <div className="teacher-loading" role="status">Đang tải ngữ cảnh trường...</div>;
    return (
      <main className="teacher-home" id="main">
        <section className="teacher-home-card">
          <p className="teacher-brand"><b>P</b> PassionEdu</p>
          <p className="teacher-role">CỔNG GIÁO VIÊN</p>
          {error && <p className="notice warning" role="alert">{error}</p>}
          {schools.length ? (
            <>
              <h1>Chọn trường làm việc</h1>
              <p className="muted">Chỉ hiển thị các trường đã cấp quyền cho tài khoản này.</p>
              <ul className="school-choices" aria-label="Chọn trường">
                {schools.map((school) => (
                  <li key={school.schoolId}>
                    <button type="button" onClick={() => navigate(`/schools/${school.schoolSlug}`)}>
                      <span>{school.schoolName}</span>
                      <span aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h1>Chưa có trường được cấp quyền</h1>
              <p className="muted">Không có trường nào đang cấp quyền cho tài khoản này. Liên hệ quản trị viên của trường.</p>
            </>
          )}
          {onLogout && <button type="button" className="button secondary" onClick={onLogout}>Đăng xuất</button>}
        </section>
      </main>
    );
  }

  const base = `/schools/${context.schoolSlug}`;
  const name = session?.displayName || teacherName || session?.email || '';
  const props: WorkspaceProps = { schoolId: context.schoolId, classes: classes ?? [], classId, chooseClass, features, setGuard, navigate, base };
  return (
    <div className="teacher-shell">
      <aside className="teacher-sidebar" id="teacher-navigation" aria-label="Điều hướng giáo viên" data-open={menuOpen}>
        <p className="teacher-brand"><b>P</b> PassionEdu</p>
        <p className="teacher-role">CỔNG GIÁO VIÊN</p>
        <nav aria-label="Điều hướng trường">
          <p className="teacher-nav-label">CÔNG VIỆC HÔM NAY</p>
          {visible.map((item) => (
            <a key={item.id} className={`teacher-link${item.id === route ? ' active' : ''}`} aria-current={item.id === route ? 'page' : undefined} href={`${base}${item.path}`} onClick={(event) => { event.preventDefault(); navigate(`${base}${item.path}`); }}>{item.label}</a>
          ))}
        </nav>
        {onLogout && <button type="button" className="teacher-link teacher-logout" onClick={onLogout}>Đăng xuất</button>}
      </aside>
      {menuOpen && <div className="teacher-scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
      <main className="teacher-workspace" id="main">
        <header className="teacher-topbar">
          <button className="button secondary teacher-menu" type="button" aria-controls="teacher-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
          <a className="teacher-context" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{context.schoolName}{classes?.[0] ? ` · Năm học ${classes[0].schoolYearName.replace(/^Năm học\s*/i, '')}` : ''} · Về trang chủ</a>
          <div className="teacher-avatar"><span>{name}</span><i>{session?.pictureUrl ? <img src={session.pictureUrl} alt="" referrerPolicy="no-referrer" /> : initials(name)}</i></div>
        </header>
        <h1 className="sr-only" ref={heading} tabIndex={-1}>PassionEdu - Giáo viên - {context.schoolName}</h1>
        {!classes ? <p className="teacher-loading" role="status">Đang tải lớp được phân công...</p>
          : !classes.length ? <div className="empty"><h2>Chưa được phân công lớp</h2><p className="muted">Hôm nay bạn chưa có lớp được phân công hiệu lực. Liên hệ quản trị viên của trường nếu cần thay đổi.</p></div>
            : route === 'class-day' ? <ClassDayWorkspace key={context.schoolId} {...props} />
              : route === 'queue' ? <QueueWorkspace key={context.schoolId} {...props} />
                : route === 'journals' ? <JournalsWorkspace key={`${context.schoolId}-${classId}`} {...props} />
                  : <MessagesWorkspace key={`${context.schoolId}-${classId}`} {...props} />}
      </main>
      {leaveTo && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-leave-title">
            <h2 id="teacher-leave-title">Rời không gian làm việc?</h2>
            <p>{guard.current.message ?? 'Thay đổi chưa lưu sẽ không được tự lưu.'}</p>
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setLeaveTo(undefined)}>Ở lại</button>
              <button type="button" className="button danger" onClick={() => { const next = leaveTo; setLeaveTo(undefined); guard.current = { dirty: false }; window.history.pushState(null, '', next); if (next === '/') goHome(false); else route_(); }}>Bỏ thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Shared Class picker: one assigned Class shows as text, several as a select kept per School.
export function ClassPicker({ classes, classId, chooseClass }: Pick<WorkspaceProps, 'classes' | 'classId' | 'chooseClass'>) {
  if (classes.length < 2) return null;
  return (
    <label className="class-picker">
      <span>Lớp</span>
      <select value={classId} onChange={(event) => chooseClass(event.target.value)}>
        {classes.map((item) => <option key={item.classId} value={item.classId}>{item.className}</option>)}
      </select>
    </label>
  );
}
