Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:
diff --git a/apps/web/src/index.css b/apps/web/src/index.css
index 702a55b..996c6f4 100644
--- a/apps/web/src/index.css
+++ b/apps/web/src/index.css
@@ -982,3 +982,163 @@ tbody tr:last-child td {
     justify-content: start;
   }
 }
+
+/* Admin chrome: shared workspace context, kept separate from route-level workspaces. */
+.admin-app-shell {
+  background: #f7f8f3;
+  color: #18332d;
+}
+.admin-sidebar {
+  background: #fff;
+}
+.admin-sidebar-copy {
+  margin: -16px 12px 0;
+  color: #5f746e;
+  font-size: 13px;
+  line-height: 1.45;
+}
+.admin-sidebar-footer {
+  margin-top: auto;
+  border-top: 1px solid #e4e2d8;
+  padding-top: 16px;
+}
+.admin-session-label {
+  display: block;
+  margin: 0 12px 6px;
+  color: #5f746e;
+  font-size: 12px;
+  font-weight: 600;
+}
+.admin-main {
+  margin-left: 232px;
+  min-height: 100vh;
+  padding: 32px;
+}
+.admin-skip-link {
+  position: absolute;
+  left: -9999px;
+  top: 12px;
+  z-index: 50;
+  border-radius: 8px;
+  background: #fff;
+  color: #18332d;
+  padding: 10px 14px;
+  font-weight: 700;
+}
+.admin-skip-link:focus { left: 12px; }
+.admin-auth-shell {
+  display: grid;
+  min-height: 100vh;
+  margin-left: 0;
+  place-items: center;
+  background: #f7f8f3;
+  padding: 24px;
+}
+.admin-auth-card {
+  width: min(100%, 440px);
+  border: 1px solid #d7e2dc;
+  border-radius: 18px;
+  background: #fff;
+  padding: 32px;
+  box-shadow: 0 8px 24px rgb(24 51 45 / 6%);
+}
+.admin-auth-card h1 { margin-bottom: 12px; color: #18332d; font-size: 28px; }
+.admin-auth-card p:not(.admin-eyebrow) { margin: 0 0 24px; color: #5f746e; }
+.admin-eyebrow, .school-context-kicker {
+  margin: 0 0 8px;
+  color: #247a51;
+  font-size: 12px;
+  font-weight: 800;
+  letter-spacing: .09em;
+}
+.admin-primary-link {
+  display: inline-flex;
+  min-height: 44px;
+  align-items: center;
+  justify-content: center;
+  border-radius: 12px;
+  background: #247a51;
+  color: #fff;
+  padding: 0 16px;
+  font-weight: 700;
+  text-decoration: none;
+}
+.admin-primary-link:hover { background: #1c623f; }
+.school-context {
+  width: min(100%, 1280px);
+  margin: 0 auto;
+}
+.school-context-loading,
+.school-context-empty {
+  display: grid;
+  min-height: 220px;
+  align-content: center;
+  border: 1px solid #d7e2dc;
+  border-radius: 18px;
+  background: #fff;
+  padding: 32px;
+}
+.school-context-loading { color: #5f746e; }
+.school-context-empty h1 { margin: 0 0 10px; }
+.school-context-empty p:last-child { margin: 0; color: #5f746e; }
+.school-context-switcher {
+  display: flex;
+  align-items: end;
+  justify-content: space-between;
+  gap: 20px;
+  border: 1px solid #d7e2dc;
+  border-radius: 18px;
+  background: #fff;
+  padding: 20px 24px;
+}
+.school-context-label { display: grid; min-width: min(100%, 380px); gap: 7px; color: #18332d; font-size: 13px; font-weight: 700; }
+.school-context-label select {
+  min-height: 44px;
+  width: 100%;
+  border: 1px solid #d7e2dc;
+  border-radius: 8px;
+  background: #fff;
+  color: #18332d;
+  padding: 0 12px;
+}
+.school-context-hint { margin: 0; color: #5f746e; }
+.school-context-error { margin: 16px 0 0; border: 1px solid #f0c5c5; border-radius: 12px; background: #fce8e8; color: #922e2e; padding: 12px 16px; font-weight: 600; }
+.school-context-heading { margin: 32px 0 18px; }
+.school-context-heading h1 { margin: 0; color: #18332d; font-size: 28px; }
+.school-context-navigation { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #d7e2dc; padding-bottom: 12px; }
+.school-context-navigation button {
+  min-height: 42px;
+  border: 0;
+  border-radius: 10px;
+  background: transparent;
+  color: #5f746e;
+  padding: 0 14px;
+  font: inherit;
+  font-weight: 700;
+}
+.school-context-navigation button:hover { background: #eef6f1; color: #18332d; }
+.school-context-navigation button[aria-current="page"] { background: #e4f3ea; color: #155d3b; }
+.school-context-workspace { margin-top: 24px; }
+.school-switch-backdrop { position: fixed; z-index: 40; inset: 0; display: grid; place-items: center; background: rgb(24 51 45 / 45%); padding: 16px; }
+.school-switch-dialog { width: min(100%, 500px); border: 1px solid #d7e2dc; border-radius: 18px; background: #fff; padding: 24px; box-shadow: 0 20px 50px rgb(24 51 45 / 25%); }
+.school-switch-dialog h2 { margin: 0 0 10px; color: #18332d; }
+.school-switch-dialog p { margin: 0; color: #5f746e; }
+.school-switch-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 24px; }
+.school-switch-actions button { min-height: 44px; border-radius: 10px; padding: 0 14px; font: inherit; font-weight: 700; }
+.school-switch-stay { border: 1px solid #d7e2dc; background: #fff; color: #18332d; }
+.school-switch-discard { border: 0; background: #247a51; color: #fff; }
+@media (min-width: 1024px) and (max-width: 1279px) { .admin-main { margin-left: 72px; } }
+@media (max-width: 1023px) {
+  .admin-main { margin-left: 0; padding: 24px; }
+}
+@media (max-width: 767px) {
+  .admin-main { padding: 20px 16px; }
+  .school-context-switcher { align-items: stretch; flex-direction: column; padding: 20px; }
+  .school-context-label { min-width: 0; }
+  .school-context-heading { margin-top: 24px; }
+  .school-context-heading h1 { font-size: 26px; }
+  .school-context-navigation { align-items: stretch; flex-direction: column; }
+  .school-context-navigation button { text-align: left; }
+  .school-switch-actions { flex-direction: column-reverse; }
+  .school-switch-actions button { width: 100%; }
+}
diff --git a/apps/web/src/main.tsx b/apps/web/src/main.tsx
index 5f758b3..f00f938 100644
--- a/apps/web/src/main.tsx
+++ b/apps/web/src/main.tsx
@@ -78,27 +78,50 @@ export function AdminShell() {
   }, []);
   if (!ready)
     return (
-      <main>
-        <h1>PassionEdu - Quản trị trường</h1>
-        <p>Đang xác thực phiên...</p>
+      <main className="admin-auth-shell">
+        <section className="admin-auth-card" aria-live="polite">
+          <p className="admin-eyebrow">PASSIONEDU</p>
+          <h1>Quản trị trường</h1>
+          <p>Đang xác thực phiên...</p>
+        </section>
       </main>
     );
   if (!session)
     return (
-      <main>
-        <h1>PassionEdu - Quản trị trường</h1>
-        <p>Vui lòng đăng nhập để tiếp tục.</p>
-        <a href={googleLoginUrl("app")}>Đăng nhập với Google</a>
+      <main className="admin-auth-shell">
+        <section className="admin-auth-card">
+          <p className="admin-eyebrow">PASSIONEDU</p>
+          <h1>Quản trị trường</h1>
+          <p>Vui lòng đăng nhập để tiếp tục.</p>
+          <a className="admin-primary-link" href={googleLoginUrl("app")}>
+            Đăng nhập với Google
+          </a>
+        </section>
       </main>
     );
   return (
-    <main>
-      <a href="#school-content">Bỏ qua điều hướng</a>
-      <div id="school-content">
-        <SchoolContext clear={clear} />
-      </div>
-      <button onClick={() => void logout("app", clear)}>Đăng xuất</button>
-    </main>
+    <div className="app-shell admin-app-shell">
+      <aside className="sidebar admin-sidebar" aria-label="Khung quản trị">
+        <div className="brand" aria-label="PassionEdu">
+          <span className="brand-mark" aria-hidden="true">✦</span>
+          <span>PassionEdu</span>
+        </div>
+        <p className="admin-sidebar-copy">Quản trị vận hành trường</p>
+        <div className="admin-sidebar-footer">
+          <span className="admin-session-label">Tài khoản đang đăng nhập</span>
+          <button className="account" onClick={() => void logout("app", clear)}>
+            <span className="avatar" aria-hidden="true">PE</span>
+            <span>Đăng xuất</span>
+          </button>
+        </div>
+      </aside>
+      <main className="admin-main">
+        <a className="admin-skip-link" href="#school-content">Bỏ qua điều hướng</a>
+        <div id="school-content">
+          <SchoolContext clear={clear} />
+        </div>
+      </main>
+    </div>
   );
 }
 
diff --git a/apps/web/src/school-context.test.tsx b/apps/web/src/school-context.test.tsx
index 8f409ad..1c975bb 100644
--- a/apps/web/src/school-context.test.tsx
+++ b/apps/web/src/school-context.test.tsx
@@ -9,6 +9,16 @@ describe('SchoolContext', () => {
     const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'b', schoolName: 'Trường B' }] })));
     const clear = vi.fn(); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={clear} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); await waitFor(() => expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull()); expect(screen.getByRole('option', { name: 'Trường B' })).toBeTruthy(); expect(clear).not.toHaveBeenCalled();
   });
+  it('exposes semantic presentation hooks for the chooser and school workspace', async () => {
+    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context })));
+    vi.stubGlobal('fetch', fetch); const { container } = render(<SchoolContext clear={vi.fn()} />);
+    await screen.findByLabelText('Chọn trường');
+    expect(container.querySelector('.school-context-switcher')).not.toBeNull();
+    fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'a' } });
+    await screen.findByRole('heading', { name: 'PassionEdu - Trường A' });
+    expect(container.querySelector('.school-context-heading')).not.toBeNull();
+    expect(container.querySelector('.school-context-navigation')).not.toBeNull();
+  });
   it('revalidates the open School when the browser returns to the foreground', async () => {
     const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'b', schoolName: 'Trường B' }] })));
     vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.focus(window);
