import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, clearClientSession, request } from './api';

interface Parent { id: string; email: string; displayName: string | null; }
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });

function Session(): React.JSX.Element {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [rejected, setRejected] = useState(false);
  const identity = useQuery({ queryKey: ['parent', 'me'], queryFn: () => request<{ data: Parent }>('/parent/me').then((result) => result.data), retry: false, refetchOnWindowFocus: true });
  useEffect(() => { if (identity.error instanceof ApiError && identity.error.status === 401) { client.clear(); clearClientSession(); setRejected(true); } }, [client, identity.error]);
  if (rejected) return <Navigate to="/login" replace />;
  if (identity.isPending) return <main aria-live="polite"><h1>Đang kiểm tra phiên</h1></main>;
  if (identity.error) return <main aria-live="assertive"><h1>Không thể kết nối</h1><button onClick={() => void identity.refetch()}>Thử lại</button></main>;
  const logout = async (): Promise<void> => { try { await request('/parent/auth/logout', { method: 'POST' }); } catch { /* Local session must still be removed after a failed logout request. */ } finally { client.clear(); clearClientSession(); navigate('/login'); } };
  return <main><header><strong>Ánh Hoa</strong><span>{identity.data!.email}</span><button onClick={() => void logout()}>Đăng xuất</button></header><h1>Hóa đơn cần thanh toán</h1><p>Dữ liệu hóa đơn sẽ sẵn sàng trong bản cập nhật tiếp theo.</p><nav><a href="/" aria-current="page">Trang chủ</a><a href="/history">Lịch sử</a></nav></main>;
}

function Login(): React.JSX.Element { return <main className="login"><p>Ánh Hoa</p><h1>Dành cho phụ huynh</h1><p>Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền.</p><a className="button" href={`${(import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')}/parent/auth/google`}>Tiếp tục với Google</a></main>; }
export function App(): React.JSX.Element { return <QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="/*" element={<Session />} /></Routes></BrowserRouter></QueryClientProvider>; }
