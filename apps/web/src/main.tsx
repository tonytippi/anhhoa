import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  bootstrapSession,
  googleLoginUrl,
  logout,
  type Audience,
  type Session,
} from "./auth-session";
import "@fontsource-variable/inter";
import "./index.css";
import { SchoolContext } from "./school-context";
import { installNetworkErrorMessage } from "./network-error";
export function AudienceShell({
  audience,
  heading,
  description,
}: {
  audience: Audience;
  heading: string;
  description: string;
}) {
  const [session, setSession] = useState<Session | undefined>();
  const [ready, setReady] = useState(false);
  const clear = () => setSession(undefined);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void bootstrapSession(audience, clear, controller.signal).then((result) => {
      if (current) {
        setSession(result);
        setReady(true);
      }
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [audience]);
  if (!ready)
    return (
      <main>
        <h1>{heading}</h1>
        <p>Đang xác thực phiên...</p>
      </main>
    );
  if (!session)
    return (
      <main>
        <h1>{heading}</h1>
        <p>Vui lòng đăng nhập để tiếp tục.</p>
        <a href={googleLoginUrl(audience)}>Đăng nhập với Google</a>
      </main>
    );
  return (
    <main>
      <h1>{heading}</h1>
      <p>{description}</p>
      <button onClick={() => void logout(audience, clear)}>Đăng xuất</button>
    </main>
  );
}
function AuthBrand() {
  return (
    <p className="admin-auth-brand">
      <span className="brand-mark" aria-hidden="true">✦</span>
      <span>PassionEdu</span>
    </p>
  );
}
function GoogleMark() {
  return (
    <svg className="admin-google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function initials(name: string): string {
  const words = name.split(/[\s@.]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1]![0] : "")).toUpperCase() || "?";
}
export function AdminShell() {
  const [session, setSession] = useState<Session | undefined>();
  const [ready, setReady] = useState(false);
  const navigateHome = useRef<(() => void) | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>();
  const clear = () => { setSession(undefined); setRole(undefined); };
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void bootstrapSession("app", clear, controller.signal).then((result) => {
      if (current) {
        setSession(result);
        setReady(true);
      }
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, []);
  if (!ready)
    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card" aria-live="polite">
          <AuthBrand />
          <h1>Quản trị trường</h1>
          <p className="admin-auth-copy">Đang xác thực phiên...</p>
        </section>
      </main>
    );
  if (!session)
    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card">
          <AuthBrand />
          <h1>Quản trị trường</h1>
          <p className="admin-auth-copy">Đăng nhập bằng tài khoản Google đã được nhà trường cấp quyền để tiếp tục.</p>
          <a className="admin-google-link" href={googleLoginUrl("app")}>
            <GoogleMark />
            <span>Đăng nhập với Google</span>
          </a>
          <p className="admin-auth-note">Chưa có quyền? Liên hệ quản trị viên của trường.</p>
        </section>
      </main>
    );
  return (
    <div className="app-shell admin-app-shell">
      <aside className="sidebar admin-sidebar" aria-label="Khung quản trị">
        <button className="brand" type="button" onClick={() => navigateHome.current?.()} aria-label="Về trang chủ PassionEdu">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>PassionEdu</span>
        </button>
        <p className="admin-sidebar-copy">Quản trị vận hành trường</p>
        <div className="admin-sidebar-footer">
          <div className="admin-profile" aria-label="Tài khoản đang đăng nhập">
            <span className="avatar admin-profile-avatar" aria-hidden="true">
              {session.pictureUrl ? <img src={session.pictureUrl} alt="" referrerPolicy="no-referrer" /> : initials(session.displayName ?? session.email)}
            </span>
            <span className="admin-profile-text">
              <strong>{session.displayName ?? session.email}</strong>
              {session.displayName && <span className="admin-profile-email">{session.email}</span>}
              {role && <span className="admin-profile-role">{role}</span>}
            </span>
          </div>
          <button className="admin-logout" type="button" onClick={() => void logout("app", clear)} aria-label="Đăng xuất" title="Đăng xuất">
            <span aria-hidden="true">⎋</span>
            <span className="admin-logout-label">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <a className="admin-skip-link" href="#school-content">Bỏ qua điều hướng</a>
        <div id="school-content">
          <BrowserRouter>
            <SchoolContext clear={clear} onRoleChange={setRole} userIdentityId={session.userIdentityId} registerHomeNavigation={(navigate) => { navigateHome.current = navigate; }} />
          </BrowserRouter>
        </div>
      </main>
    </div>
  );
}

const root = document.getElementById("root");
if (root) installNetworkErrorMessage(window);
if (root)
  createRoot(root).render(
    <StrictMode>
      <AdminShell />
    </StrictMode>,
  );