diff --git a/apps/web/src/school-context.tsx b/apps/web/src/school-context.tsx
index 996866f..77c6625 100644
--- a/apps/web/src/school-context.tsx
+++ b/apps/web/src/school-context.tsx
@@ -180,14 +180,26 @@ export function SchoolContext({ clear }: { clear: () => void }) {
   }, []);
   const updateLeaveReviewStatus = useCallback((status: WorkspaceStatus) => setLeaveReviewStatus(status), []);
   const updateFinanceStatus = useCallback((status: FinanceStatus) => setFinanceStatus(status), []);
-  if (!schools) return <p>Đang tải ngữ cảnh trường...</p>;
+  if (!schools)
+    return (
+      <section className="school-context school-context-loading" aria-live="polite">
+        <p>Đang tải ngữ cảnh trường...</p>
+      </section>
+    );
   if (!schools.length)
-    return <p>Không có trường nào đang cấp quyền cho tài khoản này.</p>;
+    return (
+      <section className="school-context school-context-empty">
+        <p className="school-context-kicker">NGỮ CẢNH TRƯỜNG</p>
+        <h1>Chưa có trường được cấp quyền</h1>
+        <p>Không có trường nào đang cấp quyền cho tài khoản này.</p>
+      </section>
+    );
   return (
     <section className="school-context">
-      <label>
-        Chọn trường{" "}
-        <select
+      <div className="school-context-switcher">
+        <label className="school-context-label">
+          <span>Chọn trường</span>
+          <select
           aria-label="Chọn trường"
           value={context?.schoolId ?? ""}
           disabled={Boolean(
@@ -203,15 +215,20 @@ export function SchoolContext({ clear }: { clear: () => void }) {
               {school.schoolName}
             </option>
           ))}
-        </select>
-      </label>
-      {error && <p role="alert">{error}</p>}
+          </select>
+        </label>
+        {!context && <p className="school-context-hint">Chọn một trường để bắt đầu công việc.</p>}
+      </div>
+      {error && <p className="school-context-error" role="alert">{error}</p>}
       {context && (
         <>
-          <h1 ref={heading} tabIndex={-1}>
+          <header className="school-context-heading">
+            <p className="school-context-kicker">NGỮ CẢNH ĐANG LÀM VIỆC</p>
+            <h1 ref={heading} tabIndex={-1}>
             PassionEdu - {context.schoolName}
-          </h1>
-          <nav aria-label="Điều hướng trường">
+            </h1>
+          </header>
+          <nav className="school-context-navigation" aria-label="Điều hướng trường">
             {context.navigation.map((item) =>
               item.id === "roster" ||
               item.id === "settings" || item.id === "leave-review" || item.id === "finance" ? (
@@ -227,6 +244,7 @@ export function SchoolContext({ clear }: { clear: () => void }) {
               ),
             )}
           </nav>
+          <div className="school-context-workspace">
           {view === "roster" &&
           context.capabilities.includes("ROSTER_MANAGE") ? (
             <RosterWorkspace
@@ -255,19 +273,23 @@ export function SchoolContext({ clear }: { clear: () => void }) {
           ) : view === "finance" && context.capabilities.includes("FINANCE_MANAGE") ? (
             <FinanceWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={() => { clearContext(); void refreshChooser(); }} onStatusChange={updateFinanceStatus} />
           ) : null}
+          </div>
         </>
       )}
       {switchTo && (
-        <div ref={dialog} role="dialog" aria-modal="true">
+        <div className="school-switch-backdrop">
+        <div className="school-switch-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="school-switch-title">
           {switchTo ? (
             <>
-              <h2>Đổi trường?</h2>
+              <h2 id="school-switch-title">Đổi trường?</h2>
               <p>
                 Biểu mẫu đang có nội dung chưa gửi hoặc thao tác đang được đối
                 soát.
               </p>
-              <button onClick={() => setSwitchTo(undefined)}>Ở lại</button>
+              <div className="school-switch-actions">
+              <button className="school-switch-stay" onClick={() => setSwitchTo(undefined)}>Ở lại</button>
               <button
+                className="school-switch-discard"
                 onClick={() => {
                   const target = switchTo;
                   setSwitchTo(undefined);
@@ -282,9 +304,11 @@ export function SchoolContext({ clear }: { clear: () => void }) {
               >
                 Bỏ nội dung và đổi trường
               </button>
+              </div>
             </>
           ) : null}
         </div>
+        </div>
       )}
     </section>
   );
diff --git a/apps/web/src/shell.test.tsx b/apps/web/src/shell.test.tsx
index 8f70f5d..c559e19 100644
--- a/apps/web/src/shell.test.tsx
+++ b/apps/web/src/shell.test.tsx
@@ -10,6 +10,8 @@ describe('AdminShell', () => {
     render(<AdminShell />);
     await screen.findByRole('link', { name: 'Đăng nhập với Google' });
     expect(screen.queryByText('Cổng quản trị đang được khởi tạo.')).toBeNull();
+    expect(document.querySelector('.admin-auth-shell')).not.toBeNull();
+    expect(document.querySelector('.admin-auth-card')).not.toBeNull();
   });
 
   it('clears protected content before a logout request settles', async () => {
@@ -18,6 +20,8 @@ describe('AdminShell', () => {
     vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'app', userIdentityId: 'id', email: 'a@example.com' } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
     render(<AdminShell />);
     await screen.findByText('Đang tải ngữ cảnh trường...');
+    expect(document.querySelector('.admin-app-shell')).not.toBeNull();
+    expect(document.querySelector('.admin-main')).not.toBeNull();
     fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
     expect(screen.queryByText('Đang tải ngữ cảnh trường...')).toBeNull();
     expect(screen.getByRole('link', { name: 'Đăng nhập với Google' }).getAttribute('href')).toBe('/api/app/auth/google/start');

Do not invoke any skill. Return only the review result.
