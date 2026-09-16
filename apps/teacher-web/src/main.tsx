import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout } from './auth-session';
import { SchoolContext } from './school-context';
export function TeacherShell() { const [signedIn, setSignedIn] = useState<boolean>(); useEffect(() => { const controller = new AbortController(); let current = true; void bootstrapSession(() => setSignedIn(false), controller.signal).then((session) => { if (current) setSignedIn(Boolean(session)); }); return () => { current = false; controller.abort(); }; }, []); if (signedIn === undefined) return <main><h1>PassionEdu - Giáo viên</h1><p>Đang xác thực phiên...</p></main>; return <main>{signedIn ? <><a href="#school-content">Bỏ qua điều hướng</a><div id="school-content"><SchoolContext clear={() => setSignedIn(false)} /></div><button onClick={() => void logout(() => setSignedIn(false))}>Đăng xuất</button></> : <><h1>PassionEdu - Giáo viên</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a href={googleLoginUrl}>Đăng nhập với Google</a></>}</main>; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><TeacherShell /></StrictMode>);
