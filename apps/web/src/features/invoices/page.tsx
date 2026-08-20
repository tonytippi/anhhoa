import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ApiError,
  ApiTimeoutError,
  createOperationId,
} from "../../app/api/client";
import {
  useActiveClassesForPicker,
  useClassesForInvoicePicker,
} from "../classes/api";
import {
  createInvoiceBatch,
  getInvoiceBatchOperation,
  type BatchInput,
  type BatchPreview,
  type BatchResult,
  type InvoiceFilters,
  type InvoiceStatus,
  useBatchPreview,
  useInvoices,
} from "./api";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonth(month: string): string {
  const [year, value] = month.split("-");
  return `${value}/${year}`;
}
function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}
function statusLabel(status: InvoiceStatus): string {
  return status === "DRAFT"
    ? "Nháp"
    : status === "PENDING"
      ? "Chờ xác nhận"
      : "Đã hoàn tất";
}
const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reconciliationAttempts = 3;
const pendingBatchKey = "anhhoa.pending-invoice-batch";
const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
type PendingBatch = { input: BatchInput; operationId: string };

function loadPendingBatch(): PendingBatch | null {
  try {
    const raw = sessionStorage.getItem(pendingBatchKey);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingBatch>;
    const input = pending.input;
    if (
      typeof pending.operationId !== "string" ||
      !uuidPattern.test(pending.operationId) ||
      !input ||
      typeof input !== "object" ||
      !monthPattern.test(input.billingMonth) ||
      typeof input.allActiveClasses !== "boolean"
    )
      return null;
    if (input.allActiveClasses)
      return input.classIds === undefined ? (pending as PendingBatch) : null;
    return Array.isArray(input.classIds) &&
      input.classIds.length > 0 &&
      input.classIds.every(
        (id) => typeof id === "string" && uuidPattern.test(id),
      )
      ? (pending as PendingBatch)
      : null;
  } catch {
    return null;
  }
}
function filtersFromUrl(params: URLSearchParams): InvoiceFilters {
  const page = Number(params.get("page"));
  const status = params.get("status");
  const month = params.get("month");
  const classId = params.get("classId");
  return {
    billingMonth: month && monthPattern.test(month) ? month : currentMonth(),
    search: params.get("search") ?? "",
    status:
      status === "DRAFT" || status === "PENDING" || status === "COMPLETED"
        ? status
        : "",
    classId: classId && uuidPattern.test(classId) ? classId : "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function InvoicesPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromUrl(params);
  const hasValidMonth = monthPattern.test(params.get("month") ?? "");
  const invoices = useInvoices(filters, hasValidMonth);
  const classes = useClassesForInvoicePicker();
  const [creating, setCreating] = useState(() => Boolean(loadPendingBatch()));
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!hasValidMonth) {
      const normalized = new URLSearchParams(params);
      normalized.set("month", filters.billingMonth);
      normalized.delete("page");
      setParams(normalized, { replace: true });
    }
  }, [filters.billingMonth, hasValidMonth, params, setParams]);
  const updateFilters = (next: Partial<InvoiceFilters>) => {
    const value = {
      ...filters,
      ...next,
      page:
        next.search !== undefined ||
        next.status !== undefined ||
        next.classId !== undefined ||
        next.billingMonth !== undefined
          ? 1
          : (next.page ?? filters.page),
    };
    const result = new URLSearchParams({ month: value.billingMonth });
    if (value.search) result.set("search", value.search);
    if (value.status) result.set("status", value.status);
    if (value.classId) result.set("classId", value.classId);
    if (value.page > 1) result.set("page", String(value.page));
    setParams(result);
  };
  const close = () => {
    setCreating(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget;
    setCreating(true);
  };
  return (
    <section className="page invoices-page">
      <div className="page-heading">
        <div>
          <h1>Hóa đơn</h1>
          <p>Tra cứu hóa đơn theo tháng, học sinh và trạng thái.</p>
        </div>
        {invoices.data?.data.length ? (
          <button className="primary-action" type="button" onClick={open}>
            Tạo hóa đơn tháng
          </button>
        ) : null}
      </div>
      <div className="table-toolbar">
        <label className="toolbar-control">
          Tháng
          <input
            aria-label="Tháng hóa đơn"
            type="month"
            value={filters.billingMonth}
            onChange={(event) =>
              updateFilters({ billingMonth: event.target.value })
            }
          />
        </label>
        <label className="toolbar-search">
          Tìm học sinh
          <input
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder="Tìm theo tên học sinh"
          />
        </label>
        <label className="toolbar-control">
          Trạng thái
          <select
            value={filters.status}
            onChange={(event) =>
              updateFilters({
                status: event.target.value as InvoiceFilters["status"],
              })
            }
          >
            <option value="">Tất cả</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING">Chờ xác nhận</option>
            <option value="COMPLETED">Đã hoàn tất</option>
          </select>
        </label>
        <label className="toolbar-control">
          Lớp tại thời điểm lập hóa đơn
          <select
            aria-label="Lớp tại thời điểm lập hóa đơn"
            value={filters.classId}
            onChange={(event) => updateFilters({ classId: event.target.value })}
            disabled={classes.isPending || Boolean(classes.error)}
          >
            <option value="">Tất cả lớp</option>
            {classes.data?.data.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
                {schoolClass.status === "ARCHIVED" ? " (Đã lưu trữ)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!hasValidMonth || invoices.isPending ? (
        <div className="table-card skeleton" aria-live="polite">
          Đang tải hóa đơn...
        </div>
      ) : invoices.error ? (
        <div className="table-card error-state" role="alert">
          <p>Không thể tải danh sách hóa đơn.</p>
          <button type="button" onClick={() => void invoices.refetch()}>
            Thử lại
          </button>
        </div>
      ) : invoices.data!.data.length === 0 && invoices.data!.meta.total > 0 ? (
        <div className="table-card empty-state">
          <p>Trang này không còn hóa đơn.</p>
          <div className="pagination">
            <span>
              Trang {invoices.data!.meta.page} / {invoices.data!.meta.pageCount}
            </span>
            <button
              type="button"
              onClick={() => updateFilters({ page: filters.page - 1 })}
            >
              Trước
            </button>
          </div>
        </div>
      ) : invoices.data!.data.length === 0 ? (
        <div className="table-card empty-state">
          <p>Chưa có hóa đơn trong {formatMonth(filters.billingMonth)}.</p>
          <button className="primary-action" type="button" onClick={open}>
            Tạo hóa đơn tháng
          </button>
        </div>
      ) : (
        <>
          <div className="table-card table-scroll">
            <table
              aria-label={`Danh sách hóa đơn tháng ${formatMonth(filters.billingMonth)}`}
            >
              <caption>
                Hóa đơn tháng {formatMonth(filters.billingMonth)}
                {filters.search ? `, tìm ${filters.search}` : ""}
              </caption>
              <thead>
                <tr>
                  <th className="invoice-identity">Học sinh</th>
                  <th>Lớp lúc lập hóa đơn</th>
                  <th>Trạng thái</th>
                  <th className="money">Tổng cộng</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data!.data.map((item) => (
                  <tr key={item.id}>
                    <th className="invoice-identity" scope="row">
                      <Link to={`/hoa-don/${item.id}`}>
                        {item.student.name}
                      </Link>
                      {item.student.nickname && (
                        <span className="student-names">
                          {item.student.nickname}
                        </span>
                      )}
                    </th>
                    <td>{item.schoolClass.name}</td>
                    <td>
                      <span
                        className={`status invoice-${item.status.toLowerCase()}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="money">{formatVnd(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Trang {invoices.data!.meta.page} / {invoices.data!.meta.pageCount}
            </span>
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => updateFilters({ page: filters.page - 1 })}
            >
              Trước
            </button>
            <button
              type="button"
              disabled={filters.page >= invoices.data!.meta.pageCount}
              onClick={() => updateFilters({ page: filters.page + 1 })}
            >
              Sau
            </button>
          </div>
        </>
      )}
      {creating && (
        <BatchDialog
          month={filters.billingMonth}
          onClose={close}
          onComplete={() => {
            close();
            updateFilters({
              billingMonth: filters.billingMonth,
              status: "DRAFT",
            });
          }}
        />
      )}
    </section>
  );
}

function BatchDialog({
  month,
  onClose,
  onComplete,
}: {
  month: string;
  onClose: () => void;
  onComplete: () => void;
}): React.JSX.Element {
  const [savedBatch] = useState(loadPendingBatch);
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | null>(
    savedBatch,
  );
  const classes = useActiveClassesForPicker();
  const preview = useBatchPreview();
  const queryClient = useQueryClient();
  const [billingMonth, setBillingMonth] = useState(
    savedBatch?.input.billingMonth ?? month,
  );
  const [allActiveClasses, setAllActiveClasses] = useState(
    savedBatch?.input.allActiveClasses ?? true,
  );
  const [classIds, setClassIds] = useState(savedBatch?.input.classIds ?? []);
  const [result, setResult] = useState<BatchResult>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unknown, setUnknown] = useState(Boolean(savedBatch));
  const input = (): BatchInput => ({
    billingMonth,
    allActiveClasses,
    ...(!allActiveClasses ? { classIds } : {}),
  });
  const resetPreview = () => {
    if (!pendingBatch) {
      preview.reset();
      setError("");
    }
  };
  const activeClassesUnavailable =
    !allActiveClasses && (classes.isPending || Boolean(classes.error));
  const locked =
    preview.isPending || checking || submitting || Boolean(pendingBatch);
  const check = () => {
    setError("");
    setResult(undefined);
    preview.mutate(input(), {
      onError: (cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Không thể xem trước hóa đơn.",
        ),
    });
  };
  const clearPending = () => {
    sessionStorage.removeItem(pendingBatchKey);
    setPendingBatch(null);
    setUnknown(false);
  };
  const applyResult = (created: BatchResult) => {
    setResult(created);
    clearPending();
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "invoices" &&
        typeof query.queryKey[1] === "object",
    });
  };
  const reconcile = async (key: string) => {
    setChecking(true);
    setUnknown(false);
    setError("");
    for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
      try {
        const reconciled = await getInvoiceBatchOperation(key);
        if (!("state" in reconciled)) {
          applyResult(reconciled);
          setChecking(false);
          return;
        }
      } catch {
        /* 404 and network failures cannot distinguish an uncommitted write. */
      }
      if (attempt < reconciliationAttempts - 1)
        await delay(500 * (attempt + 1));
    }
    setChecking(false);
    setUnknown(true);
    setError(
      "Chưa xác định được kết quả tạo hóa đơn. Bạn có thể kiểm tra lại hoặc gửi lại cùng thao tác này.",
    );
  };
  const create = async () => {
    if ((!preview.data?.eligibleCount && !pendingBatch) || submitting) return;
    const request = pendingBatch ?? {
      input: input(),
      operationId: createOperationId(),
    };
    if (!pendingBatch)
      try {
        sessionStorage.setItem(
          pendingBatchKey,
          JSON.stringify(request satisfies PendingBatch),
        );
        setPendingBatch(request);
      } catch {
        setError("Không thể lưu mã đối soát tạo hóa đơn.");
        return;
      }
    setError("");
    setUnknown(false);
    setSubmitting(true);
    try {
      applyResult(await createInvoiceBatch(request.input, request.operationId));
    } catch (cause) {
      if (cause instanceof ApiTimeoutError)
        await reconcile(request.operationId);
      else if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500 &&
        cause.code !== "IDEMPOTENCY_CONFLICT"
      ) {
        clearPending();
        setError(cause.message);
      } else {
        setUnknown(true);
        setError(
          cause instanceof ApiError ? cause.message : "Không thể tạo hóa đơn.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };
  const reconcileSavedBatch = useEffectEvent((key: string) => {
    void reconcile(key);
  });
  useEffect(() => {
    if (savedBatch) {
      const timer = setTimeout(
        () => reconcileSavedBatch(savedBatch.operationId),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [savedBatch]);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog">
          <Dialog.Title>Tạo hóa đơn tháng</Dialog.Title>
          {result ? (
            <>
              <p>Đã tạo {result.createdCount} hóa đơn nháp.</p>
              <SkipSummary skipped={result.skipped} />
              <div className="dialog-actions">
                <Link
                  className="primary-action"
                  to={`/hoa-don?month=${billingMonth}&status=DRAFT`}
                  onClick={onComplete}
                >
                  Xem hóa đơn nháp
                </Link>
              </div>
            </>
          ) : (
            <>
              <label>
                Tháng
                <input
                  aria-label="Tháng tạo hóa đơn"
                  type="month"
                  value={billingMonth}
                  disabled={locked}
                  onChange={(event) => {
                    resetPreview();
                    setBillingMonth(event.target.value);
                  }}
                />
              </label>
              <fieldset
                className="invoice-batch-scope"
                disabled={locked || classes.isPending}
              >
                <legend>Phạm vi</legend>
                <label>
                  <input
                    name="invoice-batch-scope"
                    type="radio"
                    checked={allActiveClasses}
                    onChange={() => {
                      resetPreview();
                      setAllActiveClasses(true);
                    }}
                  />{" "}
                  Tất cả lớp đang hoạt động
                </label>
                <label>
                  <input
                    name="invoice-batch-scope"
                    type="radio"
                    checked={!allActiveClasses}
                    onChange={() => {
                      resetPreview();
                      setAllActiveClasses(false);
                    }}
                  />{" "}
                  Chọn lớp
                </label>
                {!allActiveClasses &&
                  classes.data?.data.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={classIds.includes(item.id)}
                        onChange={(event) => {
                          resetPreview();
                          setClassIds((ids) =>
                            event.target.checked
                              ? [...ids, item.id]
                              : ids.filter((id) => id !== item.id),
                          );
                        }}
                      />{" "}
                      {item.name}
                    </label>
                  ))}
                {!allActiveClasses && classes.error && (
                  <p role="alert">
                    Không thể tải danh sách lớp. <button type="button" onClick={() => void classes.refetch()}>Thử lại</button>
                  </p>
                )}
              </fieldset>
              <button
                type="button"
                onClick={check}
                disabled={
                  locked ||
                  activeClassesUnavailable ||
                  !monthPattern.test(billingMonth) ||
                  (!allActiveClasses && !classIds.length)
                }
              >
                Xem trước
              </button>
              {preview.data && (
                <div aria-live="polite">
                  <p>Có {preview.data.eligibleCount} học sinh đủ điều kiện.</p>
                  <SkipSummary skipped={preview.data.skipped} />
                </div>
              )}
              {error && <p role="alert">{error}</p>}
              {unknown && (
                <p aria-live="polite">
                  Kết quả chưa xác định. Thao tác sẽ giữ nguyên mã đối soát.
                </p>
              )}
              <div className="dialog-actions">
                <Dialog.Close
                  render={
                    <button type="button" disabled={locked}>
                      Hủy
                    </button>
                  }
                />
                {unknown && (
                  <button
                    type="button"
                    onClick={() =>
                      pendingBatch && void reconcile(pendingBatch.operationId)
                    }
                  >
                    Kiểm tra lại kết quả
                  </button>
                )}
                <button
                  className="primary-action"
                  type="button"
                  disabled={
                    checking ||
                    submitting ||
                    (!unknown && !preview.data?.eligibleCount)
                  }
                  onClick={() => void create()}
                >
                  {checking
                    ? "Đang kiểm tra..."
                    : submitting
                      ? "Đang tạo..."
                      : unknown
                        ? "Gửi lại cùng thao tác"
                        : "Tạo hóa đơn nháp"}
                </button>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function SkipSummary({
  skipped,
}: {
  skipped: BatchPreview["skipped"];
}): React.JSX.Element {
  return (
    <p>
      Bỏ qua: học sinh không hoạt động {skipped.inactiveStudent}, thiếu lớp{" "}
      {skipped.missingClass}, lớp lưu trữ {skipped.archivedClass}, đã có hóa đơn{" "}
      {skipped.existingInvoice}.
    </p>
  );
}
