import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../../app/api/client';
import { useInvoice } from './api';

function formatVnd(amount: number): string { return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`; }
function statusLabel(status: string): string { return status === 'DRAFT' ? 'Nháp' : status === 'PENDING' ? 'Chờ xác nhận' : 'Đã hoàn tất'; }

export function InvoiceDetailPage(): React.JSX.Element {
  const id = useLocation().pathname.split('/')[2] ?? ''; const invoice = useInvoice(id);
  if (invoice.isPending) return <section className="page"><h1>Hóa đơn</h1><div className="table-card skeleton" aria-live="polite">Đang tải hóa đơn...</div></section>;
  if (invoice.error instanceof ApiError && invoice.error.status === 404) return <section className="page"><h1>Không tìm thấy hóa đơn</h1><div className="table-card empty-state"><p>Hóa đơn này không tồn tại hoặc đã không còn khả dụng.</p><Link to="/hoa-don">Quay lại danh sách hóa đơn</Link></div></section>;
  if (invoice.error) return <section className="page"><h1>Hóa đơn</h1><div className="table-card error-state" role="alert"><p>Không thể tải hóa đơn.</p><button type="button" onClick={() => void invoice.refetch()}>Thử lại</button></div></section>;
  const item = invoice.data!;
  return <section className="page invoice-detail-page"><Link className="back-link" to={`/hoa-don?month=${item.billingMonth}`}>Quay lại danh sách</Link><h1>Hóa đơn {item.student.name}</h1><div className="invoice-summary"><dl><dt>Tháng</dt><dd>{item.billingMonth.slice(5)}/{item.billingMonth.slice(0, 4)}</dd><dt>Học sinh</dt><dd>{item.student.name}{item.student.nickname ? ` (${item.student.nickname})` : ''}</dd><dt>Lớp snapshot</dt><dd>{item.schoolClass.name}</dd><dt>Trạng thái</dt><dd><span className={`status invoice-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></dd><dt>Tổng cộng</dt><dd className="money">{formatVnd(item.total)}</dd></dl></div></section>;
}
