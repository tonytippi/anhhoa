import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RosterWorkspace } from "./roster/roster-workspace";
import {
  SettingsWorkspace,
  type SettingsStatus,
} from "./settings/settings-workspace";
import { LeaveReviewWorkspace } from "./attendance/leave-review-workspace";
import { FinanceWorkspace, type FinanceStatus } from "./finance/finance-workspace";

type School = { schoolId: string; schoolName: string };
type Context = {
  schoolId: string;
  schoolName: string;
  membershipId: string;
  capabilities: Array<
    | "SCHOOL_CONTEXT_READ"
    | "ROSTER_MANAGE"
    | "SETTINGS_MANAGE"
    | "LEAVE_REQUEST_DECIDE"
    | "FINANCE_MANAGE"
  >;
  navigation: Array<{ id: string; label: string }>;
};
type WorkspaceStatus = {
  dirty: boolean;
  pending: boolean;
  dialogOpen?: boolean;
  reconcile?: () => void;
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const denied = (status: number) => [401, 403, 404].includes(status);
const selectionKey = (userIdentityId: string) =>
  `passionedu:app:selected-school:${userIdentityId}`;

export function SchoolContext({
  clear,
  userIdentityId,
}: {
  clear: () => void;
  userIdentityId: string;
}) {
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  type View = "students" | "parents" | "staff" | "classes" | "years" | "positions" | "settings" | "leave-review" | "finance";
  const [view, setView] = useState<View>("students");
  const [expanded, setExpanded] = useState<Record<"roster" | "settings", boolean>>({ roster: true, settings: false });
  const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [settingsStatus, setSettingsStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [leaveReviewStatus, setLeaveReviewStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [financeStatus, setFinanceStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
  const [switchTo, setSwitchTo] = useState<string>();
  const [showChooser, setShowChooser] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const selected = useRef<string | undefined>(undefined);
  const version = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const savedSchoolId = () => {
    try {
      return window.localStorage.getItem(selectionKey(userIdentityId)) ?? undefined;
    } catch {
      return undefined;
    }
  };
  const saveSchoolId = (schoolId: string) => {
    try {
      window.localStorage.setItem(selectionKey(userIdentityId), schoolId);
    } catch {
      // Storage is only a UX hint; an unavailable browser store must not block context loading.
    }
  };
  const forgetSchoolId = () => {
    try {
      window.localStorage.removeItem(selectionKey(userIdentityId));
    } catch {
      // Storage is only a UX hint.
    }
  };
  const current = (schoolId: string, requestVersion?: number) =>
    mounted.current &&
    selected.current === schoolId &&
    (requestVersion === undefined || version.current === requestVersion);
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const clearContext = () => {
    version.current += 1;
    selected.current = undefined;
    stop();
    setContext(undefined);
    setRosterStatus({ dirty: false, pending: false, dialogOpen: false });
    setSettingsStatus({ dirty: false, pending: false });
    setLeaveReviewStatus({ dirty: false, pending: false });
    setFinanceStatus({ dirty: false, pending: false });
    setView("students");
    setExpanded({ roster: true, settings: false });
    setSwitchTo(undefined);
  };
  const refreshChooser = async (restoreSelection = true) => {
    const response = await fetch(`${apiUrl}/api/app/schools`, {
      credentials: "include",
    });
    if (response.status === 401) {
      clearContext();
      clear();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải danh sách trường.");
    const next = ((await response.json()) as { data: School[] }).data;
    if (!mounted.current) return;
    setSchools(next);
    if (restoreSelection && next.length === 1) {
      const onlySchool = next[0];
      if (!onlySchool) return;
      setShowChooser(false);
      void load(onlySchool.schoolId).catch((cause: Error) => setError(cause.message));
      return;
    }
    const saved = savedSchoolId();
    if (restoreSelection && saved && next.some((school) => school.schoolId === saved)) {
      setShowChooser(false);
      void load(saved).catch((cause: Error) => setError(cause.message));
      return;
    }
    if (saved) forgetSchoolId();
    setShowChooser(true);
  };
  const load = async (schoolId: string) => {
    const requestVersion = ++version.current;
    selected.current = schoolId;
    stop();
    setContext(undefined);
    setView("students");
    setExpanded({ roster: true, settings: false });
    setRosterStatus({ dirty: false, pending: false, dialogOpen: false });
    setSettingsStatus({ dirty: false, pending: false });
    setLeaveReviewStatus({ dirty: false, pending: false });
    setFinanceStatus({ dirty: false, pending: false });
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}`, {
      credentials: "include",
    });
    if (!current(schoolId, requestVersion)) return;
    if (denied(response.status)) {
      forgetSchoolId();
      clearContext();
      setShowChooser(true);
      return refreshChooser(false);
    }
    if (!response.ok) throw new Error("Không thể tải ngữ cảnh trường.");
    const next = ((await response.json()) as { data: Context }).data;
    if (!current(schoolId, requestVersion)) return;
    setContext(next);
    setShowChooser(false);
    saveSchoolId(schoolId);
    if (!next.navigation.some((item) => item.id === "roster") && next.navigation.some((item) => item.id === "settings")) {
      setView("settings");
      setExpanded({ roster: false, settings: true });
    }
  };
  useEffect(() => {
    mounted.current = true;
    clearContext();
    setSchools(undefined);
    setShowChooser(false);
    setError("");
    void refreshChooser()
      .then(() => undefined)
      .catch((cause: Error) => {
        clearContext();
        setError(cause.message);
      });
    return () => {
      mounted.current = false;
      stop();
    };
  }, [userIdentityId]);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [context?.schoolId]);
  useEffect(() => {
    const revalidate = () => {
      if (
        document.visibilityState === "visible" &&
        selected.current &&
        !rosterStatus.dialogOpen
      )
        void load(selected.current).catch((cause: Error) =>
          setError(cause.message),
        );
    };
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, [rosterStatus.dialogOpen]);
  useEffect(() => {
    if (switchTo)
      dialog.current
        ?.querySelector<HTMLElement>("input, button, textarea")
        ?.focus();
  }, [switchTo, confirm]);
  const requestSwitch = (schoolId: string) => {
    if (schoolId === context?.schoolId) return;
    if (
      rosterStatus.dirty ||
      rosterStatus.pending ||
        settingsStatus.dirty ||
        settingsStatus.pending ||
        leaveReviewStatus.dirty ||
        leaveReviewStatus.pending || financeStatus.dirty || financeStatus.pending
    )
      setSwitchTo(schoolId);
    else void load(schoolId).catch((cause: Error) => setError(cause.message));
  };
  const updateRosterStatus = useCallback((status: WorkspaceStatus) => {
    setRosterStatus((currentStatus) =>
      currentStatus.dirty === status.dirty &&
      currentStatus.pending === status.pending &&
      currentStatus.dialogOpen === status.dialogOpen
        ? currentStatus
        : status,
    );
  }, []);
  const updateSettingsStatus = useCallback((status: SettingsStatus) => {
    setSettingsStatus((currentStatus) =>
      currentStatus.dirty === status.dirty &&
      currentStatus.pending === status.pending
        ? currentStatus
        : status,
    );
  }, []);
  const updateLeaveReviewStatus = useCallback((status: WorkspaceStatus) => setLeaveReviewStatus(status), []);
  const updateFinanceStatus = useCallback((status: FinanceStatus) => setFinanceStatus(status), []);
  const handleWorkspaceDenied = () => {
    forgetSchoolId();
    clearContext();
    setShowChooser(true);
    void refreshChooser(false).catch((cause: Error) => setError(cause.message));
  };
  if (!schools)
    return (
      <section className="school-context school-context-loading" aria-live="polite">
        <p role={error ? "alert" : undefined}>
          {error || "Đang tải ngữ cảnh trường..."}
        </p>
      </section>
    );
  if (!schools.length)
    return (
      <section className="school-context school-context-empty">
        <p className="school-context-kicker">NGỮ CẢNH TRƯỜNG</p>
        <h1>Chưa có trường được cấp quyền</h1>
        <p>Không có trường nào đang cấp quyền cho tài khoản này.</p>
      </section>
    );
  return (
    <section className="school-context">
      {(schools.length > 1 || showChooser) && <div className="school-context-switcher">
        <label className="school-context-label">
          <span>Chọn trường</span>
          <select
          aria-label="Chọn trường"
          value={context?.schoolId ?? ""}
          disabled={Boolean(
            rosterStatus.pending || settingsStatus.pending || leaveReviewStatus.pending || financeStatus.dirty || financeStatus.pending,
          )}
          onChange={(event) => requestSwitch(event.target.value)}
        >
          <option value="" disabled>
            Chọn trường
          </option>
          {schools.map((school) => (
            <option key={school.schoolId} value={school.schoolId}>
              {school.schoolName}
            </option>
          ))}
          </select>
        </label>
        {!context && <p className="school-context-hint">Chọn một trường để bắt đầu công việc.</p>}
      </div>}
      {error && <p className="school-context-error" role="alert">{error}</p>}
      {context && (
        <>
          <header className="school-context-heading">
            <p className="school-context-kicker">NGỮ CẢNH ĐANG LÀM VIỆC</p>
            <h1 ref={heading} tabIndex={-1}>
            PassionEdu - {context.schoolName}
            </h1>
          </header>
            <nav className="school-context-navigation" aria-label="Điều hướng quản trị và nhân sự">
              {context.navigation.some((item) => item.id === "roster") && (
                <section className="school-context-nav-group">
                  <button type="button" className="school-context-nav-group-toggle" aria-controls="roster-submenu" aria-expanded={expanded.roster} onClick={() => setExpanded((value) => ({ ...value, roster: !value.roster }))}>Danh bộ</button>
                  {expanded.roster && <div id="roster-submenu" className="school-context-nav-submenu">
                    {([['students', 'Học sinh'], ['parents', 'Phụ huynh'], ['staff', 'Nhân viên'], ['classes', 'Lớp học']] as const).map(([id, label]) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
                  </div>}
                </section>
              )}
              {context.navigation.some((item) => item.id === "settings") && (
                <section className="school-context-nav-group">
                  <button type="button" className="school-context-nav-group-toggle" aria-controls="settings-submenu" aria-expanded={expanded.settings} onClick={() => setExpanded((value) => ({ ...value, settings: !value.settings }))}>Cấu hình trường</button>
                  {expanded.settings && <div id="settings-submenu" className="school-context-nav-submenu">
                    {([['years', 'Năm học'], ['positions', 'Chức danh & capability']] as const).map(([id, label]) => context.capabilities.includes("ROSTER_MANAGE") && <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
                    {context.capabilities.includes("SETTINGS_MANAGE") && <button type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => setView("settings")}>Chính sách trường</button>}
                  </div>}
                </section>
              )}
              {context.navigation.filter((item) => item.id === "leave-review" || item.id === "finance").map((item) => <button type="button" key={item.id} className={`school-context-nav-item school-context-nav-${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id as View)}>{item.label}</button>)}
            </nav>
          <div className="school-context-workspace">
          {(["students", "parents", "staff", "classes", "years", "positions"] as View[]).includes(view) &&
          context.capabilities.includes("ROSTER_MANAGE") ? (
            <RosterWorkspace
              schoolId={context.schoolId}
              schoolName={context.schoolName}
              denied={handleWorkspaceDenied}
              onStatusChange={updateRosterStatus}
              section={view as "students" | "parents" | "staff" | "classes" | "years" | "positions"}
            />
          ) : view === "settings" &&
            context.capabilities.includes("SETTINGS_MANAGE") ? (
            <SettingsWorkspace
              schoolId={context.schoolId}
              schoolName={context.schoolName}
              denied={handleWorkspaceDenied}
              onStatusChange={updateSettingsStatus}
            />
          ) : view === "leave-review" &&
            context.capabilities.includes("LEAVE_REQUEST_DECIDE") ? (
            <LeaveReviewWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateLeaveReviewStatus} />
          ) : view === "finance" && context.capabilities.includes("FINANCE_MANAGE") ? (
            <FinanceWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={handleWorkspaceDenied} onStatusChange={updateFinanceStatus} />
          ) : null}
          </div>
        </>
      )}
      {switchTo && (
        <div className="school-switch-backdrop">
        <div className="school-switch-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="school-switch-title">
          {switchTo ? (
            <>
              <h2 id="school-switch-title">Đổi trường?</h2>
              <p>
                Biểu mẫu đang có nội dung chưa gửi hoặc thao tác đang được đối
                soát.
              </p>
              <div className="school-switch-actions">
              <button className="school-switch-stay" onClick={() => setSwitchTo(undefined)}>Ở lại</button>
              <button
                className="school-switch-discard"
                onClick={() => {
                  const target = switchTo;
                  setSwitchTo(undefined);
                  setRosterStatus({ dirty: false, pending: false });
                  setSettingsStatus({ dirty: false, pending: false });
                  setLeaveReviewStatus({ dirty: false, pending: false });
                  setFinanceStatus({ dirty: false, pending: false });
                  void load(target).catch((cause: Error) =>
                    setError(cause.message),
                  );
                }}
              >
                Bỏ nội dung và đổi trường
              </button>
              </div>
            </>
          ) : null}
        </div>
        </div>
      )}
    </section>
  );
}
