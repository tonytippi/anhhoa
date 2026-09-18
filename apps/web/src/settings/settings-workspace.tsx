import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

type Holiday = { id?: string; name: string; startsOn: string; endsOn: string };
type Settings = {
  asOf: string;
  timezone: string;
  profile: {
    effectiveFrom: string;
    schoolName: string;
    address: string | null;
    phone: string | null;
  } | null;
  calendar: { effectiveFrom: string; holidays: Holiday[] } | null;
  financePolicy: { effectiveFrom: string; dueDaysAfterIssue: number; taxTreatment: string; debtScope: string; reversalMode: string } | null;
  financePolicyVersions: { id: string; effectiveFrom: string; dueDaysAfterIssue: number; taxTreatment: string; debtScope: string; reversalMode: string; reason: string | null }[];
  attendancePolicy: { effectiveFrom: string; photoEvidenceMode: "REQUIRED" | "OPTIONAL"; reason: string } | null;
  attendancePolicyVersions: { id: string; effectiveFrom: string; photoEvidenceMode: "REQUIRED" | "OPTIONAL"; reason: string }[];
  handoverPolicy: { effectiveFrom: string; photoEvidenceMode: "REQUIRED" | "OPTIONAL"; reason: string } | null;
  handoverPolicyVersions: { id: string; effectiveFrom: string; photoEvidenceMode: "REQUIRED" | "OPTIONAL"; reason: string }[];
  dailyJournalPolicy: { effectiveFrom: string; reason: string; parentRetentionDaysAfterEnrollmentEnded: number; acceptedImageMimeTypes: string[]; maxImageSizeBytes: number; imageCountLimit: null } | null;
  dailyJournalPolicyVersions: { id: string; effectiveFrom: string; reason: string; parentRetentionDaysAfterEnrollmentEnded: number; acceptedImageMimeTypes: string[]; maxImageSizeBytes: number; imageCountLimit: null }[];
  bankAccounts: { id: string; receivingBank: string; accountNumber: string; accountHolderName: string; transferTemplate: string; status: "ACTIVE" | "INACTIVE"; lifecycleTransitions: { previousStatus: "ACTIVE" | "INACTIVE" | null; status: "ACTIVE" | "INACTIVE"; reason: string | null; changedAt: string }[] }[];
};
type Pending = { id: string; schoolId: string };
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
  const [profile, setProfile] = useState({
    effectiveFrom: "",
    schoolName: "",
    address: "",
    phone: "",
  });
  const [calendar, setCalendar] = useState({
    effectiveFrom: "",
    holidays: [] as Holiday[],
  });
  const [financePolicy, setFinancePolicy] = useState({ effectiveFrom: "", dueDaysAfterIssue: "", taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", reason: "" });
  const [attendancePolicy, setAttendancePolicy] = useState({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
  const [handoverPolicy, setHandoverPolicy] = useState({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
  const [dailyJournalPolicy, setDailyJournalPolicy] = useState({ effectiveFrom: "", reason: "" });
  const [bankAccount, setBankAccount] = useState({ receivingBank: "", accountNumber: "", accountHolderName: "", transferTemplate: "{{studentName}} {{className}}" });
  const [accountQuery, setAccountQuery] = useState("");
  const [accountStatus, setAccountStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [accountSort, setAccountSort] = useState<"newest" | "bank">("newest");
  const [lifecycle, setLifecycle] = useState<{ account: Settings["bankAccounts"][number]; status: "ACTIVE" | "INACTIVE"; reason: string }>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorScope, setErrorScope] = useState<"profile" | "calendar" | "financePolicy" | "attendancePolicy" | "handoverPolicy" | "dailyJournalPolicy" | "bankAccount">(
    "profile",
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>();
  const summary = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeSchool = useRef(schoolId);
  const statusChange = useRef(onStatusChange);
  const attempts = useRef(0);
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const current = (operation: Pending) =>
    activeSchool.current === operation.schoolId;
  const load = async () => {
    const response = await fetch(
      `${apiUrl}/api/app/schools/${schoolId}/settings`,
      { credentials: "include" },
    );
    if ([401, 403, 404].includes(response.status)) return denied();
    if (!response.ok) throw new Error("Không thể tải cấu hình trường.");
    if (activeSchool.current === schoolId)
      setData(((await response.json()) as { data: Settings }).data);
  };
  const reconcile = async (operation: Pending) => {
    if (!current(operation)) return;
    setPending(operation);
    if (attempts.current >= maxReconcileAttempts) {
      setMessage(
        "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
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
        setProfile({
          effectiveFrom: "",
          schoolName: "",
          address: "",
          phone: "",
        });
        setCalendar({ effectiveFrom: "", holidays: [] });
        setFinancePolicy({ effectiveFrom: "", dueDaysAfterIssue: "", taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", reason: "" });
        setAttendancePolicy({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
        setHandoverPolicy({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
        setDailyJournalPolicy({ effectiveFrom: "", reason: "" });
        setBankAccount({ receivingBank: "", accountNumber: "", accountHolderName: "", transferTemplate: "{{studentName}} {{className}}" });
      } else setMessage("Thao tác không thành công.");
    } catch {
      if (current(operation)) {
        attempts.current += 1;
        if (attempts.current >= maxReconcileAttempts)
          setMessage(
            "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
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
    setProfile({ effectiveFrom: "", schoolName: "", address: "", phone: "" });
    setCalendar({ effectiveFrom: "", holidays: [] });
    setFinancePolicy({ effectiveFrom: "", dueDaysAfterIssue: "", taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", reason: "" });
    setAttendancePolicy({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
    setHandoverPolicy({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" });
    setDailyJournalPolicy({ effectiveFrom: "", reason: "" });
    setBankAccount({ receivingBank: "", accountNumber: "", accountHolderName: "", transferTemplate: "{{studentName}} {{className}}" });
    setAccountQuery(""); setAccountStatus("ALL"); setAccountSort("newest");
    setLifecycle(undefined);
    setErrors({});
    setErrorScope("profile");
    setMessage("");
    setPending(undefined);
    void load().catch((error: Error) => setMessage(error.message));
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
  const dirty = Boolean(
    profile.effectiveFrom ||
      profile.schoolName ||
      calendar.effectiveFrom ||
      calendar.holidays.length ||
        financePolicy.effectiveFrom || financePolicy.dueDaysAfterIssue || financePolicy.reason ||
        attendancePolicy.effectiveFrom || attendancePolicy.photoEvidenceMode !== "REQUIRED" || attendancePolicy.reason || handoverPolicy.effectiveFrom || handoverPolicy.photoEvidenceMode !== "REQUIRED" || handoverPolicy.reason || dailyJournalPolicy.effectiveFrom || dailyJournalPolicy.reason ||
       bankAccount.receivingBank || bankAccount.accountNumber || bankAccount.accountHolderName ||
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
  const post = async (
    path: string,
    body: object,
    scope: "profile" | "calendar" | "financePolicy" | "attendancePolicy" | "handoverPolicy" | "dailyJournalPolicy" | "bankAccount",
  ) => {
    if (pending) return false;
    const operation = { id: crypto.randomUUID(), schoolId };
    setErrors({});
    setErrorScope(scope);
    setMessage("");
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
          "Kết quả chưa chắc chắn. Đang đối soát Operation trước khi thử lại.",
        );
        void reconcile(operation);
      } else
        setMessage(
          error instanceof Error ? error.message : "Thao tác không thành công.",
        );
      return false;
    }
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/settings/profile-versions`,
        profile,
        "profile",
      )
    )
      setProfile({ effectiveFrom: "", schoolName: "", address: "", phone: "" });
  };
  const saveCalendar = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/settings/calendar-versions`,
        calendar,
        "calendar",
      )
    )
      setCalendar({ effectiveFrom: "", holidays: [] });
  };
  const saveFinancePolicy = async (event: FormEvent) => { event.preventDefault(); if (!financePolicy.dueDaysAfterIssue.trim()) { setErrorScope("financePolicy"); setErrors({ dueDaysAfterIssue: "Cần nhập số ngày hạn thanh toán." }); setMessage("Dữ liệu không hợp lệ."); return; } if (await post(`/api/app/schools/${schoolId}/settings/finance-policy-versions`, { ...financePolicy, dueDaysAfterIssue: Number(financePolicy.dueDaysAfterIssue) }, "financePolicy")) setFinancePolicy({ effectiveFrom: "", dueDaysAfterIssue: "", taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", reason: "" }); };
  const saveEvidencePolicy = (kind: "attendance" | "handover", event: FormEvent) => { event.preventDefault(); const policy = kind === "attendance" ? attendancePolicy : handoverPolicy; const scope = kind === "attendance" ? "attendancePolicy" : "handoverPolicy"; return post(`/api/app/schools/${schoolId}/settings/${kind}-policy-versions`, policy, scope).then((saved) => { if (saved) (kind === "attendance" ? setAttendancePolicy : setHandoverPolicy)({ effectiveFrom: "", photoEvidenceMode: "REQUIRED", reason: "" }); }); };
  const saveDailyJournalPolicy = (event: FormEvent) => { event.preventDefault(); return post(`/api/app/schools/${schoolId}/settings/daily-journal-policy-versions`, dailyJournalPolicy, "dailyJournalPolicy").then((saved) => { if (saved) setDailyJournalPolicy({ effectiveFrom: "", reason: "" }); }); };
  const saveBankAccount = async (event: FormEvent) => { event.preventDefault(); if (await post(`/api/app/schools/${schoolId}/settings/bank-accounts`, bankAccount, "bankAccount")) setBankAccount({ receivingBank: "", accountNumber: "", accountHolderName: "", transferTemplate: "{{studentName}} {{className}}" }); };
  const transitionBankAccount = async (event: FormEvent) => { event.preventDefault(); if (!lifecycle) return; if (await post(`/api/app/schools/${schoolId}/settings/bank-accounts/${lifecycle.account.id}/lifecycle`, { status: lifecycle.status, reason: lifecycle.reason }, "bankAccount")) setLifecycle(undefined); };
  const visibleAccounts = (data?.bankAccounts ?? []).filter((account) => (accountStatus === "ALL" || account.status === accountStatus) && `${account.receivingBank} ${account.accountNumber} ${account.accountHolderName}`.toLocaleLowerCase("vi").includes(accountQuery.trim().toLocaleLowerCase("vi"))).sort((a, b) => accountSort === "bank" ? a.receivingBank.localeCompare(b.receivingBank, "vi") : 0);
  const field = (scope: "profile" | "calendar" | "financePolicy" | "attendancePolicy" | "handoverPolicy" | "dailyJournalPolicy" | "bankAccount", name: string) =>
    errorScope === scope && errors[name]
      ? { "aria-invalid": true, "aria-describedby": `${scope}-${name}-error` }
      : {};
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title">Cấu hình trường</h2>
      <p>
        {schoolName} / Dữ liệu được xác nhận từ máy chủ (
        {data?.timezone ?? "Asia/Ho_Chi_Minh"}).
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      <section>
        <h3>Thông tin trường</h3>
        <p>
          Đang áp dụng:{" "}
          {data?.profile
            ? `${data.profile.schoolName} từ ${data.profile.effectiveFrom}`
            : "Chưa có phiên bản"}
        </p>
        <form onSubmit={saveProfile}>
          <label>
            Ngày hiệu lực
            <input
              type="date"
              value={profile.effectiveFrom}
              onChange={(event) =>
                setProfile({ ...profile, effectiveFrom: event.target.value })
              }
              {...field("profile", "effectiveFrom")}
            />
          </label>
          {errorScope === "profile" && errors.effectiveFrom && (
            <small id="profile-effectiveFrom-error">
              {errors.effectiveFrom}
            </small>
          )}
          <label>
            Tên trường
            <input
              value={profile.schoolName}
              onChange={(event) =>
                setProfile({ ...profile, schoolName: event.target.value })
              }
              {...field("profile", "schoolName")}
            />
          </label>
          {errorScope === "profile" && errors.schoolName && (
            <small id="profile-schoolName-error">{errors.schoolName}</small>
          )}
          <label>
            Địa chỉ
            <input
              value={profile.address}
              onChange={(event) =>
                setProfile({ ...profile, address: event.target.value })
              }
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={profile.phone}
              onChange={(event) =>
                setProfile({ ...profile, phone: event.target.value })
              }
            />
          </label>
          <button disabled={Boolean(pending)}>Tạo phiên bản hồ sơ</button>
        </form>
      </section>
      <section>
        <h3>Điểm danh và bàn giao</h3>
        <p>Policy đang áp dụng: ảnh cho PRESENT {data?.attendancePolicy?.photoEvidenceMode === "REQUIRED" ? "bắt buộc" : data?.attendancePolicy ? "tùy chọn" : "chưa có phiên bản"}; ảnh cho pickedUpAt {data?.handoverPolicy?.photoEvidenceMode === "REQUIRED" ? "bắt buộc" : data?.handoverPolicy ? "tùy chọn" : "chưa có phiên bản"}.</p>
        {(["attendance", "handover"] as const).map((kind) => { const policy = kind === "attendance" ? attendancePolicy : handoverPolicy; const setPolicy = kind === "attendance" ? setAttendancePolicy : setHandoverPolicy; const scope = kind === "attendance" ? "attendancePolicy" : "handoverPolicy"; const label = kind === "attendance" ? "PRESENT" : "pickedUpAt"; const versions = kind === "attendance" ? data?.attendancePolicyVersions : data?.handoverPolicyVersions; return <form key={kind} onSubmit={(event) => void saveEvidencePolicy(kind, event)}><h4>Ảnh bằng chứng {label}</h4><label>Ngày hiệu lực<input type="date" value={policy.effectiveFrom} onChange={(event) => setPolicy({ ...policy, effectiveFrom: event.target.value })} {...field(scope, "effectiveFrom")} /></label>{errorScope === scope && errors.effectiveFrom && <small id={`${scope}-effectiveFrom-error`}>{errors.effectiveFrom}</small>}<label>Yêu cầu ảnh<select value={policy.photoEvidenceMode} onChange={(event) => setPolicy({ ...policy, photoEvidenceMode: event.target.value as "REQUIRED" | "OPTIONAL" })} {...field(scope, "photoEvidenceMode")}><option value="REQUIRED">Bắt buộc</option><option value="OPTIONAL">Tùy chọn</option></select></label>{errorScope === scope && errors.photoEvidenceMode && <small id={`${scope}-photoEvidenceMode-error`}>{errors.photoEvidenceMode}</small>}<label>Lý do<input value={policy.reason} onChange={(event) => setPolicy({ ...policy, reason: event.target.value })} {...field(scope, "reason")} /></label>{errorScope === scope && errors.reason && <small id={`${scope}-reason-error`}>{errors.reason}</small>}<button disabled={Boolean(pending)}>Tạo phiên bản policy</button><table><caption>Lịch sử policy ảnh {label}</caption><thead><tr><th>Hiệu lực</th><th>Yêu cầu ảnh</th><th>Lý do</th></tr></thead><tbody>{(versions ?? []).map((version) => <tr key={version.id}><td>{version.effectiveFrom}</td><td>{version.photoEvidenceMode === "REQUIRED" ? "Bắt buộc" : "Tùy chọn"}</td><td>{version.reason}</td></tr>)}</tbody></table></form>; })}
        <form onSubmit={(event) => void saveDailyJournalPolicy(event)}><h4>Daily Journal và media</h4><p>Parent xem tối đa 30 ngày lịch sau ngày kết thúc enrollment. Chỉ JPEG, PNG hoặc WEBP, tối đa 10 MB mỗi ảnh; không giới hạn số ảnh mỗi journal.</p><label>Ngày hiệu lực<input type="date" value={dailyJournalPolicy.effectiveFrom} onChange={(event) => setDailyJournalPolicy({ ...dailyJournalPolicy, effectiveFrom: event.target.value })} {...field("dailyJournalPolicy", "effectiveFrom")} /></label>{errorScope === "dailyJournalPolicy" && errors.effectiveFrom && <small id="dailyJournalPolicy-effectiveFrom-error">{errors.effectiveFrom}</small>}<label>Lý do<input value={dailyJournalPolicy.reason} onChange={(event) => setDailyJournalPolicy({ ...dailyJournalPolicy, reason: event.target.value })} {...field("dailyJournalPolicy", "reason")} /></label>{errorScope === "dailyJournalPolicy" && errors.reason && <small id="dailyJournalPolicy-reason-error">{errors.reason}</small>}<button disabled={Boolean(pending)}>Xác nhận policy Daily Journal</button><table><caption>Lịch sử policy Daily Journal</caption><thead><tr><th>Hiệu lực</th><th>Retention</th><th>Media</th><th>Lý do</th></tr></thead><tbody>{(data?.dailyJournalPolicyVersions ?? []).map((version) => <tr key={version.id}><td>{version.effectiveFrom}</td><td>{version.parentRetentionDaysAfterEnrollmentEnded} ngày</td><td>{version.acceptedImageMimeTypes.join(", ")}, {version.maxImageSizeBytes / 1024 / 1024} MB, không giới hạn</td><td>{version.reason}</td></tr>)}</tbody></table></form>
      </section>
      <section>
        <h3>Tài chính và thanh toán</h3>
        <p>Policy đang áp dụng: {data?.financePolicy ? `${data.financePolicy.dueDaysAfterIssue} ngày từ ${data.financePolicy.effectiveFrom}` : "Chưa có phiên bản"}.</p>
        <form onSubmit={saveFinancePolicy}>
           <label>Ngày hiệu lực<input type="date" value={financePolicy.effectiveFrom} onChange={(event) => setFinancePolicy({ ...financePolicy, effectiveFrom: event.target.value })} {...field("financePolicy", "effectiveFrom")} /></label>{errorScope === "financePolicy" && errors.effectiveFrom && <small id="financePolicy-effectiveFrom-error">{errors.effectiveFrom}</small>}
           <label>Số ngày hạn thanh toán<input type="number" min="0" max="365" value={financePolicy.dueDaysAfterIssue} onChange={(event) => setFinancePolicy({ ...financePolicy, dueDaysAfterIssue: event.target.value })} {...field("financePolicy", "dueDaysAfterIssue")} /></label>{errorScope === "financePolicy" && errors.dueDaysAfterIssue && <small id="financePolicy-dueDaysAfterIssue-error">{errors.dueDaysAfterIssue}</small>}
          <label>Nhãn thuế<select value={financePolicy.taxTreatment} onChange={(event) => setFinancePolicy({ ...financePolicy, taxTreatment: event.target.value })}><option value="NOT_APPLICABLE">Không áp dụng</option><option value="TAX_INCLUDED">Đã gồm thuế</option><option value="TAX_EXCLUDED">Chưa gồm thuế</option></select></label>
          <label>Đảo ngược<select value={financePolicy.reversalMode} onChange={(event) => setFinancePolicy({ ...financePolicy, reversalMode: event.target.value })}><option value="DIRECT">Trực tiếp</option><option value="SCHOOL_ADMIN_APPROVAL">School Admin phê duyệt</option></select></label>
           <label>Lý do<input value={financePolicy.reason} onChange={(event) => setFinancePolicy({ ...financePolicy, reason: event.target.value })} {...field("financePolicy", "reason")} /></label>{errorScope === "financePolicy" && errors.reason && <small id="financePolicy-reason-error">{errors.reason}</small>}
           <button disabled={Boolean(pending)}>Tạo phiên bản chính sách</button>
         </form>
         <table><caption>Lịch sử phiên bản chính sách tài chính</caption><thead><tr><th>Hiệu lực</th><th>Hạn thanh toán</th><th>Thuế</th><th>Đảo ngược</th><th>Lý do</th></tr></thead><tbody>{(data?.financePolicyVersions ?? []).map((policy) => <tr key={policy.id}><td>{policy.effectiveFrom}</td><td>{policy.dueDaysAfterIssue}</td><td>{policy.taxTreatment}</td><td>{policy.reversalMode}</td><td>{policy.reason ?? ""}</td></tr>)}</tbody></table>
        <h4>Tài khoản nhận tiền</h4>
        <label>Tìm tài khoản<input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} /></label>
        <label>Trạng thái tài khoản<select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
        <label>Sắp xếp tài khoản<select value={accountSort} onChange={(event) => setAccountSort(event.target.value as "newest" | "bank")}><option value="newest">Mới nhất</option><option value="bank">Ngân hàng</option></select></label>
        <table><caption>Lịch sử tài khoản nhận tiền</caption><thead><tr><th>Ngân hàng</th><th>Số tài khoản</th><th>Chủ tài khoản</th><th>Trạng thái</th><th>Lịch sử</th><th>Thao tác</th></tr></thead><tbody>{visibleAccounts.length ? visibleAccounts.map((account) => <tr key={account.id}><td>{account.receivingBank}</td><td>{account.accountNumber}</td><td>{account.accountHolderName}</td><td>{account.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}</td><td>{(account.lifecycleTransitions ?? []).map((transition) => <div key={transition.changedAt}>{transition.changedAt}: {transition.previousStatus ?? "Tạo mới"} -&gt; {transition.status}{transition.reason ? ` (${transition.reason})` : ""}</div>)}</td><td><button type="button" onClick={() => setLifecycle({ account, status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: "" })}>{account.status === "ACTIVE" ? "Ngừng sử dụng" : "Kích hoạt"}</button></td></tr>) : <tr><td colSpan={6} role="status">Không có tài khoản phù hợp.</td></tr>}</tbody></table>
        {lifecycle && <form aria-label="Thay đổi trạng thái tài khoản" onSubmit={transitionBankAccount}><h5>Thay đổi {lifecycle.account.receivingBank} thành {lifecycle.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}</h5><label>Lý do thay đổi<input autoFocus value={lifecycle.reason} onChange={(event) => setLifecycle({ ...lifecycle, reason: event.target.value })} {...field("bankAccount", "reason")} /></label>{errorScope === "bankAccount" && errors.reason && <small id="bankAccount-reason-error">{errors.reason}</small>}<button disabled={Boolean(pending)}>Xác nhận thay đổi</button><button type="button" onClick={() => setLifecycle(undefined)}>Hủy</button></form>}
        <form onSubmit={saveBankAccount}>
           <label>Ngân hàng nhận<input value={bankAccount.receivingBank} onChange={(event) => setBankAccount({ ...bankAccount, receivingBank: event.target.value })} {...field("bankAccount", "receivingBank")} /></label>{errorScope === "bankAccount" && errors.receivingBank && <small id="bankAccount-receivingBank-error">{errors.receivingBank}</small>}
           <label>Số tài khoản<input value={bankAccount.accountNumber} onChange={(event) => setBankAccount({ ...bankAccount, accountNumber: event.target.value })} {...field("bankAccount", "accountNumber")} /></label>{errorScope === "bankAccount" && errors.accountNumber && <small id="bankAccount-accountNumber-error">{errors.accountNumber}</small>}
           <label>Chủ tài khoản<input value={bankAccount.accountHolderName} onChange={(event) => setBankAccount({ ...bankAccount, accountHolderName: event.target.value })} {...field("bankAccount", "accountHolderName")} /></label>{errorScope === "bankAccount" && errors.accountHolderName && <small id="bankAccount-accountHolderName-error">{errors.accountHolderName}</small>}
          <label>Mẫu chuyển khoản<input readOnly value={bankAccount.transferTemplate} /></label>
          <button disabled={Boolean(pending)}>Thêm tài khoản nhận tiền</button>
        </form>
      </section>
      <section>
        <h3>Lịch hoạt động</h3>
        <p>
          Thứ Hai đến Thứ Bảy hoạt động; Chủ Nhật không hoạt động. Đang áp dụng
          từ {data?.calendar?.effectiveFrom ?? "chưa có phiên bản"}.
        </p>
        <form onSubmit={saveCalendar}>
          <label>
            Ngày hiệu lực
            <input
              type="date"
              value={calendar.effectiveFrom}
              onChange={(event) =>
                setCalendar({ ...calendar, effectiveFrom: event.target.value })
              }
              {...field("calendar", "effectiveFrom")}
            />
          </label>
          {errorScope === "calendar" && errors.effectiveFrom && (
            <small id="calendar-effectiveFrom-error">
              {errors.effectiveFrom}
            </small>
          )}
          <fieldset>
            <legend>Ngày nghỉ có tên</legend>
            {calendar.holidays.map((holiday, index) => (
              <div key={index}>
                <label>
                  Tên
                  <input
                    value={holiday.name}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Bắt đầu
                  <input
                    type="date"
                    value={holiday.startsOn}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, startsOn: event.target.value }
                            : item,
                        ),
                      })
                    }
                    {...field("calendar", "startsOn")}
                  />
                </label>
                <label>
                  Kết thúc
                  <input
                    type="date"
                    value={holiday.endsOn}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, endsOn: event.target.value }
                            : item,
                        ),
                      })
                    }
                    {...field("calendar", "endsOn")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCalendar({
                      ...calendar,
                      holidays: calendar.holidays.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  Bỏ ngày nghỉ
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setCalendar({
                  ...calendar,
                  holidays: [
                    ...calendar.holidays,
                    { name: "", startsOn: "", endsOn: "" },
                  ],
                })
              }
            >
              Thêm ngày nghỉ
            </button>
          </fieldset>
          {errorScope === "calendar" && errors.startsOn && (
            <small id="calendar-startsOn-error">{errors.startsOn}</small>
          )}
          {errorScope === "calendar" && errors.endsOn && (
            <small id="calendar-endsOn-error">{errors.endsOn}</small>
          )}
          <button disabled={Boolean(pending)}>Tạo phiên bản lịch</button>
        </form>
      </section>
    </section>
  );
}
