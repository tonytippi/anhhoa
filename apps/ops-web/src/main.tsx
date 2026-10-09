import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout } from './auth-session';
import { AuthCard } from './auth-card';
import { OpsSchools } from './ops-schools';
import './ops-schools.css';
export function OpsShell() { const [session, setSession] = useState<Awaited<ReturnType<typeof bootstrapSession>> | null>(null); const clear = () => setSession(undefined); useEffect(() => { let current = true; void bootstrapSession(() => { if (current) clear(); }).then((value) => { if (current) setSession(value); }); return () => { current = false; }; }, []); if (session === null) return <AuthCard title="Vận hành nền tảng" description="Đang kiểm tra phiên đăng nhập..." />; if (session === undefined) return <AuthCard title="Vận hành nền tảng" description="Đăng nhập bằng tài khoản Google của nhân sự vận hành PassionEdu để tiếp tục." loginUrl={googleLoginUrl} note="Chỉ dành cho nhân sự vận hành nền tảng." />; return <OpsSchools session={session} clear={() => void logout(clear)} />; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><OpsShell /></StrictMode>);
