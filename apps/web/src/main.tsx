import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  bootstrapSession,
  googleLoginUrl,
  logout,
  type Audience,
  type Session,
} from "./auth-session";
import "./index.css";
import { SchoolContext } from "./school-context";
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
export function AdminShell() {
  const [session, setSession] = useState<Session | undefined>();
  const [ready, setReady] = useState(false);
  const clear = () => setSession(undefined);
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
          <p className="admin-eyebrow">PASSIONEDU</p>
          <h1>Quản trị trường</h1>
          <p>Đang xác thực phiên...</p>
        </section>
      </main>
    );
  if (!session)
    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card">
          <p className="admin-eyebrow">PASSIONEDU</p>
          <h1>Quản trị trường</h1>
          <p>Vui lòng đăng nhập để tiếp tục.</p>
          <a className="admin-primary-link" href={googleLoginUrl("app")}>
            Đăng nhập với Google
          </a>
        </section>
      </main>
    );
  return (
    <div className="app-shell admin-app-shell">
      <aside className="sidebar admin-sidebar" aria-label="Khung quản trị">
        <div className="brand" aria-label="PassionEdu">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>PassionEdu</span>
        </div>
        <p className="admin-sidebar-copy">Quản trị vận hành trường</p>
        <div className="admin-sidebar-footer">
          <span className="admin-session-label">Tài khoản đang đăng nhập</span>
          <button className="account" onClick={() => void logout("app", clear)}>
            <span className="avatar" aria-hidden="true">PE</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <a className="admin-skip-link" href="#school-content">Bỏ qua điều hướng</a>
        <div id="school-content">
          <BrowserRouter>
            <SchoolContext clear={clear} userIdentityId={session.userIdentityId} />
          </BrowserRouter>
        </div>
      </main>
    </div>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <AdminShell />
    </StrictMode>,
  );
