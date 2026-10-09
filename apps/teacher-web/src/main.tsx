import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout } from './auth-session';
import { AuthCard } from './auth-card';
import { SchoolContext } from './school-context';
export function TeacherShell() { const [signedIn, setSignedIn] = useState<boolean>(); useEffect(() => { const controller = new AbortController(); let current = true; void bootstrapSession(() => setSignedIn(false), controller.signal).then((session) => { if (current) setSignedIn(Boolean(session)); }); return () => { current = false; controller.abort(); }; }, []); if (signedIn === undefined) return <AuthCard title="Giáo viên" description="Đang xác thực phiên..." />; if (!signedIn) return <AuthCard title="Giáo viên" description="Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền để tiếp tục." loginUrl={googleLoginUrl} note="Chưa có quyền? Liên hệ quản trị viên của trường." />; return <main><><a href="#school-content">Bỏ qua điều hướng</a><div id="school-content"><SchoolContext clear={() => setSignedIn(false)} /></div><button onClick={() => void logout(() => setSignedIn(false))}>Đăng xuất</button></></main>; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><TeacherShell /></StrictMode>);
