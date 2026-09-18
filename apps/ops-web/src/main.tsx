import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout } from './auth-session';
import { OpsSchools } from './ops-schools';
import './ops-schools.css';
export function OpsShell() { const [session, setSession] = useState<Awaited<ReturnType<typeof bootstrapSession>> | null>(null); const clear = () => setSession(undefined); useEffect(() => { let current = true; void bootstrapSession(() => { if (current) clear(); }).then((value) => { if (current) setSession(value); }); return () => { current = false; }; }, []); if (session === null) return <main><h1>PassionEdu - Vận hành nền tảng</h1><p role="status">Đang kiểm tra phiên đăng nhập.</p></main>; if (session === undefined) return <main><h1>PassionEdu - Vận hành nền tảng</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a href={googleLoginUrl}>Đăng nhập với Google</a></main>; return <OpsSchools session={session} clear={() => void logout(clear)} />; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><OpsShell /></StrictMode>);
