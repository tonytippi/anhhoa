import { useEffect, useRef, useState } from 'react';

export function ReportErrorToast({ visible }: { visible: boolean }): React.JSX.Element | null {
  const [shown, setShown] = useState(false); const previous = useRef(false);
  useEffect(() => {
    if (visible && !previous.current) { setShown(true); const timer = window.setTimeout(() => setShown(false), 4_000); previous.current = true; return () => window.clearTimeout(timer); }
    if (!visible) previous.current = false;
  }, [visible]);
  return shown ? <div className="report-toast" role="status">Không thể tải tháng mới. Đang hiển thị dữ liệu trước đó.</div> : null;
}
