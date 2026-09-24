import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, parentGet, parentMedia, type ParentContext, type Session } from './auth-session';
import './styles.css';
import './journal.css';

type View = 'home' | 'child' | 'inbox' | 'payment' | 'contact';

function navLabel(view: View) {
  return { home: 'Hôm nay', child: 'Các bé', inbox: 'Thông báo', payment: 'Khoản nộp', contact: 'Liên hệ' }[view];
}

function ParentWorkspace({ contexts, onLogout, onDenied }: { contexts: ParentContext[]; onLogout: () => void; onDenied: (context: ParentContext) => void }) {
  const [view, setView] = useState<View>('home');
  const [activeContext, setActiveContext] = useState(contexts[0]!);
  const [contactType, setContactType] = useState<'general' | 'today' | 'medicine'>('general');
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState([{ title: 'Gia đình sẽ đón bé lúc 16:00', state: 'Đã xem', detail: 'Nhà trường đã xem lúc 14:18. Cô sẽ hỗ trợ chuẩn bị đồ dùng của bé.', time: 'HÔM NAY' }]);
  const childName = activeContext.student.fullName;

  function changeContext(context: ParentContext) { setActiveContext(context); setView('home'); }
  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = message.trim();
    if (!title) return;
    setRequests((current) => [{ title, state: 'Chờ xem', detail: 'Nhà trường sẽ xác nhận khi đã xem yêu cầu của bạn.', time: 'VỪA GỬI' }, ...current]);
    setMessage('');
  }

  return <div className="parent-app">
    <aside className="desktop-sidebar" aria-label="Điều hướng phụ huynh">
      <div className="brand"><span className="brand-mark">P</span><span>PassionEdu<small>CỔNG PHỤ HUYNH</small></span></div>
      <p className="nav-heading">THEO DÕI CON</p>
      {(['home', 'child'] as View[]).map((item) => <button key={item} className={`side-link ${view === item ? 'active' : ''}`} onClick={() => setView(item)}>{navLabel(item)}</button>)}
      <p className="nav-heading">CẬP NHẬT & HỖ TRỢ</p>
      {(['inbox', 'payment', 'contact'] as View[]).map((item) => <button key={item} className={`side-link ${view === item ? 'active' : ''}`} onClick={() => setView(item)}>{navLabel(item)}{item === 'inbox' && <span className="unread">2</span>}</button>)}
      <div className="sidebar-account"><span className="avatar">LH</span><div><strong>Lan Hương</strong><small>Phụ huynh</small></div><button className="text-button" onClick={onLogout}>Đăng xuất</button></div>
    </aside>
    <main className="workspace-main">
      <header className="workspace-topbar">
        <label className="school-switcher">Trường đang xem<select value={`${activeContext.schoolId}-${activeContext.student.id}`} onChange={(event) => { const next = contexts.find((context) => `${context.schoolId}-${context.student.id}` === event.target.value); if (next) changeContext(next); }}>
          {contexts.map((context) => <option key={`${context.schoolId}-${context.student.id}`} value={`${context.schoolId}-${context.student.id}`}>{context.schoolName} · {context.student.fullName}</option>)}
        </select></label>
        <span className="updated">Cập nhật lúc 15:42 hôm nay</span>
      </header>

      {view === 'home' && <section className="screen" data-od-id="parent-home"><div className="screen-heading"><div><p className="eyebrow">THỨ BẢY, 05/09/2026</p><h1>Hôm nay của các con</h1><p>Những cập nhật phụ huynh cần biết từ {activeContext.schoolName}.</p></div></div><div className="child-switcher">{contexts.map((context) => <button key={`${context.schoolId}-${context.student.id}`} className={context.student.id === activeContext.student.id ? 'child-chip active' : 'child-chip'} onClick={() => changeContext(context)}><strong>{context.student.fullName}</strong><small>Chạm để xem thông tin</small></button>)}</div><div className="home-grid"><section className="panel" data-od-id="today-status"><div className="panel-header"><h2>Tình hình trong ngày</h2><button className="text-button" onClick={() => setView('child')}>Xem ngày học</button></div><article className="status-row"><div><strong>{childName}</strong><span>Mầm 3-4 tuổi</span></div><span className="badge success">Có mặt</span><div><strong>Đã nhận trẻ</strong><span>07:38</span></div></article></section><aside className="notice-card"><h2>Cần biết</h2><p><strong>Nhà trường chưa ghi nhận vắng mặt</strong> không đồng nghĩa bé nghỉ học. Trạng thái sẽ xuất hiện khi nhà trường cập nhật.</p><button className="text-button" onClick={() => setView('inbox')}>Xem thông báo</button></aside></div><section className="panel activity-panel"><div className="activity"><p className="eyebrow">HÔM NAY · {childName.toUpperCase()}</p><h2>Nhận xét trong ngày</h2><p>Hôm nay bé tham gia tích cực trong giờ xếp hình, ăn tốt và tự cất đồ dùng sau khi chơi.</p><button className="text-button" onClick={() => setView('child')}>Xem nhật ký</button></div><div className="payment-summary"><p className="eyebrow">KHOẢN CẦN THANH TOÁN</p><h2>Học phí tháng 09/2026</h2><p className="amount">3.200.000đ</p><p>Hạn thanh toán: 10/09/2026</p><button className="secondary-button" onClick={() => setView('payment')}>Xem hướng dẫn thanh toán</button></div></section></section>}

      {view === 'child' && <section className="screen" data-od-id="parent-child"><div className="screen-heading"><div><p className="eyebrow">THÔNG TIN THEO TỪNG BÉ</p><h1>{childName}</h1><p>Điểm danh, nhận xét và đơn xin nghỉ của bé.</p></div></div><div className="detail-grid"><aside className="panel child-menu"><strong>{childName}</strong><button className="active">Hôm nay</button><button>Điểm danh</button><button>Nhận xét</button><button>Đơn xin nghỉ</button></aside><section className="panel daily-detail"><p className="eyebrow">THỨ BẢY, 05/09/2026</p><h2>Ngày học của {childName}</h2><div className="timeline"><div><time>07:38</time><p><strong>Đã nhận trẻ</strong><br />Nhà trường đã ghi nhận bé đến trường.</p></div><div><time>15:42</time><p><strong>Nhận xét trong ngày</strong><br />Nhận xét hiện hành đã được giáo viên gửi đến phụ huynh.</p></div><div><time>Chưa có</time><p><strong>Thông tin bàn giao cuối ngày</strong><br />Sẽ hiển thị sau khi nhà trường hoàn tất bàn giao.</p></div></div><ChildJournal key={`${activeContext.schoolId}-${activeContext.student.id}`} context={activeContext} refresh={0} deny={() => onDenied(activeContext)} signOut={onLogout} /></section></div></section>}

      {view === 'inbox' && <section className="screen" data-od-id="parent-inbox"><div className="screen-heading"><div><p className="eyebrow">CẬP NHẬT TỪ NHÀ TRƯỜNG</p><h1>Thông báo</h1><p>Thông báo dẫn đến đúng bé và ngày học liên quan.</p></div><button className="secondary-button">Đánh dấu đã đọc</button></div><section className="panel message-list"><article><span className="message-dot" /><div><h2>Nhận xét của {childName} đã sẵn sàng</h2><p>Nhà trường đã gửi nhận xét ngày 05/09/2026.</p><button className="text-button" onClick={() => setView('child')}>Mở nhận xét</button></div><time>15:42</time></article><article><span className="message-dot" /><div><h2>Đã ghi nhận {childName} đến trường</h2><p>Điểm danh ngày 05/09/2026 được cập nhật lúc 07:38.</p></div><time>07:38</time></article></section></section>}

      {view === 'payment' && <section className="screen" data-od-id="parent-payment"><div className="screen-heading"><div><p className="eyebrow">KHOẢN PHẢI NỘP · {childName.toUpperCase()}</p><h1>Học phí tháng 09/2026</h1><p>Khoản phải nộp do nhà trường phát hành.</p></div><span className="badge warning">Còn phải nộp</span></div><div className="payment-grid"><section className="panel"><table><tbody><tr><td>Học phí tháng 09/2026</td><td>2.800.000đ</td></tr><tr><td>Tiền ăn</td><td>400.000đ</td></tr><tr className="total"><td>Tổng số phải nộp</td><td>3.200.000đ</td></tr></tbody></table><p className="quiet-note">Sau khi chuyển khoản, nhà trường sẽ đối soát và cập nhật kết quả. PassionEdu không có thao tác tự xác nhận thanh toán.</p></section><aside className="panel"><p className="eyebrow">HƯỚNG DẪN THANH TOÁN</p><h2>Chuyển khoản theo thông tin dưới đây</h2><dl><dt>NGÂN HÀNG</dt><dd>Vietcombank</dd><dt>SỐ TÀI KHOẢN</dt><dd>0123 456 789</dd><dt>NỘI DUNG</dt><dd>AH PT-2026-09-018</dd></dl></aside></div></section>}

      {view === 'contact' && <section className="screen" data-od-id="parent-contact"><div className="screen-heading"><div><p className="eyebrow">TRAO ĐỔI VỚI NHÀ TRƯỜNG</p><h1>Liên hệ nhà trường</h1><p>Gửi việc cần nhà trường biết về {childName} và theo dõi xác nhận tại một nơi.</p></div></div><div className="contact-grid"><section className="panel contact-compose" data-od-id="contact-compose"><h2>Bạn cần trao đổi việc gì?</h2><p>Chọn loại việc để nhà trường chuyển đúng người phụ trách.</p><div className="contact-types">{([{ id: 'general', label: 'Nhắn nhà trường', help: 'Trao đổi chung về lịch sinh hoạt.' }, { id: 'today', label: 'Báo thay đổi hôm nay', help: 'Thông tin cô cần biết trước giờ đón hoặc trả trẻ.' }, { id: 'medicine', label: 'Dặn thuốc', help: 'Yêu cầu có quy trình y tế riêng.' }] as const).map((item) => <button key={item.id} className={contactType === item.id ? 'contact-type active' : 'contact-type'} onClick={() => setContactType(item.id)}><strong>{item.label}</strong><small>{item.help}</small></button>)}</div>{contactType === 'medicine' ? <div className="medical-warning"><h3>Dặn thuốc cần quy trình riêng</h3><p>Để bảo đảm an toàn cho trẻ, yêu cầu dùng thuốc không được gửi như một tin nhắn thông thường. Vui lòng liên hệ trực tiếp văn phòng nhà trường để xác nhận hướng dẫn và thẩm quyền.</p><button className="secondary-button">Liên hệ văn phòng</button></div> : <form onSubmit={submitContact}><label>Bé cần liên hệ<select defaultValue={activeContext.student.id}><option value={activeContext.student.id}>{childName}</option></select></label><label>Nội dung cần nhà trường biết<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ví dụ: Gia đình sẽ đón bé lúc 16:00" required /></label><p className="form-hint">Không dùng kênh này cho tình huống khẩn cấp.</p><button className="primary-button" type="submit">Gửi yêu cầu</button></form>}</section><aside className="panel contact-history" data-od-id="contact-history"><p className="eyebrow">THEO DÕI YÊU CẦU</p><h2>Trao đổi gần đây</h2><div className="request-list">{requests.map((request, index) => <article className="request" key={`${request.title}-${index}`}><div className="request-meta"><span>{request.time} · {childName.toUpperCase()}</span><span className={`badge ${request.state === 'Đã xem' ? 'success' : 'warning'}`}>{request.state}</span></div><h3>{request.title}</h3><p>{request.detail}</p></article>)}</div><p className="history-note"><strong>Lưu ý:</strong> Nhà trường cần xác nhận đã xem trước khi yêu cầu được coi là đã tiếp nhận.</p></aside></div></section>}
    </main>
    <nav className="mobile-nav" aria-label="Điều hướng phụ huynh">{(['home', 'child', 'contact', 'inbox', 'payment'] as View[]).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{navLabel(item)}</button>)}</nav>
  </div>;
}

