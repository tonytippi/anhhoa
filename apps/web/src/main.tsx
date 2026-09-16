import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, type Audience, type Session } from './auth-session';
import './index.css';
export function AudienceShell({ audience, heading, description }: { audience: Audience; heading: string; description: string }) {
  const [session, setSession] = useState<Session | undefined>(); const [ready, setReady] = useState(false);
  const clear = () => setSession(undefined);
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    void bootstrapSession(audience, clear, controller.signal).then((result) => { if (current) { setSession(result); setReady(true); } });
    return () => { current = false; controller.abort(); };
  }, [audience]);
  if (!ready) return <main><h1>{heading}</h1><p>Đang xác thực phiên...</p></main>;
  if (!session) return <main><h1>{heading}</h1><p>Vui lòng đăng nhập để tiếp tục.</p><a href={googleLoginUrl(audience)}>Đăng nhập với Google</a></main>;
  return <main><h1>{heading}</h1><p>{description}</p><button onClick={() => void logout(audience, clear)}>Đăng xuất</button></main>;
}
export function AdminShell() { return <AudienceShell audience="app" heading="PassionEdu - Quản trị trường" description="Cổng quản trị đang được khởi tạo." />; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><AdminShell /></StrictMode>);
