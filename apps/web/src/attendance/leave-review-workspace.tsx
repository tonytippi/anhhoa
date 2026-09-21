import { FormEvent, useEffect, useRef, useState } from "react";

type Leave = {
  id: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  status: string;
  startsOn: string | null;
  operatingDates: string[];
  rejectedReason: string | null;
};
type Pending = { id: string; schoolId: string; status: "SUBMITTING" | "RECONCILING" };
type Status = { dirty: boolean; pending: boolean; reconcile?: () => void };
type ErrorBody = { error?: { message?: string; fieldErrors?: Record<string, string> } };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === "undefined" ? "app_csrf" : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-leave-decision";
const maxReconcileAttempts = 8;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const csrf = () => document.cookie.split("; ").find((value) => value.startsWith(`${csrfName}=`))?.slice(csrfName.length + 1);
const deniedStatus = (status: number) => [401, 403].includes(status);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);

export function LeaveReviewWorkspace({ schoolId, schoolName, denied, onStatusChange }: { schoolId: string; schoolName: string; denied: () => void; onStatusChange?: (status: Status) => void }) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>();
  const school = useRef(schoolId);
  const timer = useRef<number | undefined>(undefined);
  const reconcileAttempt = useRef(0);
  const active = useRef(true);
  const clearTimer = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = undefined; };
  const load = async () => {
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/leave-requests`, { credentials: "include" });
    if (school.current !== schoolId) return;
    if (deniedStatus(response.status)) return denied();
    if (!response.ok) throw new Error("Không thể tải đơn nghỉ.");
    setLeaves(((await response.json()) as { data: Leave[] }).data);
  };
  const remember = (operation: Pending) => {
    sessionStorage.setItem(pendingKey, JSON.stringify(operation));
    setPending(operation);
  };
  const reconcile = async (operation: Pending, attempt = 0) => {
    clearTimer();
    if (!active.current || school.current !== operation.schoolId || !uuid.test(operation.id) || !uuid.test(operation.schoolId)) return;
    if (attempt >= maxReconcileAttempts) { setMessage("Không thể đối soát thao tác. Vui lòng thử đối soát lại."); return; }
    reconcileAttempt.current = attempt;
    remember({ ...operation, status: "RECONCILING" });
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${operation.schoolId}/leave-operations/${operation.id}`, { credentials: "include" });
      if (!active.current || school.current !== operation.schoolId) return;
      if (deniedStatus(response.status)) return denied();
      // A missing Operation is uncertain, not proof that this user lost authorization.
      if (!response.ok) throw new Error("Operation chưa thể xác nhận.");
      const result = ((await response.json()) as { data: { status: string } }).data;
      if (result.status === "PENDING") {
        timer.current = window.setTimeout(() => void reconcile(operation, attempt + 1), 750);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      if (result.status === "COMPLETED") await load();
      else setMessage("Thao tác không thành công.");
    } catch {
      if (active.current && school.current === operation.schoolId) timer.current = window.setTimeout(() => void reconcile(operation, attempt + 1), 750);
    }
  };
  useEffect(() => {
    active.current = true; school.current = schoolId; clearTimer(); reconcileAttempt.current = 0;
    setLeaves([]); setReason({}); setErrors({}); setMessage(""); setPending(undefined);
    void load().catch((error: Error) => setMessage(error.message));
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) try { const saved = JSON.parse(raw) as Pending; if (saved.schoolId === schoolId && uuid.test(saved.id) && uuid.test(saved.schoolId) && (saved.status === "SUBMITTING" || saved.status === "RECONCILING")) void reconcile(saved); else sessionStorage.removeItem(pendingKey); } catch { sessionStorage.removeItem(pendingKey); }
    return () => { active.current = false; clearTimer(); };
  }, [schoolId]);
  useEffect(() => onStatusChange?.({ dirty: Object.values(reason).some(Boolean), pending: Boolean(pending), reconcile: pending ? () => void reconcile(pending) : undefined }), [reason, pending, onStatusChange]);
  const decide = async (event: FormEvent, leave: Leave, action: "approve" | "reject") => {
    event.preventDefault();
    if (pending) return;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, status: "SUBMITTING" };
    setMessage(""); setErrors({});
    // Persist before dispatch so navigation or a transport failure cannot lose the Operation handle.
    remember(operation);
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/leave-requests/${leave.id}/${action}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? ""), "idempotency-key": crypto.randomUUID(), "x-operation-id": operation.id }, body: JSON.stringify(action === "reject" ? { reason: reason[leave.id] ?? "" } : {}) });
      if (school.current !== schoolId) return;
      if (deniedStatus(response.status)) { sessionStorage.removeItem(pendingKey); setPending(undefined); return denied(); }
      if (uncertain(response.status)) throw new TypeError();
      if (!response.ok) {
        let data: ErrorBody | undefined;
        try { data = (await response.json()) as ErrorBody; } catch { /* Non-JSON errors are a normal failed response, not an access denial. */ }
        sessionStorage.removeItem(pendingKey); setPending(undefined);
        setErrors(data?.error?.fieldErrors ?? {}); setMessage(data?.error?.message ?? "Thao tác không thành công."); return;
      }
      sessionStorage.removeItem(pendingKey); setPending(undefined);
      setReason((current) => ({ ...current, [leave.id]: "" })); await load();
    } catch {
      void reconcile(operation, 0);
    }
  };
  const pendingLeaves = leaves.filter((leave) => leave.status === "PENDING");
  return <section aria-labelledby="leave-review-title"><h2 id="leave-review-title">Duyệt đơn nghỉ</h2><p>{schoolName} / Đơn nghỉ ngắn chờ quyết định</p>{message && <p role="alert">{message}</p>}{pending && <button type="button" onClick={() => void reconcile(pending, 0)}>Đối soát thao tác</button>}<div className="table-scroll"><table><caption>Đơn nghỉ chờ duyệt</caption><thead><tr><th>Học sinh</th><th>Ngày nghỉ</th><th>Quyết định</th></tr></thead><tbody>{pendingLeaves.length ? pendingLeaves.map((leave) => <tr key={leave.id}><td>{leave.studentName ?? leave.studentId}{leave.studentCode ? ` (${leave.studentCode})` : ""}</td><td>{leave.operatingDates.join(", ")}</td><td><form onSubmit={(event) => decide(event, leave, "reject")}><label>Lý do từ chối<input aria-label={`Lý do từ chối ${leave.id}`} value={reason[leave.id] ?? ""} onChange={(event) => setReason({ ...reason, [leave.id]: event.target.value })} aria-invalid={Boolean(errors.reason)} /></label><button type="button" disabled={Boolean(pending)} onClick={(event) => void decide(event as unknown as FormEvent, leave, "approve")}>Duyệt</button><button disabled={Boolean(pending)}>Từ chối</button></form></td></tr>) : <tr><td colSpan={3}>Không có đơn nghỉ chờ duyệt.</td></tr>}</tbody></table></div></section>;
}
