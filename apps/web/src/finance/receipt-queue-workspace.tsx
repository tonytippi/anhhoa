import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";
import type { FinanceStatus } from "./finance-workspace";

// Decision 2026-10-01: a negative Invoice is a refund the School pays back; it is closed by one exact payout.
type Direction = "COLLECT" | "REFUND";
type Row = {
  id: string;
  channel?: "SCHOOL" | "PERSONAL";
  student: { code: string; name: string };
  class: { id: string; name: string };
  schoolYearId: string;
  billingMonth: string;
  issuedAt: string;
  outstanding: string;
  direction?: Direction;
  status: "ISSUED";
};
type Queue = {
  invoices: Row[];
  filters: {
    schoolYearId: string | null;
    billingMonth: string;
    classIdSnapshot: string | null;
    student: string | null;
    direction?: Direction | null;
  };
  meta: { nextCursor: string | null };
};
type Detail = {
  id: string;
  channel?: "SCHOOL" | "PERSONAL";
  student: { code: string; name: string };
  outstanding: string;
  direction?: Direction;
  status: "ISSUED";
};
type Closed = {
  id: string;
  student: { code: string; name: string };
  payout?: { amount: string; paidOn: string; method: "BANK_TRANSFER" | "CASH"; reference: string } | null;
  receipt: {
    actualAmount: string;
    outcome: "EXACT" | "SHORTFALL" | "OVERPAYMENT";
    difference: { signedAmount: string } | null;
  } | null;
  carries: Array<{ type: "SHORTFALL_CARRY" | "OVERPAYMENT_CARRY"; amount: string }>;
  coverageFacts?: Array<{ billingMonth: string; issuedAt: string | null }>;
};
type Year = { id: string; name: string };
type Operation = { status: string; outcome?: Closed };
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const pendingKey = "passionedu.app.pending-receipt-queue-operation";
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith("app_csrf="))
    ?.slice("app_csrf=".length) ?? "";
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
const isRefund = (row: { outstanding: string; direction?: Direction }) =>
  row.direction === "REFUND" || BigInt(row.outstanding) < 0n;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
// Each payment channel is settled on its own: one row per channel Invoice, money received into that account.
const accountLabel = (channel: Row["channel"]) => (channel === "SCHOOL" ? "Tài khoản trường" : "Tài khoản cá nhân");
const outcome = (value: NonNullable<Closed["receipt"]>["outcome"]) =>
  value === "EXACT" ? "Đủ" : value === "SHORTFALL" ? "Thu thiếu" : "Thu thừa";
const monthLabel = (value: string) => (value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : "");
const errorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: { message?: string; fieldErrors?: Record<string, string> } };
    return body.error?.message ?? Object.values(body.error?.fieldErrors ?? {})[0] ?? "Không thể ghi thực nhận.";
  } catch {
    return "Không thể ghi thực nhận.";
  }
};

