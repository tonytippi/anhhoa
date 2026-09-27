import { StrictMode, useEffect, useRef, useState, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, parentGet, parentMedia, type ParentContext, type Session } from './auth-session';
import './styles.css';
import './journal.css';

export type ParentSchool = { schoolId: string; schoolName: string; children: ParentContext['student'][] };
type Attendance = { studentId: string; studentDisplayName: string; date: string; status?: 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'NOT_RECORDED'; updatedAt: string | null; calendarLabel?: string };
type Journal = { studentId: string; studentDisplayName: string; journalDate: string; text: string; updatedAt: string; media: Array<{ id: string; contentType: string }> };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const thirtyDays = () => { const value = new Date(`${today()}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() - 29); return value.toISOString().slice(0, 10); };
const statusLabel = (status?: Attendance['status']) => status === 'PRESENT' ? 'Đã ghi nhận có mặt' : status === 'ABSENT' ? 'Vắng mặt' : status === 'ON_LEAVE' ? 'Đang nghỉ' : 'Trường chưa ghi nhận';

export function groupSchools(contexts: ParentContext[]): ParentSchool[] {
  const schools = new Map<string, ParentSchool>();
  for (const context of contexts) {
    const school = schools.get(context.schoolId) ?? { schoolId: context.schoolId, schoolName: context.schoolName, children: [] };
    if (!schools.has(context.schoolId)) schools.set(context.schoolId, school);
    if (!school.children.some((child) => child.id === context.student.id)) school.children.push(context.student);
  }
  return [...schools.values()];
}

function SignedOut({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  return <main className="auth-state"><p className="sr-only" aria-live="polite">Phiên đăng nhập đã kết thúc.</p><h1 ref={headingRef} tabIndex={-1}>PassionEdu</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a className="primary-button" href={googleLoginUrl}>Đăng nhập với Google</a></main>;
}

function SchoolChooser({ schools, onSelect, onLogout, headingRef }: { schools: ParentSchool[]; onSelect: (schoolId: string) => void; onLogout: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return <main className="auth-state chooser-state"><p className="sr-only" aria-live="polite">Chọn trường được phép để tiếp tục.</p><p className="eyebrow">CỔNG PHỤ HUYNH</p><h1 id="school-chooser-heading" ref={headingRef} tabIndex={-1}>Chọn trường để xem</h1><p>Chỉ các trường có liên kết phụ huynh đang hiệu lực được hiển thị.</p><section className="school-choices" aria-labelledby="school-chooser-heading"><ul>{schools.map((school) => <li key={school.schoolId}><button className="school-choice" onClick={() => onSelect(school.schoolId)}><strong>{school.schoolName}</strong><span>Chọn ngữ cảnh trường</span></button></li>)}</ul></section><button className="text-button" onClick={onLogout}>Đăng xuất</button></main>;
}

function ParentWorkspace({ school, canSwitch, onSwitch, onLogout, headingRef, onDenied }: { school: ParentSchool; canSwitch: boolean; onSwitch: () => void; onLogout: () => void; headingRef: RefObject<HTMLHeadingElement | null>; onDenied: () => void }) {
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({}); const [selected, setSelected] = useState<string | undefined>(undefined); const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined); const [journal, setJournal] = useState<Journal | null | undefined>(undefined); const [loading, setLoading] = useState(true); const [detailLoading, setDetailLoading] = useState(false); const [error, setError] = useState(false); const [imageUrl, setImageUrl] = useState<string | undefined>(undefined); const pageRequest = useRef<AbortController | undefined>(undefined); const mediaRequest = useRef<AbortController | undefined>(undefined); const generation = useRef(0); const denied = useRef(false); const image = useRef<string | undefined>(undefined);
  const clearImage = () => { mediaRequest.current?.abort(); if (image.current) URL.revokeObjectURL(image.current); image.current = undefined; setImageUrl(undefined); };
  const clear = () => { pageRequest.current?.abort(); clearImage(); generation.current += 1; setAttendance({}); setSelected(undefined); setSelectedDate(undefined); setJournal(undefined); };
  useEffect(() => { clear(); const request = new AbortController(); pageRequest.current = request; const id = generation.current; denied.current = false; setLoading(true); setError(false); void Promise.all(school.children.map(async (child) => { const result = await parentGet<Attendance[]>(`/api/parent/schools/${school.schoolId}/students/${child.id}/attendance?from=${thirtyDays()}&to=${today()}`, request.signal); if (request.signal.aborted || denied.current || id !== generation.current || result.kind === 'aborted') return; if (result.kind === 'auth' || result.kind === 'denied') { denied.current = true; request.abort(); onDenied(); return; } if (result.kind !== 'ok') return setError(true); setAttendance((current) => ({ ...current, [child.id]: result.data })); })).then(() => { if (!request.signal.aborted && !denied.current && id === generation.current) setLoading(false); }); return clear; }, [school.schoolId, school.children.map((child) => child.id).join(',')]);
  useEffect(() => { if (!selected || !selectedDate) return; clearImage(); pageRequest.current?.abort(); const request = new AbortController(); pageRequest.current = request; const id = ++generation.current; setDetailLoading(true); setJournal(undefined); setError(false); void parentGet<Journal | null>(`/api/parent/schools/${school.schoolId}/students/${selected}/daily-journal?journalDate=${selectedDate}`, request.signal).then((result) => { if (request.signal.aborted || id !== generation.current || result.kind === 'aborted') return; if (result.kind === 'auth' || result.kind === 'denied') return onDenied(); if (result.kind === 'error') setError(true); else setJournal(result.kind === 'ok' ? result.data : null); setDetailLoading(false); }); }, [selected, selectedDate, school.schoolId]);
  const openMedia = async (mediaId: string) => { mediaRequest.current?.abort(); const request = new AbortController(); mediaRequest.current = request; const id = generation.current; const result = await parentMedia(`/api/parent/schools/${school.schoolId}/daily-journal-media/${mediaId}`, request.signal); if (request.signal.aborted || id !== generation.current || result.kind === 'aborted') return; if (result.kind === 'auth' || result.kind === 'denied') return onDenied(); if (result.kind === 'ok') { clearImage(); image.current = URL.createObjectURL(result.data); setImageUrl(image.current); } else setError(true); };
  const current = selected ? attendance[selected] : undefined;
  useEffect(() => { if (selected && selectedDate) headingRef.current?.focus(); }, [selected, selectedDate, headingRef]);
  return <div className="parent-app"><aside className="desktop-sidebar" aria-label="Điều hướng phụ huynh"><div className="brand"><span className="brand-mark">P</span><span>PassionEdu<small>CỔNG PHỤ HUYNH</small></span></div><p className="nav-heading">THEO DÕI CON</p><button className="side-link active">Hôm nay</button><div className="sidebar-account"><button className="text-button" onClick={onLogout}>Đăng xuất</button></div></aside><main className="workspace-main"><header className="workspace-topbar"><span className="selected-school">Trường đang xem <strong>{school.schoolName}</strong></span>{canSwitch && <button className="text-button" onClick={onSwitch}>Đổi trường</button>}</header><section className="screen"><div className="screen-heading"><div><p className="eyebrow">CỔNG PHỤ HUYNH</p><h1 ref={headingRef} tabIndex={-1}>{selected ? school.children.find((child) => child.id === selected)?.fullName : 'Hôm nay của các con'}</h1><p>{selected ? `Ngày ${selectedDate ?? ''}` : `Những cập nhật phụ huynh cần biết từ ${school.schoolName}.`}</p></div></div>{selected ? <><button className="text-button" onClick={() => { clearImage(); setSelected(undefined); setSelectedDate(undefined); setJournal(undefined); }}>Quay lại Hôm nay</button><section className="panel"><h2>Lịch sử điểm danh</h2>{current?.map((day) => <button className="history-row" key={day.date} onClick={() => setSelectedDate(day.date)}><span><strong>{day.date}</strong><small>{day.calendarLabel ?? (day.updatedAt ? `Cập nhật ${new Date(day.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '')}</small></span>{day.status && <span className={`attendance-status attendance-${day.status.toLowerCase()}`}>{statusLabel(day.status)}</span>}</button>)}</section>{detailLoading && <p aria-live="polite">Đang tải nhận xét trong ngày...</p>}{error && <p role="alert">Không thể tải cập nhật. Vui lòng thử lại sau.</p>}{journal && <section className="panel"><h2>Nhận xét ngày {journal.journalDate}</h2><small>Cập nhật {new Date(journal.updatedAt).toLocaleString('vi-VN')}</small><p>{journal.text}</p>{journal.media.map((media) => <button className="secondary" key={media.id} onClick={() => openMedia(media.id)}>Xem ảnh trong ngày</button>)}{imageUrl && <img className="journal-image" src={imageUrl} alt="Ảnh trong ngày" />}</section>}{!detailLoading && journal === null && <p>Chưa có nhận xét trong ngày này.</p>}</> : <section className="panel" aria-labelledby="authorized-children"><div className="panel-header"><h2 id="authorized-children">Hôm nay</h2></div>{loading && <p aria-live="polite">Đang tải cập nhật của các bé...</p>}{error && <p role="alert">Không thể tải cập nhật. Vui lòng thử lại sau.</p>}<div className="child-switcher">{school.children.map((child) => { const day = attendance[child.id]?.at(-1); return <button key={child.id} className="child-chip active" onClick={() => { clearImage(); setSelected(child.id); setSelectedDate(day?.date); }}><strong>{child.fullName}</strong><small>{day?.calendarLabel ?? statusLabel(day?.status)}</small><span>Xem chi tiết ngày học</span></button>; })}</div></section>}</section></main></div>;
}

