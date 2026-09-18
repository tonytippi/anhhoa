import {
  FormEvent,
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

type School = { schoolId: string; schoolName: string };
type Role = "SCHOOL_ADMIN" | "FINANCE_MANAGER" | "CLASS_TEACHER";
type Context = {
  schoolId: string;
  schoolName: string;
  membershipId: string;
  capabilities: Array<
    | "SCHOOL_CONTEXT_READ"
    | "ACCESS_MANAGE"
    | "ROSTER_MANAGE"
    | "SETTINGS_MANAGE"
  >;
  navigation: Array<{ id: string; label: string }>;
};
type Membership = {
  id: string;
  email: string;
  status: "ACTIVE" | "REVOKED";
  roles: Role[];
};
type Pending = { id: string; schoolId: string };
type WorkspaceStatus = {
  dirty: boolean;
  pending: boolean;
  reconcile?: () => void;
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-membership-operation";
const presets: Role[] = ["SCHOOL_ADMIN", "FINANCE_MANAGER", "CLASS_TEACHER"];
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const denied = (status: number) => [401, 403, 404].includes(status);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);

export function SchoolContext({ clear }: { clear: () => void }) {
  const [schools, setSchools] = useState<School[]>();
  const [context, setContext] = useState<Context>();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>(["CLASS_TEACHER"]);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<Pending>();
  const [view, setView] = useState<"access" | "roster" | "settings">("access");
  const [rosterStatus, setRosterStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [settingsStatus, setSettingsStatus] = useState<WorkspaceStatus>({
    dirty: false,
    pending: false,
  });
  const [switchTo, setSwitchTo] = useState<string>();
  const [confirm, setConfirm] = useState<{
    membershipId: string;
    roles?: Role[];
    action: "revoke" | "replace";
  }>();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
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
    sessionStorage.removeItem(pendingKey);
    setContext(undefined);
    setMemberships([]);
    setPending(undefined);
    setDirty(false);
    setRosterStatus({ dirty: false, pending: false });
    setSettingsStatus({ dirty: false, pending: false });
    setView("access");
    setSwitchTo(undefined);
    setConfirm(undefined);
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
  const loadMemberships = async (
    schoolId: string,
    requestVersion = version.current,
  ) => {
    const response = await fetch(
      `${apiUrl}/api/app/schools/${schoolId}/memberships`,
      { credentials: "include" },
    );
    if (!current(schoolId, requestVersion)) return;
    if (denied(response.status)) {
      clearContext();
      return refreshChooser();
    }
    if (!response.ok) throw new Error("Không thể tải danh sách truy cập.");
    if (current(schoolId, requestVersion))
      setMemberships(((await response.json()) as { data: Membership[] }).data);
  };
  const load = async (schoolId: string) => {
    const requestVersion = ++version.current;
    selected.current = schoolId;
    stop();
    setContext(undefined);
    setMemberships([]);
    setView("access");
    setRosterStatus({ dirty: false, pending: false });
    setSettingsStatus({ dirty: false, pending: false });
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
    if (next.capabilities.includes("ACCESS_MANAGE"))
      await loadMemberships(schoolId, requestVersion);
  };
  const reconcile = async (operation: Pending) => {
    if (!current(operation.schoolId)) return;
    setPending(operation);
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${operation.schoolId}/operations/${operation.id}`,
        { credentials: "include" },
      );
      if (!current(operation.schoolId)) return;
      if (denied(response.status)) {
        clearContext();
        return refreshChooser();
      }
      if (!response.ok) throw new Error();
      const result = ((await response.json()) as { data: { status: string } })
        .data;
      if (result.status === "PENDING") {
        timer.current = window.setTimeout(() => void reconcile(operation), 750);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      if (result.status === "COMPLETED") {
        await loadMemberships(operation.schoolId);
        if (current(operation.schoolId)) {
          setEmail("");
          setRoles(["CLASS_TEACHER"]);
          setDirty(false);
        }
      } else setError("Thao tác không thành công.");
    } catch {
      if (current(operation.schoolId))
        timer.current = window.setTimeout(() => void reconcile(operation), 750);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refreshChooser()
      .then(async () => {
        const raw = sessionStorage.getItem(pendingKey);
        if (!raw) return;
        const operation = JSON.parse(raw) as Pending;
        await load(operation.schoolId);
        if (current(operation.schoolId)) void reconcile(operation);
      })
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
    if (switchTo || confirm)
      dialog.current
        ?.querySelector<HTMLElement>("input, button, textarea")
        ?.focus();
  }, [switchTo, confirm]);
  const requestSwitch = (schoolId: string) => {
    if (schoolId === context?.schoolId) return;
    if (
      pending ||
      dirty ||
      rosterStatus.dirty ||
      rosterStatus.pending ||
      settingsStatus.dirty ||
      settingsStatus.pending
    )
      setSwitchTo(schoolId);
    else void load(schoolId).catch((cause: Error) => setError(cause.message));
  };
  const mutate = async (path: string, body: object) => {
    const schoolId = selected.current;
    if (!schoolId || pending) return false;
    const operation = { id: crypto.randomUUID(), schoolId };
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          "idempotency-key": crypto.randomUUID(),
          "x-operation-id": operation.id,
        },
        body: JSON.stringify(body),
      });
      if (!current(schoolId)) return false;
      if (denied(response.status)) {
        clearContext();
        await refreshChooser();
        return false;
      }
      if (uncertain(response.status)) throw new TypeError("uncertain");
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { error?: { message?: string } }).error
            ?.message ?? "Thao tác không thành công.",
        );
      await loadMemberships(schoolId);
      return current(schoolId);
    } catch (cause) {
      if (!current(schoolId)) return false;
      if (cause instanceof TypeError) {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        void reconcile(operation);
      } else
        setError(
          cause instanceof Error ? cause.message : "Thao tác không thành công.",
        );
      return false;
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !roles.length) return setError("Chọn ít nhất một preset.");
    if (
      await mutate(`/api/app/schools/${context!.schoolId}/memberships`, {
        email,
        roles,
      })
    ) {
      setEmail("");
      setRoles(["CLASS_TEACHER"]);
      setDirty(false);
    }
  };
  const confirmAction = async () => {
    if (!confirm) return;
    if (!reason.trim()) return setReasonError("Cần nêu lý do.");
    const path =
      confirm.action === "revoke"
        ? `/api/app/schools/${context!.schoolId}/memberships/${confirm.membershipId}/revoke`
        : `/api/app/schools/${context!.schoolId}/memberships/${confirm.membershipId}/roles`;
    const body =
      confirm.action === "revoke"
        ? { reason: reason.trim() }
        : { roles: confirm.roles, reason: reason.trim() };
    setConfirm(undefined);
    setReason("");
    setReasonError("");
    await mutate(path, body);
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
            pending || rosterStatus.pending || settingsStatus.pending,
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
              item.id === "settings" ||
              item.id === "access" ? (
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
          ) : (
            context.capabilities.includes("ACCESS_MANAGE") && (
              <section aria-labelledby="access-title">
                <h2 id="access-title">Quản lý truy cập</h2>
                <form onSubmit={submit}>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <fieldset>
                    <legend>Preset truy cập</legend>
                    {presets.map((role) => (
                      <label key={role}>
                        <input
                          type="checkbox"
                          checked={roles.includes(role)}
                          onChange={() => {
                            setRoles((value) =>
                              value.includes(role)
                                ? value.filter((item) => item !== role)
                                : [...value, role],
                            );
                            setDirty(true);
                          }}
                        />
                        {role}
                      </label>
                    ))}
                  </fieldset>
                  <button disabled={Boolean(pending)}>
                    {pending ? "Đang đối soát..." : "Cấp quyền"}
                  </button>
                </form>
                <table>
                  <caption>Membership của {context.schoolName}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Preset</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.length ? (
                      memberships.map((membership) => (
                        <tr key={membership.id}>
                          <td>{membership.email}</td>
                          <td>{membership.roles.join(", ") || "Không có"}</td>
                          <td>{membership.status}</td>
                          <td>
                            {membership.status === "ACTIVE" && (
                              <>
                                <button
                                  disabled={Boolean(pending)}
                                  onClick={() => {
                                    setRoles(membership.roles);
                                    setConfirm({
                                      membershipId: membership.id,
                                      roles: membership.roles,
                                      action: "replace",
                                    });
                                  }}
                                >
                                  Thay preset
                                </button>
                                <button
                                  disabled={Boolean(pending)}
                                  onClick={() =>
                                    setConfirm({
                                      membershipId: membership.id,
                                      action: "revoke",
                                    })
                                  }
                                >
                                  Thu hồi
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>Chưa có membership nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )
          )}
        </>
      )}
      {(switchTo || confirm) && (
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
                  setDirty(false);
                  setRosterStatus({ dirty: false, pending: false });
                  setSettingsStatus({ dirty: false, pending: false });
                  void load(target).catch((cause: Error) =>
                    setError(cause.message),
                  );
                }}
              >
                Bỏ nội dung và đổi trường
              </button>
            </>
          ) : (
            <>
              <h2>
                {confirm!.action === "revoke"
                  ? "Xác nhận thu hồi quyền"
                  : "Xác nhận thay preset"}
              </h2>
              <label>
                Lý do
                <textarea
                  autoFocus
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError("");
                  }}
                />
              </label>
              {reasonError && <p role="alert">{reasonError}</p>}
              <button onClick={() => setConfirm(undefined)}>Hủy</button>
              <button onClick={() => void confirmAction()}>Xác nhận</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
