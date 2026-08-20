import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { navigation } from '../../app/routes';
import { currentMonth, formatMonth, formatVnd, monthPattern } from '../reports/format';
import { useMonthlyReport } from '../reports/api';
import { ReportErrorToast } from '../reports/report-error-toast';

export function OverviewPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams(); const candidate = params.get('month'); const month = candidate && monthPattern.test(candidate) ? candidate : currentMonth(); const valid = Boolean(candidate && monthPattern.test(candidate)); const report = useMonthlyReport(month, valid); const [latestReport, setLatestReport] = useState<typeof report.data>(undefined); useEffect(() => { if (!report.data) return; const timer = window.setTimeout(() => setLatestReport(report.data), 0); return () => window.clearTimeout(timer); }, [report.data]); const visibleReport = report.data ?? latestReport;
  useEffect(() => { if (!valid) setParams({ month }, { replace: true }); }, [month, setParams, valid]);
  return <section className="page overview-page"><div className="page-heading"><div><h1>Tổng quan</h1><p>Theo dõi thu tiền và trạng thái hóa đơn theo tháng.</p></div><label className="month-picker">Tháng hóa đơn<input aria-label="Tháng tổng quan" type="month" value={month} onChange={(event) => setParams({ month: event.target.value })} /></label></div>
    {!valid || (report.isPending && !visibleReport) ? <div className="report-panel skeleton" aria-live="polite">Đang tải tổng quan...</div> : visibleReport ? <><>{month !== visibleReport.billingMonth && <p className="stale-report-context" role="status">Đang hiển thị dữ liệu {formatMonth(visibleReport.billingMonth)}.</p>}</><div className="kpi-grid"><article className="kpi-card"><span>Tổng đã thu</span><strong className="money" aria-label={`${formatVnd(visibleReport.totalCollected)} Việt Nam đồng`}>{formatVnd(visibleReport.totalCollected)}</strong></article><StatusLink month={visibleReport.billingMonth} status="DRAFT" label="Nháp" count={visibleReport.counts.draft} /><StatusLink month={visibleReport.billingMonth} status="PENDING" label="Chờ xác nhận" count={visibleReport.counts.pending} /><StatusLink month={visibleReport.billingMonth} status="COMPLETED" label="Đã hoàn tất" count={visibleReport.counts.completed} /></div><div className="overview-actions"><Link className="primary-action" to={`/hoa-don?month=${visibleReport.billingMonth}`}>Xem hóa đơn tháng này</Link><Link to={`/bao-cao?month=${visibleReport.billingMonth}`}>Xem báo cáo chi tiết</Link></div>{report.error && <div className="report-error" role="alert">Không thể tải tháng {formatMonth(month)}. Đang hiển thị dữ liệu {formatMonth(visibleReport.billingMonth)}. <button type="button" onClick={() => void report.refetch()}>Thử lại</button></div>}<ReportErrorToast errorMonth={report.error ? month : undefined} /></> : <><div className="report-panel error-state" role="alert"><p>Không thể tải tổng quan.</p><button type="button" onClick={() => void report.refetch()}>Thử lại</button></div><ReportErrorToast errorMonth={report.error ? month : undefined} /></>}
  </section>;
}
function StatusLink({ month, status, label, count }: { month: string; status: string; label: string; count: number }): React.JSX.Element { return <Link className="kpi-card status-kpi" to={`/hoa-don?month=${month}&status=${status}`}><span>{label}</span><strong>{count}</strong><small>hóa đơn</small></Link>; }

export function PlaceholderPage(): React.JSX.Element {
  const location = useLocation();
  const page = navigation.find((item) => item.to === location.pathname);
  if (!page) return <section className="page"><h1>Không tìm thấy trang</h1><div className="placeholder-card"><h2>Đường dẫn không hợp lệ</h2><p>Trang bạn yêu cầu không tồn tại trong Ánh Hoa Admin.</p></div></section>;
  return <section className="page"><h1>{page.label}</h1><div className="placeholder-card"><h2>Đang chuẩn bị</h2><p>Bề mặt {page.label.toLowerCase()} sẽ được hoàn thiện trong các bước tiếp theo.</p></div></section>;
}
