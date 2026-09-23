# Prompt review: Tái cấu trúc Danh bộ theo đối tượng quản lý

Chạy **mỗi phần** sau trong một session độc lập và gửi lại nguyên văn kết quả.

## Blind Hunter

Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:
```diff
diff --git a/apps/web/src/index.css b/apps/web/src/index.css
index b389ead..78e2e11 100644
--- a/apps/web/src/index.css
+++ b/apps/web/src/index.css
@@ -968,6 +968,13 @@ tbody tr:last-child td {
     justify-content: center;
   }
 }
+
+.school-context-nav-group { display: grid; gap: 4px; }
+.school-context-nav-group-toggle { font-weight: 750 !important; }
+.school-context-nav-group-toggle::after { content: "⌄"; margin-left: auto; }
+.school-context-nav-group-toggle[aria-expanded="false"]::after { content: "›"; }
+.school-context-nav-submenu { display: grid; gap: 2px; padding-left: 12px; }
+.school-context-nav-submenu button { font-size: 13px; }
 @media (max-width: 900px) {
   .invoice-detail-grid {
     grid-template-columns: 1fr;
diff --git a/apps/web/src/roster/roster-workspace.tsx b/apps/web/src/roster/roster-workspace.tsx
index 2105cd8..734f21e 100644
--- a/apps/web/src/roster/roster-workspace.tsx
+++ b/apps/web/src/roster/roster-workspace.tsx
@@ -195,11 +195,13 @@ export function RosterWorkspace({
   schoolName,
   denied,
   onStatusChange,
+  section = "students",
 }: {
   schoolId: string;
   schoolName: string;
   denied: () => void;
   onStatusChange?: (status: Status) => void;
+  section?: "students" | "parents" | "staff" | "classes" | "years" | "positions";
 }) {
   const [years, setYears] = useState<SchoolYear[]>([]);
   const [yearId, setYearId] = useState("");
@@ -1119,8 +1121,8 @@ export function RosterWorkspace({
   };

   return (
-    <section className="roster-workspace" aria-labelledby="roster-title">
-      <h2 id="roster-title">Danh bộ</h2>
+    <section className={`roster-workspace roster-workspace-${section}`} aria-labelledby="roster-title">
+      <h2 id="roster-title">{({ students: "Học sinh", parents: "Phụ huynh", staff: "Nhân viên / Giáo viên", classes: "Lớp học", years: "Năm học", positions: "Chức danh & capability" } as const)[section]}</h2>
       <p>
         {schoolName}
         {selected ? ` / ${selected.name}` : " / Chưa có năm học"}
diff --git a/apps/web/src/school-context.test.tsx b/apps/web/src/school-context.test.tsx
index 1c975bb..f19ce0d 100644
--- a/apps/web/src/school-context.test.tsx
+++ b/apps/web/src/school-context.test.tsx
@@ -32,7 +32,7 @@ describe('SchoolContext', () => {
   it('exposes server-projected roster navigation and protects dirty roster input on switch', async () => {
     const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
     const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: rosterContext }))).mockResolvedValue(new Response(JSON.stringify({ data: [] })));
-    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Danh bộ' }); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
+    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Học sinh' }); expect(screen.getByRole('button', { name: 'Phụ huynh' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Nhân viên / Giáo viên' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lớp học' })).toBeTruthy(); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
     expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi'); expect((screen.getByLabelText('Tên năm học') as HTMLInputElement).value).toBe('Năm 2026');
   });
   it('integrates Settings navigation and guards a dirty Settings form before switching School', async () => {
diff --git a/apps/web/src/school-context.tsx b/apps/web/src/school-context.tsx
index b0892ab..39027ed 100644
--- a/apps/web/src/school-context.tsx
+++ b/apps/web/src/school-context.tsx
@@ -38,7 +38,9 @@ const denied = (status: number) => [401, 403, 404].includes(status);
 export function SchoolContext({ clear }: { clear: () => void }) {
   const [schools, setSchools] = useState<School[]>();
   const [context, setContext] = useState<Context>();
-  const [view, setView] = useState<"roster" | "settings" | "leave-review" | "finance">("roster");
+  type View = "students" | "parents" | "staff" | "classes" | "years" | "positions" | "settings" | "leave-review" | "finance";
+  const [view, setView] = useState<View>("students");
+  const [expanded, setExpanded] = useState<Record<"roster" | "settings", boolean>>({ roster: false, settings: false });
   const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
     dirty: false,
     pending: false,
@@ -74,7 +76,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
     setFinanceStatus({ dirty: false, pending: false });
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setSwitchTo(undefined);
   };
   const refreshChooser = async () => {
@@ -95,7 +98,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     selected.current = schoolId;
     stop();
     setContext(undefined);
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setRosterStatus({ dirty: false, pending: false });
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
@@ -112,6 +116,10 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     const next = ((await response.json()) as { data: Context }).data;
     if (!current(schoolId, requestVersion)) return;
     setContext(next);
+    if (!next.navigation.some((item) => item.id === "roster") && next.navigation.some((item) => item.id === "settings")) {
+      setView("settings");
+      setExpanded({ roster: false, settings: true });
+    }
   };
   useEffect(() => {
     mounted.current = true;
@@ -229,22 +237,26 @@ export function SchoolContext({ clear }: { clear: () => void }) {
             </h1>
           </header>
             <nav className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự">
-            {context.navigation.map((item) =>
-              item.id === "roster" ||
-              item.id === "settings" || item.id === "leave-review" || item.id === "finance" ? (
-                <button
-                  key={item.id}
-                  className={`school-context-nav-item school-context-nav-${item.id}`}
-                  aria-current={view === item.id ? "page" : undefined}
-                  onClick={() => setView(item.id as typeof view)}
-                >
-                  {item.label}
-                </button>
-              ) : null,
-            )}
-          </nav>
+              {context.navigation.some((item) => item.id === "roster") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.roster} onClick={() => { setExpanded((value) => ({ ...value, roster: !value.roster })); setView("students"); }}>Danh bộ</button>
+                  {expanded.roster && <div className="school-context-nav-submenu">
+                    {([['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên / Giáo viên'], ['classes', 'Lớp học']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.some((item) => item.id === "settings") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.settings} onClick={() => { setExpanded((value) => ({ ...value, settings: !value.settings })); setView("settings"); }}>Cấu hình trường</button>
+                  {expanded.settings && <div className="school-context-nav-submenu">
+                    {([['years', 'Năm học'], ['positions', 'Chức danh & capability'], ['settings', 'Chính sách trường']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.filter((item) => item.id === "leave-review" || item.id === "finance").map((item) => <button key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id as View)}>{item.label}</button>)}
+            </nav>
           <div className="school-context-workspace">
-          {view === "roster" &&
+          {(["students", "parents", "staff", "classes", "years", "positions"] as View[]).includes(view) &&
           context.capabilities.includes("ROSTER_MANAGE") ? (
             <RosterWorkspace
               schoolId={context.schoolId}
@@ -254,6 +266,7 @@ export function SchoolContext({ clear }: { clear: () => void }) {
                 void refreshChooser();
               }}
               onStatusChange={updateRosterStatus}
+              section={view as "students" | "parents" | "staff" | "classes" | "years" | "positions"}
             />
           ) : view === "settings" &&
             context.capabilities.includes("SETTINGS_MANAGE") ? (

```

