import { useEffect, useRef, useState } from "react";

type Props = { apiUrl: string; schoolId: string; invoiceId: string; fallbackFileName: string; denied: () => void };
type State = { status: "loading" | "ready" | "error"; url?: string; fileName?: string; downloaded?: boolean };

// The API renders the payment image from the issue snapshot; the browser only previews and saves the returned PNG.
export function PaymentImagePanel({ apiUrl, schoolId, invoiceId, fallbackFileName, denied }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const request = useRef(0);
  const load = async () => {
    const token = ++request.current;
    setState({ status: "loading" });
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/invoices/${invoiceId}/payment-image`, { credentials: "include" });
      if ([401, 403].includes(response.status)) { denied(); return undefined; }
      if (!response.ok) throw new Error();
      const fileName = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? fallbackFileName;
      const url = URL.createObjectURL(await response.blob());
      if (token !== request.current) { URL.revokeObjectURL(url); return undefined; }
      const next = { status: "ready" as const, url, fileName };
      setState(next);
      return next;
    } catch {
      if (token === request.current) setState({ status: "error" });
      return undefined;
    }
  };
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [schoolId, invoiceId]);
  useEffect(() => () => { if (state.url) URL.revokeObjectURL(state.url); }, [state.url]);
  const save = async () => {
    const ready = state.status === "ready" ? state : await load();
    if (!ready?.url) return;
    const link = document.createElement("a");
    link.href = ready.url;
    link.download = ready.fileName ?? fallbackFileName;
    link.click();
    setState({ ...ready, downloaded: true });
  };
  return (
    <div className="finance-payment-image">
      {state.status === "ready" && <a className="finance-payment-thumb" href={state.url} target="_blank" rel="noopener"><img src={state.url} alt="Xem trước ảnh hóa đơn" /></a>}
      <button className="primary-action" type="button" disabled={state.status === "loading"} onClick={() => void save()}>Tải ảnh hóa đơn</button>
      <p>Gửi ảnh này cho phụ huynh qua kênh liên lạc của trường. Ảnh do hệ thống tạo từ thông tin đã chốt khi phát hành.</p>
      <p role="status">{state.status === "loading" ? "Đang tạo ảnh từ máy chủ…" : state.status === "error" ? "Không tạo được ảnh. Thông tin chuyển khoản bên trên vẫn dùng được; thử tải lại." : state.downloaded ? `Đã tải ${state.fileName}.` : ""}</p>
    </div>
  );
}
