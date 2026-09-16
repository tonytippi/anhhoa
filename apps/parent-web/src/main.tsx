import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout } from './auth-session';
import './styles.css';
export function ParentShell() { const [signedIn, setSignedIn] = useState<boolean>(); useEffect(() => { const controller = new AbortController(); let current = true; void bootstrapSession(() => setSignedIn(false), controller.signal).then((session) => { if (current) setSignedIn(Boolean(session)); }); return () => { current = false; controller.abort(); }; }, []); if (signedIn === undefined) return <main><h1>PassionEdu</h1><p>Đang xác thực phiên...</p></main>; return <main><h1>PassionEdu</h1>{signedIn ? <><p>Cổng phụ huynh đang được khởi tạo.</p><button onClick={() => void logout(() => setSignedIn(false))}>Đăng xuất</button></> : <><p>Vui lòng đăng nhập để tiếp tục.</p><a href={googleLoginUrl}>Đăng nhập với Google</a></>}</main>; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
