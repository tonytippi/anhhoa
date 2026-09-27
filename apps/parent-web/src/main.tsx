import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, type ParentContext, type Session } from './auth-session';
import './styles.css';
import './journal.css';

export type ParentSchool = { schoolId: string; schoolName: string; children: ParentContext['student'][] };

export function groupSchools(contexts: ParentContext[]): ParentSchool[] {
  const schools = new Map<string, ParentSchool>();
  for (const context of contexts) {
    const school = schools.get(context.schoolId) ?? { schoolId: context.schoolId, schoolName: context.schoolName, children: [] };
    if (!schools.has(context.schoolId)) schools.set(context.schoolId, school);
    if (!school.children.some((child) => child.id === context.student.id)) school.children.push(context.student);
  }
  return [...schools.values()];
}

function SignedOut() {
  return <main className="auth-state"><h1>PassionEdu</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a className="primary-button" href={googleLoginUrl}>Đăng nhập với Google</a></main>;
}

function SchoolChooser({ schools, onSelect, onLogout }: { schools: ParentSchool[]; onSelect: (schoolId: string) => void; onLogout: () => void }) {
  return <main className="auth-state chooser-state"><p className="eyebrow">CỔNG PHỤ HUYNH</p><h1>Chọn trường để xem</h1><p>Chỉ các trường có liên kết phụ huynh đang hiệu lực được hiển thị.</p><div className="school-choices" aria-label="Danh sách trường được phép">{schools.map((school) => <button key={school.schoolId} className="school-choice" onClick={() => onSelect(school.schoolId)}><strong>{school.schoolName}</strong><span>{school.children.length === 1 ? `Theo dõi ${school.children[0]!.fullName}` : `Theo dõi ${school.children.length} bé`}</span></button>)}</div><button className="text-button" onClick={onLogout}>Đăng xuất</button></main>;
}

function ParentWorkspace({ school, canSwitch, onSwitch, onLogout }: { school: ParentSchool; canSwitch: boolean; onSwitch: () => void; onLogout: () => void }) {
  return <div className="parent-app"><aside className="desktop-sidebar" aria-label="Điều hướng phụ huynh"><div className="brand"><span className="brand-mark">P</span><span>PassionEdu<small>CỔNG PHỤ HUYNH</small></span></div><p className="nav-heading">THEO DÕI CON</p><button className="side-link active">Hôm nay</button><div className="sidebar-account"><button className="text-button" onClick={onLogout}>Đăng xuất</button></div></aside><main className="workspace-main"><header className="workspace-topbar"><span className="selected-school">Trường đang xem <strong>{school.schoolName}</strong></span>{canSwitch && <button className="text-button" onClick={onSwitch}>Đổi trường</button>}</header><section className="screen" data-od-id="parent-home"><div className="screen-heading"><div><p className="eyebrow">CỔNG PHỤ HUYNH</p><h1 tabIndex={-1}>Hôm nay của các con</h1><p>Những cập nhật phụ huynh cần biết từ {school.schoolName}.</p></div></div><section className="panel" aria-labelledby="authorized-children"><div className="panel-header"><h2 id="authorized-children">Các bé được theo dõi</h2></div><div className="child-switcher">{school.children.map((child) => <article key={child.id} className="child-chip active"><strong>{child.fullName}</strong><small>Thông tin được tải sau khi hệ thống xác nhận quyền xem.</small></article>)}</div></section></section></main></div>;
}

export function ParentShell() {
  const [session, setSession] = useState<Session>();
  const [schoolId, setSchoolId] = useState<string>();
  const [state, setState] = useState<'loading' | 'chooser' | 'workspace' | 'signed-out'>('loading');
  const request = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);

  function clearProtectedState() {
    request.current?.abort();
    request.current = undefined;
    setSession(undefined);
    setSchoolId(undefined);
  }
  function applySession(next: Session | undefined, requestedSchoolId?: string) {
    const schools = groupSchools(next?.schools ?? []);
    if (!next || schools.length === 0) { setState('signed-out'); return; }
    setSession(next);
    if (requestedSchoolId && schools.some((school) => school.schoolId === requestedSchoolId)) { setSchoolId(requestedSchoolId); setState('workspace'); return; }
    if (schools.length === 1) { setSchoolId(schools[0]!.schoolId); setState('workspace'); return; }
    setState('chooser');
  }
  function refresh(requestedSchoolId?: string) {
    clearProtectedState();
    setState('loading');
    const controller = new AbortController();
    request.current = controller;
    const id = ++requestId.current;
    void bootstrapSession(() => undefined, controller.signal).then((next) => { if (!controller.signal.aborted && id === requestId.current) applySession(next, requestedSchoolId); });
  }
  useEffect(() => {
    refresh();
    const foreground = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground);
    return () => { window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); request.current?.abort(); };
  }, []);
  const signOut = () => { clearProtectedState(); setState('signed-out'); void logout(() => undefined); };
  if (state === 'loading') return <main className="auth-state"><h1>PassionEdu</h1><p>Đang xác thực phiên...</p></main>;
  if (state === 'signed-out') return <SignedOut />;
  const schools = groupSchools(session?.schools ?? []);
  if (state === 'chooser') return <SchoolChooser schools={schools} onSelect={(nextSchoolId) => refresh(nextSchoolId)} onLogout={signOut} />;
  const selected = schools.find((school) => school.schoolId === schoolId);
  return selected ? <ParentWorkspace school={selected} canSwitch={schools.length > 1} onSwitch={() => refresh()} onLogout={signOut} /> : <SignedOut />;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
