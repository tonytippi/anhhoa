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
  reconcile?: () => void;
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const denied = (status: number) => [401, 403, 404].includes(status);

export function SchoolContext({ clear }: { clear: () => void }) {
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [view, setView] = useState<"roster" | "settings" | "leave-review" | "finance">("roster");
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
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const selected = useRef<string | undefined>(undefined);
  const version = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
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
    setRosterStatus({ dirty: false, pending: false });
    setSettingsStatus({ dirty: false, pending: false });
    setLeaveReviewStatus({ dirty: false, pending: false });
    setFinanceStatus({ dirty: false, pending: false });
    setView("roster");
    setSwitchTo(undefined);
  };
  const refreshChooser = async () => {
    const response = await fetch(`${apiUrl}/api/app/schools`, {
      credentials: "include",
    });
    if (response.status === 401) {
      clearContext();
      clear();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải danh sách trường.");
    if (mounted.current)
      setSchools(((await response.json()) as { data: School[] }).data);
  };
  const load = async (schoolId: string) => {
    const requestVersion = ++version.current;
    selected.current = schoolId;
    stop();
    setContext(undefined);
    setView("roster");
    setRosterStatus({ dirty: false, pending: false });
    setSettingsStatus({ dirty: false, pending: false });
    setLeaveReviewStatus({ dirty: false, pending: false });
    setFinanceStatus({ dirty: false, pending: false });
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}`, {
      credentials: "include",
    });
    if (!current(schoolId, requestVersion)) return;
    if (denied(response.status)) {
      clearContext();
      return refreshChooser();
    }
    if (!response.ok) throw new Error("Không thể tải ngữ cảnh trường.");
    const next = ((await response.json()) as { data: Context }).data;
    if (!current(schoolId, requestVersion)) return;
    setContext(next);
  };
  useEffect(() => {
    mounted.current = true;
    void refreshChooser()
      .then(() => undefined)
      .catch(() => {
        clearContext();
        clear();
      });
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [context?.schoolId]);
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible" && selected.current)
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
  }, []);
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
      currentStatus.pending === status.pending
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
  if (!schools)
    return (
      <section className="school-context school-context-loading" aria-live="polite">
        <p>Đang tải ngữ cảnh trường...</p>
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
      <div className="school-context-switcher">
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
      </div>
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
            {context.navigation.map((item) =>
              item.id === "roster" ||
              item.id === "settings" || item.id === "leave-review" || item.id === "finance" ? (
                <button
                  key={item.id}
                  className={`school-context-nav-item school-context-nav-${item.id}`}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => setView(item.id as typeof view)}
                >
                  {item.label}
                </button>
              ) : null,
            )}
          </nav>
          <div className="school-context-workspace">
          {view === "roster" &&
          context.capabilities.includes("ROSTER_MANAGE") ? (
            <RosterWorkspace
              schoolId={context.schoolId}
              schoolName={context.schoolName}
              denied={() => {
                clearContext();
                void refreshChooser();
              }}
              onStatusChange={updateRosterStatus}
            />
          ) : view === "settings" &&
            context.capabilities.includes("SETTINGS_MANAGE") ? (
            <SettingsWorkspace
              schoolId={context.schoolId}
              schoolName={context.schoolName}
              denied={() => {
                clearContext();
                void refreshChooser();
              }}
              onStatusChange={updateSettingsStatus}
            />
          ) : view === "leave-review" &&
            context.capabilities.includes("LEAVE_REQUEST_DECIDE") ? (
            <LeaveReviewWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={() => { clearContext(); void refreshChooser(); }} onStatusChange={updateLeaveReviewStatus} />
          ) : view === "finance" && context.capabilities.includes("FINANCE_MANAGE") ? (
            <FinanceWorkspace schoolId={context.schoolId} schoolName={context.schoolName} denied={() => { clearContext(); void refreshChooser(); }} onStatusChange={updateFinanceStatus} />
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
