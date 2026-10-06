import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ReceivableEditFields, receivableEditChanges, receivableEditValues, type ReceivableEditValues, type ReceivableKind, type TaxCategory } from "./receivable-edit-fields";

// Story 5.34 (decision 2026-10-02 §3.3). Layout follows the reviewed mockup admin/extracurricular-classes.html.
// The server owns eligibility, overlap, counts and flags; the browser only renders them.
type Status = "ACTIVE" | "INACTIVE" | null;
type ExtraClass = { id: string; schoolYearId: string; name: string; receivableId: string; status: Status; receivableName: string; unitLabel: string; defaultUnitPrice: string; sharedWith: string[]; currentMembers: number };
type ReceivableOption = { id: string; displayName: string; unitLabel: string; defaultUnitPrice: string; status: Status; sharedWith: string[] };
type Year = { id: string; name: string; startsOn: string; endsOn: string; closedAt: string | null };
type ListData = { schoolYears: Year[]; classes: ExtraClass[]; receivables: ReceivableOption[] };
type Member = { id: string; enrollmentId: string; studentCode: string; fullName: string; officialClassId: string | null; officialClassName: string | null; effectiveFrom: string; effectiveTo: string | null; open: boolean; state: "ACTIVE" | "ENDED" | "UPCOMING"; flags: Array<"JOINED_IN_MONTH" | "LEFT_IN_MONTH">; transferNote: string | null };
type Detail = { class: ExtraClass & { schoolYearName: string }; month: { month: string; current: number; counted: number; midMonth: number }; officialClasses: Array<{ id: string; name: string }>; total: number; members: Member[] };
type Candidates = { officialClasses: Array<{ id: string | null; name: string }>; candidates: Array<{ enrollmentId: string; studentCode: string; fullName: string; officialClassName: string | null; member: boolean }> };
type Dialog = "create" | "add" | "end" | "lifecycle" | "edit" | "price";
type CatalogReceivable = { id: string; kind: ReceivableKind | null; kindLocked: boolean; extracurricularClassNames: string[]; displayName: string; unitLabel: string; defaultUnitPrice: string; refundUnitPrice?: string; taxCategory?: TaxCategory };
type PriceEdit = { id: string; title: string; values: ReceivableEditValues; original: ReceivableEditValues; locked: boolean; classNames: string[]; reason: string };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === "undefined" ? "app_csrf" : __CSRF_COOKIE_NAME__;
const csrf = () => document.cookie.split("; ").find((item) => item.startsWith(`${csrfName}=`))?.slice(csrfName.length + 1);
// An uncertain mutation keeps its Operation (id, key, route, body) until the server says it is terminal; no new key is minted before.
const pendingStorageKey = "passionedu.app.pending-extracurricular-operation";
type PendingOp = { id: string; key: string; path: string; body: object; schoolId: string; method?: "POST" | "PUT" };
const storedPending = (schoolId: string): PendingOp | undefined => {
  try { const value = JSON.parse(sessionStorage.getItem(pendingStorageKey) ?? "null") as PendingOp | null; return value && value.schoolId === schoolId ? value : undefined; } catch { return undefined; }
};
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
const price = (item: { defaultUnitPrice: string; unitLabel: string }) => `${vnd(item.defaultUnitPrice)} đ/${item.unitLabel}`;
const shown = (value: string | null) => (value ? value.split("-").reverse().join("/") : "—");
const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const statusLabel = (status: Status) => (status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động");
const memberBadge = (member: Member): [string, string] => {
  if (member.state === "ENDED") return ["neutral", "Đã kết thúc"];
  if (member.flags.includes("LEFT_IN_MONTH")) return ["warning", "Kết thúc trong tháng"];
  if (member.flags.includes("JOINED_IN_MONTH")) return ["info", "Vào giữa tháng"];
  if (member.state === "UPCOMING") return ["info", "Sắp tham gia"];
  return ["success", "Đang tham gia"];
};

export function ExtracurricularClassesWorkspace({ schoolId, schoolName, search, onSearchChange, denied, onStatusChange }: {
  schoolId: string;
  schoolName: string;
  search: string;
  onSearchChange: (search: string) => void;
  denied: () => void;
  onStatusChange?: (status: { dirty: boolean; pending: boolean }) => void;
}) {
  const classId = new URLSearchParams(search).get("class") ?? "";
  const [list, setList] = useState<ListData>();
  const [filters, setFilters] = useState({ q: "", schoolYearId: "", receivableId: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [detail, setDetail] = useState<Detail>();
  const [memberFilters, setMemberFilters] = useState({ q: "", officialClassId: "", status: "COUNTED" });
  const [memberApplied, setMemberApplied] = useState(memberFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog>();
  const [form, setForm] = useState({ name: "", schoolYearId: "", receivableId: "", effectiveFrom: today(), effectiveTo: "", reason: "" });
  const [candidates, setCandidates] = useState<Candidates>();
  const [candidateFilter, setCandidateFilter] = useState({ q: "", officialClassId: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [receivableOptions, setReceivableOptions] = useState<ReceivableOption[]>();
  const [priceEdit, setPriceEdit] = useState<PriceEdit>();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [pendingOp, setPendingOp] = useState<PendingOp | undefined>(() => storedPending(schoolId));
  const active = useRef(schoolId);
  const submitting = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const classIdRef = useRef(classId);
  const sequence = useRef({ list: 0, detail: 0, candidates: 0 });
  active.current = schoolId;
  classIdRef.current = classId;

  const request = async <T,>(path: string, allowNotFoundRedirect = true) => {
    const response = await fetch(`${apiUrl}${path}`, { credentials: "include" });
    if ([401, 403].includes(response.status)) { denied(); throw new Error(); }
    if (response.status === 404 && classIdRef.current && allowNotFoundRedirect) { onSearchChange(""); throw new Error("Không tìm thấy lớp ngoại khóa."); }
    if (!response.ok) throw new Error("Không thể tải dữ liệu lớp ngoại khóa.");
    return ((await response.json()) as { data: T }).data;
  };
  const base = `/api/app/schools/${schoolId}/finance/extracurricular-classes`;
  const query = (values: Record<string, string>) => { const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value)); return params.toString() ? `?${params}` : ""; };
  // Each load captures the School, class and a sequence number; an out-of-order or superseded response is ignored.
  const loadList = async () => {
    const token = ++sequence.current.list;
    const data = await request<ListData>(`${base}${query({ schoolYearId: applied.schoolYearId, receivableId: applied.receivableId, status: applied.status, q: applied.q })}`);
    if (active.current === schoolId && token === sequence.current.list && !classIdRef.current) setList(data);
  };
  const loadDetail = async () => {
    const token = ++sequence.current.detail;
    const requested = classId;
    const data = await request<Detail>(`${base}/${requested}${query({ q: memberApplied.q, officialClassId: memberApplied.officialClassId, status: memberApplied.status })}`);
    if (active.current === schoolId && token === sequence.current.detail && classIdRef.current === requested) { setDetail(data); setSelected((current) => current.filter((id) => data.members.some((member) => member.id === id && member.open))); }
  };
  const refresh = () => (classId ? loadDetail() : loadList());
  useEffect(() => {
    setMessage("");
    (classId ? loadDetail() : loadList()).catch((error: Error) => error.message && setMessage(error.message));
  }, [schoolId, classId, applied, memberApplied]);
  useEffect(() => { setDetail(undefined); setSelected([]); setMemberFilters({ q: "", officialClassId: "", status: "COUNTED" }); setMemberApplied({ q: "", officialClassId: "", status: "COUNTED" }); }, [classId, schoolId]);
  useEffect(() => { onStatusChange?.({ dirty: false, pending }); }, [pending]);
  useEffect(() => {
    if (!dialog && restoreFocus.current) { restoreFocus.current = false; if (trigger.current?.isConnected) trigger.current.focus(); }
  }, [dialog, pending]);
  useEffect(() => {
    if (dialog) dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])")?.focus();
  }, [dialog, Boolean(priceEdit)]);
  useEffect(() => {
    if (dialog !== "add" || !classId) return;
    const token = ++sequence.current.candidates;
    const requested = classId;
    request<Candidates>(`${base}/${requested}/candidates${query({ q: candidateFilter.q, officialClassId: candidateFilter.officialClassId })}`)
      .then((data) => { if (active.current === schoolId && token === sequence.current.candidates && classIdRef.current === requested) setCandidates(data); })
      .catch((error: Error) => error.message && token === sequence.current.candidates && setMessage(error.message));
  }, [dialog, candidateFilter]);

  const open = (kind: Dialog, source: HTMLElement | null) => {
    trigger.current = source;
    setErrors({});
    setMessage("");
    setForm({ name: "", schoolYearId: applied.schoolYearId || list?.schoolYears[0]?.id || "", receivableId: "", effectiveFrom: today(), effectiveTo: "", reason: "" });
    setCandidates(undefined);
    setCandidateFilter({ q: "", officialClassId: "" });
    setPicked([]);
    setPriceEdit(undefined);
    if (kind === "edit" && detail) {
      setForm((current) => ({ ...current, name: detail.class.name, receivableId: detail.class.receivableId }));
      setReceivableOptions(undefined);
      const requested = classId;
      request<ListData>(`${base}${query({ schoolYearId: detail.class.schoolYearId })}`)
        .then((data) => { if (active.current === schoolId && classIdRef.current === requested) setReceivableOptions(data.receivables); })
        .catch((error: Error) => error.message && setMessage(error.message));
    }
    // Decision 2026-10-06: `Sửa giá` opens the Khoản thu page's edit dialog, loaded from the same catalog read.
    if (kind === "price" && detail) {
      const requested = classId;
      request<{ receivables: CatalogReceivable[] }>(`/api/app/schools/${schoolId}/finance/receivables`)
        .then((data) => {
          const item = data.receivables.find((entry) => entry.id === detail.class.receivableId);
          if (!item || active.current !== schoolId || classIdRef.current !== requested) return;
          const values = receivableEditValues(item);
          setPriceEdit({ id: item.id, title: item.displayName, values, original: values, locked: item.kindLocked, classNames: item.extracurricularClassNames, reason: "" });
        })
        .catch((error: Error) => error.message && setMessage(error.message));
    }
    setDialog(kind);
  };
  const close = () => { if (pending) return; restoreFocus.current = true; setDialog(undefined); setErrors({}); };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea, button")].filter((item) => !item.hasAttribute("disabled"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const forget = () => { sessionStorage.removeItem(pendingStorageKey); setPendingOp(undefined); };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  // Polls the Operation. true = COMPLETED, false = terminal failure, undefined = still unknown (kept pending for "Đối soát lại").
  const poll = async (op: PendingOp, attempts = 8): Promise<boolean | undefined> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(`${apiUrl}/api/app/schools/${op.schoolId}/finance/operations/${op.id}`, { credentials: "include" });
        if ([401, 403].includes(response.status)) { denied(); return false; }
        if (response.ok) {
          const result = ((await response.json()) as { data: { status: string } }).data;
          if (result.status === "COMPLETED") { forget(); return true; }
          if (result.status !== "PENDING") { forget(); setMessage("Thao tác không thành công."); return false; }
        }
      } catch { /* keep reconciling with the same Operation */ }
      await wait(750);
    }
    setMessage("Chưa thể xác nhận Operation. Giữ nguyên thao tác và bấm “Đối soát lại”; hệ thống chưa cho thực hiện thao tác mới.");
    return undefined;
  };
  // Sends (or re-sends) the stored request under its own Idempotency-Key; an uncertain answer is reconciled, never retried under a new key.
  const send = async (op: PendingOp): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}${op.path}`, { method: op.method ?? "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? ""), "idempotency-key": op.key, "x-operation-id": op.id }, body: JSON.stringify(op.body) });
      if ([401, 403].includes(response.status)) { forget(); denied(); return false; }
      if (uncertain(response.status)) { setMessage("Kết quả chưa chắc chắn. Đang đối soát Operation trước khi thử lại."); return (await poll(op)) === true; }
      if (!response.ok) {
        forget();
        const error = ((await response.json()) as { error?: { message?: string; fieldErrors?: Record<string, string> } }).error;
        setErrors(error?.fieldErrors ?? {});
        setMessage(error?.message ?? "Thao tác không thành công.");
        return false;
      }
      const result = ((await response.json()) as { data: { status: string } }).data;
      if (result.status === "PENDING") return (await poll(op)) === true;
      forget();
      return result.status === "COMPLETED";
    } catch {
      setMessage("Kết nối bị gián đoạn. Đang đối soát Operation trước khi thử lại.");
      return (await poll(op)) === true;
    }
  };
  const command = async (path: string, body: object, method: "POST" | "PUT" = "POST") => {
    if (submitting.current || pendingOp) return false;
    submitting.current = true;
    setPending(true);
    setErrors({});
    setMessage("");
    const op: PendingOp = { id: crypto.randomUUID(), key: crypto.randomUUID(), path, body, schoolId, method };
    sessionStorage.setItem(pendingStorageKey, JSON.stringify(op));
    setPendingOp(op);
    try { return await send(op); } finally { submitting.current = false; setPending(false); }
  };
  // "Đối soát lại": ask the server about the same Operation; only when it never saw it is the same request re-sent with the same key.
  const reconcileAgain = async () => {
    const op = pendingOp;
    if (!op || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    let completed = false;
    try {
      let known = false;
      try {
        const response = await fetch(`${apiUrl}/api/app/schools/${op.schoolId}/finance/operations/${op.id}`, { credentials: "include" });
        if ([401, 403].includes(response.status)) { denied(); return; }
        known = response.ok;
      } catch { /* unknown: reconcile below */ }
      completed = known ? (await poll(op, 1)) === true : await send(op);
    } finally { submitting.current = false; setPending(false); }
    if (completed) await finish();
  };
  const finish = async () => {
    restoreFocus.current = true;
    setDialog(undefined);
    setSelected([]);
    try { await refresh(); } catch { setMessage("Thao tác đã hoàn tất; chưa thể tải lại dữ liệu mới nhất."); }
  };
  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    // The dialog can open before the list (and its SchoolYears) has loaded; the select then shows the first open year, so submit that.
    const schoolYearId = form.schoolYearId || years.find((year) => !year.closedAt)?.id || "";
    if (await command(base, { name: form.name, schoolYearId, receivableId: form.receivableId })) await finish();
  };
  const addMembers = async (event: FormEvent) => {
    event.preventDefault();
    if (!picked.length) { setErrors({ enrollmentIds: "Chọn ít nhất một học sinh trước khi thêm." }); return; }
    if (await command(`${base}/${classId}/memberships`, { enrollmentIds: picked, effectiveFrom: form.effectiveFrom, reason: form.reason })) await finish();
  };
  const endMembers = async (event: FormEvent) => {
    event.preventDefault();
    if (await command(`${base}/${classId}/memberships/end`, { membershipIds: selected, effectiveTo: form.effectiveTo, reason: form.reason })) await finish();
  };
  // Decision 2026-10-06: one edit command for the class name and its Receivable; only changed fields are sent.
  const editClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    const changes = { ...(form.name !== detail.class.name ? { name: form.name } : {}), ...(form.receivableId !== detail.class.receivableId ? { receivableId: form.receivableId } : {}) };
    if (await command(`${base}/${classId}`, { ...changes, reason: form.reason }, "PUT")) await finish();
  };
  const savePrice = async (event: FormEvent) => {
    event.preventDefault();
    if (!priceEdit) return;
    const changed = receivableEditChanges(priceEdit);
    if (!Object.keys(changed).length) return;
    if (await command(`/api/app/schools/${schoolId}/finance/receivables/${priceEdit.id}`, { ...changed, reason: priceEdit.reason }, "PUT")) await finish();
  };
  const changeLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    if (detail && await command(`${base}/${classId}/lifecycle`, { status: detail.class.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: form.reason })) await finish();
  };
  const go = (next: string) => (event: { preventDefault(): void }) => { event.preventDefault(); onSearchChange(next); };
  const field = (name: string) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `xc-${name}-error` : undefined });
  const fieldError = (name: string) => errors[name] && <small id={`xc-${name}-error`} role="alert">{errors[name]}</small>;
  const blocked = pending || Boolean(pendingOp);
  const years = list?.schoolYears ?? [];
  const chosenReceivable = list?.receivables.find((item) => item.id === form.receivableId);

  const shell = (children: React.ReactNode) => (
    <section className="finance-workspace extracurricular-workspace" aria-labelledby="xc-title">
      {message && <div role="alert" tabIndex={-1}>{message}</div>}
      {pendingOp && <div role="status" className="xc-pending"><p>Một thao tác chưa có kết quả cuối cùng nên các thao tác mới đang bị khóa.</p><button type="button" disabled={pending} onClick={() => void reconcileAgain()}>Đối soát lại</button></div>}
      {children}
    </section>
  );

  if (classId) {
    if (!detail) return shell(<h1 id="xc-title">Lớp ngoại khóa</h1>);
    const cls = detail.class;
    const inactive = cls.status !== "ACTIVE";
    return shell(<>
      <div className="finance-catalog-heading">
        <div>
          <p className="eyebrow">DANH BỘ › <a href="?" onClick={go("")}>Lớp ngoại khóa</a></p>
          <h1 id="xc-title">{cls.name}</h1>
          <p className="muted"><span className={`badge ${inactive ? "neutral" : "success"}`}>{statusLabel(cls.status)}</span> Năm học {cls.schoolYearName} · {cls.receivableName} · {price(cls)}<button className="xc-inline-action" type="button" disabled={blocked} onClick={(event) => open("price", event.currentTarget)}>Sửa giá</button>{cls.sharedWith.length ? ` · Dùng chung với ${cls.sharedWith.join(", ")}` : ""}</p>
        </div>
        <div className="finance-list-actions">
          <button className="primary-action" type="button" disabled={blocked || inactive} onClick={(event) => open("add", event.currentTarget)}>Thêm học sinh</button>
          <button type="button" disabled={blocked} onClick={(event) => open("edit", event.currentTarget)}>Chỉnh sửa</button>
          <button type="button" disabled={blocked} onClick={(event) => open("lifecycle", event.currentTarget)}>{inactive ? "Kích hoạt lại" : "Ngừng hoạt động"}</button>
        </div>
      </div>
      <p className="xc-month"><b>Tháng {monthLabel(detail.month.month)}</b><span>Đang tham gia: <b>{detail.month.current}</b></span><span>Tính trong tháng: <b>{detail.month.counted}</b></span><span>Vào/nghỉ trong tháng: <b>{detail.month.midMonth}</b></span></p>
      <form className="finance-list-toolbar" aria-label="Lọc thành viên" onSubmit={(event) => { event.preventDefault(); setMemberApplied(memberFilters); }}>
        <label>Tìm học sinh<input type="search" placeholder="Mã hoặc tên học sinh" autoComplete="off" value={memberFilters.q} onChange={(event) => setMemberFilters({ ...memberFilters, q: event.target.value })} /></label>
        <label>Lớp chính thức<select value={memberFilters.officialClassId} onChange={(event) => setMemberFilters({ ...memberFilters, officialClassId: event.target.value })}><option value="">Tất cả lớp</option>{detail.officialClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Trạng thái<select value={memberFilters.status} onChange={(event) => setMemberFilters({ ...memberFilters, status: event.target.value })}><option value="COUNTED">Đang tham gia và trong tháng</option><option value="CURRENT">Đang tham gia</option><option value="ENDED">Đã kết thúc</option><option value="ALL">Tất cả</option></select></label>
        <button type="submit">Áp dụng</button>
      </form>
      <div className="xc-selection">
        <p className="muted" aria-live="polite">{selected.length ? `Đã chọn ${selected.length} học sinh.` : "Chưa chọn học sinh nào."}</p>
        <button type="button" disabled={blocked || inactive || !selected.length} onClick={(event) => open("end", event.currentTarget)}>Kết thúc tham gia</button>
      </div>
      <div className="table-scroll">
        <table>
          <caption>Thành viên · hiển thị {detail.members.length} trong {detail.total} học sinh</caption>
          <thead><tr><th><input type="checkbox" aria-label="Chọn tất cả thành viên đang tham gia" checked={detail.members.some((member) => member.open) && detail.members.filter((member) => member.open).every((member) => selected.includes(member.id))} onChange={(event) => setSelected(event.target.checked ? detail.members.filter((member) => member.open).map((member) => member.id) : [])} disabled={inactive} /></th><th>Mã HS</th><th>Họ tên</th><th>Lớp chính thức</th><th>Từ ngày</th><th>Đến ngày</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {detail.members.length ? detail.members.map((member) => {
              const [tone, label] = memberBadge(member);
              return <tr key={member.id}>
                <td>{member.open && <input type="checkbox" aria-label={`Chọn ${member.fullName}`} disabled={inactive} checked={selected.includes(member.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, member.id] : selected.filter((id) => id !== member.id))} />}</td>
                <td>{member.studentCode}</td>
                <td><b>{member.fullName}</b>{member.transferNote && <><br /><small className="muted">{member.transferNote}</small></>}</td>
                <td>{member.officialClassName ?? "—"}</td>
                <td>{shown(member.effectiveFrom)}</td>
                <td>{shown(member.effectiveTo)}</td>
                <td><span className={`badge ${tone}`}>{label}</span></td>
              </tr>;
            }) : <tr><td colSpan={7}>Chưa có thành viên khớp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      <details className="finance-guide"><summary>Hướng dẫn</summary><p>Học sinh có hiệu lực ít nhất một ngày trong tháng được tính khoản thu của lớp với giá mặc định. Vào/nghỉ giữa tháng hoặc chuyển giữa hai lớp cùng khoản thu được đánh dấu trên hóa đơn nháp; học sinh chuyển lớp chỉ có một dòng, kế toán điều chỉnh số lượng hoặc đơn giá kèm lý do.</p><p>Mỗi lần thêm hoặc kết thúc tham gia được ghi lịch sử theo từng học sinh, kèm lý do và người thực hiện.</p></details>

      {dialog === "add" && <div className="dialog-backdrop"><div ref={dialogRef} className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="xc-add-title" onKeyDown={keyDown}>
        <form onSubmit={addMembers}>
          <h3 id="xc-add-title">Thêm học sinh · {cls.name}</h3>
          <div className="dialog-grid">
            <label>Lớp chính thức<select value={candidateFilter.officialClassId} onChange={(event) => setCandidateFilter({ ...candidateFilter, officialClassId: event.target.value })}><option value="">Tất cả lớp</option>{candidates?.officialClasses.map((item) => <option key={item.id} value={item.id ?? ""}>{item.name}</option>)}</select></label>
            <label>Tìm học sinh<input type="search" placeholder="Mã hoặc tên học sinh" autoComplete="off" value={candidateFilter.q} onChange={(event) => setCandidateFilter({ ...candidateFilter, q: event.target.value })} /></label>
            <div className="full table-scroll"><table>
              <caption>Học sinh có thể thêm</caption>
              <thead><tr><th><input type="checkbox" aria-label="Chọn tất cả học sinh có thể thêm" checked={Boolean(candidates?.candidates.some((item) => !item.member)) && candidates!.candidates.filter((item) => !item.member).every((item) => picked.includes(item.enrollmentId))} onChange={(event) => setPicked(event.target.checked ? (candidates?.candidates ?? []).filter((item) => !item.member).map((item) => item.enrollmentId) : [])} /></th><th>Mã HS</th><th>Họ tên</th><th>Lớp chính thức</th></tr></thead>
              <tbody>{candidates ? (candidates.candidates.length ? candidates.candidates.map((item) => <tr key={item.enrollmentId}><td><input type="checkbox" aria-label={`Chọn ${item.fullName}`} disabled={item.member} checked={picked.includes(item.enrollmentId)} onChange={(event) => setPicked(event.target.checked ? [...picked, item.enrollmentId] : picked.filter((id) => id !== item.enrollmentId))} /></td><td>{item.studentCode}</td><td><b>{item.fullName}</b>{item.member && <><br /><small className="muted">Đã thuộc lớp này</small></>}</td><td>{item.officialClassName ?? "—"}</td></tr>) : <tr><td colSpan={4}>Không có học sinh phù hợp.</td></tr>) : <tr><td colSpan={4}>Đang tải học sinh.</td></tr>}</tbody>
            </table></div>
            <p className="muted full" aria-live="polite">{picked.length ? `Đã chọn ${picked.length} học sinh.` : "Chưa chọn học sinh nào."}</p>
            {fieldError("enrollmentIds")}
            <div><label>Hiệu lực từ<input type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} {...field("effectiveFrom")} /></label>{fieldError("effectiveFrom")}</div>
            <div><label>Lý do<input placeholder="Ví dụ: Đăng ký học kỳ 1" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} {...field("reason")} /></label>{fieldError("reason")}</div>
          </div>
          <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked}>Thêm học sinh đã chọn</button></div>
        </form>
      </div></div>}

      {dialog === "end" && <div className="dialog-backdrop"><div ref={dialogRef} className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="xc-end-title" onKeyDown={keyDown}>
        <form onSubmit={endMembers}>
          <h3 id="xc-end-title">Kết thúc tham gia · {cls.name}</h3>
          <div className="dialog-grid">
            <p className="full">Kết thúc tham gia cho {selected.length} học sinh đã chọn với cùng ngày kết thúc và lý do.</p>
            <div><label>Ngày kết thúc<input type="date" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} {...field("effectiveTo")} /></label>{fieldError("effectiveTo")}</div>
            <div><label>Lý do<input placeholder="Ví dụ: Phụ huynh xin nghỉ" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} {...field("reason")} /></label>{fieldError("reason")}</div>
            <p className="muted full">Học sinh vẫn được tính tháng có ngày tham gia cuối.</p>
          </div>
          <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked}>Kết thúc tham gia</button></div>
        </form>
      </div></div>}

      {dialog === "edit" && (() => {
        const options = (receivableOptions ?? []).filter((item) => item.status === "ACTIVE" || item.id === cls.receivableId);
        const shared = options.find((item) => item.id === form.receivableId)?.sharedWith.filter((name) => name !== cls.name) ?? [];
        const unchanged = form.name === cls.name && form.receivableId === cls.receivableId;
        return <div className="dialog-backdrop"><div ref={dialogRef} className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="xc-edit-title" onKeyDown={keyDown}>
          <form onSubmit={editClass}>
            <h3 id="xc-edit-title">Chỉnh sửa · {cls.name}</h3>
            <div className="dialog-grid">
              <div><label>Tên lớp<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} {...field("name")} /></label>{fieldError("name")}</div>
              <label>Năm học<input value={cls.schoolYearName} disabled /></label>
              <div className="full"><label>Khoản thu<select value={form.receivableId} onChange={(event) => setForm({ ...form, receivableId: event.target.value })} {...field("receivableId")} aria-describedby={errors.receivableId ? "xc-receivableId-error xc-edit-receivable-help" : "xc-edit-receivable-help"}>{options.length ? options.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {price(item)}</option>) : <option value={cls.receivableId}>{cls.receivableName} · {price(cls)}</option>}</select></label><p id="xc-edit-receivable-help" className="muted">{shared.length ? `Dùng chung với: ${shared.join(", ")}.` : "Chỉ khoản thu Ngoại khóa đang áp dụng."}</p>{fieldError("receivableId")}</div>
              <div className="full"><label>Lý do<input placeholder="Ví dụ: Lớp chuyển sang chương trình nâng cao" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} {...field("reason")} /></label>{fieldError("reason")}</div>
              <p className="muted full">Đổi khoản thu chỉ áp dụng cho dòng hóa đơn tạo sau đó; hóa đơn đã tạo giữ nguyên, đợt thu còn nháp cần xem trước lại.</p>
            </div>
            <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked || unchanged}>Lưu thay đổi</button></div>
          </form>
        </div></div>;
      })()}

      {dialog === "price" && <div className="dialog-backdrop"><div ref={dialogRef} className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="xc-price-title" onKeyDown={keyDown}>
        <form onSubmit={savePrice}>
          <h3 id="xc-price-title">Chỉnh sửa · {priceEdit?.title ?? cls.receivableName}</h3>
          {priceEdit ? <ReceivableEditFields values={priceEdit.values} locked={priceEdit.locked} reason={priceEdit.reason} classNames={priceEdit.classNames} onChange={(values) => setPriceEdit({ ...priceEdit, values: { ...priceEdit.values, ...values } })} onReason={(reason) => setPriceEdit({ ...priceEdit, reason })} field={field} /> : <p className="muted">Đang tải khoản thu…</p>}
          {Object.entries(errors).map(([name, error]) => <small key={name} id={`xc-${name}-error`} role="alert">{error}</small>)}
          <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked || !priceEdit || !Object.keys(receivableEditChanges(priceEdit)).length}>Lưu thay đổi</button></div>
        </form>
      </div></div>}

      {dialog === "lifecycle" && <div className="dialog-backdrop"><div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="xc-lifecycle-title" onKeyDown={keyDown}>
        <form onSubmit={changeLifecycle}>
          <h3 id="xc-lifecycle-title">{inactive ? "Kích hoạt lại" : "Ngừng hoạt động"} {cls.name}</h3>
          <p>{inactive ? "Lớp sẽ được tính vào đợt thu mới. Hệ thống kiểm tra khoản thu của lớp còn áp dụng." : "Lớp sẽ không được tính vào đợt thu mới. Thành viên và lịch sử vẫn được giữ để đối soát."}</p>
          <div><label>Lý do<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} {...field("reason")} /></label>{fieldError("reason")}</div>
          <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked}>{inactive ? "Kích hoạt lại" : "Ngừng hoạt động"}</button></div>
        </form>
      </div></div>}
    </>);
  }

  const yearName = years.find((year) => year.id === applied.schoolYearId)?.name ?? years[0]?.name ?? "";
  return shell(<>
    <div className="finance-catalog-heading">
      <div>
        <p className="eyebrow">DANH BỘ</p>
        <h1 id="xc-title">Lớp ngoại khóa · {schoolName}</h1>
        <p className="muted">{yearName ? `Năm học ${yearName} · ` : ""}Dữ liệu do hệ thống xác nhận.</p>
      </div>
      <button className="primary-action" type="button" disabled={blocked} onClick={(event) => open("create", event.currentTarget)}>Thêm lớp ngoại khóa</button>
    </div>
    <form className="finance-list-toolbar" aria-label="Lọc lớp ngoại khóa" onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}>
      <label>Tìm kiếm<input type="search" placeholder="Tên lớp ngoại khóa" autoComplete="off" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
      <label>Năm học<select value={filters.schoolYearId} onChange={(event) => setFilters({ ...filters, schoolYearId: event.target.value })}><option value="">Tất cả năm học</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
      <label>Khoản thu<select value={filters.receivableId} onChange={(event) => setFilters({ ...filters, receivableId: event.target.value })}><option value="">Tất cả khoản thu</option>{list?.receivables.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label>Trạng thái<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
      <button type="submit">Áp dụng</button>
    </form>
    <div className="table-scroll">
      <table>
        <caption>Lớp ngoại khóa · {schoolName}{yearName ? ` · Năm học ${yearName}` : ""}</caption>
        <thead><tr><th>Lớp ngoại khóa</th><th>Khoản thu</th><th>Học sinh hiện tại</th><th>Trạng thái</th><th>Tùy chọn</th></tr></thead>
        <tbody>
          {list ? (list.classes.length ? list.classes.map((item) => <tr key={item.id}>
            <td><b>{item.name}</b></td>
            <td>{item.receivableName} · {price(item)}{item.sharedWith.length > 0 && <><br /><small className="muted">Dùng chung với {item.sharedWith.join(", ")}</small></>}</td>
            <td>{item.currentMembers} học sinh</td>
            <td><span className={`badge ${item.status === "ACTIVE" ? "success" : "neutral"}`}>{statusLabel(item.status)}</span></td>
            <td><a href={`?class=${item.id}`} onClick={go(`?class=${item.id}`)}>Xem thành viên</a></td>
          </tr>) : <tr><td colSpan={5}>Chưa có lớp ngoại khóa.</td></tr>) : <tr><td colSpan={5}>Đang tải lớp ngoại khóa.</td></tr>}
        </tbody>
      </table>
    </div>
    <details className="finance-guide">
      <summary>Hướng dẫn</summary>
      <p>Mỗi lớp ngoại khóa gắn một khoản thu Ngoại khóa ở trang Khoản thu. Nhiều lớp có thể dùng chung một khoản thu và có cùng giá; muốn giá khác, tạo khoản thu khác.</p>
      <p>Thành viên có hiệu lực ít nhất một ngày trong tháng được tính khoản thu của lớp trong đợt thu tháng đó. Vào/nghỉ giữa tháng và chuyển lớp trong tháng được đánh dấu trên hóa đơn nháp để kế toán điều chỉnh; hệ thống không tự chia theo ngày.</p>
      <p>Lớp ngoại khóa không thay đổi lớp chính thức, điểm danh hay quyền của giáo viên.</p>
    </details>
    {dialog === "create" && <div className="dialog-backdrop"><div ref={dialogRef} className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="xc-create-title" onKeyDown={keyDown}>
      <form onSubmit={createClass}>
        <h3 id="xc-create-title">Thêm lớp ngoại khóa</h3>
        <div className="dialog-grid">
          <div><label>Tên lớp<input placeholder="Ví dụ: Tiếng Anh A2 (T3-T5)" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} {...field("name")} /></label>{fieldError("name")}</div>
          <div><label>Năm học<select value={form.schoolYearId} onChange={(event) => setForm({ ...form, schoolYearId: event.target.value })} {...field("schoolYearId")}>{years.filter((year) => !year.closedAt).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>{fieldError("schoolYearId")}</div>
          <div className="full"><label>Khoản thu<select value={form.receivableId} onChange={(event) => setForm({ ...form, receivableId: event.target.value })} {...field("receivableId")} aria-describedby={errors.receivableId ? "xc-receivableId-error xc-receivable-help" : "xc-receivable-help"}><option value="">Chọn khoản thu Ngoại khóa</option>{list?.receivables.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.displayName} · {price(item)}</option>)}</select></label>
            <p id="xc-receivable-help" className="muted">{chosenReceivable?.sharedWith.length ? `Dùng chung với: ${chosenReceivable.sharedWith.join(", ")}.` : "Chỉ khoản thu Ngoại khóa đang áp dụng."}</p>{fieldError("receivableId")}</div>
        </div>
        <div className="dialog-actions"><button type="button" disabled={pending} onClick={close}>Hủy</button><button className="primary-action" disabled={blocked}>Lưu lớp ngoại khóa</button></div>
      </form>
    </div></div>}
  </>);
}
