import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";
import { DateInput } from "../components/date-input";

type Holiday = { id?: string; name: string; startsOn: string; endsOn: string };
type EvidenceMode = "REQUIRED" | "OPTIONAL";
type EvidencePolicy = { id: string; effectiveFrom: string; photoEvidenceMode: EvidenceMode; reason: string; createdAt?: string };
type FinancePolicy = { id: string; effectiveFrom: string; dueDaysAfterIssue: number; schoolWeekdays?: number[]; taxTreatment: string; debtScope: string; reversalMode: string; reason: string | null; createdAt?: string };
type DailyJournalPolicy = { id: string; effectiveFrom: string; reason: string; parentRetentionDaysAfterEnrollmentEnded: number; acceptedImageMimeTypes: string[]; maxImageSizeBytes: number; imageCountLimit: null; createdAt?: string };
type BankAccount = { id: string; kind?: "SCHOOL" | "PERSONAL"; receivingBank: string; bankBin?: string; accountNumber: string; accountHolderName: string; transferTemplate: string; status: "ACTIVE" | "INACTIVE"; createdAt?: string; lifecycleTransitions: { previousStatus: "ACTIVE" | "INACTIVE" | null; status: "ACTIVE" | "INACTIVE"; reason: string | null; changedAt: string }[] };
type Settings = {
  asOf: string;
  timezone: string;
  profile: {
    effectiveFrom: string;
    schoolName: string;
    address: string | null;
    phone: string | null;
    supportEmail?: string | null;
    createdAt?: string;
  } | null;
  calendar: { effectiveFrom: string; holidays: Holiday[]; createdAt?: string } | null;
  upcomingCalendar?: { effectiveFrom: string; holidays: Holiday[]; createdAt?: string } | null;
  financePolicy: Omit<FinancePolicy, "id" | "reason"> & { id?: string; reason?: string | null } | null;
  financePolicyVersions: FinancePolicy[];
  attendancePolicy: Omit<EvidencePolicy, "id"> & { id?: string } | null;
  attendancePolicyVersions: EvidencePolicy[];
  handoverPolicy: Omit<EvidencePolicy, "id"> & { id?: string } | null;
  handoverPolicyVersions: EvidencePolicy[];
  dailyJournalPolicy: Omit<DailyJournalPolicy, "id"> & { id?: string } | null;
  dailyJournalPolicyVersions: DailyJournalPolicy[];
  vietQrBanks?: { bin: string; shortName: string; name: string }[];
  bankAccounts: BankAccount[];
};
type Pending = { id: string; schoolId: string };
type Scope = "profile" | "calendar" | "financePolicy" | "attendancePolicy" | "handoverPolicy" | "dailyJournalPolicy" | "bankAccount";
type Tab = "school-information" | "calendar" | "finance-payment" | "attendance-handover";
export type SettingsStatus = {
  dirty: boolean;
  pending: boolean;
  reconcile?: () => void;
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-settings-operation";
const maxReconcileAttempts = 5;
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const networkUncertain = (error: unknown) =>
  error instanceof TypeError && /network|fetch|timeout/i.test(error.message);

const tabs: [Tab, string][] = [
  ["school-information", "Thông tin trường"],
  ["calendar", "Lịch hoạt động"],
  ["finance-payment", "Tài chính & thanh toán"],
  ["attendance-handover", "Điểm danh & bàn giao"],
];
const scopeTab: Record<Scope, Tab> = {
  profile: "school-information",
  calendar: "calendar",
  financePolicy: "finance-payment",
  bankAccount: "finance-payment",
  attendancePolicy: "attendance-handover",
  handoverPolicy: "attendance-handover",
  dailyJournalPolicy: "attendance-handover",
};
const tabFromHash = (): Tab => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return tabs.some(([id]) => id === hash) ? (hash as Tab) : "school-information";
};
// Decision 2026-10-08: ISO weekdays (1 = Thứ 2 … 6 = Thứ 7) counted as school days for per-day receivables.
const weekdayOptions = [1, 2, 3, 4, 5, 6];
const defaultSchoolWeekdays = [1, 2, 3, 4, 5, 6];
const weekdayLabel = (day: number) => `Thứ ${day + 1}`;
const weekdaysLabel = (days: number[] = defaultSchoolWeekdays) =>
  days.length > 2 && days.every((day, index) => index === 0 || day === days[index - 1]! + 1)
    ? `${weekdayLabel(days[0]!)} – ${weekdayLabel(days[days.length - 1]!)}`
    : days.map(weekdayLabel).join(", ");
const reversalLabels: Record<string, string> = {
  DIRECT: "Thực hiện trực tiếp",
  SCHOOL_ADMIN_APPROVAL: "Cần quản trị viên trường duyệt",
};
const evidenceCopy = {
  attendance: {
    title: "Ảnh khi điểm danh",
    REQUIRED: "Khi ghi có mặt, giáo viên phải chụp ảnh.",
    OPTIONAL: "Khi ghi có mặt, giáo viên có thể chụp ảnh nếu cần.",
    note: "Chỉ giáo viên được phân quyền và quản trị viên trường xem ảnh. Tệp bị xóa sau 2 tháng lịch.",
  },
  handover: {
    title: "Ảnh khi trả trẻ",
    REQUIRED: "Khi trả trẻ, giáo viên phải chụp ảnh.",
    OPTIONAL: "Khi trả trẻ, giáo viên có thể chụp ảnh nếu cần.",
    note: "Phụ huynh chỉ nhận giờ trả đã xác nhận, không xem ảnh. Không xác nhận người đón hoặc tự tính phí.",
  },
} as const;
const formatDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const dayCount = (startsOn: string, endsOn: string) =>
  Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1;
