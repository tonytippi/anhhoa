import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, clearClientSession, completedInvoices, parentInvoice, parentStudents, pendingInvoices, request, type ParentInvoice, type ParentStudent } from './api';

interface Parent { id: string; email: string; displayName: string | null; }

function formatMoney(total: number): string { return `${new Intl.NumberFormat('vi-VN').format(total)} VND`; }
function formatMonth(month: string): string { return `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`; }
function validMonth(value: string | null): value is string { return Boolean(value && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)); }

function Session(): React.JSX.Element {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [rejected, setRejected] = useState(false);
  const identity = useQuery({ queryKey: ['parent', 'me'], queryFn: () => request<{ data: Parent }>('/parent/me').then((result) => result.data), retry: false, refetchOnWindowFocus: true });
  const students = useQuery({ queryKey: ['parent', 'students'], queryFn: parentStudents, enabled: identity.isSuccess, refetchOnWindowFocus: false });
  const reject = (): void => { client.clear(); clearClientSession(); setRejected(true); };
  const unauthorized = [identity.error, students.error].some((error) => error instanceof ApiError && error.status === 401);
  useEffect(() => { if (unauthorized) reject(); }, [unauthorized]);
  useEffect(() => {
    const revalidate = (): void => { void client.invalidateQueries({ queryKey: ['parent'] }); };
    const foreground = (): void => { if (document.visibilityState === 'visible') revalidate(); };
    window.addEventListener('focus', revalidate); document.addEventListener('visibilitychange', foreground);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', foreground); };
  }, [client]);
  if (rejected) return <Navigate to="/login" replace />;
  if (identity.isPending) return <main aria-live="polite"><h1>Đang kiểm tra phiên</h1></main>;
  if (identity.error) return <main aria-live="assertive"><h1>Không thể kết nối</h1><button onClick={() => void identity.refetch()}>Thử lại</button></main>;
  if (students.isPending) return <main aria-live="polite"><h1>Đang tải học sinh</h1></main>;
  if (students.error) return <main aria-live="assertive"><h1>Không thể kết nối</h1><button onClick={() => void students.refetch()}>Thử lại</button></main>;
  const logout = async (): Promise<void> => { try { await request('/parent/auth/logout', { method: 'POST' }); } catch { /* Clear the local protected session even when logout fails. */ } finally { client.clear(); clearClientSession(); navigate('/login'); } };
  return <ProtectedRoutes parent={identity.data!} students={students.data!} onUnauthorized={reject} onLogout={logout} />;
}

function ProtectedRoutes({ parent, students, onUnauthorized, onLogout }: { parent: Parent; students: ParentStudent[]; onUnauthorized: () => void; onLogout: () => Promise<void> }): React.JSX.Element {
  return <Routes>
    <Route path="/" element={<Home parent={parent} students={students} onUnauthorized={onUnauthorized} onLogout={onLogout} />} />
    <Route path="/history" element={<History parent={parent} students={students} onUnauthorized={onUnauthorized} onLogout={onLogout} />} />
    <Route path="/invoices/:invoiceId" element={<InvoiceDetail parent={parent} students={students} onUnauthorized={onUnauthorized} onLogout={onLogout} />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function Shell({ parent, onLogout, current, children }: { parent: Parent; onLogout: () => Promise<void>; current: 'home' | 'history'; children: React.ReactNode }): React.JSX.Element {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => { const sync = (): void => setOffline(!navigator.onLine); window.addEventListener('online', sync); window.addEventListener('offline', sync); return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); }; }, []);
  return <main><header><strong>Ánh Hoa</strong><span>{parent.email}</span><button onClick={() => void onLogout()}>Đăng xuất</button></header>{offline && <p className="offline" role="status">Bạn đang ngoại tuyến. Dữ liệu có thể không mới.</p>}{children}<nav><Link to="/" aria-current={current === 'home' ? 'page' : undefined}>Trang chủ</Link><Link to="/history" aria-current={current === 'history' ? 'page' : undefined}>Lịch sử</Link></nav></main>;
}

function Home({ parent, students, onUnauthorized, onLogout }: { parent: Parent; students: ParentStudent[]; onUnauthorized: () => void; onLogout: () => Promise<void> }): React.JSX.Element {
  const [studentId, setStudentId] = useState<string | undefined>();
  const client = useQueryClient();
  const invoices = useQuery({ queryKey: ['parent', 'invoices', 'pending'], queryFn: () => pendingInvoices(), refetchOnWindowFocus: false });
  const unauthorized = invoices.error instanceof ApiError && invoices.error.status === 401;
  useEffect(() => { if (unauthorized) onUnauthorized(); }, [onUnauthorized, unauthorized]);
  useEffect(() => { if (studentId && !students.some((student) => student.id === studentId)) setStudentId(undefined); }, [studentId, students]);
  const activeStudents = new Map(students.map((student) => [student.id, student]));
  const pending = (invoices.data ?? []).filter((invoice) => activeStudents.has(invoice.student.id) && (!studentId || invoice.student.id === studentId));
  const groups = groupInvoices(pending, activeStudents);
  return <Shell parent={parent} onLogout={onLogout} current="home"><h1>Hóa đơn cần thanh toán</h1>{students.length >= 2 && <StudentSwitcher students={students} selected={studentId} onSelect={setStudentId} />}{invoices.isPending ? <HomeSkeleton /> : invoices.error && !unauthorized ? <Retry client={client} label="Không thể tải Hóa đơn. Vui lòng thử lại." /> : <HomeContent groups={groups} refreshing={invoices.isFetching} />}</Shell>;
}

