import { useEffect, useRef, useState } from "react";

type Facts = { students: number; staff: number; present: number; approvedLeave: number; pickedUp: number; unresolved: { label: string; count: number }; notRecorded: number };
type ClassFacts = Omit<Facts, "staff">;
type Overview = { date: string; isToday: boolean; metrics: Facts; classes: Array<{ classId: string; className: string } & ClassFacts> };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const deniedStatus = (status: number) => [401, 403, 404].includes(status);
const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
const validFacts = (value: unknown): value is Facts => {
  if (!value || typeof value !== "object") return false;
  const facts = value as Facts;
  return [facts.students, facts.staff, facts.present, facts.approvedLeave, facts.pickedUp, facts.notRecorded, facts.unresolved?.count].every((item) => Number.isInteger(item) && item >= 0) && typeof facts.unresolved?.label === "string";
};
const validClassFacts = (value: unknown): value is ClassFacts => {
  if (!value || typeof value !== "object") return false;
  const facts = value as ClassFacts;
  return [facts.students, facts.present, facts.approvedLeave, facts.pickedUp, facts.notRecorded, facts.unresolved?.count].every((item) => Number.isInteger(item) && item >= 0) && typeof facts.unresolved?.label === "string";
};
const validOverview = (value: unknown): value is Overview => Boolean(value && typeof value === "object" && validDate((value as Overview).date) && typeof (value as Overview).isToday === "boolean" && validFacts((value as Overview).metrics) && Array.isArray((value as Overview).classes) && (value as Overview).classes.every((item) => typeof item?.classId === "string" && typeof item.className === "string" && validClassFacts(item)));
const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`));

export function OverviewWorkspace({ schoolId, schoolName, selectedDate, setSelectedDate, denied }: { schoolId: string; schoolName: string; selectedDate?: string; setSelectedDate: (date?: string) => void; denied: () => void }) {
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState("");
  const [dateInput, setDateInput] = useState(selectedDate ?? "");
  const generation = useRef(0);
  const load = async () => {
    const current = ++generation.current;
    const controller = new AbortController();
    setOverview(undefined); setError("");
    const query = validDate(selectedDate) ? `?date=${selectedDate}` : "";
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/overview${query}`, { credentials: "include", signal: controller.signal });
      if (current !== generation.current) return;
      if (deniedStatus(response.status)) return denied();
      if (!response.ok) throw new Error("Không thể tải tổng quan vận hành.");
      const payload = (await response.json()) as { data?: unknown };
       if (!validOverview(payload.data)) throw new Error("Dữ liệu tổng quan không hợp lệ.");
       setOverview(payload.data);
       if (!selectedDate) setDateInput(payload.data.date);
    } catch (cause) {
      if (current === generation.current && !(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Không thể tải tổng quan vận hành.");
    }
    return () => controller.abort();
  };
  useEffect(() => { setDateInput(selectedDate ?? ""); void load(); return () => { generation.current += 1; }; }, [schoolId, selectedDate]);
  const dateControl = <label className="overview-date">Ngày xem<input aria-label="Ngày xem tổng quan" type="date" value={dateInput} onChange={(event) => { const next = event.target.value; setDateInput(next); if (!next || validDate(next)) setSelectedDate(next || undefined); }} /></label>;
  if (error) return <section className="overview-workspace" aria-labelledby="overview-title"><header className="overview-heading"><div><p>{schoolName}</p><h2 id="overview-title">Tổng quan vận hành</h2></div>{dateControl}</header><div className="overview-state" role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Thử lại</button></div></section>;
  if (!overview) return <section className="overview-workspace" aria-labelledby="overview-title"><header className="overview-heading"><div><p>{schoolName}</p><h2 id="overview-title">Tổng quan vận hành</h2></div>{dateControl}</header><div className="overview-state overview-loading" aria-live="polite">Đang tải tình hình vận hành...</div></section>;
  const labels = overview.isToday ? [overview.metrics.unresolved.label] : [overview.metrics.unresolved.label, "Chưa ghi nhận"];
  return <section className="overview-workspace" aria-labelledby="overview-title"><header className="overview-heading"><div><p>{schoolName}</p><h2 id="overview-title">Tổng quan vận hành</h2></div>{dateControl}</header>{!overview.classes.length ? <div className="overview-state"><p>Chưa có số liệu vận hành cho ngày đã chọn.</p></div> : <><div className="overview-metrics" aria-label="Chỉ số vận hành">{[[overview.metrics.students, "Tổng học sinh"], [overview.metrics.staff, "Tổng nhân viên"], [overview.metrics.present, "Đã có mặt"], [overview.metrics.approvedLeave, "Nghỉ có đơn"], [overview.metrics.pickedUp, "Đã được đón"], ...labels.map((label) => [label === "Chưa ghi nhận" ? overview.metrics.notRecorded : overview.metrics.unresolved.count, label])] .map(([count, label]) => <article key={String(label)}><strong>{count}</strong><span>{label}</span></article>)}</div><div className="table-scroll overview-table"><table><caption>Tình hình theo lớp · {schoolName} · {formatDate(overview.date)}</caption><thead><tr><th>Lớp</th><th>Sĩ số</th><th>Đã có mặt</th><th>{overview.metrics.unresolved.label}</th>{!overview.isToday && <th>Chưa ghi nhận</th>}<th>Nghỉ có đơn</th><th>Đã được đón</th></tr></thead><tbody>{overview.classes.map((item) => <tr key={item.classId}><th scope="row">{item.className}</th><td>{item.students}</td><td>{item.present}</td><td><span className="overview-status">{item.unresolved.count} {item.unresolved.label}</span></td>{!overview.isToday && <td><span className="overview-status">{item.notRecorded} Chưa ghi nhận</span></td>}<td>{item.approvedLeave}</td><td>{item.pickedUp}</td></tr>)}</tbody></table></div></>}</section>;
}
