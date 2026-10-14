import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";
import type { FinanceStatus } from "./finance-workspace";
import { ReceivingAccountLabel, receivingAccountName, type ReceivingAccount } from "./receiving-account";
import { DateInput } from "../components/date-input";

// Decision 2026-10-01: a negative Invoice is a refund the School pays back; it is closed by one exact payout.
type Direction = "COLLECT" | "REFUND";
type Row = {
  id: string;
  channel?: "SCHOOL" | "PERSONAL";
  obligationCode?: string | null;
  account?: ReceivingAccount | null;
  student: { code: string; name: string };
  class: { id: string; name: string };
  schoolYearId: string;
  billingMonth: string;
  periodLabel?: string;
  issuedAt: string;
  outstanding: string;
  direction?: Direction;
  status: "ISSUED" | "CLOSED";
  // What closed the Invoice, on the settled view.
  settlement?:
    | { type: "RECEIPT"; amount: string; outcome: "EXACT" | "SHORTFALL" | "OVERPAYMENT"; on: string }
    | { type: "PAYOUT"; amount: string; method: "BANK_TRANSFER" | "CASH"; on: string }
    | null;
};
type Queue = {
  invoices: Row[];
  filters: {
    schoolYearId: string | null;
    billingMonth: string;
    classIdSnapshot: string | null;
    student: string | null;
    direction?: Direction | null;
    bankAccountId?: string | null;
    state?: "OPEN" | "SETTLED";
  };
  meta: { nextCursor: string | null };
};
type Detail = {
  id: string;
  channel?: "SCHOOL" | "PERSONAL";
  obligationCode?: string | null;
  account?: ReceivingAccount | null;
  student: { code: string; name: string };
  className?: string;
  periodLabel?: string;
  issuedTotal?: string;
  lines?: Array<{ id: string; receivableName: string; unitLabel: string; quantity: number; amount: string }>;
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
const accountTitle = (item: { channel?: Row["channel"]; account?: ReceivingAccount | null }) =>
  item.account ? receivingAccountName(item.account) : accountLabel(item.channel);
// "Hóa đơn OBL-… · tài khoản trường VCB - … · 0123456789."
const accountContext = (item: Detail) =>
  [
    item.obligationCode ? `Hóa đơn ${item.obligationCode}` : "",
    item.account
      ? `${accountLabel(item.channel).toLocaleLowerCase("vi")} ${receivingAccountName(item.account)} · ${item.account.accountNumber}`
      : accountLabel(item.channel).toLocaleLowerCase("vi"),
  ]
    .filter(Boolean)
    .join(" · ");
const outcome = (value: NonNullable<Closed["receipt"]>["outcome"]) =>
  value === "EXACT" ? "Đủ" : value === "SHORTFALL" ? "Thu thiếu" : "Thu thừa";
const displayDay = (value: string) => value.split("-").reverse().join("/");
const signed = (value: string) => (BigInt(value) > 0n ? `+${vnd(value)}` : vnd(value));
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
  classRuns = false,
}: {
  // Sprint change 2026-10-12: a School that bills by Class reads the run period ("Starters A · Unit 3") instead of the month.
  classRuns?: boolean;
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: FinanceStatus) => void;
}) {
  const [queue, setQueue] = useState<Queue>();
  // The result names the invoice's own period by the run label for a School that bills by Class; any other covered month stays a month.
  const opened = useRef<Row | undefined>(undefined);
  const periodName = (month: string) =>
    classRuns && opened.current?.periodLabel && opened.current.billingMonth === month ? opened.current.periodLabel : monthLabel(month);
  const [filters, setFilters] = useState({
    schoolYearId: "",
    billingMonth: "",
    classIdSnapshot: "",
    student: "",
    direction: "",
    bankAccountId: "",
    state: "",
  });
  const [payout, setPayout] = useState({ paidOn: today(), method: "BANK_TRANSFER", reference: "" });
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [accounts, setAccounts] = useState<ReceivingAccount[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [detail, setDetail] = useState<Detail>();
  const [actual, setActual] = useState("");
  const [pending, setPending] = useState<string>();
  const [result, setResult] = useState<Closed>();
  // The table follows the loaded queue, not the unapplied filter form.
  const settledView = queue?.filters.state === "SETTLED";
  const [message, setMessage] = useState("");
  const active = useRef(schoolId);
  const generation = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
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
      bankAccountId: value.filters.bankAccountId ?? "",
      state: value.filters.state === "SETTLED" ? "SETTLED" : "",
    }));
    return value;
  };
  const loadClasses = async (expected = generation.current) => {
    const value = new URLSearchParams();
    if (filters.schoolYearId) value.set("schoolYearId", filters.schoolYearId);
    if (filters.billingMonth) value.set("billingMonth", filters.billingMonth);
    if (filters.state) value.set("state", filters.state);
    const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/receipt-queue/classes?${value}`, {
      credentials: "include",
    });
    if ([401, 403].includes(response.status)) {
      denied();
      return;
    }
    if (response.ok && active.current === schoolId && expected === generation.current) {
      const options = (
        (await response.json()) as {
          data: { classes: Array<{ id: string; name: string }>; accounts?: ReceivingAccount[]; months?: string[] };
        }
      ).data;
      setClasses(options.classes);
      setAccounts(options.accounts ?? []);
      setMonths(options.months ?? []);
    }
  };
  const clearProtected = () => {
    generation.current += 1;
    setDetail(undefined);
    setResult(undefined);
  };
  const finished = async (closed: Closed, expected: number) => {
    if (expected !== generation.current) return;
    setDetail(undefined);
    setResult(closed);
    try {
      await load(undefined, true, expected);
    } catch {
      if (expected === generation.current) setMessage("Đã ghi thực nhận; chưa thể tải lại hàng đợi mới nhất.");
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
    setAccounts([]);
    setMonths([]);
    setMessage("");
    const expected = generation.current;
    void Promise.all([load(undefined, true, expected), loadClasses(expected)]).catch((error: Error) =>
      setMessage(error.message),
    );
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
  // Receipts are recorded one bank transfer at a time: the outcome sits above the refreshed queue, not a next-Invoice prompt.
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  const applyFilters = () => {
    clearProtected();
    const expected = generation.current;
    void Promise.all([load(undefined, true, expected), loadClasses(expected)]).catch(
      (error: Error) => expected === generation.current && setMessage(error.message),
    );
  };
  const open = async (row: Row) => {
    clearProtected();
    opened.current = row;
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
      <p>
        Hóa đơn chờ ghi thực nhận và phiếu hoàn tiền chờ chi. Mỗi dòng là một hóa đơn theo tài khoản nhận, để đối chiếu
        từng sao kê. Hai phần của cùng một học sinh luôn nằm liền nhau (tài khoản trường trước) và được ghi thực nhận
        riêng.
      </p>
      {message && <p role="alert">{message}</p>}
      {result && (
        <section className="receipt-result" aria-labelledby="receipt-result-title">
          <span className="receipt-result-icon" aria-hidden="true">✓</span>
          <div>
            <h3 id="receipt-result-title" ref={resultHeading} tabIndex={-1}>
              {result.payout
                ? `Đã ghi nhận chi hoàn ${vnd(result.payout.amount)} đ`
                : `Đã ghi thực nhận ${vnd(result.receipt?.actualAmount ?? "0")} đ`}{" "}
              · {result.student.code} / {result.student.name}
            </h3>
            <p>
              {result.payout
                ? `Ngày ${displayDay(result.payout.paidOn)} · ${result.payout.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"} · ${result.payout.reference}`
                : result.receipt
                  ? [
                      outcome(result.receipt.outcome),
                      BigInt(result.receipt.difference?.signedAmount ?? "0") !== 0n
                        ? `chênh lệch ${signed(result.receipt.difference!.signedAmount)} đ`
                        : "",
                      ...(result.carries ?? []).map(
                        (carry) =>
                          `${carry.type === "SHORTFALL_CARRY" ? "thu thiếu chuyển kỳ sau" : "thu thừa khấu trừ kỳ sau"} ${vnd(carry.amount)} đ`,
                      ),
                      ...(result.coverageFacts ?? []).map(
                        (fact) =>
                          `ưu đãi nộp trước kỳ ${periodName(fact.billingMonth)} ${fact.issuedAt ? "đã phát hành" : "chưa phát hành"}`,
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : ""}
            </p>
          </div>
          <button type="button" className="receipt-result-close" aria-label="Đóng thông báo" onClick={() => setResult(undefined)}>
            ×
          </button>
        </section>
      )}
      <form
        className="roster-list-filters"
        aria-label="Lọc hóa đơn chờ thu"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label className="roster-filter-search">
          Tìm học sinh
          <input
            placeholder="Mã hoặc tên học sinh"
            value={filters.student}
            onChange={(event) => setFilters({ ...filters, student: event.target.value })}
          />
        </label>
        <label>
          Tháng thu
          <select
            value={filters.billingMonth}
            onChange={(event) => setFilters({ ...filters, billingMonth: event.target.value })}
          >
            <option value="ALL">Tất cả tháng</option>
            {[...new Set([...months, ...(filters.billingMonth && filters.billingMonth !== "ALL" ? [filters.billingMonth] : [])])]
              .sort()
              .reverse()
              .map((month) => (
                <option key={month} value={month}>
                  Tháng {monthLabel(month)}
                </option>
              ))}
          </select>
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
        <label className="receipt-queue-account-filter">
          Tài khoản nhận
          <select
            value={filters.bankAccountId}
            onChange={(event) => setFilters({ ...filters, bankAccountId: event.target.value })}
          >
            <option value="">Tất cả tài khoản</option>
            {(["SCHOOL", "PERSONAL"] as const).map((kind) =>
              accounts.some((account) => account.kind === kind) ? (
                <optgroup key={kind} label={accountLabel(kind)}>
                  {accounts
                    .filter((account) => account.kind === kind)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {receivingAccountName(account)} · {account.accountNumber}
                      </option>
                    ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </label>
        <label>
          Trạng thái
          <select value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })}>
            <option value="">Chưa xử lý</option>
            <option value="SETTLED">Đã xử lý</option>
          </select>
        </label>
        <label>
          Loại
          <select
            value={filters.direction}
            onChange={(event) => setFilters({ ...filters, direction: event.target.value })}
          >
            <option value="">Tất cả</option>
            <option value="COLLECT">Hóa đơn thu tiền</option>
            <option value="REFUND">Phiếu hoàn tiền</option>
          </select>
        </label>
        <div className="roster-list-filter-actions">
          <button>Lọc</button>
        </div>
      </form>
      <div className="table-scroll student-list-table receipt-queue-table">
      <table aria-label={settledView ? "Hóa đơn đã thu và phiếu hoàn tiền đã chi" : "Hóa đơn chờ thu và phiếu hoàn tiền chờ chi"}>
        <thead>
          <tr>
            <th>STT</th>
            <th>Học sinh</th>
            <th>Lớp</th>
            <th>{classRuns ? "Kỳ" : "Tháng"}</th>
            <th>Tài khoản nhận</th>
            <th className="finance-money">{settledView ? "Đã thu / đã chi" : "Còn phải thu"}</th>
            <th>{settledView ? "Kết quả" : "Trạng thái"}</th>
            {!settledView && <th>Tùy chọn</th>}
          </tr>
        </thead>
        <tbody>
          {queue?.invoices.length ? (
            queue.invoices.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <th scope="row">
                  {row.student.code} / {row.student.name}
                </th>
                <td>{row.class.name}</td>
                <td>{classRuns && row.periodLabel ? row.periodLabel : monthLabel(row.billingMonth)}</td>
                <td>{row.account ? <ReceivingAccountLabel account={row.account} /> : accountLabel(row.channel)}</td>
                {row.settlement ? (
                  <>
                    <td className="finance-money">
                      {row.settlement.type === "PAYOUT" ? `Đã chi ${vnd(row.settlement.amount)}` : vnd(row.settlement.amount)} đ
                      <br />
                      <small className="muted">Ngày {displayDay(row.settlement.on)}</small>
                    </td>
                    <td>
                      {row.settlement.type === "PAYOUT" ? (
                        <span className="finance-badge finance-badge-success">
                          Đã chi hoàn · {row.settlement.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                        </span>
                      ) : (
                        <span
                          className={`finance-badge finance-badge-${row.settlement.outcome === "EXACT" ? "success" : "warning"}`}
                        >
                          {outcome(row.settlement.outcome)}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="finance-money">
                      {isRefund(row) ? `Hoàn ${vnd((-BigInt(row.outstanding)).toString())}` : vnd(row.outstanding)} đ
                    </td>
                    <td>
                      <span className={`finance-badge finance-badge-${isRefund(row) ? "info" : "warning"}`}>
                        {isRefund(row) ? "Chờ chi hoàn" : "Chờ thu"}
                      </span>
                    </td>
                  </>
                )}
                {!settledView && <td className="roster-row-actions">
                  <AnchoredActionMenu
                    label={`Tùy chọn cho ${row.student.name} · ${accountLabel(row.channel)}`}
                    disabled={Boolean(pending)}
                    onTriggerOpen={(element) => {
                      trigger.current = element;
                    }}
                  >
                    <AnchoredActionMenuItem onClick={() => void open(row)}>
                      {isRefund(row) ? "Ghi nhận đã chi" : "Ghi thực nhận"}
                    </AnchoredActionMenuItem>
                  </AnchoredActionMenu>
                </td>}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={settledView ? 7 : 8} className="student-empty-state">
                {settledView ? "Không có hóa đơn đã thu." : "Không có hóa đơn chờ thu."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {detail && isRefund(detail) && (
        <>
          <div className="dialog-backdrop" aria-hidden="true" />
          <div
            ref={dialogRef}
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            onKeyDown={trap}
          >
            <h3 id="receipt-title">
              Ghi nhận đã chi cho {detail.student.name} · {accountTitle(detail)}
            </h3>
            <p>
              {accountContext(detail)}. Số tiền phải chi do hệ thống xác nhận:{" "}
              {vnd((-BigInt(detail.outstanding)).toString())} đ. Chi đúng số tiền này một lần; hóa đơn đóng sau khi hệ
              thống xác nhận.
            </p>
            <label>
              Ngày chi
              <DateInput
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
            <div className="dialog-actions">
              <button type="button" disabled={Boolean(pending)} onClick={() => setDetail(undefined)}>
                Hủy
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={Boolean(pending) || !payout.paidOn || !payout.reference.trim()}
                onClick={() => void close()}
              >
                Xác nhận đã chi
              </button>
            </div>
          </div>
        </>
      )}
      {detail && !isRefund(detail) && (
        <>
          <div className="dialog-backdrop" aria-hidden="true" />
          <div
            ref={dialogRef}
            className="dialog finance-confirm-dialog finance-issue-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title receipt-student"
            onKeyDown={trap}
          >
            <h3 id="receipt-title">
              Ghi thực nhận · {detail.periodLabel ? detail.periodLabel.replace(/^Tháng /, "tháng ") : accountTitle(detail)}
            </h3>
            <div className="finance-issue-student">
              <strong id="receipt-student">{detail.student.name}</strong>
              <span>
                {[
                  detail.student.code,
                  detail.className ? `Lớp ${detail.className}` : "",
                  detail.obligationCode ? `Hóa đơn ${detail.obligationCode}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <section className="finance-receiving-account" aria-label="Tài khoản nhận">
              <header>
                <span>Tiền vào tài khoản</span>
                <span className={`finance-badge finance-badge-${detail.channel === "SCHOOL" ? "info" : "neutral"}`}>
                  {accountLabel(detail.channel)}
                </span>
              </header>
              {detail.account ? (
                <>
                  <p className="finance-receiving-account-number">
                    <b>{detail.account.bankCode}</b> {detail.account.accountNumber}
                  </p>
                  <p>{detail.account.accountHolderName}</p>
                </>
              ) : (
                <p>Hóa đơn không ghi tài khoản nhận.</p>
              )}
            </section>
            <div className="table-scroll">
              <table className="finance-issue-lines">
                <caption className="sr-only">Các khoản thu của hóa đơn</caption>
                <thead>
                  <tr>
                    <th>Khoản thu</th>
                    <th>Số lượng</th>
                    <th className="finance-money">Thành tiền (đ)</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td>{line.receivableName}</td>
                      <td>
                        {line.quantity} {line.unitLabel}
                      </td>
                      <td className="finance-money">{vnd(line.amount)}</td>
                    </tr>
                  ))}
                  {detail.issuedTotal && detail.issuedTotal !== detail.outstanding && (
                    <tr className="finance-issue-subtotal">
                      <td colSpan={2}>Tổng hóa đơn</td>
                      <td className="finance-money">{vnd(detail.issuedTotal)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2} scope="row">
                      Cần thu <small>do hệ thống xác nhận</small>
                    </th>
                    <td className="finance-money">{vnd(detail.outstanding)} đ</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="muted">
              Thu thiếu, đủ hay thừa do hệ thống quyết định; phần chênh lệch chỉ chuyển sang hóa đơn cùng tài khoản kỳ
              sau, hóa đơn của tài khoản kia không đổi.
            </p>
            <label>
              Số thực nhận (đ)
              <input inputMode="numeric" value={actual} onChange={(event) => setActual(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" disabled={Boolean(pending)} onClick={() => setDetail(undefined)}>
                Hủy
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={Boolean(pending) || !actual}
                onClick={() => void close()}
              >
                Xác nhận ghi thực nhận
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
