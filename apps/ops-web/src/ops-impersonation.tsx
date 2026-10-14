import { FormEvent, useEffect, useRef, useState } from 'react';

type Identity = { id: string; email: string; displayName: string | null; bound: boolean; lastLoginAt: string | null; lastSeenAt: string | null; platformOperator: boolean; parent: boolean; memberships: { schoolName: string; schoolSlug: string; status: string }[] };
type Audience = 'app' | 'teacher' | 'parent';
const audienceLabels: Record<Audience, string> = { app: 'Quản trị trường', teacher: 'Giáo viên', parent: 'Phụ huynh' };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === 'undefined' ? 'ops_csrf' : __CSRF_COOKIE_NAME__;
// Schools run on Vietnam time, so "hôm nay"/"hôm qua" are calendar days there, not 24-hour spans.
const timeZone = 'Asia/Ho_Chi_Minh';
const dayNumber = (date: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)) / 86_400_000;
const exactTime = (value: string) => { const date = new Date(value); return `${new Intl.DateTimeFormat('vi-VN', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)} ${new Intl.DateTimeFormat('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' }).format(date)}`; };
function When({ value, empty }: { value: string | null; empty: string }) {
  if (!value) return <span className="muted">{empty}</span>;
  const days = dayNumber(new Date()) - dayNumber(new Date(value));
  return <>{days <= 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`}<br /><small>{exactTime(value)}</small></>;
}
const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith(`${csrfName}=`))?.slice(csrfName.length + 1);

// Lets a Platform Operator open a portal as another user to reproduce what they see; every start is recorded with its reason.
export function OpsImpersonation({ clear }: { clear: () => void }) {
  const [query, setQuery] = useState('');
  const [identities, setIdentities] = useState<Identity[]>();
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ identity: Identity; audience: Audience; reason: string }>();
  const [link, setLink] = useState<{ url: string; label: string }>();
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>('select, textarea')?.focus(); }, [Boolean(dialog)]);
  const search = async (event?: FormEvent) => {
    event?.preventDefault(); setError(''); setLink(undefined);
    const response = await fetch(`${apiUrl}/api/ops/identities?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' }).catch(() => undefined);
    if (response && [401, 403].includes(response.status)) return clear();
    if (!response?.ok) return setError('Không thể tìm người dùng.');
    setIdentities((await response.json() as { data: { identities: Identity[] } }).data.identities);
  };
  const start = async (event: FormEvent) => {
    event.preventDefault(); if (!dialog) return; setPending(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/ops/impersonations`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf() ?? '') }, body: JSON.stringify({ targetIdentityId: dialog.identity.id, audience: dialog.audience, reason: dialog.reason }) });
      if (response.status === 401) return clear();
      if (!response.ok) throw new Error((await response.json() as { error?: { message?: string } }).error?.message ?? 'Không thể bắt đầu giả lập.');
      const { url } = (await response.json() as { data: { url: string } }).data;
      setLink({ url, label: `Mở cổng ${audienceLabels[dialog.audience]} dưới tư cách ${dialog.identity.email}` }); setDialog(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể bắt đầu giả lập.'); } finally { setPending(false); }
  };
  return <section className="ops-impersonation" aria-labelledby="ops-impersonation-title">
    <h2 id="ops-impersonation-title">Người dùng</h2>
    <p>Mở cổng dưới tư cách một người dùng để kiểm tra sự cố. Phiên giả lập có toàn quyền như người dùng, tối đa 1 giờ; mọi thao tác được ghi kèm nhân sự vận hành và lý do.</p>
    <form className="ops-search" onSubmit={search}><label>Email hoặc tên (để trống để xem tất cả)<input value={query} onChange={(event) => setQuery(event.target.value)} /></label><button>Tìm</button></form>
    {error && <p role="alert">{error}</p>}
    {link && <p className="notice"><a href={link.url} target="_blank" rel="noreferrer" onClick={() => setLink(undefined)}>{link.label}</a> — liên kết dùng một lần, hết hạn sau 1 phút.</p>}
    {identities && <div className="table-wrap"><table><caption>{identities.length} người dùng</caption><thead><tr><th>Người dùng</th><th>Trường</th><th>Phụ huynh</th><th>Truy cập gần nhất</th><th>Đăng nhập gần nhất</th><th>Thao tác</th></tr></thead><tbody>
      {identities.length ? identities.map((identity) => <tr key={identity.id}><td>{identity.displayName ? <>{identity.displayName}<br /><small>{identity.email}</small></> : identity.email}</td><td>{identity.memberships.length ? identity.memberships.map((membership) => `${membership.schoolName}${membership.status === 'ACTIVE' ? '' : ' (đã khóa)'}`).join(', ') : '—'}</td><td>{identity.parent ? 'Có' : '—'}</td><td><When value={identity.lastSeenAt} empty="Chưa truy cập" /></td><td><When value={identity.lastLoginAt} empty={identity.bound ? 'Chưa ghi nhận' : 'Chưa đăng nhập'} /></td><td>{identity.platformOperator ? <small>Nhân sự vận hành</small> : <button type="button" onClick={() => { setLink(undefined); setDialog({ identity, audience: identity.memberships.length || !identity.parent ? 'app' : 'parent', reason: '' }); }}>Giả lập</button>}</td></tr>)
        : <tr><td colSpan={6}>Không tìm thấy người dùng.</td></tr>}
    </tbody></table></div>}
    {dialog && <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ops-impersonation-dialog-title" className="dialog" onKeyDown={(event) => { if (event.key === 'Escape' && !pending) setDialog(undefined); }}><form onSubmit={start}>
      <h2 id="ops-impersonation-dialog-title">Giả lập {dialog.identity.email}</h2>
      <label>Cổng<select value={dialog.audience} onChange={(event) => setDialog({ ...dialog, audience: event.target.value as Audience })}>{(Object.keys(audienceLabels) as Audience[]).map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}</select></label>
      <label>Lý do<textarea required minLength={5} rows={3} value={dialog.reason} onChange={(event) => setDialog({ ...dialog, reason: event.target.value })} /></label>
      <p>Phiên giả lập thay thế phiên hiện tại của trình duyệt trên cổng đó. Thao tác ghi dữ liệu sẽ có hiệu lực thật.</p>
      <div className="dialog-actions"><button type="button" disabled={pending} onClick={() => setDialog(undefined)}>Hủy</button><button disabled={pending}>Tạo liên kết giả lập</button></div>
    </form></div>}
  </section>;
}
