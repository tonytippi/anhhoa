import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { AgingBars, Bridge, ChartCard, ColumnChart, StackedBars, StatusBar } from "./finance-report-charts";

type Filters = { schoolYearId: string; billingMonth: string; runId: string; className: string; groupName: string; status: string };
type Charts = {
  byMonth: Array<{ billingMonth: string; netBilled: string; actualReceipt: string }>;
  byClass: Array<{ className: string; netBilled: string; actualReceipt: string; outstanding: string }>;
  runStatus: Array<{ collectionRunId: string; billingMonth: string | null; issued: number; exact: number; shortfall: number; overpayment: number; refunded: number; awaitingReceipt: number; awaitingPayout: number }>;
  aging: Array<{ key: string; amount: string }>;
  topDebtors: Array<{ studentId: string; studentCode: string; studentName: string; className: string; outstanding: string; invoices: number; maxOverdueDays: number }>;
  cashByWeek: Array<{ weekStart: string; cashIn: string; cashOut: string }>;
};
type Report = { workspace: string; asOf: string; generatedAt: string; timezone: string; reportDefinitionVersion: string; filters: Record<string, string | null>; summary: Record<string, string | { exact: string; shortfall: string; overpayment: string }>; charts?: Charts; rows: Array<{ id: string; postedAt?: string; type?: string; billingMonth: string | null; amount?: string; vatAmount?: string; vat?: string; netBilled?: string; actualReceipt?: string; carryAdjustment?: string; outstanding?: string; provenance?: { groupAllocation?: string } }> };
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === "undefined" ? "app_csrf" : __CSRF_COOKIE_NAME__;
const csrf = () => document.cookie.split("; ").find((item) => item.startsWith(`${csrfName}=`))?.slice(csrfName.length + 1);
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
const workspaces = [{ id: "overview", label: "Tổng quan" }, { id: "collection-runs", label: "Đối soát đợt thu" }, { id: "outstanding", label: "Công nợ" }, { id: "cash-adjustments", label: "Sổ tiền và điều chỉnh" }];
const hcmInstant = (value: string) => value ? `${value}:00+07:00` : "";
const emptyFilters: Filters = { schoolYearId: "", billingMonth: "", runId: "", className: "", groupName: "", status: "" };
const monthLabel = (month: string | null | undefined) => month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : "-";
const dateTime = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const percent = (part: string, whole: string) => BigInt(whole) > 0n ? Number((BigInt(part) * 100n) / BigInt(whole)) : 0;
const eventLabel: Record<string, string> = { INVOICE_ISSUED: "Phát hành hóa đơn", INVOICE_CANCELLED: "Hủy hóa đơn", RECEIPT_POSTED: "Phiếu thu", SETTLEMENT_DIFFERENCE_POSTED: "Chênh lệch thu", SETTLEMENT_CARRY_POSTED: "Chuyển sang kỳ sau", SETTLEMENT_TRANSFER_POSTED: "Chuyển phiếu thu sang bản thay thế", DEBT_TRANSFER_POSTED: "Chuyển nợ kỳ trước", COVERAGE_ISSUED: "Ghi nhận gói nộp trước", COVERAGE_REVERSAL_POSTED: "Hoàn học phí nộp trước", PAYOUT_POSTED: "Chi hoàn quyết toán" };
const agingLabel: Record<string, [string, string]> = { NOT_DUE: ["Chưa đến hạn", "#86b6ef"], "1_15": ["Quá hạn 1–15 ngày", "#3987e5"], "16_30": ["Quá hạn 16–30 ngày", "#1c5cab"], OVER_30: ["Quá hạn trên 30 ngày", "#0d366b"] };

