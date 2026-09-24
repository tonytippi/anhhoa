import { useEffect, useRef, useState } from "react";

type QueueClass = { classId: string; className: string; attendanceGapCount: number; pendingLeaveCount: number };
type Queue = { schoolId: string; attendanceOn: string; operating: boolean; explanation: string; classes: QueueClass[] };
type Item = { studentId: string; studentName: string; studentCode: string };
type Items = { attendanceOn: string; classId: string; className: string; status: "NOT_RECORDED" | "PENDING"; operating: boolean; explanation: string; students: Item[] };
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const deniedStatus = (status: number) => [401, 403].includes(status);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function OperationalQueueWorkspace({ schoolId, schoolName, denied }: { schoolId: string; schoolName: string; denied: () => void }) {
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get("date") ?? today());
  const [queue, setQueue] = useState<Queue>(); const [items, setItems] = useState<Items>(); const [error, setError] = useState(""); const school = useRef(schoolId); const request = useRef(0);
  school.current = schoolId;
  const load = async (nextDate = date) => {
    const current = ++request.current;
    const isCurrent = () => school.current === schoolId && current === request.current;
    setQueue(undefined); setItems(undefined); setError("");
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/operational-queue?date=${encodeURIComponent(nextDate)}`, { credentials: "include" });
      if (!isCurrent()) return false;
      if ([401, 403, 404].includes(response.status)) { denied(); return false; }
      if (!response.ok) throw new Error("Không thể tải hàng đợi vận hành.");
      const payload = (await response.json()) as { data: Queue };
      if (!isCurrent()) return false;
      setQueue(payload.data);
      return true;
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Không thể tải hàng đợi vận hành."); return false; }
  };
  const open = async (classId: string, status: "NOT_RECORDED" | "PENDING", attendanceOn = date) => {
    const current = ++request.current;
    const isCurrent = () => school.current === schoolId && current === request.current;
    const params = new URLSearchParams({ date: attendanceOn, classId, status }); window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    setItems(undefined); setError("");
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/operational-queue/items?${params}`, { credentials: "include" });
      if (!isCurrent()) return;
      if (deniedStatus(response.status)) return denied();
      const payload = (await response.json()) as { data?: Items; error?: { code?: string; message?: string } };
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(payload.error?.code === "CLASS_NOT_FOUND" ? "Lớp đã chọn không còn trong phạm vi được cấp quyền." : "Không thể tải danh sách vận hành.");
      setItems(payload.data!);
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách vận hành."); }
  };
  useEffect(() => { const params = new URLSearchParams(window.location.search); const nextDate = params.get("date") ?? today(); setDate(nextDate); void load(nextDate).then(async (loaded) => { const classId = params.get("classId"); const status = params.get("status"); if (loaded && classId && (status === "NOT_RECORDED" || status === "PENDING")) await open(classId, status, nextDate); }); return () => { request.current += 1; }; }, [schoolId]);
  return <section aria-labelledby="operational-queue-title"><h2 id="operational-queue-title">Tổng quan vận hành</h2><p>{schoolName} / Hàng đợi buổi sáng</p><label>Ngày <input type="date" value={date} onChange={(event) => { const next = event.target.value; setDate(next); window.history.replaceState(null, "", `${window.location.pathname}?date=${encodeURIComponent(next)}`); void load(next); }} /></label>{error && <p role="alert">{error}</p>}{!queue && !error && <p aria-live="polite">Đang tải hàng đợi vận hành...</p>}{queue && <><p>{queue.attendanceOn} / {queue.explanation}</p>{!queue.operating ? <p>Ngày đã chọn không vận hành.</p> : <div className="table-scroll"><table><caption>Việc cần xử lý theo lớp</caption><thead><tr><th>Lớp</th><th>Thiếu điểm danh</th><th>Đơn nghỉ chờ duyệt</th></tr></thead><tbody>{queue.classes.length ? queue.classes.map((row) => <tr key={row.classId}><td>{row.className}</td><td><button type="button" onClick={() => void open(row.classId, "NOT_RECORDED")}>{row.attendanceGapCount} học sinh</button></td><td><button type="button" onClick={() => void open(row.classId, "PENDING")}>{row.pendingLeaveCount} đơn</button></td></tr>) : <tr><td colSpan={3}>Không có lớp trong phạm vi được cấp quyền.</td></tr>}</tbody></table></div>}{items && <div className="table-scroll"><table><caption>{items.className} / {items.status === "NOT_RECORDED" ? "Thiếu điểm danh" : "Đơn nghỉ chờ duyệt"}</caption><thead><tr><th>Học sinh</th><th>Mã học sinh</th></tr></thead><tbody>{items.students.length ? items.students.map((student) => <tr key={student.studentId}><td>{student.studentName}</td><td>{student.studentCode}</td></tr>) : <tr><td colSpan={2}>Không có học sinh phù hợp.</td></tr>}</tbody></table></div>}</>}</section>;
}
