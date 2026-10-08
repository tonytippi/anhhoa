import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LeaveReviewWorkspace } from "./attendance/leave-review-workspace";
import { FinanceWorkspace, type FinancePage } from "./finance/finance-workspace";
import { ExtracurricularClassesWorkspace } from "./finance/extracurricular-classes-workspace";
import { FinanceReportsWorkspace } from "./finance/finance-reports-workspace";
import { ReceiptQueueWorkspace } from "./finance/receipt-queue-workspace";
import { OverviewWorkspace } from "./overview/overview-workspace";
import { RosterWorkspace } from "./roster/roster-workspace";
import { SettingsWorkspace, type SettingsStatus } from "./settings/settings-workspace";

type School = { schoolId: string; schoolSlug: string; schoolName: string };
type View = "overview" | "students" | "parents" | "staff" | "classes" | "transitions" | "years" | "positions" | "settings" | "leave-review" | FinancePage | "receipt-queue" | "finance-reports" | "extracurricular-classes";
type Context = { schoolId: string; schoolSlug: string; schoolName: string; positionName?: string; membershipId: string; capabilities: Array<"SCHOOL_CONTEXT_READ" | "ROSTER_MANAGE" | "SETTINGS_MANAGE" | "LEAVE_REQUEST_DECIDE" | "FINANCE_MANAGE" | "OPERATIONAL_QUEUE_READ">; navigation: Array<{ id: string; label: string }> };
type WorkspaceStatus = { dirty: boolean; pending: boolean; dialogOpen?: boolean; reconcile?: () => void };
type Destination = { schoolSlug: string; page: View; runId?: string; invoiceId?: string };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const pages: View[] = ["overview", "students", "parents", "staff", "classes", "transitions", "years", "positions", "settings", "leave-review", "receivables", "promotions", "collection-runs", "receipt-queue", "finance-reports", "extracurricular-classes"];
const denied = (status: number) => [401, 403, 404].includes(status);
const selectionKey = (userIdentityId: string) => `passionedu:app:selected-school:${userIdentityId}`;
const pathFor = ({ schoolSlug, page, runId, invoiceId }: Destination) => `/schools/${schoolSlug}/${page}${page === "collection-runs" && runId ? `/${runId}${invoiceId ? `/invoices/${invoiceId}` : ""}` : ""}`;
const destinationFromPath = (pathname: string): Destination | undefined => {
  const match = /^\/schools\/([^/]+)\/([^/]+)(?:\/([^/]+)(?:\/invoices\/([^/]+))?)?$/.exec(pathname);
  if (!match || !pages.includes(match[2] as View)) return undefined;
  if (match[3] && match[2] !== "collection-runs") return undefined;
  return { schoolSlug: match[1]!, page: match[2] as View, runId: match[3], invoiceId: match[4] };
};
const allowedPages = (context: Context): View[] => {
  const has = (id: string) => context.navigation.some((item) => item.id === id);
  const result: View[] = [];
  if (has("overview") && context.capabilities.includes("SCHOOL_CONTEXT_READ")) result.push("overview");
  if (has("roster") && context.capabilities.includes("ROSTER_MANAGE")) result.push("students", "parents", "staff", "classes", "transitions");
  if (has("settings") && context.capabilities.includes("ROSTER_MANAGE")) result.push("years", "positions");
  if (has("settings") && context.capabilities.includes("SETTINGS_MANAGE")) result.push("settings");
  if (has("leave-review") && context.capabilities.includes("LEAVE_REQUEST_DECIDE")) result.push("leave-review");
  if (has("receivables") && context.capabilities.includes("FINANCE_MANAGE")) result.push("receivables");
  if (has("promotions") && context.capabilities.includes("FINANCE_MANAGE")) result.push("promotions");
  if (has("collection-runs") && context.capabilities.includes("FINANCE_MANAGE")) result.push("collection-runs");
  if (has("receipt-queue") && context.capabilities.includes("FINANCE_MANAGE")) result.push("receipt-queue");
  if (has("finance-reports") && context.capabilities.includes("FINANCE_MANAGE")) result.push("finance-reports");
  if (has("extracurricular-classes") && context.capabilities.includes("FINANCE_MANAGE")) result.push("extracurricular-classes");
  return result;
};

