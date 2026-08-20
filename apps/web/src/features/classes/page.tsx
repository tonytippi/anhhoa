import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, ApiTimeoutError } from '../../app/api/client';
import { type ClassFilters, type SchoolClass, useArchiveClass, useClasses, useSaveClass } from './api';

function formatVnd(amount: number): string { return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`; }
function filtersFromUrl(params: URLSearchParams): ClassFilters { const page = Number(params.get('page')); const status = params.get('status'); return { search: params.get('search') ?? '', status: status === 'ACTIVE' || status === 'ARCHIVED' ? status : '', page: Number.isInteger(page) && page > 0 ? page : 1 }; }

export function ClassesPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromUrl(params);
  const classes = useClasses(filters);
  const [editing, setEditing] = useState<SchoolClass | null | undefined>(undefined);
  const [archiving, setArchiving] = useState<SchoolClass | null>(null);
  const formTrigger = useRef<HTMLElement | null>(null);
  const updateFilters = (next: Partial<ClassFilters>) => { const value = { ...filters, ...next, page: next.search !== undefined || next.status !== undefined ? 1 : (next.page ?? filters.page) }; const search = new URLSearchParams(); if (value.search) search.set('search', value.search); if (value.status) search.set('status', value.status); if (value.page > 1) search.set('page', String(value.page)); setParams(search); };
  const openCreate = (event: React.MouseEvent<HTMLButtonElement>) => { formTrigger.current = event.currentTarget; setEditing(null); };
  const openEdit = (event: React.MouseEvent<HTMLButtonElement>, item: SchoolClass) => { formTrigger.current = event.currentTarget; setEditing(item); };
  const closeForm = () => { setEditing(undefined); requestAnimationFrame(() => formTrigger.current?.focus()); };
  const hasFilters = Boolean(filters.search || filters.status);
  return <section className="page classes-page"><div className="page-heading"><div><h1>Lớp</h1><p>Quản lý học phí hiện hành và lưu trữ lớp đã ngừng sử dụng.</p></div><button className="primary-action" type="button" onClick={openCreate}>Thêm lớp</button></div>
    <div className="table-toolbar"><label>Tìm lớp<input value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Tìm theo tên lớp" /></label><label>Trạng thái<select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as ClassFilters['status'] })}><option value="">Tất cả</option><option value="ACTIVE">Đang dùng</option><option value="ARCHIVED">Đã lưu trữ</option></select></label></div>
    {classes.isPending ? <div className="table-card skeleton" aria-live="polite">Đang tải danh sách lớp...</div> : classes.error ? <div className="table-card error-state" role="alert"><p>Không thể tải danh sách lớp.</p><button type="button" onClick={() => void classes.refetch()}>Thử lại</button></div> : classes.data!.data.length === 0 ? classes.data!.meta.total > 0 ? <div className="table-card empty-state"><p>Trang này không còn lớp nào.</p><div className="pagination"><span>Trang {classes.data!.meta.page} / {classes.data!.meta.pageCount}</span><button type="button" onClick={() => updateFilters({ page: filters.page - 1 })}>Trước</button></div></div> : <div className="table-card empty-state">{hasFilters ? <p>Không tìm thấy lớp phù hợp.</p> : <><p>Chưa có lớp nào.</p><button className="primary-action" type="button" onClick={openCreate}>Thêm lớp</button></>}</div> : <><div className="table-card table-scroll"><table aria-label="Danh sách lớp"><caption className="sr-only">Danh sách các lớp</caption><thead><tr><th>Tên lớp</th><th>Học phí tháng</th><th>Học sinh đang học</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{classes.data!.data.map((item) => <tr key={item.id}><th scope="row"><Link to={`/lop/${item.id}`}>{item.name}</Link></th><td>{formatVnd(item.monthlyTuition)}</td><td>{item.activeStudentCount}</td><td><span className={`status ${item.status === 'ACTIVE' ? 'active' : 'archived'}`}>{item.status === 'ACTIVE' ? 'Đang dùng' : 'Đã lưu trữ'}</span></td><td className="row-actions">{item.status === 'ACTIVE' && <><button type="button" onClick={(event) => openEdit(event, item)}>Sửa</button><button type="button" onClick={() => setArchiving(item)}>Lưu trữ</button></>}</td></tr>)}</tbody></table></div><div className="pagination"><span>Trang {classes.data!.meta.page} / {classes.data!.meta.pageCount}</span><button type="button" disabled={filters.page <= 1} onClick={() => updateFilters({ page: filters.page - 1 })}>Trước</button><button type="button" disabled={filters.page >= classes.data!.meta.pageCount} onClick={() => updateFilters({ page: filters.page + 1 })}>Sau</button></div></>}
    {editing !== undefined && <ClassForm item={editing} onClose={closeForm} />}{archiving && <ArchiveDialog item={archiving} onClose={() => setArchiving(null)} />}</section>;
}

function ClassForm({ item, onClose }: { item: SchoolClass | null; onClose: () => void }): React.JSX.Element {
  const save = useSaveClass(); const [name, setName] = useState(item?.name ?? ''); const [tuition, setTuition] = useState(item ? String(item.monthlyTuition) : ''); const [errors, setErrors] = useState<{ name?: string; tuition?: string; form?: string }>({});
  const validateName = () => { const value = name.trim(); setName(value); const message = !value ? 'Tên lớp không được để trống.' : value.length > 100 ? 'Tên lớp không được dài quá 100 ký tự.' : undefined; setErrors((current) => ({ ...current, name: message })); return !message; };
  const tuitionAmount = () => { const digits = tuition.replaceAll(/[^0-9]/g, ''); const amount = Number(digits); return digits && Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined; };
  const validateTuition = () => { const message = tuitionAmount() === undefined ? 'Học phí phải là số nguyên VND không âm hợp lệ.' : undefined; setErrors((current) => ({ ...current, tuition: message })); return !message; };
  const submit = (event: React.FormEvent) => { event.preventDefault(); const validName = validateName(); const validTuition = validateTuition(); const amount = tuitionAmount(); if (!validName || !validTuition || amount === undefined) return; save.mutate({ id: item?.id, input: { name: name.trim(), monthlyTuition: amount } }, { onSuccess: onClose, onError: (cause) => setErrors(serverErrors(cause)) }); };
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog"><Dialog.Title>{item ? 'Sửa lớp' : 'Thêm lớp'}</Dialog.Title><form onSubmit={submit} noValidate><label>Tên lớp<input maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'class-name-error' : undefined} value={name} onChange={(event) => setName(event.target.value)} onBlur={validateName} disabled={save.isPending} autoFocus /></label>{errors.name && <p id="class-name-error" role="alert">{errors.name}</p>}<label>Học phí tháng (VND)<input inputMode="numeric" aria-invalid={Boolean(errors.tuition)} aria-describedby={errors.tuition ? 'class-tuition-error' : undefined} value={tuition} onChange={(event) => setTuition(event.target.value.replaceAll(/[^0-9]/g, ''))} onBlur={() => { if (validateTuition()) setTuition(formatVnd(tuitionAmount()!)); }} onFocus={() => setTuition(tuition.replaceAll(/[^0-9]/g, ''))} disabled={save.isPending} /></label>{errors.tuition && <p id="class-tuition-error" role="alert">{errors.tuition}</p>}{errors.form && <p role="alert">{errors.form}</p>}<div className="dialog-actions"><Dialog.Close render={<button type="button" disabled={save.isPending}>Hủy</button>} /><button className="primary-action" disabled={save.isPending} type="submit">{save.isPending ? 'Đang lưu...' : 'Lưu lớp'}</button></div></form></Dialog.Popup></Dialog.Portal></Dialog.Root>;
}

function serverErrors(cause: unknown): { name?: string; tuition?: string; form?: string } {
  if (cause instanceof ApiTimeoutError) return { form: cause.message };
  if (!(cause instanceof ApiError)) return { form: 'Không thể lưu lớp.' };
  const errors = cause.fieldErrors ?? [];
  const name = errors.find((error) => error.startsWith('name '));
  const tuition = errors.find((error) => error.startsWith('monthlyTuition '));
  if (name || tuition) return { ...(name ? { name } : {}), ...(tuition ? { tuition } : {}) };
  return { form: cause.message };
}

function ArchiveDialog({ item, onClose }: { item: SchoolClass; onClose: () => void }): React.JSX.Element {
  const archive = useArchiveClass(); const [error, setError] = useState(''); const trigger = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => () => trigger.current?.focus(), []);
  const submit = () => archive.mutate(item.id, { onSuccess: onClose, onError: (cause) => { const count = cause instanceof ApiError ? cause.metadata?.activeStudentCount : undefined; setError(count ? `Lớp còn ${count} học sinh đang học. Hãy chuyển lớp hoặc cho nghỉ học các em trước.` : cause instanceof ApiError ? cause.message : 'Không thể lưu trữ lớp.'); } });
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !archive.isPending) onClose(); }}><Dialog.Portal><Dialog.Backdrop className="dialog-backdrop" /><Dialog.Popup className="dialog"><Dialog.Title>Lưu trữ {item.name}?</Dialog.Title><p>Lớp vẫn được tra cứu nhưng không thể dùng cho học sinh hoặc hóa đơn mới.</p>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><Dialog.Close render={<button type="button" disabled={archive.isPending}>Hủy</button>} /><button className="danger-action" type="button" disabled={archive.isPending} onClick={submit}>{archive.isPending ? 'Đang lưu trữ...' : 'Xác nhận lưu trữ'}</button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