function Kpi({ label, value, note, meter, lead }: { label: string; value: string; note?: ReactNode; meter?: number; lead?: boolean }) {
  return <div className={`finance-kpi${lead ? " finance-kpi-lead" : ""}`}><span>{label}</span><b>{value}</b>{meter !== undefined && <div className="finance-meter" role="img" aria-label={`${meter}%`}><i style={{ width: `${Math.min(Math.max(meter, 0), 100)}%` }} /></div>}{note && <small>{note}</small>}</div>;
}

export function FinanceReportsWorkspace({ schoolId, schoolName, denied }: { schoolId: string; schoolName: string; denied: () => void }) {
  const [workspace, setWorkspace] = useState("overview"); const [asOf, setAsOf] = useState(""); const [filters, setFilters] = useState<Filters>(emptyFilters); const [report, setReport] = useState<Report>(); const [message, setMessage] = useState(""); const [exporting, setExporting] = useState(false); const active = useRef(schoolId); const sequence = useRef(0); const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const queryString = () => { const query = new URLSearchParams(); const instant = hcmInstant(asOf); if (instant) query.set("asOf", instant); for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value); return query.toString(); };
  const load = async () => { const token = ++sequence.current; setMessage(""); setReport(undefined); const query = queryString(); const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/reports/${workspace}${query ? `?${query}` : ""}`, { credentials: "include" }); if (token !== sequence.current || active.current !== schoolId) return; if ([401, 403].includes(response.status)) { denied(); return; } if (!response.ok) throw new Error("Không thể tải báo cáo từ sổ cái."); const payload = await response.json() as { data: Report }; if (token === sequence.current && active.current === schoolId) setReport(payload.data); };
  useEffect(() => { active.current = schoolId; setExporting(false); setFilters(emptyFilters); void load().catch((error: Error) => setMessage(error.message)); return () => { ++sequence.current; }; }, [schoolId, workspace]);
  const exportCsv = async () => { if (!report || exporting) return; const token = ++sequence.current; const exportSchool = schoolId; const operationId = crypto.randomUUID(); const body = { asOf: report.asOf, schoolYearId: null, billingMonth: null, runId: null, className: null, groupName: null, status: null, ...(report.filters ?? {}) }; const download = (outcome: { exportId: string }) => { if (token === sequence.current && active.current === exportSchool) window.location.assign(`${apiUrl}/api/app/schools/${exportSchool}/finance/report-exports/${outcome.exportId}/download`); }; const reconcile = () => fetch(`${apiUrl}/api/app/schools/${exportSchool}/finance/operations/${operationId}`, { credentials: "include" }); setExporting(true); setMessage(""); try { let response: Response; try { response = await fetch(`${apiUrl}/api/app/schools/${exportSchool}/finance/reports/${report.workspace}/exports`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? ""), "idempotency-key": crypto.randomUUID(), "x-operation-id": operationId }, body: JSON.stringify(body) }); if ([408, 502, 503, 504].includes(response.status)) response = await reconcile(); } catch { response = await reconcile(); }
      if (token !== sequence.current || active.current !== exportSchool) return; if ([401, 403].includes(response.status)) { denied(); return; } if (!response.ok) { setMessage("Không thể tạo tệp CSV do máy chủ không còn cho phép xuất kết quả này."); return; } const { data } = await response.json() as { data: { status?: string; outcome?: { exportId: string }; exportId?: string } }; const outcome: { exportId: string } | null = data.outcome ?? (typeof data.exportId === "string" ? { exportId: data.exportId } : null); if (data.status && data.status !== "COMPLETED") { setMessage("Tệp CSV đang được xử lý. Hãy đối soát thao tác trước khi tải lại."); return; } if (!outcome) { setMessage("Không thể tạo tệp CSV do máy chủ không còn cho phép xuất kết quả này."); return; } download(outcome); } finally { if (token === sequence.current && active.current === exportSchool) setExporting(false); } };
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? workspaces.length - 1 : (index + (event.key === "ArrowRight" ? 1 : workspaces.length - 1)) % workspaces.length; setWorkspace(workspaces[next]!.id); tabs.current[next]?.focus(); };
  const money = (key: string) => { const value = report?.summary[key]; return typeof value === "string" ? value : "0"; };
  const nonZero = (key: string) => money(key) !== "0";
  const charts = report?.charts;
  // Every figure below is a server value; the browser only formats and draws it.
  const content = () => {
    if (!report) return null;
    if (report.workspace === "overview") return <>
      <div className="finance-report-kpis">
        <Kpi lead label="Phải thu ròng" value={`${vnd(money("netBilled"))} đ`} note="Sau ưu đãi, bớt, thuế GTGT và nợ chuyển kỳ" />
        <Kpi label="Đã thu" value={`${vnd(money("actualReceipt"))} đ`} meter={percent(money("actualReceipt"), money("netBilled"))} note={`${percent(money("actualReceipt"), money("netBilled"))}% số phải thu`} />
        <Kpi label="Còn phải thu" value={`${vnd(money("outstanding"))} đ`} note={charts ? `${charts.topDebtors.length} học sinh chưa thu đủ` : undefined} />
        <Kpi label="Đã chi hoàn" value={`${vnd(money("payout"))} đ`} note={nonZero("refundOwed") ? `Còn phải chi hoàn ${vnd(money("refundOwed"))} đ` : "Phiếu hoàn tiền đã chi"} />
      </div>
      <div className="finance-report-charts">
        <ChartCard title="Phải thu và đã thu theo tháng" description="Theo tháng thu của hóa đơn."><ColumnChart series={["Phải thu ròng", "Đã thu"]} rows={(charts?.byMonth ?? []).map((item) => ({ label: monthLabel(item.billingMonth), values: [BigInt(item.netBilled), BigInt(item.actualReceipt)] }))} /></ChartCard>
        <ChartCard title="Từ tổng phải thu đến phải thu ròng" description="Các khoản làm tăng hoặc giảm số phải thu.">
          <Bridge start={["Tổng phải thu", BigInt(money("gross"))]} end={["Phải thu ròng", BigInt(money("netBilled"))]} rows={[{ label: "Ưu đãi", amount: -BigInt(money("promotionDiscount")) }, { label: "Bớt (hoàn trả nghỉ)", amount: -BigInt(money("deduction")) }, { label: "Thuế GTGT", amount: BigInt(money("vat")) }, { label: "Nợ kỳ trước và chênh lệch", amount: BigInt(money("otherAdjustments")) }]} />
          {nonZero("refund") && <p className="finance-report-note">Hoàn tiền coverage: {vnd(money("refund"))} đ{nonZero("refundVat") ? ` · VAT đã hoàn ${vnd(money("refundVat"))} đ` : ""}</p>}
        </ChartCard>
        <ChartCard wide title="Tình hình thu theo lớp" description="Mỗi thanh là số phải thu của lớp; phần cam là số còn phải thu."><StackedBars series={["Đã thu", "Còn phải thu"]} rows={(charts?.byClass ?? []).map((item) => ({ label: item.className, values: [BigInt(item.actualReceipt) > 0n ? BigInt(item.actualReceipt) : 0n, BigInt(item.outstanding)], end: `${percent(item.actualReceipt, item.netBilled)}%` }))} /></ChartCard>
      </div>
      <div className="table-scroll"><table><caption>Chi tiết theo lớp</caption><thead><tr><th>Lớp</th><th className="finance-money">Phải thu ròng</th><th className="finance-money">Đã thu</th><th className="finance-money">Còn phải thu</th><th className="finance-money">Tỷ lệ thu</th></tr></thead><tbody>{charts?.byClass.length ? charts.byClass.map((item) => <tr key={item.className}><td>{item.className}</td><td className="finance-money">{vnd(item.netBilled)} đ</td><td className="finance-money">{vnd(item.actualReceipt)} đ</td><td className="finance-money">{vnd(item.outstanding)} đ</td><td className="finance-money">{percent(item.actualReceipt, item.netBilled)}%</td></tr>) : <tr><td colSpan={5}>Không có hoạt động sổ cái phù hợp tại thời điểm chốt.</td></tr>}</tbody></table></div>
    </>;
    if (report.workspace === "collection-runs") {
      const status = charts?.runStatus ?? []; const latest = [...status].sort((a, b) => String(a.billingMonth).localeCompare(String(b.billingMonth))).at(-1);
      const issuedCount = status.reduce((sum, item) => sum + item.issued, 0), exactCount = status.reduce((sum, item) => sum + item.exact, 0);
      return <>
        <div className="finance-report-kpis">
          <Kpi lead label="Hóa đơn đã phát hành" value={String(issuedCount)} note={`${status.length} đợt thu`} />
          <Kpi label="Đã thu đủ" value={String(exactCount)} meter={issuedCount ? Math.round((exactCount * 100) / issuedCount) : 0} note={`${issuedCount ? Math.round((exactCount * 100) / issuedCount) : 0}% số hóa đơn`} />
          <Kpi label="Chênh lệch chờ chuyển kỳ sau" value={`${vnd(money("openDifference"))} đ`} note="Thu thiếu hoặc thừa, chuyển sang hóa đơn cùng tài khoản kỳ sau" />
          <Kpi label="Đã chuyển sang kỳ sau" value={`${vnd(money("carryAdjustment"))} đ`} note={`${money("revisionCancellation")} hóa đơn thay thế`} />
        </div>
        <div className="finance-report-charts">
          <ChartCard title={`Trạng thái hóa đơn${latest ? ` · Đợt thu tháng ${monthLabel(latest.billingMonth)}` : ""}`} description="Đếm theo hóa đơn của từng tài khoản nhận.">{latest ? <StatusBar rows={[{ label: "Đã thu đủ", count: latest.exact, color: "#0ca30c", icon: "✓" }, { label: "Thu thiếu", count: latest.shortfall, color: "#fab219", icon: "!" }, { label: "Thu thừa", count: latest.overpayment, color: "#2a78d6", icon: "+" }, { label: "Chờ thu", count: latest.awaitingReceipt, color: "#c3c2b7", icon: "○" }, { label: "Chờ chi hoàn", count: latest.awaitingPayout, color: "#eb6834", icon: "↺" }, { label: "Đã chi hoàn", count: latest.refunded, color: "#86b6ef", icon: "✓" }]} /> : <p>Chưa có hóa đơn đã phát hành.</p>}</ChartCard>
          <ChartCard title="Tiến độ thu theo đợt" description="Phần cam là số còn phải thu của đợt."><StackedBars series={["Đã thu", "Còn phải thu"]} rows={report.rows.map((row) => ({ label: `Tháng ${monthLabel(row.billingMonth)}`, values: [BigInt(row.actualReceipt ?? "0"), BigInt(row.netBilled ?? "0") > BigInt(row.actualReceipt ?? "0") ? BigInt(row.netBilled ?? "0") - BigInt(row.actualReceipt ?? "0") : 0n], end: `${percent(row.actualReceipt ?? "0", row.netBilled ?? "0")}%` }))} /></ChartCard>
        </div>
        <div className="table-scroll"><table><caption>Đối soát theo đợt thu</caption><thead><tr><th>Đợt thu</th><th className="finance-money">Phải thu ròng</th><th className="finance-money">Đã thu</th><th className="finance-money">Chuyển sang kỳ sau</th></tr></thead><tbody>{report.rows.length ? report.rows.map((row) => <tr key={row.id}><td>Thu tháng {monthLabel(row.billingMonth)}</td><td className="finance-money">{vnd(row.netBilled ?? "0")} đ</td><td className="finance-money">{vnd(row.actualReceipt ?? "0")} đ</td><td className="finance-money">{vnd(row.carryAdjustment ?? "0")} đ</td></tr>) : <tr><td colSpan={4}>Không có hoạt động sổ cái phù hợp tại thời điểm chốt.</td></tr>}</tbody></table></div>
      </>;
    }
    if (report.workspace === "outstanding") return <>
      <div className="finance-report-kpis">
        <Kpi lead label="Công nợ hiện tại" value={`${vnd(money("outstanding"))} đ`} note={charts ? `${charts.topDebtors.length} học sinh` : undefined} />
        <Kpi label="Nợ kỳ trước" value={`${vnd(money("debtTransfer"))} đ`} note="Đã chuyển vào hóa đơn kỳ sau" />
        <Kpi label="Chênh lệch chờ kỳ sau" value={`${vnd(money("openDifference"))} đ`} />
        <Kpi label="Còn phải chi hoàn" value={`${vnd(money("refundOwed"))} đ`} note="Phiếu hoàn tiền đã phát hành, chưa chi" />
      </div>
      <div className="finance-report-charts"><ChartCard wide title="Công nợ theo thời gian quá hạn" description="Màu đậm hơn là nợ lâu hơn."><AgingBars rows={(charts?.aging ?? []).map((item) => ({ label: agingLabel[item.key]?.[0] ?? item.key, amount: BigInt(item.amount), color: agingLabel[item.key]?.[1] ?? "#3987e5" }))} /></ChartCard></div>
      <div className="table-scroll"><table><caption>Học sinh còn nợ nhiều nhất</caption><thead><tr><th>Học sinh</th><th>Lớp</th><th>Số hóa đơn còn nợ</th><th className="finance-money">Còn phải thu</th><th>Quá hạn</th></tr></thead><tbody>{charts?.topDebtors.length ? charts.topDebtors.map((item) => <tr key={item.studentId}><td>{item.studentCode} / {item.studentName}</td><td>{item.className}</td><td>{item.invoices}</td><td className="finance-money">{vnd(item.outstanding)} đ</td><td>{item.maxOverdueDays > 0 ? `${item.maxOverdueDays} ngày` : "Chưa đến hạn"}</td></tr>) : <tr><td colSpan={5}>Không có hoạt động sổ cái phù hợp tại thời điểm chốt.</td></tr>}</tbody></table></div>
    </>;
    return <>
      <div className="finance-report-kpis">
        <Kpi lead label="Tiền vào" value={`${vnd(money("actualReceipt"))} đ`} note="Phiếu thu đã ghi" />
        <Kpi label="Tiền ra" value={`${vnd(money("cashOut"))} đ`} note="Chi hoàn và hoàn học phí nộp trước" />
        <Kpi label="Tiền ròng" value={`${vnd(money("netCash"))} đ`} note="Tiền vào trừ tiền ra" />
        <Kpi label="Điều chỉnh chuyển kỳ" value={`${vnd(money("carryAdjustment"))} đ`} note="Không phải tiền mặt" />
      </div>
      <div className="finance-report-charts"><ChartCard wide title="Tiền vào và tiền ra theo tuần" description="Theo thời điểm ghi sổ, tuần bắt đầu thứ Hai."><ColumnChart labelLast={false} series={["Tiền vào", "Tiền ra"]} rows={(charts?.cashByWeek ?? []).map((item) => ({ label: `${item.weekStart.slice(8, 10)}/${item.weekStart.slice(5, 7)}`, values: [BigInt(item.cashIn), BigInt(item.cashOut)] }))} /></ChartCard></div>
      <div className="table-scroll"><table><caption>Sổ tiền và điều chỉnh theo thời điểm ghi</caption><thead><tr><th>Thời điểm ghi</th><th>Loại</th><th>Tháng thu</th><th className="finance-money">Số tiền</th>{report.rows.some((row) => (row.vatAmount ?? row.vat ?? "0") !== "0") && <th className="finance-money">Thuế GTGT (VND)</th>}</tr></thead><tbody>{report.rows.length ? report.rows.map((row) => <tr key={row.id}><td>{row.postedAt ? dateTime(row.postedAt) : "-"}</td><td>{eventLabel[row.type ?? ""] ?? row.type}{row.provenance?.groupAllocation === "UNALLOCATED_WHOLE_INVOICE_EVENT" ? " (chưa phân bổ theo nhóm)" : ""}</td><td>{monthLabel(row.billingMonth)}</td><td className="finance-money">{BigInt(row.amount ?? "0") > 0n ? "+" : ""}{vnd(row.amount ?? "0")}</td>{report.rows.some((item) => (item.vatAmount ?? item.vat ?? "0") !== "0") && <td className="finance-money">{(row.vatAmount ?? row.vat ?? "0") !== "0" ? vnd(row.vatAmount ?? row.vat ?? "0") : "-"}</td>}</tr>) : <tr><td colSpan={4}>Không có hoạt động sổ cái phù hợp tại thời điểm chốt.</td></tr>}</tbody></table></div>
    </>;
  };
  return <section className="finance-report" aria-labelledby="finance-reports-title">
    <h2 id="finance-reports-title">Báo cáo tài chính</h2><p>Số thu, số còn nợ và tiền vào ra của {schoolName} theo kỳ thu.</p>
    <div role="tablist" aria-label="Không gian báo cáo" className="finance-report-tabs">{workspaces.map((item, index) => <button key={item.id} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab" id={`finance-report-tab-${item.id}`} aria-controls={`finance-report-panel-${item.id}`} tabIndex={workspace === item.id ? 0 : -1} aria-selected={workspace === item.id} onKeyDown={(event) => moveTab(event, index)} onClick={() => setWorkspace(item.id)}>{item.label}</button>)}</div>
    <div role="tabpanel" id={`finance-report-panel-${workspace}`} aria-labelledby={`finance-report-tab-${workspace}`}>
      <form className="finance-report-filters" onSubmit={(event) => { event.preventDefault(); void load().catch((error: Error) => setMessage(error.message)); }}><label>Tháng thu<input placeholder="YYYY-MM" value={filters.billingMonth} onChange={(event) => setFilters({ ...filters, billingMonth: event.target.value })} /></label><label>Lớp<input value={filters.className} onChange={(event) => setFilters({ ...filters, className: event.target.value })} /></label><label>Nhóm khoản thu<input value={filters.groupName} onChange={(event) => setFilters({ ...filters, groupName: event.target.value })} /></label><label>Trạng thái<input value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} /></label><label>Thời điểm chốt (giờ Việt Nam)<input type="datetime-local" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label><button>Xem số liệu</button></form>
      {message && <p role="alert">{message}</p>}
      {!report && !message && <p aria-live="polite">Đang tải báo cáo...</p>}
      {report && <>
        <p className="finance-report-asof">Số liệu chốt <b>{dateTime(report.asOf)}</b>{report.filters?.billingMonth ? ` · Tháng thu ${monthLabel(report.filters.billingMonth)}` : ""}{report.filters?.className ? ` · Lớp ${report.filters.className}` : " · Tất cả lớp"}{report.filters?.groupName ? ` · Nhóm ${report.filters.groupName}` : ""}</p>
        {report.filters?.groupName && <p>Tiền thu, chuyển kỳ, nợ, gói nộp trước và hoàn tiền theo cả hóa đơn chưa được phân bổ vào nhóm.</p>}
        {content()}
        <div className="finance-report-export"><small>Tệp CSV chứa đúng các dòng và metadata của kết quả đã được cấp quyền (thời điểm chốt, múi giờ {report.timezone}, phiên bản {report.reportDefinitionVersion}).</small><button type="button" className="primary-action" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? "Đang tạo CSV..." : "Tải CSV"}</button></div>
      </>}
    </div>
  </section>;
}
