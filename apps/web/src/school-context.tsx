import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LeaveReviewWorkspace } from "./attendance/leave-review-workspace";
import { FinanceWorkspace } from "./finance/finance-workspace";
import { RosterWorkspace } from "./roster/roster-workspace";
import { SettingsWorkspace, type SettingsStatus } from "./settings/settings-workspace";

type School = { schoolId: string; schoolSlug: string; schoolName: string };
type View = "students" | "parents" | "staff" | "classes" | "years" | "positions" | "settings" | "leave-review" | "finance";
type Context = { schoolId: string; schoolSlug: string; schoolName: string; membershipId: string; capabilities: Array<"SCHOOL_CONTEXT_READ" | "ROSTER_MANAGE" | "SETTINGS_MANAGE" | "LEAVE_REQUEST_DECIDE" | "FINANCE_MANAGE">; navigation: Array<{ id: string; label: string }> };
type WorkspaceStatus = { dirty: boolean; pending: boolean; dialogOpen?: boolean; reconcile?: () => void };
type Destination = { schoolSlug: string; page: View };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const pages: View[] = ["students", "parents", "staff", "classes", "years", "positions", "settings", "leave-review", "finance"];
const denied = (status: number) => [401, 403, 404].includes(status);
const selectionKey = (userIdentityId: string) => `passionedu:app:selected-school:${userIdentityId}`;
const pathFor = ({ schoolSlug, page }: Destination) => `/schools/${schoolSlug}/${page}`;
const destinationFromPath = (pathname: string): Destination | undefined => {
  const match = /^\/schools\/([^/]+)\/([^/]+)$/.exec(pathname);
  return match && pages.includes(match[2] as View) ? { schoolSlug: match[1]!, page: match[2] as View } : undefined;
};
const allowedPages = (context: Context): View[] => {
  const has = (id: string) => context.navigation.some((item) => item.id === id);
  const result: View[] = [];
  if (has("roster") && context.capabilities.includes("ROSTER_MANAGE")) result.push("students", "parents", "staff", "classes");
  if (has("settings") && context.capabilities.includes("ROSTER_MANAGE")) result.push("years", "positions");
  if (has("settings") && context.capabilities.includes("SETTINGS_MANAGE")) result.push("settings");
  if (has("leave-review") && context.capabilities.includes("LEAVE_REQUEST_DECIDE")) result.push("leave-review");
  if (has("finance") && context.capabilities.includes("FINANCE_MANAGE")) result.push("finance");
  return result;
};