function StudentSwitcher({ students, selected, onSelect }: { students: ParentStudent[]; selected?: string; onSelect: (id?: string) => void }): React.JSX.Element { return <div className="student-switcher" aria-label="Chọn học sinh"><button className={!selected ? 'selected' : ''} aria-pressed={!selected} onClick={() => onSelect(undefined)}>Tất cả</button>{students.map((student) => <button key={student.id} className={selected === student.id ? 'selected' : ''} aria-pressed={selected === student.id} onClick={() => onSelect(student.id)}>{student.nickname ?? student.fullName}</button>)}</div>; }
function groupInvoices(invoices: ParentInvoice[], activeStudents: Map<string, ParentStudent>): Array<{ student: ParentStudent; invoices: ParentInvoice[]; newestPosition: number }> { const byStudent = new Map<string, ParentInvoice[]>(); invoices.forEach((invoice) => byStudent.set(invoice.student.id, [...(byStudent.get(invoice.student.id) ?? []), invoice])); return [...byStudent.entries()].map(([studentId, grouped]) => ({ student: activeStudents.get(studentId)!, invoices: grouped.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth)), newestPosition: Math.min(...grouped.map((invoice) => invoices.indexOf(invoice))) })).sort((a, b) => a.newestPosition - b.newestPosition || (a.student.nickname ?? a.student.fullName).localeCompare(b.student.nickname ?? b.student.fullName, 'vi')); }
function HomeContent({ groups, refreshing }: { groups: Array<{ student: ParentStudent; invoices: ParentInvoice[]; newestPosition: number }>; refreshing: boolean }): React.JSX.Element { if (!groups.length) return <section className="empty"><p>Không còn Hóa đơn cần thanh toán</p><Link to="/history">Xem lịch sử</Link></section>; return <section aria-live="polite">{refreshing && <p className="refreshing">Đang cập nhật...</p>}{groups.map((group) => <section className="invoice-group" key={group.student.id}><h2>{group.student.nickname ?? group.student.fullName}</h2>{group.invoices.map((invoice) => <Link className="invoice-card" key={invoice.id} to={`/invoices/${invoice.id}`}><p className="month">{formatMonth(invoice.billingMonth)}</p><p className="student-name">Học sinh: {invoice.student.name}</p><p><span className="status">Cần thanh toán</span></p><strong>{formatMoney(invoice.total)}</strong>{invoice.paymentMethod === 'CASH' && <p>Thanh toán tiền mặt tại nhà trường.</p>}<span className="button">Xem Hóa đơn</span></Link>)}</section>)}</section>; }

function InvoiceDetail({ parent, students, onUnauthorized, onLogout }: { parent: Parent; students: ParentStudent[]; onUnauthorized: () => void; onLogout: () => Promise<void> }): React.JSX.Element {
  const { invoiceId = '' } = useParams(); const navigate = useNavigate(); const client = useQueryClient();
  const detail = useQuery({ queryKey: ['parent', 'invoice', invoiceId], queryFn: () => parentInvoice(invoiceId), enabled: Boolean(invoiceId), refetchOnWindowFocus: false });
  const unauthorized = detail.error instanceof ApiError && detail.error.status === 401;
  const revoked = detail.data && !students.some((student) => student.id === detail.data.student.id);
  useEffect(() => { if (unauthorized) onUnauthorized(); }, [onUnauthorized, unauthorized]);
  useEffect(() => { if (revoked) { client.removeQueries({ queryKey: ['parent', 'invoice', invoiceId] }); navigate('/', { replace: true }); } }, [client, invoiceId, navigate, revoked]);
  return <Shell parent={parent} onLogout={onLogout} current="home"><h1>Chi tiết Hóa đơn</h1>{detail.isPending ? <HomeSkeleton /> : detail.error && !unauthorized ? <Retry client={client} label="Không thể tải Hóa đơn. Vui lòng thử lại." /> : detail.data && !revoked ? <InvoiceReadOnly invoice={detail.data} /> : null}</Shell>;
}