Do not invoke any skill. Return only the review result.

## Edge Case Hunter

Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/edge-case-hunter.md` completely and follow it as your review instructions.

Review content:

```diff
diff --git a/apps/web/src/index.css b/apps/web/src/index.css
index b389ead..78e2e11 100644
--- a/apps/web/src/index.css
+++ b/apps/web/src/index.css
@@ -968,6 +968,13 @@ tbody tr:last-child td {
     justify-content: center;
   }
 }
+
+.school-context-nav-group { display: grid; gap: 4px; }
+.school-context-nav-group-toggle { font-weight: 750 !important; }
+.school-context-nav-group-toggle::after { content: "⌄"; margin-left: auto; }
+.school-context-nav-group-toggle[aria-expanded="false"]::after { content: "›"; }
+.school-context-nav-submenu { display: grid; gap: 2px; padding-left: 12px; }
+.school-context-nav-submenu button { font-size: 13px; }
 @media (max-width: 900px) {
   .invoice-detail-grid {
     grid-template-columns: 1fr;
diff --git a/apps/web/src/roster/roster-workspace.tsx b/apps/web/src/roster/roster-workspace.tsx
index 2105cd8..734f21e 100644
--- a/apps/web/src/roster/roster-workspace.tsx
+++ b/apps/web/src/roster/roster-workspace.tsx
@@ -195,11 +195,13 @@ export function RosterWorkspace({
   schoolName,
   denied,
   onStatusChange,
+  section = "students",
 }: {
   schoolId: string;
   schoolName: string;
   denied: () => void;
   onStatusChange?: (status: Status) => void;
+  section?: "students" | "parents" | "staff" | "classes" | "years" | "positions";
 }) {
   const [years, setYears] = useState<SchoolYear[]>([]);
   const [yearId, setYearId] = useState("");
@@ -1119,8 +1121,8 @@ export function RosterWorkspace({
   };

   return (
-    <section className="roster-workspace" aria-labelledby="roster-title">
-      <h2 id="roster-title">Danh bộ</h2>
+    <section className={`roster-workspace roster-workspace-${section}`} aria-labelledby="roster-title">
+      <h2 id="roster-title">{({ students: "Học sinh", parents: "Phụ huynh", staff: "Nhân viên / Giáo viên", classes: "Lớp học", years: "Năm học", positions: "Chức danh & capability" } as const)[section]}</h2>
       <p>
         {schoolName}
         {selected ? ` / ${selected.name}` : " / Chưa có năm học"}
diff --git a/apps/web/src/school-context.test.tsx b/apps/web/src/school-context.test.tsx
index 1c975bb..f19ce0d 100644
--- a/apps/web/src/school-context.test.tsx
+++ b/apps/web/src/school-context.test.tsx
@@ -32,7 +32,7 @@ describe('SchoolContext', () => {
   it('exposes server-projected roster navigation and protects dirty roster input on switch', async () => {
     const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
     const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: rosterContext }))).mockResolvedValue(new Response(JSON.stringify({ data: [] })));
-    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Danh bộ' }); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
+    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Học sinh' }); expect(screen.getByRole('button', { name: 'Phụ huynh' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Nhân viên / Giáo viên' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lớp học' })).toBeTruthy(); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
     expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi'); expect((screen.getByLabelText('Tên năm học') as HTMLInputElement).value).toBe('Năm 2026');
   });
   it('integrates Settings navigation and guards a dirty Settings form before switching School', async () => {
diff --git a/apps/web/src/school-context.tsx b/apps/web/src/school-context.tsx
index b0892ab..39027ed 100644
--- a/apps/web/src/school-context.tsx
+++ b/apps/web/src/school-context.tsx
@@ -38,7 +38,9 @@ const denied = (status: number) => [401, 403, 404].includes(status);
 export function SchoolContext({ clear }: { clear: () => void }) {
   const [schools, setSchools] = useState<School[]>();
   const [context, setContext] = useState<Context>();
-  const [view, setView] = useState<"roster" | "settings" | "leave-review" | "finance">("roster");
+  type View = "students" | "parents" | "staff" | "classes" | "years" | "positions" | "settings" | "leave-review" | "finance";
+  const [view, setView] = useState<View>("students");
+  const [expanded, setExpanded] = useState<Record<"roster" | "settings", boolean>>({ roster: false, settings: false });
   const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
     dirty: false,
     pending: false,
@@ -74,7 +76,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
     setFinanceStatus({ dirty: false, pending: false });
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setSwitchTo(undefined);
   };
   const refreshChooser = async () => {
@@ -95,7 +98,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     selected.current = schoolId;
     stop();
     setContext(undefined);
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setRosterStatus({ dirty: false, pending: false });
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
@@ -112,6 +116,10 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     const next = ((await response.json()) as { data: Context }).data;
     if (!current(schoolId, requestVersion)) return;
     setContext(next);
+    if (!next.navigation.some((item) => item.id === "roster") && next.navigation.some((item) => item.id === "settings")) {
+      setView("settings");
+      setExpanded({ roster: false, settings: true });
+    }
   };
   useEffect(() => {
     mounted.current = true;
@@ -229,22 +237,26 @@ export function SchoolContext({ clear }: { clear: () => void }) {
             </h1>
           </header>
             <nav className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự">
-            {context.navigation.map((item) =>
-              item.id === "roster" ||
-              item.id === "settings" || item.id === "leave-review" || item.id === "finance" ? (
-                <button
-                  key={item.id}
-                  className={`school-context-nav-item school-context-nav-${item.id}`}
-                  aria-current={view === item.id ? "page" : undefined}
-                  onClick={() => setView(item.id as typeof view)}
-                >
-                  {item.label}
-                </button>
-              ) : null,
-            )}
-          </nav>
+              {context.navigation.some((item) => item.id === "roster") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.roster} onClick={() => { setExpanded((value) => ({ ...value, roster: !value.roster })); setView("students"); }}>Danh bộ</button>
+                  {expanded.roster && <div className="school-context-nav-submenu">
+                    {([['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên / Giáo viên'], ['classes', 'Lớp học']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.some((item) => item.id === "settings") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.settings} onClick={() => { setExpanded((value) => ({ ...value, settings: !value.settings })); setView("settings"); }}>Cấu hình trường</button>
+                  {expanded.settings && <div className="school-context-nav-submenu">
+                    {([['years', 'Năm học'], ['positions', 'Chức danh & capability'], ['settings', 'Chính sách trường']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.filter((item) => item.id === "leave-review" || item.id === "finance").map((item) => <button key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id as View)}>{item.label}</button>)}
+            </nav>
           <div className="school-context-workspace">
-          {view === "roster" &&
+          {(["students", "parents", "staff", "classes", "years", "positions"] as View[]).includes(view) &&
           context.capabilities.includes("ROSTER_MANAGE") ? (
             <RosterWorkspace
               schoolId={context.schoolId}
@@ -254,6 +266,7 @@ export function SchoolContext({ clear }: { clear: () => void }) {
                 void refreshChooser();
               }}
               onStatusChange={updateRosterStatus}
+              section={view as "students" | "parents" | "staff" | "classes" | "years" | "positions"}
             />
           ) : view === "settings" &&
             context.capabilities.includes("SETTINGS_MANAGE") ? (

```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.

## Verification Gap Reviewer

Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/verification-gap.md` completely and follow it as your review instructions.

Review content:

```diff
diff --git a/apps/web/src/index.css b/apps/web/src/index.css
index b389ead..78e2e11 100644
--- a/apps/web/src/index.css
+++ b/apps/web/src/index.css
@@ -968,6 +968,13 @@ tbody tr:last-child td {
     justify-content: center;
   }
 }
+
+.school-context-nav-group { display: grid; gap: 4px; }
+.school-context-nav-group-toggle { font-weight: 750 !important; }
+.school-context-nav-group-toggle::after { content: "⌄"; margin-left: auto; }
+.school-context-nav-group-toggle[aria-expanded="false"]::after { content: "›"; }
+.school-context-nav-submenu { display: grid; gap: 2px; padding-left: 12px; }
+.school-context-nav-submenu button { font-size: 13px; }
 @media (max-width: 900px) {
   .invoice-detail-grid {
     grid-template-columns: 1fr;
diff --git a/apps/web/src/roster/roster-workspace.tsx b/apps/web/src/roster/roster-workspace.tsx
index 2105cd8..734f21e 100644
--- a/apps/web/src/roster/roster-workspace.tsx
+++ b/apps/web/src/roster/roster-workspace.tsx
@@ -195,11 +195,13 @@ export function RosterWorkspace({
   schoolName,
   denied,
   onStatusChange,
+  section = "students",
 }: {
   schoolId: string;
   schoolName: string;
   denied: () => void;
   onStatusChange?: (status: Status) => void;
+  section?: "students" | "parents" | "staff" | "classes" | "years" | "positions";
 }) {
   const [years, setYears] = useState<SchoolYear[]>([]);
   const [yearId, setYearId] = useState("");
@@ -1119,8 +1121,8 @@ export function RosterWorkspace({
   };

   return (
-    <section className="roster-workspace" aria-labelledby="roster-title">
-      <h2 id="roster-title">Danh bộ</h2>
+    <section className={`roster-workspace roster-workspace-${section}`} aria-labelledby="roster-title">
+      <h2 id="roster-title">{({ students: "Học sinh", parents: "Phụ huynh", staff: "Nhân viên / Giáo viên", classes: "Lớp học", years: "Năm học", positions: "Chức danh & capability" } as const)[section]}</h2>
       <p>
         {schoolName}
         {selected ? ` / ${selected.name}` : " / Chưa có năm học"}
diff --git a/apps/web/src/school-context.test.tsx b/apps/web/src/school-context.test.tsx
index 1c975bb..f19ce0d 100644
--- a/apps/web/src/school-context.test.tsx
+++ b/apps/web/src/school-context.test.tsx
@@ -32,7 +32,7 @@ describe('SchoolContext', () => {
   it('exposes server-projected roster navigation and protects dirty roster input on switch', async () => {
     const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
     const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: rosterContext }))).mockResolvedValue(new Response(JSON.stringify({ data: [] })));
-    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Danh bộ' }); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
+    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Danh bộ' })); await screen.findByRole('heading', { name: 'Học sinh' }); expect(screen.getByRole('button', { name: 'Phụ huynh' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Nhân viên / Giáo viên' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lớp học' })).toBeTruthy(); fireEvent.change(screen.getByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
     expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi'); expect((screen.getByLabelText('Tên năm học') as HTMLInputElement).value).toBe('Năm 2026');
   });
   it('integrates Settings navigation and guards a dirty Settings form before switching School', async () => {
diff --git a/apps/web/src/school-context.tsx b/apps/web/src/school-context.tsx
index b0892ab..39027ed 100644
--- a/apps/web/src/school-context.tsx
+++ b/apps/web/src/school-context.tsx
@@ -38,7 +38,9 @@ const denied = (status: number) => [401, 403, 404].includes(status);
 export function SchoolContext({ clear }: { clear: () => void }) {
   const [schools, setSchools] = useState<School[]>();
   const [context, setContext] = useState<Context>();
-  const [view, setView] = useState<"roster" | "settings" | "leave-review" | "finance">("roster");
+  type View = "students" | "parents" | "staff" | "classes" | "years" | "positions" | "settings" | "leave-review" | "finance";
+  const [view, setView] = useState<View>("students");
+  const [expanded, setExpanded] = useState<Record<"roster" | "settings", boolean>>({ roster: false, settings: false });
   const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
     dirty: false,
     pending: false,
@@ -74,7 +76,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
     setFinanceStatus({ dirty: false, pending: false });
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setSwitchTo(undefined);
   };
   const refreshChooser = async () => {
@@ -95,7 +98,8 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     selected.current = schoolId;
     stop();
     setContext(undefined);
-    setView("roster");
+    setView("students");
+    setExpanded({ roster: false, settings: false });
     setRosterStatus({ dirty: false, pending: false });
     setSettingsStatus({ dirty: false, pending: false });
     setLeaveReviewStatus({ dirty: false, pending: false });
@@ -112,6 +116,10 @@ export function SchoolContext({ clear }: { clear: () => void }) {
     const next = ((await response.json()) as { data: Context }).data;
     if (!current(schoolId, requestVersion)) return;
     setContext(next);
+    if (!next.navigation.some((item) => item.id === "roster") && next.navigation.some((item) => item.id === "settings")) {
+      setView("settings");
+      setExpanded({ roster: false, settings: true });
+    }
   };
   useEffect(() => {
     mounted.current = true;
@@ -229,22 +237,26 @@ export function SchoolContext({ clear }: { clear: () => void }) {
             </h1>
           </header>
             <nav className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự">
-            {context.navigation.map((item) =>
-              item.id === "roster" ||
-              item.id === "settings" || item.id === "leave-review" || item.id === "finance" ? (
-                <button
-                  key={item.id}
-                  className={`school-context-nav-item school-context-nav-${item.id}`}
-                  aria-current={view === item.id ? "page" : undefined}
-                  onClick={() => setView(item.id as typeof view)}
-                >
-                  {item.label}
-                </button>
-              ) : null,
-            )}
-          </nav>
+              {context.navigation.some((item) => item.id === "roster") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.roster} onClick={() => { setExpanded((value) => ({ ...value, roster: !value.roster })); setView("students"); }}>Danh bộ</button>
+                  {expanded.roster && <div className="school-context-nav-submenu">
+                    {([['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên / Giáo viên'], ['classes', 'Lớp học']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.some((item) => item.id === "settings") && (
+                <section className="school-context-nav-group">
+                  <button className="school-context-nav-group-toggle" aria-expanded={expanded.settings} onClick={() => { setExpanded((value) => ({ ...value, settings: !value.settings })); setView("settings"); }}>Cấu hình trường</button>
+                  {expanded.settings && <div className="school-context-nav-submenu">
+                    {([['years', 'Năm học'], ['positions', 'Chức danh & capability'], ['settings', 'Chính sách trường']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
+                  </div>}
+                </section>
+              )}
+              {context.navigation.filter((item) => item.id === "leave-review" || item.id === "finance").map((item) => <button key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id as View)}>{item.label}</button>)}
+            </nav>
           <div className="school-context-workspace">
-          {view === "roster" &&
+          {(["students", "parents", "staff", "classes", "years", "positions"] as View[]).includes(view) &&
           context.capabilities.includes("ROSTER_MANAGE") ? (
             <RosterWorkspace
               schoolId={context.schoolId}
@@ -254,6 +266,7 @@ export function SchoolContext({ clear }: { clear: () => void }) {
                 void refreshChooser();
               }}
               onStatusChange={updateRosterStatus}
+              section={view as "students" | "parents" | "staff" | "classes" | "years" | "positions"}
             />
           ) : view === "settings" &&
             context.capabilities.includes("SETTINGS_MANAGE") ? (

```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.
