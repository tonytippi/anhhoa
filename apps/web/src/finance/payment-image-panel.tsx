import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Props = { apiUrl: string; schoolId: string; invoiceId: string; fallbackFileName: string; denied: () => void };
type State = { status: "idle" | "loading" | "ready" | "error"; url?: string; fileName?: string; downloaded?: boolean };

// The API renders the payment image from the issue snapshot; the browser only previews and saves the returned PNG.
// The image is requested on demand (view or download), not on every visit to the review page.
export function PaymentImagePanel({ apiUrl, schoolId, invoiceId, fallbackFileName, denied }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [viewing, setViewing] = useState(false);
  const request = useRef(0);
  const viewTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
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
  useEffect(() => { setState({ status: "idle" }); setViewing(false); return () => { request.current += 1; }; }, [schoolId, invoiceId]);
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
  const view = () => {
    setViewing(true);
    if (state.status !== "ready" && state.status !== "loading") void load();
  };
  const close = () => {
    setViewing(false);
    viewTrigger.current?.focus();
  };
  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    const first = focusable[0], last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const status = state.status === "loading" ? "Đang tạo ảnh từ máy chủ…" : state.status === "error" ? "Không tạo được ảnh. Thông tin chuyển khoản trên trang vẫn dùng được; thử lại." : state.downloaded ? `Đã tải ${state.fileName}.` : "";
  return (
    <div className="finance-payment-image">
      <button ref={viewTrigger} type="button" onClick={view}>Xem ảnh hóa đơn</button>
      <button className="primary-action" type="button" disabled={state.status === "loading"} onClick={() => void save()}>Tải ảnh hóa đơn</button>
      {!viewing && <p role="status">{status}</p>}
      {viewing && (
        <div className="dialog-backdrop">
          <div ref={dialog} className="dialog dialog-wide finance-image-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-image-title" onKeyDown={onDialogKeyDown}>
            <h3 id="payment-image-title">Ảnh hóa đơn</h3>
            <div className="finance-image-frame">
              {state.status === "ready" ? (
                <a href={state.url} target="_blank" rel="noopener" aria-label="Mở ảnh hóa đơn cỡ lớn"><img src={state.url} alt="Xem trước ảnh hóa đơn" /></a>
              ) : (
                <p>{state.status === "error" ? "Không tạo được ảnh. Thử lại." : "Đang tạo ảnh từ máy chủ…"}</p>
              )}
            </div>
            <p className="muted">Gửi ảnh này cho phụ huynh qua kênh liên lạc của trường. Ảnh do hệ thống tạo từ thông tin đã chốt khi phát hành.</p>
            <p role="status">{state.downloaded ? `Đã tải ${state.fileName}.` : ""}</p>
            <div className="dialog-actions">
              <button autoFocus type="button" onClick={close}>Đóng</button>
              {state.status === "error" && <button type="button" onClick={() => void load()}>Thử lại</button>}
              <button className="primary-action" type="button" disabled={state.status === "loading"} onClick={() => void save()}>Tải ảnh hóa đơn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