function InvoiceReadOnly({ invoice }: { invoice: ParentInvoice }): React.JSX.Element { return <section className="invoice-detail"><p>Học sinh: {invoice.student.name}</p><p>{formatMonth(invoice.billingMonth)}</p><p><span className={`status ${invoice.status === 'COMPLETED' ? 'completed' : ''}`}>{invoice.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Cần thanh toán'}</span></p><h2>Chi tiết các khoản thu</h2><ul>{invoice.items.map((item) => <li key={`${item.position}-${item.description}`}><span>{item.description}</span><strong>{formatMoney(item.amount)}</strong></li>)}</ul><p>Phương thức: {invoice.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</p>{invoice.status === 'PENDING' && invoice.paymentMethod === 'CASH' && <p>Thanh toán tiền mặt tại nhà trường.</p>}<p className="total">Tổng cộng: {formatMoney(invoice.total)}</p></section>; }

function History({ parent, students, onUnauthorized, onLogout }: { parent: Parent; students: ParentStudent[]; onUnauthorized: () => void; onLogout: () => Promise<void> }): React.JSX.Element {
  const [params, setParams] = useSearchParams(); const client = useQueryClient();
  const studentId = students.some((student) => student.id === params.get('studentId')) ? params.get('studentId')! : undefined;
  const billingMonth = validMonth(params.get('billingMonth')) ? params.get('billingMonth')! : undefined;
  const requestedPage = params.get('page');
  const page = requestedPage && /^[1-9]\d*$/.test(requestedPage) && Number(requestedPage) <= 10_000 ? Number(requestedPage) : 1;
  const history = useQuery({ queryKey: ['parent', 'invoices', 'completed', studentId, billingMonth, page], queryFn: () => completedInvoices({ studentId, billingMonth, page }), refetchOnWindowFocus: false });
  const unauthorized = history.error instanceof ApiError && history.error.status === 401;
  useEffect(() => { if (unauthorized) onUnauthorized(); }, [onUnauthorized, unauthorized]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    let changed = false;
    if (params.get('studentId') && !studentId) { next.delete('studentId'); changed = true; }
    if (params.get('billingMonth') && !billingMonth) { next.delete('billingMonth'); changed = true; }
    if (requestedPage && page === 1 && requestedPage !== '1') { next.delete('page'); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [billingMonth, page, params, requestedPage, setParams, studentId]);
  useEffect(() => {
    if (history.data && page > history.data.meta.pageCount) setPage(history.data.meta.pageCount);
  }, [history.data, page]);
  const update = (name: string, value?: string): void => { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); next.delete('page'); setParams(next); };
  const setPage = (nextPage: number): void => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); };
  const activeStudents = new Set(students.map((student) => student.id));
  const invoices = (history.data?.data ?? []).filter((invoice) => invoice.status === 'COMPLETED' && activeStudents.has(invoice.student.id));
  return <Shell parent={parent} onLogout={onLogout} current="history"><h1>Lịch sử thanh toán</h1><section className="history-filters" aria-label="Bộ lọc lịch sử"><label>Học sinh<select value={studentId ?? ''} onChange={(event) => update('studentId', event.target.value || undefined)}><option value="">Tất cả học sinh</option>{students.map((student) => <option key={student.id} value={student.id}>{student.nickname ?? student.fullName}</option>)}</select></label><label>Tháng<input type="month" value={billingMonth ?? ''} onChange={(event) => update('billingMonth', event.target.value || undefined)} /></label></section>{history.isPending ? <HomeSkeleton /> : history.error && !unauthorized ? <Retry client={client} label="Không thể tải lịch sử. Vui lòng thử lại." /> : <section className="history-list">{invoices.length ? invoices.map((invoice) => <Link className="history-row" to={`/invoices/${invoice.id}`} key={invoice.id}><span>{invoice.student.name}</span><span>{formatMonth(invoice.billingMonth)}</span><strong>{formatMoney(invoice.total)}</strong><span className="status completed">Đã hoàn tất</span></Link>) : <p>Chưa có Hóa đơn đã hoàn tất.</p>}{history.data && <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {history.data.meta.page} / {history.data.meta.pageCount}</span><button disabled={page >= history.data.meta.pageCount} onClick={() => setPage(page + 1)}>Trang sau</button></div>}</section>}</Shell>;
}

function Retry({ client, label }: { client: QueryClient; label: string }): React.JSX.Element { return <section className="error" role="alert"><p>{label}</p><button onClick={() => void client.invalidateQueries({ queryKey: ['parent'] })}>Thử lại</button></section>; }
function HomeSkeleton(): React.JSX.Element { return <section aria-label="Đang tải hóa đơn" className="skeleton"><div /><div /><div /></section>; }
function Login(): React.JSX.Element { return <main className="login"><p>Ánh Hoa</p><h1>Dành cho phụ huynh</h1><p>Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền.</p><a className="button" href={`${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')}/parent/auth/google`}>Tiếp tục với Google</a></main>; }
export function App(): React.JSX.Element { const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })); return <QueryClientProvider client={client}><BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="/*" element={<Session />} /></Routes></BrowserRouter></QueryClientProvider>; }
