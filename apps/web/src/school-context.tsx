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
  const [view, setView] = useState<"roster" | "settings" | "leave-review">("roster");
  const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [settingsStatus, setSettingsStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [leaveReviewStatus, setLeaveReviewStatus] = useState<WorkspaceStatus>({ dirty: false, pending: false });
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
        leaveReviewStatus.pending
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
  if (!schools) return <p>Đang tải ngữ cảnh trường...</p>;
  if (!schools.length)
    return <p>Không có trường nào đang cấp quyền cho tài khoản này.</p>;
  return (
    <section className="school-context">
      <label>
        Chọn trường{" "}
        <select
          aria-label="Chọn trường"
          value={context?.schoolId ?? ""}
          disabled={Boolean(
            rosterStatus.pending || settingsStatus.pending || leaveReviewStatus.pending,
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
      {error && <p role="alert">{error}</p>}
      {context && (
        <>
          <h1 ref={heading} tabIndex={-1}>
            PassionEdu - {context.schoolName}
          </h1>
          <nav aria-label="Điều hướng trường">
            {context.navigation.map((item) =>
              item.id === "roster" ||
              item.id === "settings" || item.id === "leave-review" ? (
                <button
                  key={item.id}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => setView(item.id as typeof view)}
                >
                  {item.label}
                </button>
              ) : (
                <span key={item.id}>{item.label} </span>
              ),
            )}
          </nav>
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
          ) : null}
        </>
      )}
      {switchTo && (
        <div ref={dialog} role="dialog" aria-modal="true">
          {switchTo ? (
            <>
              <h2>Đổi trường?</h2>
              <p>
                Biểu mẫu đang có nội dung chưa gửi hoặc thao tác đang được đối
                soát.
              </p>
              <button onClick={() => setSwitchTo(undefined)}>Ở lại</button>
              <button
                onClick={() => {
                  const target = switchTo;
                  setSwitchTo(undefined);
                  setRosterStatus({ dirty: false, pending: false });
                  setSettingsStatus({ dirty: false, pending: false });
                  setLeaveReviewStatus({ dirty: false, pending: false });
                  void load(target).catch((cause: Error) =>
                    setError(cause.message),
                  );
                }}
              >
                Bỏ nội dung và đổi trường
              </button>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
