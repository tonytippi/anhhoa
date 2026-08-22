import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, clearClientSession, parentStudents, pendingInvoices, request, type ParentInvoice, type ParentStudent } from './api';

interface Parent { id: string; email: string; displayName: string | null; }
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });

function Session(): React.JSX.Element {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [rejected, setRejected] = useState(false);
  const identity = useQuery({ queryKey: ['parent', 'me'], queryFn: () => request<{ data: Parent }>('/parent/me').then((result) => result.data), retry: false, refetchOnWindowFocus: true });
  const reject = (): void => { client.clear(); clearClientSession(); setRejected(true); };
  useEffect(() => { if (identity.error instanceof ApiError && identity.error.status === 401) reject(); }, [identity.error]);
  if (rejected) return <Navigate to="/login" replace />;
  if (identity.isPending) return <main aria-live="polite"><h1>Đang kiểm tra phiên</h1></main>;
  if (identity.error) return <main aria-live="assertive"><h1>Không thể kết nối</h1><button onClick={() => void identity.refetch()}>Thử lại</button></main>;
  const logout = async (): Promise<void> => { try { await request('/parent/auth/logout', { method: 'POST' }); } catch { /* Local session must still be removed after a failed logout request. */ } finally { client.clear(); clearClientSession(); navigate('/login'); } };
  return <Home parent={identity.data!} onUnauthorized={reject} onLogout={logout} />;
}

function formatMoney(total: number): string { return `${new Intl.NumberFormat('vi-VN').format(total)} VND`; }
function formatMonth(month: string): string { return `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`; }

function Home({ parent, onUnauthorized, onLogout }: { parent: Parent; onUnauthorized: () => void; onLogout: () => Promise<void> }): React.JSX.Element {
  const [studentId, setStudentId] = useState<string | undefined>();
  const [offline, setOffline] = useState(!navigator.onLine);
  const client = useQueryClient();
  const students = useQuery({ queryKey: ['parent', 'students'], queryFn: parentStudents, refetchOnWindowFocus: false });
  const invoices = useQuery({ queryKey: ['parent', 'invoices', 'pending'], queryFn: () => pendingInvoices(), enabled: students.isSuccess, refetchOnWindowFocus: false });
  const unauthorized = [students.error, invoices.error].some((error) => error instanceof ApiError && error.status === 401);

  useEffect(() => { if (unauthorized) onUnauthorized(); }, [onUnauthorized, unauthorized]);
  useEffect(() => {
    const sync = (): void => setOffline(!navigator.onLine);
    window.addEventListener('online', sync); window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  useEffect(() => {
    const revalidate = (): void => { void client.invalidateQueries({ queryKey: ['parent'] }); };
    const foreground = (): void => { if (document.visibilityState === 'visible') revalidate(); };
    window.addEventListener('focus', revalidate); document.addEventListener('visibilitychange', foreground);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', foreground); };
  }, [client]);
  useEffect(() => {
    if (studentId && students.data && !students.data.some((student) => student.id === studentId)) {
      setStudentId(undefined);
    }
  }, [client, studentId, students.data]);

  const activeStudents = new Map(students.data?.map((student) => [student.id, student]) ?? []);
  const pending = (invoices.data ?? []).filter((invoice) => activeStudents.has(invoice.student.id) && (!studentId || invoice.student.id === studentId));
  const groups = groupInvoices(pending, activeStudents);
  const hasError = (students.error || invoices.error) && !unauthorized;
  const loading = students.isPending || (invoices.isPending && !invoices.data);
  return <main>
    <header><strong>Ánh Hoa</strong><span>{parent.email}</span><button onClick={() => void onLogout()}>Đăng xuất</button></header>
    <h1>Hóa đơn cần thanh toán</h1>
    {offline && <p className="offline" role="status">Bạn đang ngoại tuyến. Dữ liệu có thể không mới.</p>}
    {students.data && students.data.length >= 2 && <StudentSwitcher students={students.data} selected={studentId} onSelect={setStudentId} />}
    {loading ? <HomeSkeleton /> : hasError ? <section className="error" role="alert"><p>Không thể tải Hóa đơn. Vui lòng thử lại.</p><button onClick={() => void client.invalidateQueries({ queryKey: ['parent'] })}>Thử lại</button></section> : <HomeContent groups={groups} refreshing={invoices.isFetching || students.isFetching} />}
    <nav><a href="/" aria-current="page">Trang chủ</a><a href="/history">Lịch sử</a></nav>
  </main>;
}

function StudentSwitcher({ students, selected, onSelect }: { students: ParentStudent[]; selected?: string; onSelect: (id?: string) => void }): React.JSX.Element {
  return <div className="student-switcher" aria-label="Chọn học sinh">
    <button className={!selected ? 'selected' : ''} aria-pressed={!selected} onClick={() => onSelect(undefined)}>Tất cả</button>
    {students.map((student) => <button key={student.id} className={selected === student.id ? 'selected' : ''} aria-pressed={selected === student.id} onClick={() => onSelect(student.id)}>{student.nickname ?? student.fullName}</button>)}
  </div>;
}

function groupInvoices(invoices: ParentInvoice[], activeStudents: Map<string, ParentStudent>): Array<{ student: ParentStudent; invoices: ParentInvoice[]; newestPosition: number }> {
  const byStudent = new Map<string, ParentInvoice[]>();
  invoices.forEach((invoice) => byStudent.set(invoice.student.id, [...(byStudent.get(invoice.student.id) ?? []), invoice]));
  return [...byStudent.entries()].map(([studentId, grouped]) => ({ student: activeStudents.get(studentId)!, invoices: grouped.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth)), newestPosition: Math.min(...grouped.map((invoice) => invoices.indexOf(invoice))) }))
    .sort((a, b) => a.newestPosition - b.newestPosition || (a.student.nickname ?? a.student.fullName).localeCompare(b.student.nickname ?? b.student.fullName, 'vi'));
}

function HomeContent({ groups, refreshing }: { groups: Array<{ student: ParentStudent; invoices: ParentInvoice[]; newestPosition: number }>; refreshing: boolean }): React.JSX.Element {
  if (!groups.length) return <section className="empty"><p>Không còn Hóa đơn cần thanh toán</p><a href="/history">Xem lịch sử</a></section>;
  return <section aria-live="polite">{refreshing && <p className="refreshing">Đang cập nhật...</p>}{groups.map((group) => <section className="invoice-group" key={group.student.id}><h2>{group.student.nickname ?? group.student.fullName}</h2>{group.invoices.map((invoice) => <article className="invoice-card" key={invoice.id}><p className="month">{formatMonth(invoice.billingMonth)}</p><p className="student-name">Học sinh: {invoice.student.name}</p><p><span className="status">Cần thanh toán</span></p><strong>{formatMoney(invoice.total)}</strong>{invoice.paymentMethod === 'CASH' && <p>Thanh toán tiền mặt tại nhà trường.</p>}<button>Xem Hóa đơn</button></article>)}</section>)}</section>;
}

function HomeSkeleton(): React.JSX.Element { return <section aria-label="Đang tải hóa đơn" className="skeleton"><div /><div /><div /></section>; }

function Login(): React.JSX.Element { return <main className="login"><p>Ánh Hoa</p><h1>Dành cho phụ huynh</h1><p>Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền.</p><a className="button" href={`${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')}/parent/auth/google`}>Tiếp tục với Google</a></main>; }
export function App(): React.JSX.Element { return <QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="/*" element={<Session />} /></Routes></BrowserRouter></QueryClientProvider>; }
