import { useEffect, useRef, useState } from 'react';

export function ReportErrorToast({ errorMonth }: { errorMonth?: string }): React.JSX.Element | null {
  const [shown, setShown] = useState(false); const previousMonth = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!errorMonth) { previousMonth.current = undefined; return; }
    if (errorMonth === previousMonth.current) return;
    previousMonth.current = errorMonth;
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), 4_000);
    return () => window.clearTimeout(timer);
  }, [errorMonth]);
  return shown ? <div className="report-toast" role="status">Không thể tải tháng mới. Đang hiển thị dữ liệu trước đó.</div> : null;
}