const maskAccount = (value: string) => `•••• ${value.slice(-4)}`;
const versionState = (
  version: { id: string; effectiveFrom: string },
  versions: { id: string; effectiveFrom: string }[],
  asOf: string,
) => {
  if (version.effectiveFrom > asOf) return ["Sắp áp dụng", "finance-badge-info"] as const;
  return versions.find((item) => item.effectiveFrom <= asOf)?.id === version.id
    ? (["Đang áp dụng", "finance-badge-success"] as const)
    : (["Đã thay thế", "finance-badge-neutral"] as const);
};
const emptyFinancePolicy = () => ({ effectiveFrom: "", dueDaysAfterIssue: "", schoolWeekdays: null as number[] | null, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", reason: "" });
const emptyEvidencePolicy = () => ({ effectiveFrom: "", photoEvidenceMode: "" as "" | EvidenceMode, reason: "" });
const emptyBankAccount = () => ({ kind: "PERSONAL" as "SCHOOL" | "PERSONAL", bankBin: "", accountNumber: "", accountHolderName: "", transferTemplate: "{{studentName}} {{className}}" });

export function SettingsWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: SettingsStatus) => void;
}) {
  const [data, setData] = useState<Settings>();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [profileDraft, setProfileDraft] = useState<{ schoolName: string; address: string; phone: string; supportEmail: string }>();
  const [holiday, setHoliday] = useState<{ id?: string; name: string; startsOn: string; endsOn: string }>();
  const [confirmAction, setConfirmAction] = useState<{ title: string; body: string; label: string; path: string; scope: Scope; notice: string }>();
  const [financePolicy, setFinancePolicy] = useState(emptyFinancePolicy);
  const [attendancePolicy, setAttendancePolicy] = useState(emptyEvidencePolicy);
  const [handoverPolicy, setHandoverPolicy] = useState(emptyEvidencePolicy);
  const [dailyJournalPolicy, setDailyJournalPolicy] = useState({ effectiveFrom: "", reason: "" });
  const [bankAccount, setBankAccount] = useState(emptyBankAccount);
  const [accountQuery, setAccountQuery] = useState("");
  const [accountStatus, setAccountStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [accountSort, setAccountSort] = useState<"newest" | "bank">("newest");
  const [lifecycle, setLifecycle] = useState<{ account: BankAccount; status: "ACTIVE" | "INACTIVE"; reason: string }>();
  const [accountHistory, setAccountHistory] = useState<BankAccount>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorScope, setErrorScope] = useState<Scope>("profile");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending>();
  const summary = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeSchool = useRef(schoolId);
  const statusChange = useRef(onStatusChange);
  const attempts = useRef(0);
  const today = data?.asOf ?? "";
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const resetDrafts = () => {
    setProfileDraft(undefined);
    setHoliday(undefined);
    setFinancePolicy(emptyFinancePolicy());
    setAttendancePolicy(emptyEvidencePolicy());
    setHandoverPolicy(emptyEvidencePolicy());
    setDailyJournalPolicy({ effectiveFrom: "", reason: "" });
    setBankAccount(emptyBankAccount());
    setLifecycle(undefined);
    setConfirmAction(undefined);
  };
  const current = (operation: Pending) =>
    activeSchool.current === operation.schoolId;
  const load = async () => {
    const response = await fetch(
      `${apiUrl}/api/app/schools/${schoolId}/settings`,
      { credentials: "include" },
    );
    if ([401, 403, 404].includes(response.status)) {
      if (activeSchool.current === schoolId) denied();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải cấu hình trường.");
    if (activeSchool.current === schoolId)
      setData(((await response.json()) as { data: Settings }).data);
  };
  const reconcile = async (operation: Pending) => {
    if (!current(operation)) return;
    setPending(operation);
    if (attempts.current >= maxReconcileAttempts) {
      setMessage(
        "Chưa thể xác nhận kết quả với hệ thống. Mã thao tác được giữ lại để đối soát sau.",
      );
      return;
    }
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${operation.schoolId}/operations/${operation.id}`,
        { credentials: "include" },
      );
      if (!current(operation)) return;
      if ([401, 403, 404].includes(response.status)) return denied();
      if (!response.ok) throw new Error();
      const result = ((await response.json()) as { data: { status: string } })
        .data;
      if (result.status === "PENDING") {
        attempts.current += 1;
        timer.current = window.setTimeout(
          () => void reconcile(operation),
          attempts.current * 750,
        );
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      attempts.current = 0;
      if (result.status === "COMPLETED") {
        await load();
        resetDrafts();
        setMessage("");
        setNotice("Hệ thống đã xác nhận thay đổi.");
      } else setMessage("Thao tác không thành công.");
    } catch {
      if (current(operation)) {
        attempts.current += 1;
        if (attempts.current >= maxReconcileAttempts)
          setMessage(
            "Chưa thể xác nhận kết quả với hệ thống. Mã thao tác được giữ lại để đối soát sau.",
          );
        else
          timer.current = window.setTimeout(
            () => void reconcile(operation),
            attempts.current * 750,
          );
      }
    }
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    stop();
    attempts.current = 0;
    setData(undefined);
    resetDrafts();
    setAccountHistory(undefined);
    setAccountQuery(""); setAccountStatus("ALL"); setAccountSort("newest");
    setErrors({});
    setErrorScope("profile");
    setMessage("");
    setNotice("");
    setPending(undefined);
    void load().catch((error: Error) => {
      if (activeSchool.current === schoolId) setMessage(error.message);
    });
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) {
      try {
        const operation = JSON.parse(raw) as Pending;
        if (
          typeof operation?.id !== "string" ||
          typeof operation.schoolId !== "string"
        )
          sessionStorage.removeItem(pendingKey);
        else if (operation.schoolId === schoolId) void reconcile(operation);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    }
    return stop;
  }, [schoolId]);
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const dirty = Boolean(
    profileDraft ||
      holiday ||
      financePolicy.effectiveFrom || financePolicy.dueDaysAfterIssue || financePolicy.schoolWeekdays || financePolicy.reason ||
      attendancePolicy.effectiveFrom || attendancePolicy.photoEvidenceMode || attendancePolicy.reason ||
      handoverPolicy.effectiveFrom || handoverPolicy.photoEvidenceMode || handoverPolicy.reason ||
      dailyJournalPolicy.effectiveFrom || dailyJournalPolicy.reason ||
      bankAccount.bankBin || bankAccount.accountNumber || bankAccount.accountHolderName ||
      lifecycle?.reason,
  );
  useEffect(() => {
    statusChange.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    statusChange.current?.({
      dirty,
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending]);
  useLayoutEffect(() => {
    if (Object.keys(errors).length) summary.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (!lifecycle && !accountHistory && !confirmAction) return;
    dialog.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [Boolean(lifecycle), Boolean(accountHistory), Boolean(confirmAction)]);
  const closeDialog = () => {
    setLifecycle(undefined);
    setAccountHistory(undefined);
    setConfirmAction(undefined);
    if (errorScope === "bankAccount" || confirmAction) {
      setErrors({});
      setMessage("");
    }
    returnFocus();
  };
  const trapDialog = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? []);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const selectTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${next}`);
    if (!pending) {
      setErrors({});
      setMessage("");
    }
    setNotice("");
  };
  const post = async (path: string, body: object, scope: Scope) => {
    if (pending) return false;
    const operation = { id: crypto.randomUUID(), schoolId };
    setErrors({});
    setErrorScope(scope);
    setMessage("");
    setNotice("");
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
      if ([401, 403, 404].includes(response.status)) {
        denied();
        return false;
      }
      if ([408, 502, 503, 504].includes(response.status))
        throw new TypeError("timeout");
      if (!response.ok) {
        const error = (
          (await response.json()) as {
            error?: { message?: string; fieldErrors?: Record<string, string> };
          }
        ).error;
        setErrors(error?.fieldErrors ?? {});
        setMessage(error?.message ?? "Thao tác không thành công.");
        return false;
      }
      await load();
      return true;
    } catch (error) {
      if (networkUncertain(error)) {
        attempts.current = 0;
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        setMessage(
          "Kết quả chưa chắc chắn. Đang đối soát với hệ thống trước khi cho phép thử lại.",
        );
        void reconcile(operation);
      } else
        setMessage(
          error instanceof Error ? error.message : "Thao tác không thành công.",
        );
      return false;
    }
  };
  const profile = profileDraft ?? {
    schoolName: data ? data.profile?.schoolName ?? schoolName : "",
    address: data?.profile?.address ?? "",
    phone: data?.profile?.phone ?? "",
    supportEmail: data?.profile?.supportEmail ?? "",
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/settings/profile-versions`,
        { ...profile, effectiveFrom: today },
        "profile",
      )
    ) {
      setProfileDraft(undefined);
      setNotice("Đã lưu hồ sơ trường.");
    }
  };
  const saveHoliday = async (event: FormEvent) => {
    event.preventDefault();
    if (!holiday) return;
    const path = holiday.id ? `/api/app/schools/${schoolId}/settings/holidays/${holiday.id}` : `/api/app/schools/${schoolId}/settings/holidays`;
    if (await post(path, { name: holiday.name, startsOn: holiday.startsOn, endsOn: holiday.endsOn }, "calendar")) {
      setHoliday(undefined);
      setNotice(holiday.id ? `Đã lưu kỳ nghỉ “${holiday.name.trim()}”.` : `Đã thêm kỳ nghỉ “${holiday.name.trim()}”.`);
    }
  };
  // The row that opened a dialog may disappear after the change; fall back to the panel heading.
  const returnFocus = () =>
    window.setTimeout(() => {
      const target = dialogTrigger.current;
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLElement>(".settings-panel h3")?.focus();
    });
  const runConfirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmAction) return;
    if (await post(confirmAction.path, {}, confirmAction.scope)) {
      setNotice(confirmAction.notice);
      setConfirmAction(undefined);
      returnFocus();
    }
  };
  const askDeleteVersion = (trigger: HTMLElement, kind: string, scope: Scope, version: { id: string; effectiveFrom: string }, label: string) => {
    dialogTrigger.current = trigger;
    setErrors({});
    setMessage("");
    setConfirmAction({
      title: "Xóa phiên bản sắp áp dụng",
      body: `${label} dự kiến áp dụng từ ${formatDate(version.effectiveFrom)} sẽ bị xóa. Phiên bản đang áp dụng tiếp tục có hiệu lực.`,
      label: "Xóa phiên bản",
      path: `/api/app/schools/${schoolId}/settings/${kind}/${version.id}/delete`,
      scope,
      notice: "Đã xóa phiên bản sắp áp dụng.",
    });
  };
  const deleteVersionCell = (kind: string, scope: Scope, version: { id: string; effectiveFrom: string }, label: string) =>
    version.effectiveFrom > today ? (
      <button type="button" disabled={Boolean(pending)} onClick={(event) => askDeleteVersion(event.currentTarget, kind, scope, version, label)}>Xóa</button>
    ) : (
      <span className="settings-muted">—</span>
    );
  // A new version starts from the current school days until Finance changes them.
  const schoolWeekdays = financePolicy.schoolWeekdays ?? data?.financePolicy?.schoolWeekdays ?? defaultSchoolWeekdays;
  const toggleSchoolWeekday = (day: number, checked: boolean) =>
    setFinancePolicy({ ...financePolicy, schoolWeekdays: checked ? [...schoolWeekdays, day].sort((a, b) => a - b) : schoolWeekdays.filter((item) => item !== day) });
  const saveFinancePolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (!financePolicy.dueDaysAfterIssue.trim()) {
      setErrorScope("financePolicy");
      setErrors({ dueDaysAfterIssue: "Cần nhập số ngày hạn thanh toán." });
      setMessage("Dữ liệu không hợp lệ.");
      return;
    }
    if (!schoolWeekdays.length) {
      setErrorScope("financePolicy");
      setErrors({ schoolWeekdays: "Chọn ít nhất một ngày học." });
      setMessage("Dữ liệu không hợp lệ.");
      return;
    }
    if (await post(`/api/app/schools/${schoolId}/settings/finance-policy-versions`, { ...financePolicy, effectiveFrom: financePolicy.effectiveFrom || today, dueDaysAfterIssue: Number(financePolicy.dueDaysAfterIssue), schoolWeekdays }, "financePolicy")) {
      setFinancePolicy(emptyFinancePolicy());
      setNotice("Đã tạo phiên bản chính sách tài chính.");
    }
  };
  const saveEvidencePolicy = async (kind: "attendance" | "handover", event: FormEvent) => {
    event.preventDefault();
    const policy = kind === "attendance" ? attendancePolicy : handoverPolicy;
    const active = kind === "attendance" ? data?.attendancePolicy : data?.handoverPolicy;
    const body = {
      effectiveFrom: policy.effectiveFrom || today,
      photoEvidenceMode: policy.photoEvidenceMode || active?.photoEvidenceMode || "REQUIRED",
      reason: policy.reason,
    };
    if (await post(`/api/app/schools/${schoolId}/settings/${kind}-policy-versions`, body, kind === "attendance" ? "attendancePolicy" : "handoverPolicy")) {
      (kind === "attendance" ? setAttendancePolicy : setHandoverPolicy)(emptyEvidencePolicy());
      setNotice(`Đã lưu yêu cầu ${evidenceCopy[kind].title.toLocaleLowerCase("vi")}.`);
    }
  };
  const saveDailyJournalPolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (await post(`/api/app/schools/${schoolId}/settings/daily-journal-policy-versions`, { effectiveFrom: dailyJournalPolicy.effectiveFrom || today, reason: dailyJournalPolicy.reason }, "dailyJournalPolicy")) {
      setDailyJournalPolicy({ effectiveFrom: "", reason: "" });
      setNotice("Đã xác nhận chính sách nhật ký ngày.");
    }
  };
  const saveBankAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (await post(`/api/app/schools/${schoolId}/settings/bank-accounts`, bankAccount, "bankAccount")) {
      setBankAccount(emptyBankAccount());
      setNotice("Đã thêm tài khoản nhận tiền.");
    }
  };
  const transitionBankAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!lifecycle) return;
    if (await post(`/api/app/schools/${schoolId}/settings/bank-accounts/${lifecycle.account.id}/lifecycle`, { status: lifecycle.status, reason: lifecycle.reason }, "bankAccount")) {
      setNotice(lifecycle.status === "ACTIVE" ? "Đã dùng lại tài khoản nhận tiền." : "Đã ngừng dùng tài khoản nhận tiền.");
      setLifecycle(undefined);
      returnFocus();
    }
  };
  const schoolAccounts = (data?.bankAccounts ?? []).filter((account) => account.kind === "SCHOOL");
  const visibleAccounts = (data?.bankAccounts ?? []).filter((account) => account.kind !== "SCHOOL").filter((account) => (accountStatus === "ALL" || account.status === accountStatus) && `${account.receivingBank} ${account.accountNumber} ${account.accountHolderName}`.toLocaleLowerCase("vi").includes(accountQuery.trim().toLocaleLowerCase("vi"))).sort((a, b) => accountSort === "bank" ? a.receivingBank.localeCompare(b.receivingBank, "vi") : 0);
  const field = (scope: Scope, name: string) =>
    errorScope === scope && errors[name]
      ? { "aria-invalid": true, "aria-describedby": `${scope}-${name}-error` }
      : {};
  const fieldError = (scope: Scope, name: string) =>
    errorScope === scope && errors[name] ? <small id={`${scope}-${name}-error`}>{errors[name]}</small> : null;
  const dialogOpen = Boolean(lifecycle || accountHistory || confirmAction);
  const shownCalendar = data?.upcomingCalendar ?? data?.calendar;
  const showMessage = message && !dialogOpen && (!Object.keys(errors).length || scopeTab[errorScope] === tab);
  const badge = (label: string, tone: string) => <span className={`finance-badge ${tone}`}>{label}</span>;

  return (
    <section aria-labelledby="settings-title" className="settings-workspace">
      <header className="settings-head">
        <h2 id="settings-title">Cấu hình trường</h2>
        <p>Giá trị, hiệu lực và ảnh hưởng đều do hệ thống xác nhận.</p>
      </header>
      <nav className="settings-tabs" aria-label="Các phần cấu hình trường">
        {tabs.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              selectTab(id);
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      {showMessage && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      {notice && <p className="settings-notice" role="status">{notice}</p>}
      {pending && <p className="settings-notice settings-notice-info" role="status">Đang kiểm tra kết quả với hệ thống…</p>}

      {tab === "school-information" && (
        <section id="school-information" className="settings-panel" aria-labelledby="school-information-title">
          <form className="settings-card" onSubmit={saveProfile} aria-labelledby="school-information-title" noValidate>
            <div className="settings-card-head">
              <div>
                <h3 id="school-information-title" tabIndex={-1}>Hồ sơ trường</h3>
                <p>Thông tin nhận diện và liên hệ chỉ đổi sau khi hệ thống xác nhận.</p>
              </div>
              <button type="submit" className="primary-action" disabled={Boolean(pending) || !data}>Lưu hồ sơ</button>
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>
                  Tên hiển thị
                  <input value={profile.schoolName} onChange={(event) => setProfileDraft({ ...profile, schoolName: event.target.value })} {...field("profile", "schoolName")} />
                </label>
                {fieldError("profile", "schoolName")}
              </div>
              <div className="settings-field">
                <label>
                  Điện thoại hỗ trợ
                  <input type="tel" value={profile.phone} onChange={(event) => setProfileDraft({ ...profile, phone: event.target.value })} {...field("profile", "phone")} />
                </label>
                {fieldError("profile", "phone")}
              </div>
              <div className="settings-field settings-field-wide">
                <label>
                  Địa chỉ
                  <textarea value={profile.address} onChange={(event) => setProfileDraft({ ...profile, address: event.target.value })} {...field("profile", "address")} />
                </label>
                {fieldError("profile", "address")}
              </div>
              <div className="settings-field">
                <label>
                  Email hỗ trợ
                  <input type="email" value={profile.supportEmail} onChange={(event) => setProfileDraft({ ...profile, supportEmail: event.target.value })} {...field("profile", "supportEmail")} />
                </label>
                {fieldError("profile", "supportEmail")}
              </div>
              <label>
                Múi giờ
                <input value={`${data?.timezone ?? "Asia/Ho_Chi_Minh"} (Việt Nam)`} readOnly />
              </label>
            </div>
            <p className="settings-muted">
              {data?.profile
                ? `Đang áp dụng từ ${formatDate(data.profile.effectiveFrom)}. Thay đổi được lưu ngay và có hiệu lực từ hôm nay.`
                : "Chưa có hồ sơ được xác nhận. Tên hiển thị đang lấy theo tên trường hiện tại."}
            </p>
          </form>
        </section>
      )}

      {tab === "calendar" && (
        <section id="calendar" className="settings-panel" aria-labelledby="calendar-title">
          <div className="settings-card-head">
            <div>
              <h3 id="calendar-title" tabIndex={-1}>Lịch hoạt động</h3>
              <p>Lịch mặc định: Thứ Hai đến Thứ Bảy. Chủ Nhật là ngày không hoạt động.</p>
            </div>
            <button type="button" className="primary-action" disabled={Boolean(holiday) || Boolean(pending) || !data} onClick={() => { setErrors({}); setMessage(""); setHoliday({ name: "", startsOn: "", endsOn: "" }); }}>Thêm kỳ nghỉ</button>
          </div>
          <p className="settings-notice settings-notice-info">Kỳ nghỉ tính cả ngày bắt đầu và ngày kết thúc. Thêm, sửa hoặc xóa kỳ nghỉ có hiệu lực từ hôm nay; các ngày đã qua giữ nguyên.</p>
          <div className="table-scroll">
            <table>
              <caption>Kỳ nghỉ · {schoolName}</caption>
              <thead><tr><th>Tên kỳ nghỉ</th><th>Từ ngày</th><th>Đến ngày</th><th>Số ngày</th><th>Trạng thái</th><th>Tùy chọn</th></tr></thead>
              <tbody>
                {shownCalendar?.holidays.length ? shownCalendar.holidays.map((item) => {
                  const ended = item.endsOn < today;
                  return (
                    <tr key={item.id ?? `${item.startsOn}-${item.name}`}>
                      <td><b>{item.name}</b></td>
                      <td>{formatDate(item.startsOn)}</td>
                      <td>{formatDate(item.endsOn)}</td>
                      <td>{dayCount(item.startsOn, item.endsOn)} ngày</td>
                      <td>{ended ? badge("Đã qua", "finance-badge-neutral") : item.startsOn <= today ? badge("Đang nghỉ", "finance-badge-info") : badge("Sắp tới", "finance-badge-success")}</td>
                      <td>
                        {ended || !item.id ? (
                          <span className="settings-muted">—</span>
                        ) : (
                          <AnchoredActionMenu label={`Tùy chọn cho kỳ nghỉ ${item.name}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { dialogTrigger.current = trigger; }}>
                            <AnchoredActionMenuItem onClick={() => { setErrors({}); setMessage(""); setHoliday({ id: item.id, name: item.name, startsOn: item.startsOn, endsOn: item.endsOn }); }}>Sửa</AnchoredActionMenuItem>
                            <AnchoredActionMenuItem onClick={() => { setErrors({}); setMessage(""); setConfirmAction({ title: "Xóa kỳ nghỉ", body: `Xóa kỳ nghỉ “${item.name}” (${formatDate(item.startsOn)} – ${formatDate(item.endsOn)}). Những ngày này sẽ trở lại là ngày hoạt động bình thường.`, label: "Xóa kỳ nghỉ", path: `/api/app/schools/${schoolId}/settings/holidays/${item.id}/delete`, scope: "calendar", notice: `Đã xóa kỳ nghỉ “${item.name}”.` }); }}>Xóa</AnchoredActionMenuItem>
                          </AnchoredActionMenu>
                        )}
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} role="status">Chưa có kỳ nghỉ nào.</td></tr>}
              </tbody>
            </table>
          </div>
          {shownCalendar && <p className="settings-muted">Lịch áp dụng từ {formatDate(shownCalendar.effectiveFrom)}.</p>}
          {holiday && (
            <form className="settings-card" onSubmit={saveHoliday} aria-labelledby="holiday-title">
              <div>
                <h3 id="holiday-title">{holiday.id ? "Sửa kỳ nghỉ" : "Thêm kỳ nghỉ"}</h3>
                <p className="settings-muted">Thông tin được giữ nguyên để sửa nếu hệ thống báo lỗi ngày hoặc trùng kỳ nghỉ.</p>
              </div>
              <div className="settings-fields">
                <div className="settings-field settings-field-wide">
                  <label>
                    Tên kỳ nghỉ
                    <input autoFocus value={holiday.name} onChange={(event) => setHoliday({ ...holiday, name: event.target.value })} {...field("calendar", "name")} />
                  </label>
                  {fieldError("calendar", "name")}
                </div>
                <div className="settings-field">
                  <label>
                    Ngày bắt đầu
                    <DateInput value={holiday.startsOn} onChange={(event) => setHoliday({ ...holiday, startsOn: event.target.value })} {...field("calendar", "startsOn")} />
                  </label>
                  {fieldError("calendar", "startsOn")}
                </div>
                <div className="settings-field">
                  <label>
                    Ngày kết thúc
                    <DateInput value={holiday.endsOn} onChange={(event) => setHoliday({ ...holiday, endsOn: event.target.value })} {...field("calendar", "endsOn")} />
                  </label>
                  {fieldError("calendar", "endsOn")}
                </div>
              </div>
              <div className="settings-actions">
                <button type="button" disabled={Boolean(pending)} onClick={() => { setHoliday(undefined); if (errorScope === "calendar") { setErrors({}); setMessage(""); } }}>Hủy</button>
                <button type="submit" className="primary-action" disabled={Boolean(pending)}>{holiday.id ? "Lưu kỳ nghỉ" : "Tạo kỳ nghỉ"}</button>
              </div>
            </form>
          )}
        </section>
      )}

      {tab === "finance-payment" && (
        <section id="finance-payment" className="settings-panel" aria-labelledby="finance-payment-title">
          <div>
            <h3 id="finance-payment-title" tabIndex={-1}>Tài chính &amp; thanh toán</h3>
            <p className="settings-muted">Chính sách tài chính và tài khoản nhận tiền của trường. Lưu lại cùng ngày hiệu lực (từ hôm nay trở đi) sẽ sửa phiên bản đó; phiên bản chưa đến ngày áp dụng có thể xóa.</p>
          </div>
          <div className="table-scroll">
            <table>
              <caption>Phiên bản chính sách tài chính</caption>
              <thead><tr><th>Hiệu lực</th><th>Hạn thanh toán</th><th>Ngày học</th><th>Hoàn tiền ưu đãi</th><th>Lý do</th><th>Trạng thái</th><th>Tùy chọn</th></tr></thead>
              <tbody>
                {data?.financePolicyVersions.length ? data.financePolicyVersions.map((policy) => {
                  const [label, tone] = versionState(policy, data.financePolicyVersions, today);
                  return (
                    <tr key={policy.id}>
                      <td>{formatDate(policy.effectiveFrom)}</td>
                      <td>{policy.dueDaysAfterIssue} ngày sau khi phát hành</td>
                      <td>{weekdaysLabel(policy.schoolWeekdays)}</td>
                      <td>{reversalLabels[policy.reversalMode] ?? policy.reversalMode}</td>
                      <td>{policy.reason ?? ""}</td>
                      <td>{badge(label, tone)}</td>
                      <td>{deleteVersionCell("finance-policy-versions", "financePolicy", policy, "Chính sách tài chính")}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={7} role="status">Chưa có chính sách tài chính.</td></tr>}
              </tbody>
            </table>
          </div>
          <form className="settings-card" onSubmit={saveFinancePolicy} aria-labelledby="finance-policy-title">
            <h3 id="finance-policy-title">Đề xuất chính sách tài chính</h3>
            <div className="settings-fields">
              <div className="settings-field">
                <label>
                  Ngày hiệu lực
                  <DateInput value={financePolicy.effectiveFrom || today} onChange={(event) => setFinancePolicy({ ...financePolicy, effectiveFrom: event.target.value })} {...field("financePolicy", "effectiveFrom")} />
                </label>
                {fieldError("financePolicy", "effectiveFrom")}
              </div>
              <div className="settings-field">
                <label>
                  Số ngày hạn thanh toán
                  <input type="number" min="0" max="365" inputMode="numeric" value={financePolicy.dueDaysAfterIssue} onChange={(event) => setFinancePolicy({ ...financePolicy, dueDaysAfterIssue: event.target.value })} {...field("financePolicy", "dueDaysAfterIssue")} />
                </label>
                {fieldError("financePolicy", "dueDaysAfterIssue")}
              </div>
              <fieldset className="settings-field settings-field-wide settings-weekdays" aria-describedby="school-weekdays-hint">
                <legend>Ngày học trong tuần</legend>
                <div className="settings-weekday-options">
                  {weekdayOptions.map((day) => (
                    <label key={day} className="finance-checkbox">
                      <input type="checkbox" checked={schoolWeekdays.includes(day)} onChange={(event) => toggleSchoolWeekday(day, event.target.checked)} />
                      {weekdayLabel(day)}
                    </label>
                  ))}
                </div>
                <span id="school-weekdays-hint" className="settings-muted">Khoản thu tự trừ theo ngày nghỉ có phép (ví dụ tiền ăn) mở đợt thu với số ngày học của tháng, trừ ngày nghỉ lễ; chỉ ngày nghỉ phép vào ngày học mới được trừ.</span>
                {fieldError("financePolicy", "schoolWeekdays")}
              </fieldset>
              <label>
                Hoàn tiền ưu đãi
                <select value={financePolicy.reversalMode} onChange={(event) => setFinancePolicy({ ...financePolicy, reversalMode: event.target.value })}>
                  {Object.entries(reversalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="settings-field settings-field-wide">
                <label>
                  Lý do
                  <input value={financePolicy.reason} onChange={(event) => setFinancePolicy({ ...financePolicy, reason: event.target.value })} {...field("financePolicy", "reason")} />
                </label>
                {fieldError("financePolicy", "reason")}
              </div>
            </div>
            {fieldError("financePolicy", "financePolicy")}
            <div className="settings-actions">
              <button type="submit" className="primary-action" disabled={Boolean(pending)}>Tạo phiên bản chính sách</button>
            </div>
          </form>
          <section className="settings-card" aria-labelledby="bank-accounts-title">
            <div>
              <h3 id="bank-accounts-title">Tài khoản nhận tiền</h3>
              <p className="settings-muted">Khoản có thuế thu vào tài khoản trường; khoản không kê khai thu vào tài khoản cá nhân. Chỉ tài khoản đang hiệu lực được dùng cho hóa đơn mới. Tài khoản ngừng dùng vẫn đọc được trong lịch sử.</p>
            </div>
            <form className="settings-fields settings-bank-form" onSubmit={saveBankAccount} aria-label="Thông tin tài khoản mới">
              <div className="settings-field">
                <label>
                  Loại tài khoản
                  <select required value={bankAccount.kind} onChange={(event) => setBankAccount({ ...bankAccount, kind: event.target.value as "SCHOOL" | "PERSONAL" })} {...field("bankAccount", "kind")}>
                    <option value="PERSONAL">Tài khoản cá nhân (khoản không kê khai)</option>
                    <option value="SCHOOL">Tài khoản trường (khoản có thuế)</option>
                  </select>
                </label>
                {!lifecycle && fieldError("bankAccount", "kind")}
              </div>
              <div className="settings-field">
                <label>
                  Ngân hàng nhận
                  <select required value={bankAccount.bankBin} onChange={(event) => setBankAccount({ ...bankAccount, bankBin: event.target.value })} {...field("bankAccount", "bankBin")}>
                    <option value="">Chọn ngân hàng</option>
                    {(data?.vietQrBanks ?? []).map((bank) => <option key={bank.bin} value={bank.bin}>{bank.shortName} - {bank.name}</option>)}
                  </select>
                </label>
                {!lifecycle && fieldError("bankAccount", "bankBin")}
              </div>
              <div className="settings-field">
                <label>
                  Số tài khoản
                  <input inputMode="numeric" autoComplete="off" value={bankAccount.accountNumber} onChange={(event) => setBankAccount({ ...bankAccount, accountNumber: event.target.value })} {...field("bankAccount", "accountNumber")} />
                </label>
                {!lifecycle && fieldError("bankAccount", "accountNumber")}
              </div>
              <div className="settings-field">
                <label>
                  Chủ tài khoản
                  <input autoComplete="off" value={bankAccount.accountHolderName} onChange={(event) => setBankAccount({ ...bankAccount, accountHolderName: event.target.value })} {...field("bankAccount", "accountHolderName")} />
                </label>
                {!lifecycle && fieldError("bankAccount", "accountHolderName")}
              </div>
              <p className="settings-muted settings-field-wide">Danh sách ngân hàng và mã VietQR do hệ thống cung cấp. Nội dung chuyển khoản trên hóa đơn là <b>tên học sinh + tên lớp</b>, bỏ dấu, tối đa 50 ký tự.</p>
              <div className="settings-actions settings-field-wide">
                <button type="submit" className="primary-action" disabled={Boolean(pending)}>Thêm tài khoản nhận tiền</button>
              </div>
            </form>
            <section aria-labelledby="school-account-title">
              <h3 id="school-account-title">Tài khoản trường (khoản có thuế)</h3>
              <p className="settings-muted">Trường có thể có nhiều tài khoản trường đang hiệu lực. Mỗi lớp chọn tài khoản trường mặc định cho phần thu có thuế; kế toán có thể chọn tài khoản khác khi phát hành phiếu thu.</p>
              <div className="table-scroll">
                <table>
                  <caption>Tài khoản trường · {schoolName}</caption>
                  <thead><tr><th>Ngân hàng</th><th>Chủ tài khoản</th><th>Số tài khoản</th><th>Trạng thái</th><th>Hiệu lực từ</th><th>Tùy chọn</th></tr></thead>
                  <tbody>
                    {schoolAccounts.length ? schoolAccounts.map((account) => (
                    <tr key={account.id}>
                      <td><b>{account.receivingBank}</b></td>
                      <td>{account.accountHolderName}</td>
                      <td title={account.accountNumber}>{maskAccount(account.accountNumber)}</td>
                      <td>{account.status === "ACTIVE" ? badge("Đang hiệu lực", "finance-badge-success") : badge("Ngừng dùng", "finance-badge-neutral")}</td>
                      <td>{account.createdAt ? formatDate(account.createdAt.slice(0, 10)) : ""}</td>
                      <td>
                        <button type="button" disabled={Boolean(pending)} onClick={(event) => { dialogTrigger.current = event.currentTarget; setErrors({}); setMessage(""); setLifecycle({ account, status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: "" }); }}>{account.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}</button>
                        <button type="button" onClick={(event) => { dialogTrigger.current = event.currentTarget; setAccountHistory(account); }}>Xem lịch sử</button>
                      </td>
                    </tr>
                                      )) : <tr><td colSpan={6} role="status">Chưa có tài khoản trường.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <section aria-labelledby="personal-account-title">
            <h3 id="personal-account-title">Tài khoản cá nhân (khoản không kê khai)</h3>
            <p className="settings-muted">Mỗi lớp có thể chọn một tài khoản cá nhân mặc định tại Năm học và lớp; khi phát hành, Finance có thể chọn tài khoản khác.</p>
            <div className="roster-list-filters" role="search" aria-label="Lọc tài khoản nhận tiền">
              <label className="roster-filter-search">
                Tìm kiếm
                <input type="search" placeholder="Ngân hàng, số hoặc chủ tài khoản" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} />
              </label>
              <label>
                Trạng thái
                <select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}>
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hiệu lực</option>
                  <option value="INACTIVE">Ngừng dùng</option>
                </select>
              </label>
              <label>
                Sắp xếp
                <select value={accountSort} onChange={(event) => setAccountSort(event.target.value as "newest" | "bank")}>
                  <option value="newest">Mới nhất</option>
                  <option value="bank">Ngân hàng</option>
                </select>
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <caption>Tài khoản cá nhân · {schoolName}</caption>
                <thead><tr><th>Ngân hàng</th><th>Chủ tài khoản</th><th>Số tài khoản</th><th>Trạng thái</th><th>Hiệu lực từ</th><th>Tùy chọn</th></tr></thead>
                <tbody>
                  {visibleAccounts.length ? visibleAccounts.map((account) => (
                    <tr key={account.id}>
                      <td><b>{account.receivingBank}</b></td>
                      <td>{account.accountHolderName}</td>
                      <td title={account.accountNumber}>{maskAccount(account.accountNumber)}</td>
                      <td>{account.status === "ACTIVE" ? badge("Đang hiệu lực", "finance-badge-success") : badge("Ngừng dùng", "finance-badge-neutral")}</td>
                      <td>{account.createdAt ? formatDate(account.createdAt.slice(0, 10)) : ""}</td>
                      <td>
                        <button type="button" disabled={Boolean(pending)} onClick={(event) => { dialogTrigger.current = event.currentTarget; setErrors({}); setMessage(""); setLifecycle({ account, status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: "" }); }}>{account.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}</button>
                        <button type="button" onClick={(event) => { dialogTrigger.current = event.currentTarget; setAccountHistory(account); }}>Xem lịch sử</button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} role="status">Không có tài khoản nhận tiền phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
            </section>
          </section>
        </section>
      )}

      {tab === "attendance-handover" && (
        <section id="attendance-handover" className="settings-panel" aria-labelledby="attendance-handover-title">
          <div>
            <h3 id="attendance-handover-title" tabIndex={-1}>Điểm danh &amp; bàn giao</h3>
            <p className="settings-muted">Giáo viên ghi nhận trong ứng dụng Giáo viên. Chọn yêu cầu ảnh tại đây. Lưu lại cùng ngày hiệu lực (từ hôm nay trở đi) sẽ sửa phiên bản đó.</p>
          </div>
          {(["attendance", "handover"] as const).map((kind) => {
            const policy = kind === "attendance" ? attendancePolicy : handoverPolicy;
            const setPolicy = kind === "attendance" ? setAttendancePolicy : setHandoverPolicy;
            const scope = kind === "attendance" ? "attendancePolicy" : "handoverPolicy";
            const active = kind === "attendance" ? data?.attendancePolicy : data?.handoverPolicy;
            const versions = (kind === "attendance" ? data?.attendancePolicyVersions : data?.handoverPolicyVersions) ?? [];
            const copy = evidenceCopy[kind];
            return (
              <form key={kind} className="settings-card" onSubmit={(event) => void saveEvidencePolicy(kind, event)} aria-labelledby={`${kind}-evidence-title`}>
                <div className="settings-card-head">
                  <div>
                    <h3 id={`${kind}-evidence-title`}>{copy.title}</h3>
                    <p>{active ? copy[active.photoEvidenceMode] : "Chưa có yêu cầu được xác nhận."}</p>
                  </div>
                  {active ? badge(active.photoEvidenceMode === "REQUIRED" ? "Bắt buộc" : "Tùy chọn", active.photoEvidenceMode === "REQUIRED" ? "finance-badge-success" : "finance-badge-info") : badge("Chưa thiết lập", "finance-badge-warning")}
                </div>
                <div className="settings-fields">
                  <div className="settings-field">
                    <label>
                      Yêu cầu ảnh
                      <select value={policy.photoEvidenceMode || active?.photoEvidenceMode || "REQUIRED"} onChange={(event) => setPolicy({ ...policy, photoEvidenceMode: event.target.value as EvidenceMode })} {...field(scope, "photoEvidenceMode")}>
                        <option value="REQUIRED">Bắt buộc</option>
                        <option value="OPTIONAL">Tùy chọn</option>
                      </select>
                    </label>
                    {fieldError(scope, "photoEvidenceMode")}
                  </div>
                  <div className="settings-field">
                    <label>
                      Ngày hiệu lực
                      <DateInput value={policy.effectiveFrom || today} onChange={(event) => setPolicy({ ...policy, effectiveFrom: event.target.value })} {...field(scope, "effectiveFrom")} />
                    </label>
                    {fieldError(scope, "effectiveFrom")}
                  </div>
                  <div className="settings-field settings-field-wide">
                    <label>
                      Lý do
                      <input value={policy.reason} onChange={(event) => setPolicy({ ...policy, reason: event.target.value })} {...field(scope, "reason")} />
                    </label>
                    {fieldError(scope, "reason")}
                  </div>
                </div>
                <p className="settings-muted">{copy.note}</p>
                <div className="settings-actions">
                  <button type="submit" className="primary-action" disabled={Boolean(pending)}>Thay đổi</button>
                </div>
                {versions.length > 0 && (
                  <details className="settings-history">
                    <summary>Lịch sử thay đổi ({versions.length})</summary>
                    <div className="table-scroll">
                      <table>
                        <caption>Lịch sử {copy.title.toLocaleLowerCase("vi")}</caption>
                        <thead><tr><th>Hiệu lực</th><th>Yêu cầu ảnh</th><th>Lý do</th><th>Trạng thái</th><th>Tùy chọn</th></tr></thead>
                        <tbody>
                          {versions.map((version) => {
                            const [label, tone] = versionState(version, versions, today);
                            return <tr key={version.id}><td>{formatDate(version.effectiveFrom)}</td><td>{version.photoEvidenceMode === "REQUIRED" ? "Bắt buộc" : "Tùy chọn"}</td><td>{version.reason}</td><td>{badge(label, tone)}</td><td>{deleteVersionCell(`${kind}-policy-versions`, scope, version, copy.title)}</td></tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </form>
            );
          })}
          <form className="settings-card" onSubmit={(event) => void saveDailyJournalPolicy(event)} aria-labelledby="daily-journal-title">
            <div className="settings-card-head">
              <div>
                <h3 id="daily-journal-title">Nhật ký ngày và ảnh</h3>
                <p>Phụ huynh xem nhật ký tối đa 30 ngày lịch sau khi học sinh kết thúc học tại trường. Chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 10 MB mỗi ảnh; không giới hạn số ảnh mỗi nhật ký.</p>
              </div>
              {data?.dailyJournalPolicy ? badge("Đã xác nhận", "finance-badge-success") : badge("Chưa xác nhận", "finance-badge-warning")}
            </div>
            <div className="settings-fields">
              <div className="settings-field">
                <label>
                  Ngày hiệu lực
                  <DateInput value={dailyJournalPolicy.effectiveFrom || today} onChange={(event) => setDailyJournalPolicy({ ...dailyJournalPolicy, effectiveFrom: event.target.value })} {...field("dailyJournalPolicy", "effectiveFrom")} />
                </label>
                {fieldError("dailyJournalPolicy", "effectiveFrom")}
              </div>
              <div className="settings-field settings-field-wide">
                <label>
                  Lý do
                  <input value={dailyJournalPolicy.reason} onChange={(event) => setDailyJournalPolicy({ ...dailyJournalPolicy, reason: event.target.value })} {...field("dailyJournalPolicy", "reason")} />
                </label>
                {fieldError("dailyJournalPolicy", "reason")}
              </div>
            </div>
            <div className="settings-actions">
              <button type="submit" className="primary-action" disabled={Boolean(pending)}>Xác nhận chính sách nhật ký</button>
            </div>
            {(data?.dailyJournalPolicyVersions.length ?? 0) > 0 && (
              <details className="settings-history">
                <summary>Lịch sử xác nhận ({data!.dailyJournalPolicyVersions.length})</summary>
                <div className="table-scroll">
                  <table>
                    <caption>Lịch sử chính sách nhật ký ngày</caption>
                    <thead><tr><th>Hiệu lực</th><th>Phụ huynh xem sau khi nghỉ học</th><th>Ảnh</th><th>Lý do</th><th>Tùy chọn</th></tr></thead>
                    <tbody>
                      {data!.dailyJournalPolicyVersions.map((version) => (
                        <tr key={version.id}>
                          <td>{formatDate(version.effectiveFrom)}</td>
                          <td>{version.parentRetentionDaysAfterEnrollmentEnded} ngày</td>
                          <td>{version.acceptedImageMimeTypes.map((type) => type.replace("image/", "").toUpperCase()).join(", ")}, tối đa {version.maxImageSizeBytes / 1024 / 1024} MB</td>
                          <td>{version.reason}</td>
                          <td>{deleteVersionCell("daily-journal-policy-versions", "dailyJournalPolicy", version, "Chính sách nhật ký ngày")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </form>
        </section>
      )}

      {dialogOpen && (
        <div className="student-intake-backdrop" role="presentation">
          <div ref={dialog} className="student-intake-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" onKeyDown={trapDialog}>
            {confirmAction ? (
              <form className="settings-dialog-form" onSubmit={runConfirm}>
                <h3 id="settings-dialog-title">{confirmAction.title}</h3>
                <p>{confirmAction.body}</p>
                {message && <div ref={summary} tabIndex={-1} role="alert">{message}</div>}
                {pending && <p className="settings-muted" role="status">Đang kiểm tra kết quả với hệ thống…</p>}
                <div className="settings-actions">
                  <button type="button" disabled={Boolean(pending)} onClick={closeDialog}>Hủy</button>
                  <button type="submit" className="settings-danger" disabled={Boolean(pending)}>{confirmAction.label}</button>
                </div>
              </form>
            ) : lifecycle ? (
              <form className="settings-dialog-form" onSubmit={transitionBankAccount}>
                <h3 id="settings-dialog-title">{lifecycle.status === "ACTIVE" ? "Dùng lại tài khoản" : "Ngừng dùng tài khoản"}</h3>
                <p className="settings-muted">
                  {lifecycle.account.receivingBank} · {maskAccount(lifecycle.account.accountNumber)} · {lifecycle.account.accountHolderName}
                </p>
                <p>{lifecycle.status === "ACTIVE" ? "Tài khoản sẽ được dùng lại cho hóa đơn mới." : "Tài khoản sẽ không dùng cho hóa đơn mới; lịch sử thanh toán vẫn giữ nguyên."}</p>
                {message && errorScope === "bankAccount" && <div ref={summary} tabIndex={-1} role="alert">{message}</div>}
                <div className="settings-field">
                  <label>
                    Lý do
                    <input value={lifecycle.reason} onChange={(event) => setLifecycle({ ...lifecycle, reason: event.target.value })} {...field("bankAccount", "reason")} />
                  </label>
                  {fieldError("bankAccount", "reason")}
                </div>
                {pending && <p className="settings-muted" role="status">Đang kiểm tra kết quả với hệ thống…</p>}
                <div className="settings-actions">
                  <button type="button" disabled={Boolean(pending)} onClick={closeDialog}>Hủy</button>
                  <button type="submit" className={lifecycle.status === "ACTIVE" ? "primary-action" : "settings-danger"} disabled={Boolean(pending)}>{lifecycle.status === "ACTIVE" ? "Xác nhận dùng lại" : "Xác nhận ngừng dùng"}</button>
                </div>
              </form>
            ) : accountHistory && (
              <div className="settings-dialog-form">
                <h3 id="settings-dialog-title">Lịch sử tài khoản</h3>
                <p className="settings-muted">{accountHistory.receivingBank} · {maskAccount(accountHistory.accountNumber)} · {accountHistory.accountHolderName}</p>
                <ol className="settings-timeline">
                  {accountHistory.lifecycleTransitions.map((transition) => (
                    <li key={transition.changedAt}>
                      <b>{transition.previousStatus === null ? "Thêm tài khoản" : transition.status === "ACTIVE" ? "Dùng lại" : "Ngừng dùng"}</b>
                      <span className="settings-muted">{formatTime(transition.changedAt)}</span>
                      {transition.reason && <span>Lý do: {transition.reason}</span>}
                    </li>
                  ))}
                </ol>
                <div className="settings-actions">
                  <button type="button" onClick={closeDialog}>Đóng</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