type NavigationIconName = "overview" | "roster" | "settings" | "leave-review" | "finance";

function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths = {
    overview: <><path d="M3 11.5 12 4l9 7.5v8.25a.75.75 0 0 1-.75.75H15v-6H9v6H3.75a.75.75 0 0 1-.75-.75Z" /><path d="M9 20.5v-6h6v6" /></>,
    roster: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.7-3.1 2.6-4.75 5.5-4.75s4.8 1.65 5.5 4.75M16 8h4M18 6v4M15.5 16.5c2.7.2 4.3 1.37 5 3.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.08 2.08-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.07h-2.94v-.07a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.08-2.08.06-.06A1.7 1.7 0 0 0 7.16 15a1.7 1.7 0 0 0-1.56-1.03h-.07v-2.94h.07A1.7 1.7 0 0 0 7.16 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.08-2.08.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.07h2.94v.07A1.7 1.7 0 0 0 15.78 6.4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.08 2.08-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.03h.07v2.94h-.07A1.7 1.7 0 0 0 19.4 15Z" /></>,
    "leave-review": <><path d="M5 3.5h11l3 3V20a.75.75 0 0 1-.75.75h-13.5A.75.75 0 0 1 4 20V4.5a1 1 0 0 1 1-1Z" /><path d="M8 12.5 10.5 15 16 9.5M8 6.5h7" /></>,
    finance: <><path d="M4 6.5h16v11H4zM4 10h16M7.5 14h3" /><circle cx="16.5" cy="14" r="1" /></>,
  } satisfies Record<NavigationIconName, ReactNode>;
  return <svg className="school-context-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function SchoolContext({ clear, userIdentityId, registerHomeNavigation, onRoleChange }: { clear: () => void; userIdentityId: string; registerHomeNavigation?: (navigateHome: () => void) => void; onRoleChange?: (role: string | undefined) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [view, setView] = useState<View>("overview");
  const [expanded, setExpanded] = useState<Record<"roster" | "settings" | "finance", boolean>>({ roster: true, settings: false, finance: false });
  const [railGroup, setRailGroup] = useState<"roster" | "settings" | "finance">();
  const [isRail, setIsRail] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px) and (max-width: 1023px)").matches);
  const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [settingsStatus, setSettingsStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [leaveReviewStatus, setLeaveReviewStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [financeStatus, setFinanceStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [switchTo, setSwitchTo] = useState<{ path: string; destination?: Destination }>();
  const [showChooser, setShowChooser] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  const selected = useRef<string | undefined>(undefined);
  const version = useRef(0);
  const loadedPath = useRef<string | undefined>(undefined);
  const committed = useRef<Destination | undefined>(undefined);
  const statuses = useRef([rosterStatus, settingsStatus, leaveReviewStatus, financeStatus]);
  const dialog = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const railBlurTimer = useRef<number | undefined>(undefined);
  statuses.current = [rosterStatus, settingsStatus, leaveReviewStatus, financeStatus];

  const unresolved = () => statuses.current.some((status) => status.dirty || status.pending);
  const hasPending = () => statuses.current.some((status) => status.pending);
  const forgetSchoolId = () => { try { window.localStorage.removeItem(selectionKey(userIdentityId)); } catch { /* UX hint only. */ } };
  const clearProtectedState = () => {
    version.current += 1;
    selected.current = undefined;
    committed.current = undefined;
    setContext(undefined);
    setRosterStatus({ dirty: false, pending: false, dialogOpen: false });
    setSettingsStatus({ dirty: false, pending: false });
    setLeaveReviewStatus({ dirty: false, pending: false });
    setFinanceStatus({ dirty: false, pending: false });
  };
  const setPage = (page: View) => {
    setView(page);
    setExpanded({ roster: ["students", "parents", "staff", "classes", "transitions", "extracurricular-classes"].includes(page), settings: ["years", "positions", "settings"].includes(page), finance: ["receivables", "promotions", "collection-runs", "receipt-queue", "finance-reports"].includes(page) });
  };
  const refreshChooser = async () => {
    const response = await fetch(`${apiUrl}/api/app/schools`, { credentials: "include" });
    if (response.status === 401) { clearProtectedState(); clear(); return; }
    if (!response.ok) throw new Error("Không thể tải danh sách trường.");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw new Error("Không thể tải danh sách trường.");
    const next = payload.data as School[];
    if (!mounted.current) return;
    setSchools(next);
    if (selected.current && !next.some((school) => school.schoolId === selected.current)) {
      forgetSchoolId();
      clearProtectedState();
      setShowChooser(true);
      navigate('/', { replace: true });
      return;
    }
    setShowChooser(true);
  };
  const applyDestination = (next: Context, destination: Destination) => {
    const page = allowedPages(next).includes(destination.page) ? destination.page : allowedPages(next)[0];
    if (!page) {
      clearProtectedState();
      setShowChooser(true);
      navigate("/", { replace: true });
      return;
    }
    setContext(next);
    setPage(page);
    committed.current = { schoolSlug: next.schoolSlug, page, runId: page === "collection-runs" ? destination.runId : undefined, invoiceId: page === "collection-runs" ? destination.invoiceId : undefined };
    setShowChooser(false);
    if (page !== destination.page) navigate(pathFor({ schoolSlug: next.schoolSlug, page }), { replace: true });
  };
  const load = async (destination: Destination, school: School) => {
    clearProtectedState();
    const requestVersion = ++version.current;
    selected.current = school.schoolId;
    const response = await fetch(`${apiUrl}/api/app/schools/${school.schoolId}`, { credentials: "include" });
    if (!mounted.current || selected.current !== school.schoolId || version.current !== requestVersion) return;
    if (denied(response.status)) {
      forgetSchoolId();
      clearProtectedState();
      setShowChooser(true);
      navigate("/", { replace: true });
      void refreshChooser().catch((cause: Error) => setError(cause.message));
      return;
    }
    if (!response.ok) throw new Error("Không thể tải ngữ cảnh trường.");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !payload.data || typeof payload.data !== "object") {
      clearProtectedState();
      setShowChooser(true);
      navigate("/", { replace: true });
      return;
    }
    const next = payload.data as Context;
    // Both server-authorized selector values must match before protected UI renders.
    if (!mounted.current || selected.current !== school.schoolId || next.schoolId !== school.schoolId || next.schoolSlug !== school.schoolSlug) {
      if (mounted.current && (next.schoolId !== school.schoolId || next.schoolSlug !== school.schoolSlug)) {
        clearProtectedState();
        setShowChooser(true);
        navigate("/", { replace: true });
      }
      return;
    }
    applyDestination(next, destination);
  };
  const requestPath = (path: string, destination?: Destination) => {
    if (context && unresolved()) { setSwitchTo({ path, destination }); return; }
    navigate(path);
  };
  const requestDestination = (destination: Destination) => {
    requestPath(pathFor(destination), destination);
  };
  const retryRoute = () => {
    setError("");
    loadedPath.current = undefined;
    if (!schools) void refreshChooser().catch((cause: Error) => setError(cause.message));
    else setRetry((value) => value + 1);
  };

  useEffect(() => {
    mounted.current = true;
    clearProtectedState();
    setSchools(undefined);
    setShowChooser(false);
    setError("");
    void refreshChooser().catch((cause: Error) => setError(cause.message));
    return () => { mounted.current = false; };
  }, [userIdentityId]);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => { setIsRail(query.matches); if (!query.matches) setRailGroup(undefined); };
    update();
    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);
  useEffect(() => {
    const refreshAuthorizedSchools = () => {
        // An open workspace reports its own load failures; a background refresh only surfaces one when nothing else would.
        if (!hasPending()) void refreshChooser().catch((cause: Error) => { if (!context) setError(cause.message); });
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") refreshAuthorizedSchools(); };
    window.addEventListener("focus", refreshAuthorizedSchools);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.removeEventListener("focus", refreshAuthorizedSchools); document.removeEventListener("visibilitychange", onVisibilityChange); };
  });
  useEffect(() => {
    if (!schools) return;
    const destination = destinationFromPath(location.pathname);
    if (!destination || !schools.length) {
      if (context && unresolved()) { setSwitchTo({ path: location.pathname }); return; }
      clearProtectedState();
      setShowChooser(true);
      if (location.pathname !== "/") navigate("/", { replace: true });
      return;
    }
    // Prefer an exact authorized slug; UUIDs are only accepted to canonicalize legacy bookmarks.
    const slugMatch = schools.find((item) => item.schoolSlug === destination.schoolSlug);
    const school = slugMatch ?? schools.find((item) => item.schoolId === destination.schoolSlug);
    if (!school) {
      clearProtectedState();
      setShowChooser(true);
      navigate("/", { replace: true });
      return;
    }
    if (!slugMatch && school.schoolId === destination.schoolSlug) {
      navigate({ pathname: pathFor({ schoolSlug: school.schoolSlug, page: destination.page, runId: destination.runId, invoiceId: destination.invoiceId }), search: location.search }, { replace: true });
      return;
    }
    if (context?.schoolId === school.schoolId) {
      if (!allowedPages(context).includes(destination.page)) applyDestination(context, destination);
      else { setPage(destination.page); committed.current = destination; }
      return;
    }
    if (context && unresolved()) {
      // History has already moved. Keep its entry intact until the user chooses an action.
      setSwitchTo({ path: location.pathname, destination });
      return;
    }
    const key = `${location.pathname}:${retry}`;
    if (loadedPath.current === key) return;
    loadedPath.current = key;
    void load(destination, school).catch((cause: Error) => {
      loadedPath.current = undefined;
      if (mounted.current) setError(cause.message);
    });
  }, [location.pathname, schools, context, retry]);
  useEffect(() => { if (switchTo) dialog.current?.querySelector<HTMLElement>("input, button, textarea")?.focus(); }, [switchTo]);
  useEffect(() => {
    if (context) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".school-context-workspace h1, .school-context-workspace h2")?.focus());
  }, [context?.schoolId, view]);

  const sameStatus = (current: WorkspaceStatus, next: WorkspaceStatus) => current.dirty === next.dirty && current.pending === next.pending && current.dialogOpen === next.dialogOpen && current.reconcile === next.reconcile;
  const updateRosterStatus = useCallback((status: WorkspaceStatus) => setRosterStatus((current) => sameStatus(current, status) ? current : status), []);
  const updateSettingsStatus = useCallback((status: SettingsStatus) => setSettingsStatus((current) => sameStatus(current, status) ? current : status), []);
  const handleWorkspaceDenied = () => { forgetSchoolId(); clearProtectedState(); setShowChooser(true); navigate("/", { replace: true }); void refreshChooser().catch((cause: Error) => setError(cause.message)); };
  const stay = () => {
    const current = committed.current;
    setSwitchTo(undefined);
    if (current) navigate(pathFor(current), { replace: true });
  };
  const reconcile = () => statuses.current.filter((status) => status.pending).forEach((status) => status.reconcile?.());
  const toggleGroup = (group: "roster" | "settings" | "finance") => {
    if (isRail) {
      if (railBlurTimer.current) window.clearTimeout(railBlurTimer.current);
      setRailGroup(group);
    }
    else setExpanded((current) => ({ ...current, [group]: !current[group] }));
  };
  const groupExpanded = (group: "roster" | "settings" | "finance") => isRail ? railGroup === group : expanded[group];
  const closeRailOnBlur = () => {
    if (railBlurTimer.current) window.clearTimeout(railBlurTimer.current);
    railBlurTimer.current = window.setTimeout(() => {
    if (isRail && !navigation.current?.contains(document.activeElement)) setRailGroup(undefined);
    }, 0);
  };
  const selectPage = (page: View) => {
    if (isRail) setRailGroup(undefined);
    requestDestination({ schoolSlug: context!.schoolSlug, page });
  };
  useEffect(() => { document.title = context?.schoolName ?? "Passion Edu"; return () => { document.title = "Passion Edu"; }; }, [context?.schoolName]);
  useEffect(() => { onRoleChange?.(context?.positionName); }, [onRoleChange, context?.positionName]);
  useEffect(() => { registerHomeNavigation?.(() => requestPath("/")); }, [registerHomeNavigation, context, rosterStatus, settingsStatus, leaveReviewStatus, financeStatus]);

  if (!schools) return <section className="school-context school-context-loading" aria-live="polite"><p role={error ? "alert" : undefined}>{error || "Đang tải ngữ cảnh trường..."}</p>{error && <button type="button" onClick={retryRoute}>Thử lại</button>}</section>;
  if (!schools.length) return <section className="school-context school-context-empty"><p className="school-context-kicker">NGỮ CẢNH TRƯỜNG</p><h1>Chưa có trường được cấp quyền</h1><p>Không có trường nào đang cấp quyền cho tài khoản này.</p></section>;
  return <section className="school-context">
    {!context && showChooser && <section className="school-context-chooser" aria-labelledby="school-chooser-title"><header><div><h1 id="school-chooser-title">Chọn trường</h1><p>Chọn một trường để bắt đầu công việc.</p></div></header><div className="table-scroll"><table><caption>Danh sách trường được cấp quyền</caption><thead><tr><th>Trường</th><th>Thao tác</th></tr></thead><tbody>{schools.map((school) => <tr key={school.schoolId}><th scope="row">{school.schoolName}</th><td><button type="button" className="primary-action" onClick={() => requestDestination({ schoolSlug: school.schoolSlug, page: "overview" })}>Mở trường</button></td></tr>)}</tbody></table></div></section>}
    {error && <p className="school-context-error" role="alert">{error} <button type="button" onClick={retryRoute}>Thử lại</button></p>}
    {context && <><header className="school-context-header"><p className="school-context-current-school"><span>Trường đang làm việc</span><strong>{context.schoolName}</strong></p></header><nav ref={navigation} className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự" onKeyDown={(event) => { if (event.key === "Escape" && isRail) { const trigger = event.currentTarget.querySelector<HTMLButtonElement>('[aria-expanded="true"]'); const restoreFocus = Boolean(trigger?.nextElementSibling?.contains(document.activeElement)); setRailGroup(undefined); if (restoreFocus && trigger) trigger.focus(); } }} onBlur={closeRailOnBlur}>
      {allowedPages(context).includes("overview") && <button type="button" data-tooltip="Tổng quan" className="school-context-nav-item school-context-nav-overview" aria-current={view === "overview" ? "page" : undefined} onFocus={() => { if (isRail) setRailGroup(undefined); }} onClick={() => selectPage("overview")}><NavigationIcon name="overview" /><span className="school-context-nav-label">Tổng quan</span></button>}
      {context.navigation.filter((item) => item.id === "leave-review").filter((item) => allowedPages(context).includes(item.id as View)).map((item) => <button type="button" data-tooltip={item.label} key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onFocus={() => { if (isRail) setRailGroup(undefined); }} onClick={() => selectPage(item.id as View)}><NavigationIcon name="leave-review" /><span className="school-context-nav-label">{item.label}</span></button>)}
      {([['roster', 'Danh bộ', 'roster', [['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên'], ['classes', 'Lớp học'], ['extracurricular-classes', 'Lớp ngoại khóa']]], ['settings', 'Cấu hình trường', 'settings', [['years', 'Năm học'], ['positions', 'Chức danh'], ['settings', 'Cấu hình chung']]] ] as const).filter(([, , , items]) => items.some(([page]) => allowedPages(context).includes(page))).map(([group, label, icon, items]) => <section key={group} className={`school-context-nav-group school-context-nav-${group}`}><button type="button" data-tooltip={label} className="school-context-nav-group-toggle" aria-controls={groupExpanded(group) ? `${group}-submenu` : undefined} aria-expanded={groupExpanded(group)} onFocus={() => { if (isRail) toggleGroup(group); }} onClick={() => toggleGroup(group)}><NavigationIcon name={icon} /><span className="school-context-nav-label">{label}</span></button>{groupExpanded(group) && <div id={`${group}-submenu`} className="school-context-nav-submenu">{items.filter(([page]) => allowedPages(context).includes(page)).map(([page, childLabel]) => <button type="button" key={page} aria-current={view === page ? "page" : undefined} onClick={() => selectPage(page)}>{childLabel}</button>)}</div>}</section>)}
        {allowedPages(context).some((page) => ["receivables", "promotions", "collection-runs", "receipt-queue", "finance-reports"].includes(page)) && <section className="school-context-nav-group school-context-nav-finance"><button type="button" data-tooltip="Tài chính" className="school-context-nav-group-toggle" aria-controls={groupExpanded("finance") ? "finance-submenu" : undefined} aria-expanded={groupExpanded("finance")} onFocus={() => { if (isRail) toggleGroup("finance"); }} onClick={() => toggleGroup("finance")}><NavigationIcon name="finance" /><span className="school-context-nav-label">Tài chính</span></button>{groupExpanded("finance") && <div id="finance-submenu" className="school-context-nav-submenu">{context.navigation.filter((item) => item.id === "receivables" || item.id === "promotions" || item.id === "collection-runs" || item.id === "receipt-queue" || item.id === "finance-reports").filter((item) => allowedPages(context).includes(item.id as View)).map((item) => <button type="button" key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => selectPage(item.id as View)}>{item.label}</button>)}</div>}</section>}</nav>
          <div className="school-context-workspace">{view === "overview" && allowedPages(context).includes(view) ? <OverviewWorkspace schoolId={context.schoolId} schoolName={context.schoolName} selectedDate={new URLSearchParams(location.search).get("date") ?? undefined} setSelectedDate={(date) => navigate({ pathname: location.pathname, search: date ? `?date=${date}` : "" })} denied={handleWorkspaceDenied} /> : (["students", "parents", "staff", "classes", "transitions", "years", "positions"] as View[]).includes(view) && allowedPages(context).includes(view) ? <RosterWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateRosterStatus} requestHome={() => requestPath("/")} onOpenTransition={allowedPages(context).includes("transitions") ? () => selectPage("transitions") : undefined} onBackToRoster={() => selectPage("students")} section={view as "students" | "parents" | "staff" | "classes" | "transitions" | "years" | "positions"} /> : view === "settings" && allowedPages(context).includes(view) ? <SettingsWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateSettingsStatus} /> : view === "leave-review" && allowedPages(context).includes(view) ? <LeaveReviewWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={setLeaveReviewStatus} /> : (["receivables", "promotions", "collection-runs"] as FinancePage[]).includes(view as FinancePage) && allowedPages(context).includes(view) ? <FinanceWorkspace schoolId={context.schoolId} schoolName={context.schoolName} page={view as FinancePage} runId={view === "collection-runs" ? destinationFromPath(location.pathname)?.runId : undefined} invoiceId={view === "collection-runs" ? destinationFromPath(location.pathname)?.invoiceId : undefined} listSearch={location.search} denied={handleWorkspaceDenied} onStatusChange={setFinanceStatus} onOpenRun={(runId) => { const path = pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs", runId }) + location.search; if (hasPending()) requestPath(path); else navigate(path); }} onBackToRuns={() => requestPath(pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs" }) + location.search)} onOpenInvoice={(runId, invoiceId) => requestPath(pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs", runId, invoiceId }) + location.search)} onBackToRun={(runId) => requestPath(pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs", runId }) + location.search)} onDetailUnavailable={(message) => { setError(message); requestPath(pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs" }) + location.search); }} onListSearchChange={(search) => navigate({ pathname: pathFor({ schoolSlug: context.schoolSlug, page: "collection-runs" }), search })} onOpenExtracurricularClasses={allowedPages(context).includes("extracurricular-classes") ? () => selectPage("extracurricular-classes") : undefined} /> : view === "receipt-queue" && allowedPages(context).includes(view) ? <ReceiptQueueWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={setFinanceStatus} /> : view === "extracurricular-classes" && allowedPages(context).includes(view) ? <ExtracurricularClassesWorkspace schoolId={context.schoolId} schoolName={context.schoolName} search={location.search} onSearchChange={(search) => navigate({ pathname: location.pathname, search })} denied={handleWorkspaceDenied} onStatusChange={setFinanceStatus} /> : view === "finance-reports" && allowedPages(context).includes(view) ? <FinanceReportsWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} /> : null}</div></>}
    {switchTo && <div className="school-switch-backdrop"><div className="school-switch-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="school-switch-title"><h2 id="school-switch-title">Rời không gian làm việc?</h2><p>Biểu mẫu đang có nội dung chưa gửi hoặc thao tác đang được đối soát.</p><div className="school-switch-actions"><button className="school-switch-stay" onClick={stay}>Ở lại</button>{hasPending() ? <button className="school-switch-reconcile" onClick={reconcile}>Đối soát thao tác</button> : <button className="school-switch-discard" onClick={() => { const target = switchTo; clearProtectedState(); setSwitchTo(undefined); navigate(target.path); }}>Bỏ thay đổi</button>}</div></div></div>}
  </section>;
}