export function ReceiptQueueWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: FinanceStatus) => void;
}) {
  const [queue, setQueue] = useState<Queue>();
  const [filters, setFilters] = useState({
    schoolYearId: "",
    billingMonth: "",
    classIdSnapshot: "",
    student: "",
    direction: "",
  });
  const [payout, setPayout] = useState({ paidOn: today(), method: "BANK_TRANSFER", reference: "" });
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [detail, setDetail] = useState<Detail>();
  const [actual, setActual] = useState("");
  const [pending, setPending] = useState<string>();
  const [result, setResult] = useState<Closed>();
  const [next, setNext] = useState<Row>();
  const [message, setMessage] = useState("");
  const active = useRef(schoolId);
  const generation = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const query = (cursor?: string | null) => {
    const value = new URLSearchParams({ limit: "25" });
    for (const [key, item] of Object.entries(filters)) if (item) value.set(key, item);
    if (cursor) value.set("cursor", cursor);
    return value;
  };
  const load = async (cursor?: string | null, replace = true, expected = generation.current) => {
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/receipt-queue?${query(cursor)}`, {
      credentials: "include",
    });
    if ([401, 403].includes(response.status)) {
      denied();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải hàng đợi thu tiền.");
    const value = ((await response.json()) as { data: Queue }).data;
    if (active.current !== schoolId || expected !== generation.current) return;
    setQueue((current) =>
      replace ? value : { ...value, invoices: [...(current?.invoices ?? []), ...value.invoices] },
    );
    setFilters((current) => ({
      ...current,
      schoolYearId: value.filters.schoolYearId ?? "",
      billingMonth: value.filters.billingMonth,
      classIdSnapshot: value.filters.classIdSnapshot ?? "",
      student: value.filters.student ?? "",
      direction: value.filters.direction ?? "",
    }));
    return value;
  };
  const loadClasses = async (expected = generation.current) => {
    const value = new URLSearchParams();
    if (filters.schoolYearId) value.set("schoolYearId", filters.schoolYearId);
    if (filters.billingMonth) value.set("billingMonth", filters.billingMonth);
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/receipt-queue/classes?${value}`, {
      credentials: "include",
    });
    if ([401, 403].includes(response.status)) {
      denied();
      return;
    }
    if (response.ok && active.current === schoolId && expected === generation.current)
      setClasses(((await response.json()) as { data: { classes: Array<{ id: string; name: string }> } }).data.classes);
  };
  const clearProtected = () => {
    generation.current += 1;
    setDetail(undefined);
    setResult(undefined);
    setNext(undefined);
  };
  const finished = async (closed: Closed, expected: number) => {
    if (expected !== generation.current) return;
    setDetail(undefined);
    setResult(closed);
    try {
      const refreshed = await load(undefined, true, expected);
      if (expected === generation.current) setNext(refreshed?.invoices.find((row) => row.id !== closed.id));
    } catch {
      if (expected === generation.current) {
        setNext(undefined);
        setMessage("Đã ghi thực nhận; chưa thể tải lại hàng đợi mới nhất.");
      }
    }
  };
  const reconcile = async (operationId: string, expected = generation.current) => {
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/operations/${operationId}`, {
        credentials: "include",
      });
      if ([401, 403].includes(response.status)) {
        sessionStorage.removeItem(pendingKey);
        setPending(undefined);
        denied();
        return;
      }
      if (!response.ok) throw new Error();
      const operation = ((await response.json()) as { data: Operation }).data;
      if (expected !== generation.current || active.current !== schoolId) return;
      if (operation.status === "PENDING") {
        window.setTimeout(() => void reconcile(operationId, expected), 750);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      if (operation.status === "COMPLETED" && operation.outcome) await finished(operation.outcome, expected);
      else setMessage("Thao tác không thành công.");
    } catch {
      if (expected === generation.current) {
        setPending(operationId);
        sessionStorage.setItem(pendingKey, JSON.stringify({ schoolId, id: operationId }));
        setMessage("Đang kiểm tra kết quả với hệ thống");
        window.setTimeout(() => void reconcile(operationId, expected), 750);
      }
    }
  };
  useEffect(() => {
    active.current = schoolId;
    clearProtected();
    setQueue(undefined);
    setClasses([]);
    setYears([]);
    setMessage("");
    const expected = generation.current;
    void Promise.all([
      load(undefined, true, expected),
      fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/receivables`, { credentials: "include" }).then(
        async (response) => {
          if (!response.ok) throw new Error("Không thể tải năm học.");
          return ((await response.json()) as { data: { schoolYears?: Year[] } }).data.schoolYears ?? [];
        },
      ),
    ])
      .then(([, schoolYears]) => {
        if (active.current === schoolId && expected === generation.current) {
          setYears(schoolYears);
          void loadClasses(expected);
        }
      })
      .catch((error: Error) => setMessage(error.message));
    const saved = sessionStorage.getItem(pendingKey);
    if (saved)
      try {
        const value = JSON.parse(saved);
        if (value.schoolId === schoolId && typeof value.id === "string") {
          setPending(value.id);
          void reconcile(value.id, expected);
        }
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
  }, [schoolId]);
  useEffect(() => {
    onStatusChange?.({
      dirty: Boolean(detail),
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [detail, pending]);
  useEffect(() => {
    if (detail) dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    else if (trigger.current?.isConnected) trigger.current.focus();
  }, [detail]);
  const applyFilters = () => {
    clearProtected();
    const expected = generation.current;
    void Promise.all([load(undefined, true, expected), loadClasses(expected)]).catch(
      (error: Error) => expected === generation.current && setMessage(error.message),
    );
  };
  const open = async (row: Row) => {
    clearProtected();
    const expected = generation.current;
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/receipt-queue/${row.id}`, {
      credentials: "include",
    });
    if ([401, 403, 404].includes(response.status)) {
      if (expected === generation.current && response.status !== 404) denied();
      else void load(undefined, true, expected).catch(() => {});
      return;
    }
    if (!response.ok) {
      setMessage("Không thể mở hóa đơn đã chọn.");
      return;
    }
    const value = ((await response.json()) as { data: Detail }).data;
    if (expected !== generation.current || value.status !== "ISSUED") return;
    setDetail(value);
    setActual(value.outstanding);
    setPayout({ paidOn: today(), method: "BANK_TRANSFER", reference: "" });
  };
  const close = async () => {
    if (!detail || pending) return;
    const id = crypto.randomUUID(),
      expected = generation.current;
    setPending(id);
    sessionStorage.setItem(pendingKey, JSON.stringify({ schoolId, id }));
    try {
      const refund = isRefund(detail);
      const response = await fetch(
        `${apiUrl}/api/app/schools/${schoolId}/finance/invoices/${detail.id}/${refund ? "payout" : "receipt"}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": decodeURIComponent(csrf()),
            "idempotency-key": crypto.randomUUID(),
            "x-operation-id": id,
          },
          body: JSON.stringify(refund ? payout : { actualAmount: actual }),
        },
      );
      if ([401, 403].includes(response.status)) {
        sessionStorage.removeItem(pendingKey);
        setPending(undefined);
        denied();
        return;
      }
      if ([408, 502, 503, 504].includes(response.status)) {
        void reconcile(id, expected);
        return;
      }
      if (!response.ok) {
        sessionStorage.removeItem(pendingKey);
        setPending(undefined);
        setMessage(await errorMessage(response));
        return;
      }
      const operation = ((await response.json()) as { data: Operation }).data;
      if (operation.status === "PENDING") {
        void reconcile(id, expected);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      if (operation.status === "COMPLETED" && operation.outcome) await finished(operation.outcome, expected);
      else setMessage("Thao tác không thành công.");
    } catch {
      void reconcile(id, expected);
    }
  };
  const trap = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      setDetail(undefined);
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("input, button")].filter(
      (item) => !item.hasAttribute("disabled"),
    );
    const first = items[0],
      last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <section aria-labelledby="receipt-queue-title">
      <h2 id="receipt-queue-title">Thu tiền</h2>
      <p>{schoolName}</p>
      {message && <p role="alert">{message}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label>
          Năm học
          <select
            value={filters.schoolYearId}
            onChange={(event) => setFilters({ ...filters, schoolYearId: event.target.value })}
          >
            <option value="">Tất cả năm học</option>
            {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
        </label>
        <label>
          Tháng thu
          <input
            type="month"
            value={filters.billingMonth}
            onChange={(event) => setFilters({ ...filters, billingMonth: event.target.value })}
          />
        </label>
        <label>
          Lớp
          <select
            value={filters.classIdSnapshot}
            onChange={(event) => setFilters({ ...filters, classIdSnapshot: event.target.value })}
          >
            <option value="">Tất cả lớp</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mã hoặc tên học sinh
          <input
            value={filters.student}
            onChange={(event) => setFilters({ ...filters, student: event.target.value })}
          />
        </label>
        <label>
          Loại
          <select
            value={filters.direction}
            onChange={(event) => setFilters({ ...filters, direction: event.target.value })}
          >
            <option value="">Tất cả</option>
            <option value="COLLECT">Cần thu</option>
            <option value="REFUND">Cần chi hoàn</option>
          </select>
        </label>
        <button>Lọc</button>
      </form>
      <table>
        <caption>Hóa đơn chờ thu và phiếu hoàn tiền chờ chi</caption>
        <thead>
          <tr>
            <th>Học sinh</th>
            <th>Lớp</th>
            <th>Tháng</th>
            <th>Tài khoản nhận</th>
            <th>Còn phải thu</th>
            <th>Trạng thái</th>
            <th>Tùy chọn</th>
          </tr>
        </thead>
        <tbody>
          {queue?.invoices.length ? (
            queue.invoices.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.student.code} / {row.student.name}
                </td>
                <td>{row.class.name}</td>
                <td>{monthLabel(row.billingMonth)}</td>
                <td>{accountLabel(row.channel)}</td>
                <td>
                  {isRefund(row) ? `Hoàn ${vnd((-BigInt(row.outstanding)).toString())}` : vnd(row.outstanding)} đ
                </td>
                <td>{isRefund(row) ? "Chờ chi hoàn" : "Chờ thu"}</td>
                <td>
                  <AnchoredActionMenu
                    label={`Tùy chọn cho ${row.student.name}`}
                    disabled={Boolean(pending)}
                    onTriggerOpen={(element) => {
                      trigger.current = element;
                    }}
                  >
                    <AnchoredActionMenuItem onClick={() => void open(row)}>
                      {isRefund(row) ? "Ghi nhận đã chi" : "Ghi thực nhận"}
                    </AnchoredActionMenuItem>
                  </AnchoredActionMenu>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>Không có hóa đơn chờ thu.</td>
            </tr>
          )}
        </tbody>
      </table>
      {detail && isRefund(detail) && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="receipt-title" onKeyDown={trap}>
          <h3 id="receipt-title">
            Ghi nhận đã chi cho {detail.student.name}
            {detail.channel ? ` · ${accountLabel(detail.channel)}` : ""}
          </h3>
          <p>
            Số tiền phải chi do hệ thống xác nhận: {vnd((-BigInt(detail.outstanding)).toString())} đ. Chi đúng số tiền
            này một lần; hóa đơn đóng sau khi hệ thống xác nhận.
          </p>
          <label>
            Ngày chi
            <input
              type="date"
              value={payout.paidOn}
              onChange={(event) => setPayout({ ...payout, paidOn: event.target.value })}
            />
          </label>
          <label>
            Hình thức
            <select value={payout.method} onChange={(event) => setPayout({ ...payout, method: event.target.value })}>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH">Tiền mặt</option>
            </select>
          </label>
          <label>
            Mã giao dịch hoặc ghi chú
            <input
              value={payout.reference}
              onChange={(event) => setPayout({ ...payout, reference: event.target.value })}
            />
          </label>
          <button
            type="button"
            disabled={Boolean(pending) || !payout.paidOn || !payout.reference.trim()}
            onClick={() => void close()}
          >
            Xác nhận đã chi
          </button>
          <button type="button" disabled={Boolean(pending)} onClick={() => setDetail(undefined)}>
            Hủy
          </button>
        </div>
      )}
      {detail && !isRefund(detail) && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="receipt-title" onKeyDown={trap}>
          <h3 id="receipt-title">
            Ghi thực nhận cho {detail.student.name}
            {detail.channel ? ` · ${accountLabel(detail.channel)}` : ""}
          </h3>
          <p>
            Nghĩa vụ do máy chủ xác nhận: {vnd(detail.outstanding)} đ. Kết quả, chênh lệch, chuyển kỳ và ưu đãi nộp trước do
            máy chủ xác định.
          </p>
          <label>
            Số thực nhận (đ)
            <input inputMode="numeric" value={actual} onChange={(event) => setActual(event.target.value)} />
          </label>
          <button type="button" disabled={Boolean(pending) || !actual} onClick={() => void close()}>
            Xác nhận ghi thực nhận
          </button>
          <button type="button" disabled={Boolean(pending)} onClick={() => setDetail(undefined)}>
            Hủy
          </button>
        </div>
      )}
      {result && result.payout && (
        <section aria-labelledby="receipt-result-title">
          <h3 id="receipt-result-title">Đã ghi nhận chi hoàn</h3>
          <p>
            Đã chi {vnd(result.payout.amount)} đ ngày {result.payout.paidOn.split("-").reverse().join("/")} ·{" "}
            {result.payout.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"} · {result.payout.reference}.
          </p>
          {next && (
            <button type="button" onClick={() => void open(next)}>
              Hóa đơn tiếp theo
            </button>
          )}
        </section>
      )}
      {result && result.receipt && (
        <section aria-labelledby="receipt-result-title">
          <h3 id="receipt-result-title">Kết quả ghi thực nhận</h3>
          <p>Thực nhận: {vnd(result.receipt.actualAmount)} đ.</p>
          <p>Kết quả máy chủ: {outcome(result.receipt.outcome)}.</p>
          <p>Chênh lệch: {vnd(result.receipt.difference?.signedAmount ?? "0")} đ.</p>
          <p>
            {(result.carries ?? []).length
              ? (result.carries ?? [])
                  .map(
                    (carry) =>
                      `${carry.type === "SHORTFALL_CARRY" ? "Khoản thu thiếu chuyển kỳ" : "Khoản thu thừa khấu trừ kỳ sau"}: ${vnd(carry.amount)} đ.`,
                  )
                  .join(" ")
              : "Trạng thái chuyển kỳ: Máy chủ chưa tạo khoản chuyển kỳ cho hóa đơn này."}
          </p>
          <p>
            {(result.coverageFacts ?? []).length
              ? (result.coverageFacts ?? [])
                  .map((fact) =>
                    fact.issuedAt
                      ? `Ưu đãi nộp trước kỳ ${monthLabel(fact.billingMonth)} đã phát hành.`
                      : `Ưu đãi nộp trước kỳ ${monthLabel(fact.billingMonth)} chưa phát hành.`,
                  )
                  .join(" ")
              : "Ưu đãi nộp trước: Không có ưu đãi áp dụng."}
          </p>
          {next && (
            <button type="button" onClick={() => void open(next)}>
              Hóa đơn tiếp theo
            </button>
          )}
        </section>
      )}
    </section>
  );
}
