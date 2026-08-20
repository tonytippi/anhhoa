import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMonthlyReport } from './api';
import { currentMonth, formatMonth, formatVnd, monthPattern } from './format';
import { ReportErrorToast } from './report-error-toast';


export function ReportsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams(); const candidate = params.get('month'); const month = candidate && monthPattern.test(candidate) ? candidate : currentMonth(); const valid = Boolean(candidate && monthPattern.test(candidate)); const report = useMonthlyReport(month, valid); const [latestReport, setLatestReport] = useState<typeof report.data>(undefined); useEffect(() => { if (!report.data) return; const timer = window.setTimeout(() => setLatestReport(report.data), 0); return () => window.clearTimeout(timer); }, [report.data]); const visibleReport = report.data ?? latestReport;
  useEffect(() => { if (!valid) setParams({ month }, { replace: true }); }, [month, setParams, valid]);
  const changeMonth = (next: string) => setParams({ month: next });
  return <section className="page reports-page"><div className="page-heading"><div><h1>Báo cáo thu</h1><p>Đối soát số tiền đã thu từ hóa đơn hoàn tất.</p></div><label className="month-picker">Tháng báo cáo<input aria-label="Tháng báo cáo" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} /></label></div>
    {!valid || (report.isPending && !visibleReport) ? <div className="report-panel skeleton" aria-live="polite">Đang tải báo cáo...</div> : visibleReport ? <><ReportContent report={visibleReport} selectedMonth={month} />{report.error && <div className="report-error" role="alert">Không thể tải tháng {formatMonth(month)}. Đang hiển thị dữ liệu {formatMonth(visibleReport.billingMonth)}. <button type="button" onClick={() => void report.refetch()}>Thử lại</button></div>}<ReportErrorToast visible={Boolean(report.error)} /></> : <div className="report-panel error-state" role="alert"><p>Không thể tải báo cáo.</p><button type="button" onClick={() => void report.refetch()}>Thử lại</button></div>}
  </section>;
}

export function ReportContent({ report, selectedMonth }: { report: import('./api').MonthlyReport; selectedMonth: string }): React.JSX.Element {
  return <>{selectedMonth !== report.billingMonth && <p className="stale-report-context" role="status">Đang hiển thị dữ liệu {formatMonth(report.billingMonth)}.</p>}<div className="kpi-grid"><Kpi label="Tổng đã thu" amount={report.totalCollected} /><Kpi label="Tiền mặt" amount={report.cashCollected} /><Kpi label="Chuyển khoản" amount={report.transferCollected} /></div><section className="report-panel"><div className="section-heading"><h2>Chuyển khoản theo tài khoản nhận tiền</h2><Link to={`/hoa-don?month=${report.billingMonth}&status=COMPLETED`}>Xem hóa đơn hoàn tất</Link></div>{report.transferBreakdown.length ? <div className="breakdown-list">{report.transferBreakdown.map((account) => <article className="breakdown-card" key={`${account.bankCode}-${account.accountNumber}-${account.accountHolderName}`}><div><strong>{account.accountHolderName}</strong><span>{account.bankCode} · {account.accountNumber}</span></div><span className="money" aria-label={`${formatVnd(account.total)} Việt Nam đồng`}>{formatVnd(account.total)}</span></article>)}</div> : <p className="empty-copy">Chưa có khoản chuyển khoản hoàn tất trong {formatMonth(report.billingMonth)}.</p>}</section></>;
}
function Kpi({ label, amount }: { label: string; amount: number }): React.JSX.Element { return <article className="kpi-card"><span>{label}</span><strong className="money" aria-label={`${formatVnd(amount)} Việt Nam đồng`}>{formatVnd(amount)}</strong></article>; }