export function ParentShell() {
  const [session, setSession] = useState<Session>();
  const [schoolId, setSchoolId] = useState<string>();
  const [state, setState] = useState<'loading' | 'chooser' | 'workspace' | 'signed-out'>('loading');
  const request = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);
  const foregroundQueued = useRef(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const currentSchoolId = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  const signedOut = useRef(false);

  function clearProtectedState() {
    request.current?.abort();
    request.current = undefined;
    currentSchoolId.current = undefined;
    setSession(undefined);
    setSchoolId(undefined);
  }
  function applySession(next: Session | undefined, trigger: 'initial' | 'select' | 'foreground' | 'chooser', requestedSchoolId?: string, previousSchoolId?: string) {
    const schools = groupSchools(next?.schools ?? []);
    if (!next || schools.length === 0) { signedOut.current = true; setState('signed-out'); return; }
    setSession(next);
    if (trigger === 'select' && requestedSchoolId && schools.some((school) => school.schoolId === requestedSchoolId)) { currentSchoolId.current = requestedSchoolId; setSchoolId(requestedSchoolId); setState('workspace'); return; }
    if (trigger === 'initial' && schools.length === 1) { currentSchoolId.current = schools[0]!.schoolId; setSchoolId(schools[0]!.schoolId); setState('workspace'); return; }
    if (trigger === 'foreground' && previousSchoolId && schools.some((school) => school.schoolId === previousSchoolId)) { currentSchoolId.current = previousSchoolId; setSchoolId(previousSchoolId); setState('workspace'); return; }
    setState('chooser');
  }
  function refresh(trigger: 'initial' | 'select' | 'foreground' | 'chooser', requestedSchoolId?: string) {
    if (!mounted.current || (trigger === 'foreground' && signedOut.current)) return;
    signedOut.current = false;
    const previousSchoolId = currentSchoolId.current;
    clearProtectedState();
    setState('loading');
    const controller = new AbortController();
    request.current = controller;
    const id = ++requestId.current;
    void bootstrapSession(() => undefined, controller.signal).then((next) => { if (mounted.current && !signedOut.current && !controller.signal.aborted && id === requestId.current) applySession(next, trigger, requestedSchoolId, previousSchoolId); });
  }
  useEffect(() => {
    mounted.current = true;
    refresh('initial');
    const foreground = () => {
      if (document.visibilityState === 'hidden' || foregroundQueued.current) return;
      foregroundQueued.current = true;
      queueMicrotask(() => { foregroundQueued.current = false; if (mounted.current && !signedOut.current) refresh('foreground'); });
    };
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground);
    return () => { mounted.current = false; requestId.current += 1; window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); request.current?.abort(); };
  }, []);
  const signOut = () => { signedOut.current = true; requestId.current += 1; clearProtectedState(); setState('signed-out'); void logout(() => undefined); };
  useEffect(() => { if (state !== 'loading') heading.current?.focus(); }, [state, schoolId]);
  if (state === 'loading') return <main className="auth-state"><p className="sr-only" aria-live="polite">Đang xác thực phiên.</p><h1>PassionEdu</h1><p>Đang xác thực phiên...</p></main>;
  if (state === 'signed-out') return <SignedOut headingRef={heading} />;
  const schools = groupSchools(session?.schools ?? []);
  if (state === 'chooser') return <SchoolChooser schools={schools} onSelect={(nextSchoolId) => refresh('select', nextSchoolId)} onLogout={signOut} headingRef={heading} />;
  const selected = schools.find((school) => school.schoolId === schoolId);
  return selected ? <ParentWorkspace school={selected} canSwitch={schools.length > 1} onSwitch={() => refresh('chooser')} onLogout={signOut} headingRef={heading} onDenied={() => refresh('chooser')} /> : <SignedOut headingRef={heading} />;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
