import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapSession, googleLoginUrl, logout, type Session } from './auth-session';
import { ImpersonationBanner } from './impersonation-banner';
import { AuthCard } from './auth-card';
import { SchoolContext } from './school-context';
import { disablePush } from './web-push';
import './styles.css';
import './teacher.css';

export function TeacherShell() {
  const [signedIn, setSignedIn] = useState<boolean>();
  const [session, setSession] = useState<Session>();
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void bootstrapSession(() => setSignedIn(false), controller.signal).then((session) => {
      if (current) { setSession(session); setSignedIn(Boolean(session)); }
    });
    return () => { current = false; controller.abort(); };
  }, []);
  if (signedIn === undefined) return <AuthCard title="Giáo viên" description="Đang xác thực phiên..." />;
  if (!signedIn) return <AuthCard title="Giáo viên" description="Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền để tiếp tục." loginUrl={googleLoginUrl} note="Chưa có quyền? Liên hệ quản trị viên của trường." />;
  // Drop this device's push subscription while the session can still authorize the removal.
  const signOut = () => { setSignedIn(false); void disablePush().finally(() => logout(() => undefined)); };
  return (
    <>
      {session && <ImpersonationBanner email={session.email} impersonation={session.impersonation} onEnd={signOut} />}
      <a className="skip" href="#main">Bỏ qua điều hướng</a>
      <SchoolContext clear={() => setSignedIn(false)} session={session} onLogout={signOut} />
    </>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><TeacherShell /></StrictMode>);