export function SchoolContext({ clear, userIdentityId }: { clear: () => void; userIdentityId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [view, setView] = useState<View>("students");
  const [expanded, setExpanded] = useState<Record<"roster" | "settings", boolean>>({ roster: true, settings: false });
  const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [settingsStatus, setSettingsStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [leaveReviewStatus, setLeaveReviewStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [financeStatus, setFinanceStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [switchTo, setSwitchTo] = useState<Destination>();
  const [showChooser, setShowChooser] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  const selected = useRef<string | undefined>(undefined);
  const version = useRef(0);
  const loadedPath = useRef<string | undefined>(undefined);
  const committed = useRef<Destination | undefined>(undefined);
  const statuses = useRef([rosterStatus, settingsStatus, leaveReviewStatus, financeStatus]);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  statuses.current = [rosterStatus, settingsStatus, leaveReviewStatus, financeStatus];

  const unresolved = () => statuses.current.some((status) => status.dirty || status.pending);
  const hasPending = () => statuses.current.some((status) => status.pending);
  const forgetSchoolId = () => { try { window.localStorage.removeItem(selectionKey(userIdentityId)); } catch { /* UX hint only. */ } };
  const saveSchoolId = (schoolId: string) => { try { window.localStorage.setItem(selectionKey(userIdentityId), schoolId); } catch { /* UX hint only. */ } };
  const savedSchoolId = () => { try { return window.localStorage.getItem(selectionKey(userIdentityId)) ?? undefined; } catch { return undefined; } };
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
    setExpanded({ roster: ["students", "parents", "staff", "classes"].includes(page), settings: ["years", "positions", "settings"].includes(page) });
  };
  const refreshChooser = async (restoreSelection: boolean) => {
    const response = await fetch(`${apiUrl}/api/app/schools`, { credentials: "include" });
    if (response.status === 401) { clearProtectedState(); clear(); return; }
    if (!response.ok) throw new Error("Không thể tải danh sách trường.");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw new Error("Không thể tải danh sách trường.");
    const next = payload.data as School[];
    if (!mounted.current) return;
    setSchools(next);
    const saved = savedSchoolId();
    const schoolId = next.length === 1 ? next[0]?.schoolId : saved && next.some((school) => school.schoolId === saved) ? saved : undefined;
    const school = schoolId ? next.find((item) => item.schoolId === schoolId) : undefined;
    if (restoreSelection && school) navigate(pathFor({ schoolSlug: school.schoolSlug, page: "students" }), { replace: true });
    else {
      if (saved && !next.some((school) => school.schoolId === saved)) forgetSchoolId();
      setShowChooser(true);
    }
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
    committed.current = { schoolSlug: next.schoolSlug, page };
    setShowChooser(false);
    saveSchoolId(next.schoolId);
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
      void refreshChooser(false).catch((cause: Error) => setError(cause.message));
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
  const requestDestination = (destination: Destination) => {
    if (context && destination.schoolSlug !== context.schoolSlug && unresolved()) { setSwitchTo(destination); return; }
    navigate(pathFor(destination));
  };
  const retryRoute = () => {
    setError("");
    loadedPath.current = undefined;
    if (!schools) void refreshChooser(!destinationFromPath(location.pathname)).catch((cause: Error) => setError(cause.message));
    else setRetry((value) => value + 1);
  };

  useEffect(() => {
    mounted.current = true;
    clearProtectedState();
    setSchools(undefined);
    setShowChooser(false);
    setError("");
    void refreshChooser(!destinationFromPath(location.pathname)).catch((cause: Error) => setError(cause.message));
    return () => { mounted.current = false; };
  }, [userIdentityId]);
  useEffect(() => {
    if (!schools) return;
    const destination = destinationFromPath(location.pathname);
    if (!destination || !schools.length) {
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
      navigate(pathFor({ schoolSlug: school.schoolSlug, page: destination.page }), { replace: true });
      return;
    }
    if (context?.schoolId === school.schoolId) {
      if (!allowedPages(context).includes(destination.page)) applyDestination(context, destination);
      else { setPage(destination.page); committed.current = destination; }
      return;
    }
    if (context && unresolved()) {
      // History has already moved. Keep its entry intact until the user chooses an action.
      setSwitchTo(destination);
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
  useLayoutEffect(() => { heading.current?.focus(); }, [context?.schoolId, view]);
  useEffect(() => { if (switchTo) dialog.current?.querySelector<HTMLElement>("input, button, textarea")?.focus(); }, [switchTo]);

  const sameStatus = (current: WorkspaceStatus, next: WorkspaceStatus) => current.dirty === next.dirty && current.pending === next.pending && current.dialogOpen === next.dialogOpen && current.reconcile === next.reconcile;
  const updateRosterStatus = useCallback((status: WorkspaceStatus) => setRosterStatus((current) => sameStatus(current, status) ? current : status), []);
  const updateSettingsStatus = useCallback((status: SettingsStatus) => setSettingsStatus((current) => sameStatus(current, status) ? current : status), []);
  const handleWorkspaceDenied = () => { forgetSchoolId(); clearProtectedState(); setShowChooser(true); navigate("/", { replace: true }); void refreshChooser(false).catch((cause: Error) => setError(cause.message)); };
  const stay = () => {
    const current = committed.current;
    setSwitchTo(undefined);
    if (current) navigate(pathFor(current), { replace: true });
  };
  const reconcile = () => statuses.current.filter((status) => status.pending).forEach((status) => status.reconcile?.());

  if (!schools) return <section className="school-context school-context-loading" aria-live="polite"><p role={error ? "alert" : undefined}>{error || "Đang tải ngữ cảnh trường..."}</p>{error && <button type="button" onClick={retryRoute}>Thử lại</button>}</section>;
  if (!schools.length) return <section className="school-context school-context-empty"><p className="school-context-kicker">NGỮ CẢNH TRƯỜNG</p><h1>Chưa có trường được cấp quyền</h1><p>Không có trường nào đang cấp quyền cho tài khoản này.</p></section>;
  return <section className="school-context">
    {(schools.length > 1 || showChooser) && <div className="school-context-switcher"><label className="school-context-label"><span>Chọn trường</span><select aria-label="Chọn trường" value={context?.schoolId ?? ""} disabled={hasPending()} onChange={(event) => { const school = schools.find((item) => item.schoolId === event.target.value); if (school) requestDestination({ schoolSlug: school.schoolSlug, page: "students" }); }}><option value="" disabled>Chọn trường</option>{schools.map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></label>{!context && <p className="school-context-hint">Chọn một trường để bắt đầu công việc.</p>}</div>}
    {error && <p className="school-context-error" role="alert">{error} <button type="button" onClick={retryRoute}>Thử lại</button></p>}
    {context && <><header className="school-context-heading"><p className="school-context-kicker">NGỮ CẢNH ĐANG LÀM VIỆC</p><h1 ref={heading} tabIndex={-1}>PassionEdu - {context.schoolName}</h1></header><nav className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự">
      {allowedPages(context).some((page) => ["students", "parents", "staff", "classes"].includes(page)) && <section className="school-context-nav-group"><button type="button" className="school-context-nav-group-toggle" aria-controls="roster-submenu" aria-expanded={expanded.roster} onClick={() => setExpanded((value) => ({ ...value, roster: !value.roster }))}>Danh bộ</button>{expanded.roster && <div id="roster-submenu" className="school-context-nav-submenu">{([['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên'], ['classes', 'Lớp học']] as const).filter(([page]) => allowedPages(context).includes(page)).map(([page, label]) => <button type="button" key={page} aria-current={view === page ? "page" : undefined} onClick={() => requestDestination({ schoolSlug: context.schoolSlug, page })}>{label}</button>)}</div>}</section>}
      {allowedPages(context).some((page) => ["years", "positions", "settings"].includes(page)) && <section className="school-context-nav-group"><button type="button" className="school-context-nav-group-toggle" aria-controls="settings-submenu" aria-expanded={expanded.settings} onClick={() => setExpanded((value) => ({ ...value, settings: !value.settings }))}>Cấu hình trường</button>{expanded.settings && <div id="settings-submenu">{([['years', 'Năm học'], ['positions', 'Chức danh & capability'], ['settings', 'Chính sách trường']] as const).filter(([page]) => allowedPages(context).includes(page)).map(([page, label]) => <button type="button" key={page} aria-current={view === page ? "page" : undefined} onClick={() => requestDestination({ schoolSlug: context.schoolSlug, page })}>{label}</button>)}</div>}</section>}
      {context.navigation.filter((item) => item.id === "leave-review" || item.id === "finance").filter((item) => allowedPages(context).includes(item.id as View)).map((item) => <button type="button" key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={() => requestDestination({ schoolSlug: context.schoolSlug, page: item.id as View })}>{item.label}</button>)}</nav>
      <div className="school-context-workspace">{(["students", "parents", "staff", "classes", "years", "positions"] as View[]).includes(view) && allowedPages(context).includes(view) ? <RosterWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateRosterStatus} section={view as "students" | "parents" | "staff" | "classes" | "years" | "positions"} /> : view === "settings" && allowedPages(context).includes(view) ? <SettingsWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateSettingsStatus} /> : view === "leave-review" && allowedPages(context).includes(view) ? <LeaveReviewWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={setLeaveReviewStatus} /> : view === "finance" && allowedPages(context).includes(view) ? <FinanceWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={setFinanceStatus} /> : null}</div></>}
    {switchTo && <div className="school-switch-backdrop"><div className="school-switch-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="school-switch-title"><h2 id="school-switch-title">Đổi trường?</h2><p>Biểu mẫu đang có nội dung chưa gửi hoặc thao tác đang được đối soát.</p><div className="school-switch-actions"><button className="school-switch-stay" onClick={stay}>Ở lại</button>{hasPending() ? <button className="school-switch-reconcile" onClick={reconcile}>Đối soát thao tác</button> : <button className="school-switch-discard" onClick={() => { const target = switchTo; clearProtectedState(); setSwitchTo(undefined); navigate(pathFor(target)); }}>Bỏ nội dung và đổi trường</button>}</div></div></div>}
  </section>;
}
