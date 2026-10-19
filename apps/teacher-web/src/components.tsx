import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { hcmToday, protectedObjectUrl, shiftDay, shortDay } from './api';

export function DateControls({ day, onChange, maxDay }: { day: string; onChange: (day: string) => void; maxDay?: string }) {
  const today = hcmToday();
  const next = shiftDay(day, 1);
  return (
    <div className="date-controls" role="group" aria-label="Chọn ngày">
      <button className="button secondary" type="button" onClick={() => onChange(shiftDay(day, -1))}>‹ {shortDay(shiftDay(day, -1))}</button>
      <button className="button secondary" type="button" aria-pressed={day === today} onClick={() => onChange(today)}>{day === today ? `Hôm nay · ${shortDay(day)}` : `Về hôm nay · ${shortDay(today)}`}</button>
      <button className="button secondary" type="button" disabled={Boolean(maxDay && next > maxDay)} onClick={() => onChange(next)}>{shortDay(next)} ›</button>
    </div>
  );
}

// Media is session-protected, so it is fetched with credentials and shown from an object URL.
export function ProtectedImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let created: string | undefined;
    protectedObjectUrl(path, controller.signal).then((value) => { created = value; setUrl(value); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (created) URL.revokeObjectURL(created); };
  }, [path]);
  if (failed) return <span className="photo-tile photo-missing">Không tải được ảnh</span>;
  if (!url) return <span className="photo-tile photo-loading" aria-label="Đang tải ảnh" />;
  return <img className="photo-tile" src={url} alt={alt} />;
}

export function Dialog({ title, eyebrow, children, onClose, labelledBy }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; labelledBy: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);
  // Portal to <body>: the phone sidebar is transformed, which would otherwise trap a fixed dialog inside it.
  return createPortal(
    <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog handover-form" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ErrorNotice({ message, onRetry, retryLabel = 'Kiểm tra lại kết quả' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, [message]);
  if (!message) return null;
  return (
    <div className="notice warning teacher-alert" role="alert" tabIndex={-1} ref={ref}>
      <span>{message}</span>
      {onRetry && <button type="button" className="button secondary" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}
