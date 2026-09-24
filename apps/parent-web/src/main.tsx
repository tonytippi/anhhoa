import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, parentGet, parentMedia, type ParentContext, type Session } from './auth-session';
import './styles.css';
import './journal.css';

type Journal = { studentId: string; studentDisplayName: string; journalDate: string; text: string; updatedAt: string; media: Array<{ id: string; contentType: string }> };
type LoadState = Journal | null | 'loading' | 'error';

function ChildJournal({ context, refresh, deny, signOut }: { context: ParentContext; refresh: number; deny: () => void; signOut: () => void }) {
  const [journal, setJournal] = useState<LoadState>('loading');
  const [images, setImages] = useState<Record<string, string>>({});
  const request = useRef(0);
  const urls = useRef(new Set<string>());
  const clearImages = () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current.clear(); setImages({}); };
  useEffect(() => {
    const controller = new AbortController();
    const id = ++request.current;
    setJournal('loading'); clearImages();
    void parentGet<Journal | null>(`/api/parent/schools/${context.schoolId}/students/${context.student.id}/daily-journal`, controller.signal).then((value) => {
      if (controller.signal.aborted || id !== request.current) return;
      if (value.kind === 'ok') setJournal(value.data); else if (value.kind === 'auth') signOut(); else if (value.kind === 'denied') deny(); else setJournal('error');
    });
    return () => controller.abort();
  }, [context.schoolId, context.student.id, refresh]);
  useEffect(() => () => { request.current++; urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  async function viewImages() {
    if (!journal || journal === 'loading' || journal === 'error') return;
    const id = request.current;
    for (const media of journal.media) {
      if (images[media.id]) continue;
      const result = await parentMedia(`/api/parent/schools/${context.schoolId}/daily-journal-media/${media.id}`);
      if (id !== request.current) return;
      if (result.kind === 'auth') { signOut(); return; }
      if (result.kind === 'denied') { deny(); return; }
      if (result.kind !== 'ok') return;
      const blob = result.data;
      const url = URL.createObjectURL(blob); urls.current.add(url);
      setImages((current) => id === request.current ? { ...current, [media.id]: url } : current);
    }
  }
  if (journal === 'loading') return <p>Đang tải nhận xét hôm nay...</p>;
  if (journal === 'error') return <p className="muted">Không thể tải nhận xét lúc này.</p>;
  if (!journal) return <p className="muted">Hôm nay chưa có nhận xét.</p>;
  return <section aria-labelledby="journal-title"><div className="section-head"><h2 id="journal-title">Nhận xét hôm nay</h2><span className="muted">Cập nhật {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(journal.updatedAt))}</span></div><article className="journal-card"><p>{journal.text}</p>{journal.media.length > 0 && <><p className="muted">Ảnh trong ngày chỉ mở sau khi hệ thống xác nhận bạn còn quyền xem.</p><button className="secondary" onClick={() => void viewImages()}>Xem ảnh trong ngày</button><div className="journal-media">{journal.media.map((media) => images[media.id] && <img key={media.id} className="journal-image" src={images[media.id]} alt={`Ảnh trong ngày của ${journal.studentDisplayName}`} />)}</div></>}</article></section>;
}

export function ParentShell() {
  const [session, setSession] = useState<Session>(); const [resolved, setResolved] = useState(false); const [selected, setSelected] = useState<ParentContext>();
  const foregroundRequest = useRef(0); const [journalRefresh, setJournalRefresh] = useState(0);
  const deny = (context: ParentContext) => { setSelected(undefined); setSession((current) => current && { ...current, schools: current.schools.filter((item) => item.schoolId !== context.schoolId || item.student.id !== context.student.id) }); };
  const signOut = () => { setSelected(undefined); setSession(undefined); };
  useEffect(() => { const controller = new AbortController(); let current = true; void bootstrapSession(() => { if (current) setSession(undefined); }, controller.signal).then((next) => { if (current) { setSession(next); setResolved(true); if (next?.schools.length === 1) setSelected(next.schools[0]); } }); return () => { current = false; controller.abort(); }; }, []);
  useEffect(() => { const controller = new AbortController(); const id = ++foregroundRequest.current; const foreground = () => { if (!selected) return; void parentGet<Journal | null>(`/api/parent/schools/${selected.schoolId}/students/${selected.student.id}/daily-journal`, controller.signal).then((result) => { if (controller.signal.aborted || id !== foregroundRequest.current) return; if (result.kind === 'auth') signOut(); else if (result.kind === 'denied') deny(selected); else if (result.kind === 'ok' && result.data === null) setJournalRefresh((value) => value + 1); }); }; window.addEventListener('focus', foreground); return () => { controller.abort(); foregroundRequest.current++; window.removeEventListener('focus', foreground); }; }, [selected]);
  if (!resolved) return <main><h1>PassionEdu</h1><p>Đang xác thực phiên...</p></main>;
  if (!session || !session.schools.length) return <main><h1>PassionEdu</h1><p>Không còn quyền truy cập nội dung trẻ em.</p><a href={googleLoginUrl}>Đăng nhập với Google</a></main>;
  if (selected) return <main><header className="context-header"><button className="back" onClick={() => setSelected(undefined)}>‹ Trang chủ</button><span className="muted">{selected.schoolName}</span></header><h1>{selected.student.fullName}</h1><p className="muted">Lịch sử điểm danh theo ngày</p><ChildJournal key={`${selected.schoolId}-${selected.student.id}`} context={selected} refresh={journalRefresh} deny={() => deny(selected)} signOut={signOut} /><button onClick={() => void logout(signOut)}>Đăng xuất</button></main>;
  return <main><section className="parent-hero"><h1>Hôm nay</h1><p>Hôm nay của các con tại trường</p></section><section aria-labelledby="today"><div className="section-head"><h2 id="today">Hôm nay</h2></div><ul className="context-list">{session.schools.map((context) => <li key={`${context.schoolId}-${context.student.id}`}><button className="child-card" onClick={() => setSelected(context)}><strong>{context.student.fullName}</strong><span className="muted">{context.schoolName} · Xem ngày học và nhận xét →</span></button></li>)}</ul></section><button onClick={() => void logout(() => { setSelected(undefined); setSession(undefined); })}>Đăng xuất</button></main>;
}
const root = document.getElementById('root'); if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