export function ParentShell() {
  const [session, setSession] = useState<Session>();
  const [resolved, setResolved] = useState(false);
  useEffect(() => { const controller = new AbortController(); let current = true; void bootstrapSession(() => setSession(undefined), controller.signal).then((next) => { if (current) { setSession(next); setResolved(true); } }); return () => { current = false; controller.abort(); }; }, []);
  if (!resolved) return <main className="auth-state"><h1>PassionEdu</h1><p>Đang xác thực phiên...</p></main>;
  if (!session) return <main className="auth-state"><h1>PassionEdu</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a className="primary-button" href={googleLoginUrl}>Đăng nhập với Google</a></main>;
  if (!session.schools.length) return <main className="auth-state"><h1>Chưa có học sinh để theo dõi</h1><p>Nhà trường sẽ thông báo khi liên kết phụ huynh và học sinh được kích hoạt.</p><button className="secondary-button" onClick={() => void logout(() => setSession(undefined))}>Đăng xuất</button></main>;
  const signOut = () => void logout(() => setSession(undefined));
  const deny = (denied: ParentContext) => setSession((current) => current && { ...current, schools: current.schools.filter((context) => context.schoolId !== denied.schoolId || context.student.id !== denied.student.id) });
  return <ParentWorkspace contexts={session.schools} onLogout={signOut} onDenied={deny} />;
}

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

const root = document.getElementById('root'); if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
