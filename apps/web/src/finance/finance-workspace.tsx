import { FormEvent, Fragment, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReceivingAccountLabel, type ReceivingAccount } from "./receiving-account";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";
import { PaymentImagePanel } from "./payment-image-panel";
import {
  ReceivableEditFields,
  receivableEditChanges,
  receivableEditValues,
  receivableKinds,
  taxCategoryOptions,
  taxChannelHint,
  type ReceivableEditValues,
  type ReceivableKind,
  type TaxCategory,
  AutoLeaveDeductionField,
  UnitSuggestions,
} from "./receivable-edit-fields";
import { DateInput } from "../components/date-input";

type Group = { id: string; name: string; kind: ReceivableKind };
const kindShortLabel = (kind: ReceivableKind | null | undefined) =>
  (({ FIXED: "Cố định", FLEXIBLE: "Linh hoạt", EXTRACURRICULAR: "Ngoại khóa" }) as const)[kind ?? "FLEXIBLE"] ?? "";
const kindLabel = (kind: ReceivableKind | null | undefined) =>
  receivableKinds.find((item) => item.kind === kind)?.label ?? "";
type Receivable = {
  id: string;
  groupId: string;
  kind?: ReceivableKind | null;
  kindLocked?: boolean;
  extracurricularClassCount?: number;
  extracurricularClassNames?: string[];
  code: string | null;
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  refundUnitPrice?: string;
  autoLeaveDeduction?: boolean;
  taxCategory?: TaxCategory;
  channel?: PaymentChannel;
  status: "ACTIVE" | "INACTIVE" | null;
  available: boolean;
};
type PaymentChannel = "SCHOOL" | "PERSONAL";
// Decision 2026-10-01: "Bớt" is the server-proposed deduction of a line; the source names the leave days it counted.
type DeductionSource = {
  type?: string;
  month?: string;
  days?: string[];
  afterEndDays?: string[];
  proposedQuantity?: number;
  proposedUnitPrice?: string;
  months?: number;
  usedMonths?: number;
  firstMonth?: string;
  lastMonth?: string;
  paidNet?: string;
  listPriceUsed?: string;
  priorRefundNet?: string;
  maxRefundNet?: string;
};
const deductionMonthLabel = (month: string | undefined) => (month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : "");
const deductionDays = (source: DeductionSource | null | undefined) =>
  (source?.days ?? []).map((day) => day.slice(8, 10) + "/" + day.slice(5, 7)).join(", ");
const deductionMonth = (source: DeductionSource | null | undefined) =>
  source?.month ? `${source.month.slice(5, 7)}/${source.month.slice(0, 4)}` : "";
const taxShortLabel: Record<TaxCategory, string> = {
  NOT_DECLARED: "Không kê khai",
  EXEMPT: "Không chịu thuế",
  VAT_0: "0%",
  VAT_5: "5%",
  VAT_8: "8%",
  VAT_10: "10%",
};
const channelAccountLabel = (channel: PaymentChannel | undefined) =>
  channel === "SCHOOL" ? "Tài khoản trường" : "Tài khoản cá nhân";
// Review moves student by student: the first part of each payment notice stands for the Student.
const studentQueueIds = (invoices: Array<{ id: string; studentId: string }> | undefined) =>
  [...new Map((invoices ?? []).map((item) => [item.studentId, item.id] as const).reverse()).values()].reverse();
type Catalog = { groups: Group[]; receivables: Receivable[]; schoolYears?: Year[] };
type PromotionPolicy = {
  id: string;
  name: string;
  versions: Array<{
    id: string;
    version: number;
    status: "DRAFT" | "ACTIVE" | "RETIRED";
    discountType: "FIXED_VND" | "PERCENTAGE";
    discountValue: string;
    priority: number;
    stackingMode: "STACKABLE" | "EXCLUSIVE";
    fulfillmentMode: "DISCOUNT" | "PREPAID_COVERAGE";
    prepaidTermMonths?: number | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    targets: Array<{ id: string; receivableId: string; receivableName: string }>;
    assignments: Array<{
      id: string;
      studentId: string;
      studentCode: string;
      studentName: string;
      effectiveFrom: string;
      effectiveTo: string | null;
      isCurrent: boolean;
      reason: string;
      endReason: string | null;
    }>;
  }>;
};
type Year = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  closedAt: string | null;
};
type Candidate = { id: string; studentCode: string; fullName: string };
type PromotionCandidates = {
  schoolYear: { id: string; name: string } | null;
  officialClasses: Array<{ id: string | null; name: string }>;
  students: Array<Candidate & { officialClassName: string | null; assigned: boolean }>;
};
type Candidates = { schoolYears: Year[]; students: Candidate[] };
// Decision 2026-10-02 §3.2: a template line has a typed kind and a scope; counts and subtotals only come from the server preview.
type TemplateScope = {
  type: "ALL" | "CLASSES" | "STUDENTS";
  label: string;
  classes: Array<{ id: string; name: string }>;
  students: Array<{ id: string; studentCode: string; fullName: string }>;
};
type TemplateLine = {
  id: string;
  receivableId: string;
  receivableName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  quantity: string;
  amount: string;
  kind?: ReceivableKind | null;
  scope?: TemplateScope;
};
type LineSummary = {
  templateLineId: string | null;
  note?: string;
  receivableId: string;
  receivableName: string;
  kind: ReceivableKind | null;
  scope: { type: string; label: string };
  studentCount: number;
  subtotal: string;
  discountAmount?: string;
  deductionAmount?: string;
  vatAmount?: string;
  totalAmount?: string;
};
type ScopeOptions = {
  classes: Array<{ id: string; name: string }>;
  students: Array<{ id: string; studentCode: string; fullName: string; className: string | null }>;
};
type RunExtracurricularClass = {
  id: string;
  name: string;
  receivableId: string;
  receivableName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  memberCount: number;
  transferredCount: number;
  excluded: boolean;
  receivableActive: boolean;
};
type TemplateDialog = {
  lineId?: string;
  receivableId: string;
  name: string;
  kind: ReceivableKind | null;
  quantity: string;
  scopeType: "ALL" | "CLASSES" | "STUDENTS";
  classIds: string[];
  students: Array<{ id: string; label: string }>;
  search: string;
  officialClassId: string;
};
type Run = {
  id: string;
  schoolYearId: string;
  billingMonth: string;
  type: "MONTHLY";
  status: "DRAFT" | "READY" | "GENERATED" | "CLOSED";
  version: number;
  previousOpenRun?: { id: string; billingMonth: string } | null;
  templateLines: Array<TemplateLine>;
  coverageSelections?: Array<{ studentId: string; versionId: string; billingMonth: string }>;
  invoices?: Array<{
    id: string;
    studentId: string;
    studentCode: string;
    studentName: string;
    className: string;
    status: string;
    total: string;
    channel?: PaymentChannel;
    kind?: "NORMAL" | "SETTLEMENT";
  }>;
  notices?: RunNotice[];
  summary?: PreviewSummary | InvoiceSummary;
};
// Decision 2026-10-05: one row per payment notice; the API owns its total and combined status.
type RunNotice = {
  invoiceId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  kind: "NORMAL" | "SETTLEMENT";
  status: "DRAFT" | "ISSUED" | "PARTLY_SETTLED" | "COMPLETED" | "CANCELLED";
  settledParts: number;
  partCount: number;
  total: string;
  parts: Array<{ id: string; channel: PaymentChannel; status: string; total: string; account: ReceivingAccount | null }>;
};
type PreviewSummary = {
  eligibleCount: number;
  skippedCount: number;
  expectedTotal: string;
  grossAmount?: string;
  discountAmount?: string;
  deductionAmount?: string;
  vatAmount?: string;
  netAmount?: string;
};
type InvoiceSummary = {
  invoiceCount: number;
  issuedCount: number;
  invoiceTotal: string;
  noticeCount?: number;
  issuedNoticeCount?: number;
};
type Preview = {
  run: Run;
  eligible: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
    totals?: { grossAmount: string; discountAmount: string; deductionAmount: string; vatAmount: string; amount: string };
    lines: Array<{
      receivableId: string;
      receivableName: string;
      grossAmount: string;
      discountAmount: string;
      netAmount: string;
      amount?: string;
      taxCategory?: TaxCategory | null;
      vatRate?: number | null;
      vatAmount?: string;
      refundUnitPrice?: string;
      deductionQuantity?: string;
      proposedDeductionQuantity?: string;
      deductionAmount?: string;
      deductionReason?: string | null;
      deductionSource?: DeductionSource | null;
      promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> };
    }>;
  }>;
  skips: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
  fingerprint: string;
  summary?: PreviewSummary;
  lineSummaries?: LineSummary[];
  extracurricularClasses?: Array<{ id: string; billedStudents: number; subtotal: string }>;
  lineTotal?: string;
  coverageSelections?: Array<{ studentId: string; versionId: string; billingMonth: string }>;
  futureCoverageFacts?: Array<{
    studentId: string;
    billingMonth: string;
    policyId: string;
    versionId: string;
    receivableId: string;
    receivableName: string;
    originalPrice: string;
    reduction: string;
    serviceStart: string;
    serviceEnd: string;
    calendarEffectiveFrom: string;
    timezone: string;
  }>;
};
type GenerateOutcome = {
  run: Run;
  created: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
    invoiceId?: string;
  }>;
  skipped: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
};
type Source = {
  serviceDate: string | null;
  attendanceState: "PRESENT" | "ABSENT" | null;
  pickedUpAt: string | null;
  lateCareMinutes: number | null;
};
type BankAccount = {
  id: string;
  kind?: PaymentChannel;
  receivingBank: string;
  bankBin?: string | null;
  accountNumber: string;
  accountHolderName: string;
};
type Invoice = {
  id: string;
  paymentTotal?: string;
  noticeTotal?: string;
  channel?: PaymentChannel;
  kind?: "NORMAL" | "SETTLEMENT";
  enrollmentEndedOn?: string | null;
  notice?: { classDefaultBankAccountId: string | null; classDefaultSchoolBankAccountId?: string | null; invoices: Invoice[] };
  status: string;
  total: string;
  sourceOutstanding?: string | null;
  billingMonth: string;
  revisesInvoiceId: string | null;
  revisionReason: string | null;
  replacementInvoiceId: string | null;
  receipt: {
    actualAmount: string;
    outcome: "EXACT" | "SHORTFALL" | "OVERPAYMENT";
    postedAt: string;
    difference: { signedAmount: string } | null;
  } | null;
  settlementTransfer: { sourceInvoiceId: string; sourceReceiptId: string; amount: string; postedAt: string } | null;
  sourceDebtTransfers?: Array<{ targetInvoiceId: string; amount: string; reason: string; postedAt: string }>;
  priorDebtTransfers?: Array<{ sourceInvoiceId: string; amount: string; reason: string; postedAt: string }>;
  carries: Array<{ type: "SHORTFALL_CARRY" | "OVERPAYMENT_CARRY"; amount: string; sourceDifferenceId: string }>;
  coverageFacts?: Array<{
    coverageId: string | null;
    receivableId: string;
    billingMonth: string;
    policyId: string;
    versionId: string;
    originalPrice: string;
    reduction: string;
    netPrice: string;
    serviceStart: string;
    serviceEnd: string;
    calendarEffectiveFrom: string;
    timezone: string;
    issuedAt: string | null;
  }>;
  paymentImageAvailable?: boolean;
  student: { code: string; name: string; className: string };
  lines: Array<{
    id: string;
    kind?: "NORMAL" | "PRIOR_DEBT";
    sourceBadge?: {
      kind: string;
      label: string;
      flags?: Array<{ code: string; label: string }>;
      detail?: string;
    } | null;
    receivableId: string | null;
    receivableName: string;
    unitLabel: string;
    unitPrice: string;
    quantity: string;
    amount: string;
    grossAmount: string;
    discountAmount: string;
    netAmount: string;
    taxCategory?: TaxCategory | null;
    vatRate?: number | null;
    vatAmount?: string;
    refundUnitPrice?: string;
    deductionQuantity?: string;
    proposedDeductionQuantity?: string;
    deductionAmount?: string;
    deductionReason?: string | null;
    deductionSource?: DeductionSource | null;
    promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> } | null;
    promotionApplicationSnapshot: Array<{ assignmentReason: string; appliedDiscount: string }> | null;
    overrideReason: string | null;
    source: Source | null;
    sourceReason: string | null;
    sourceRecordedAt: string | null;
    sourceProvenance: unknown;
    sourceAudit: { actorIdentityId: string; membershipId: string } | null;
  }>;
  issue?: {
    obligationCode?: string | null;
    obligationTotal: string;
    dueOn: string;
    bankAccount: BankAccount;
    transferContent: string;
    policy: {
      effectiveFrom: string;
      dueDaysAfterIssue: number;
      taxTreatment: string;
      debtScope: string;
      reversalMode: string;
    };
  };
};
type Pending = { id: string; schoolId: string };
// Draft lines show the live promotion evaluation; issued lines show the snapshot taken at issue.
const discountReasons = (status: string, line: Invoice["lines"][number]) =>
  (status === "DRAFT" ? line.promotionEvaluation?.applications : line.promotionApplicationSnapshot)
    ?.map((application) => application.assignmentReason)
    .join(", ");
// Decision 2026-10-01 D9: Students who left last month are settled in this run.
type Settlement = {
  studentId: string;
  studentCode: string;
  fullName: string;
  className: string | null;
  lifecycle: string;
  endedOn: string;
  invoiceTotal: string;
  invoices: Array<{ id: string; channel: PaymentChannel; status: string; total: string }>;
};
// Decision 2026-10-08 §2: unpaid issued notices of closed earlier runs, moved on request into this run's draft.
type PriorDebt = {
  sourceInvoiceId: string;
  student: { id: string; code: string; name: string };
  className: string;
  billingMonth: string;
  channel: PaymentChannel;
  account: ReceivingAccount | null;
  outstanding: string;
  obligationCode: string | null;
};
type GenerationProgress = {
  status: "QUEUED" | "RUNNING" | "PAUSED" | "FAILED" | "COMPLETED";
  total: number;
  processed: number;
  eligible: number;
  skipped: number;
  lastError: { code: string | null; message: string | null } | null;
};
type OperationResult = { status: string; outcome?: unknown; progress?: GenerationProgress | null };
type Lifecycle = {
  kind: "receivables";
  id: string;
  name: string;
  next: "ACTIVE" | "INACTIVE";
  reason: string;
};
export type FinanceStatus = {
  dirty: boolean;
  pending: boolean;
  reconcile?: () => void;
};
export type FinancePage = "receivables" | "promotions" | "collection-runs";

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName = typeof __CSRF_COOKIE_NAME__ === "undefined" ? "app_csrf" : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-finance-operation";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
// Reductions read as subtractions in reconciliation rows; zero stays unsigned.
const reductionVnd = (value = "0") => (BigInt(value) === 0n ? "0 đ" : `-${vnd(value)} đ`);
// Decision 2026-10-01 D7: a negative total is money the School pays back to the parent.
const signedVnd = (value: string) =>
  BigInt(value) < 0n ? `Hoàn ${vnd((-BigInt(value)).toString())} đ` : `${vnd(value)} đ`;
const displayDate = (value: string) => value.split("-").reverse().join("/");
const skipReason = (reason: string) =>
  ({
    NO_ENROLLMENT: "Không còn hồ sơ nhập học.",
    ENROLLMENT_NOT_EFFECTIVE: "Nhập học không hiệu lực vào đầu tháng thu.",
    NOT_ENROLLED: "Học sinh không ở trạng thái đang theo học.",
    NO_CLASS_ASSIGNMENT: "Chưa có lớp được phân công hiệu lực vào đầu tháng thu.",
    CLASS_INACTIVE: "Lớp được phân công đã ngừng hoạt động.",
    INVOICE_EXISTS: "Học sinh đã có hóa đơn trong đợt thu này.",
    NO_APPLICABLE_LINES: "Không có khoản thu áp dụng.",
  })[reason] ?? "Không đủ điều kiện theo roster hiện tại.";
const runStatusLabel = (status: Run["status"]) =>
  ({
    DRAFT: "Nháp",
    READY: "Sẵn sàng tạo hóa đơn",
    GENERATED: "Đã tạo hóa đơn",
    CLOSED: "Đã đóng",
  })[status];
const runSteps = ["DRAFT", "READY", "GENERATED", "CLOSED"] as const;
// Overview values render only the server `summary`; the browser never adds VND amounts.
const runMetrics = (run: Run, preview?: Preview): Array<[string, string]> => {
  if (run.status === "DRAFT" || run.status === "READY") {
    const summary = (run.status === "DRAFT" ? preview?.summary : run.summary) as PreviewSummary | undefined;
    const missing = run.status === "DRAFT" ? "Chưa xem trước" : "Chưa có số liệu";
    return [
      ["Học sinh đủ điều kiện", summary ? String(summary.eligibleCount) : missing],
      ["Học sinh bị bỏ qua", summary ? String(summary.skippedCount) : missing],
      ["Cần thu dự kiến", summary ? `${vnd(summary.expectedTotal)} đ` : missing],
    ];
  }
  const summary = run.summary as InvoiceSummary | undefined;
  return [
    ["Phiếu thu", summary ? String(summary.noticeCount ?? summary.invoiceCount) : "Chưa có số liệu"],
    ["Đã phát hành", summary ? String(summary.issuedNoticeCount ?? summary.issuedCount) : "Chưa có số liệu"],
    ["Tổng phải thu", summary ? `${vnd(summary.invoiceTotal)} đ` : "Chưa có số liệu"],
  ];
};
const billingMonthLabel = (month: string) => {
  const [year, value] = (month ?? "").split("-");
  return year && value ? `${value}/${year}` : month;
};
// Months whose first day falls inside [startsOn, endsOn), matching the server's billing-month check.
const schoolYearMonths = (year?: Year) => {
  if (!year) return [];
  const months: string[] = [];
  const [startYear, startMonth, startDay] = year.startsOn.slice(0, 10).split("-").map(Number);
  let cursor = new Date(Date.UTC(startYear!, startMonth! - 1 + (startDay === 1 ? 0 : 1), 1));
  const end = year.endsOn.slice(0, 10);
  while (cursor.toISOString().slice(0, 10) < end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
};
const promotionStatusLabel = (status: PromotionPolicy["versions"][number]["status"]) =>
  ({ DRAFT: "Nháp", ACTIVE: "Đang áp dụng", RETIRED: "Đã ngừng" })[status];
const invoiceStatusLabel = (status: string) =>
  ({
    DRAFT: "Nháp",
    ISSUED: "Đã phát hành",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã hủy",
  })[status] ?? "Đã cập nhật";

// Prepaid coverage sits on the notice part its receivables are paid into, not necessarily the part that is open.
const noticeCoverageFacts = (invoice: Invoice) =>
  (invoice.notice?.invoices?.length ? invoice.notice.invoices : [invoice]).flatMap((part) => part.coverageFacts ?? []);
const noticeLineName = (invoice: Invoice, receivableId: string) =>
  (invoice.notice?.invoices?.length ? invoice.notice.invoices : [invoice])
    .flatMap((part) => part.lines)
    .find((line) => line.receivableId === receivableId)?.receivableName ?? "Khoản thu theo hóa đơn";
const noticeStatus = (notice: RunNotice): [string, "neutral" | "info" | "success" | "warning"] =>
  notice.status === "DRAFT"
    ? ["Nháp", "neutral"]
    : notice.status === "PARTLY_SETTLED"
      ? [`Đã thu ${notice.settledParts}/${notice.partCount} phần`, "info"]
      : notice.status === "COMPLETED"
        ? ["Hoàn tất", "success"]
        : notice.status === "CANCELLED"
          ? ["Đã hủy", "warning"]
          : ["Đã phát hành", "success"];

const PREVIEW_PAGE_SIZE = 25;
const foldSearch = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

// One row per Student with server-computed totals; search and paging keep a whole-school run readable.
function PreviewEligibleTable({ eligible }: { eligible: Preview["eligible"] }) {
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState("");
  const [page, setPage] = useState(1);
  const classNames = [...new Set(eligible.map((item) => item.className))].sort((a, b) => a.localeCompare(b, "vi"));
  const needle = foldSearch(query.trim());
  const rows = eligible.filter(
    (item) => (!className || item.className === className) && (!needle || foldSearch(`${item.studentCode} ${item.fullName}`).includes(needle)),
  );
  const totalPages = Math.max(1, Math.trunc((rows.length + PREVIEW_PAGE_SIZE - 1) / PREVIEW_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * PREVIEW_PAGE_SIZE, current * PREVIEW_PAGE_SIZE);
  return (
    <>
      {eligible.length > PREVIEW_PAGE_SIZE && (
        <div className="roster-list-filters">
          <label className="roster-filter-search">
            Tìm kiếm
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Tên hoặc mã học sinh"
            />
          </label>
          <label>
            Lớp
            <select
              value={className}
              onChange={(event) => {
                setClassName(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả lớp</option>
              {classNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <caption>Học sinh đủ điều kiện</caption>
          <thead>
            <tr>
              <th>Học sinh</th>
              <th>Lớp</th>
              <th className="finance-money">Tổng trước giảm</th>
              <th className="finance-money">Ưu đãi</th>
              <th className="finance-money">Bớt</th>
              <th className="finance-money">Thuế GTGT</th>
              <th className="finance-money">Tổng phải thu</th>
              <th>Lý do ưu đãi</th>
            </tr>
          </thead>
          <tbody>
            {shown.length ? (
              shown.map((item) => (
                <tr key={item.studentId}>
                  <td>
                    {item.studentCode} / {item.fullName}
                  </td>
                  <td>{item.className}</td>
                  <td className="finance-money">{vnd(item.totals?.grossAmount ?? "0")} đ</td>
                  <td className="finance-money">{vnd(item.totals?.discountAmount ?? "0")} đ</td>
                  <td className="finance-money">{vnd(item.totals?.deductionAmount ?? "0")} đ</td>
                  <td className="finance-money">{vnd(item.totals?.vatAmount ?? "0")} đ</td>
                  <td className="finance-money">{vnd(item.totals?.amount ?? "0")} đ</td>
                  <td>
                    {[...new Set((item.lines ?? []).flatMap((line) => line.promotionEvaluation.applications.map((application) => application.assignmentReason)))].join(", ") ||
                      "Không áp dụng"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>{eligible.length ? "Không có học sinh khớp bộ lọc." : "Không có học sinh đủ điều kiện."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Phân trang học sinh đủ điều kiện">
          <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Trước
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, index) =>
            totalPages <= 5 ? index + 1 : Math.min(totalPages - 4, Math.max(1, current - 2)) + index,
          ).map((item) => (
            <button key={item} type="button" disabled={item === current} aria-current={item === current ? "page" : undefined} onClick={() => setPage(item)}>
              {item}
            </button>
          ))}
          <button type="button" disabled={current === totalPages} onClick={() => setPage(current + 1)}>
            Sau
          </button>
        </nav>
      )}
    </>
  );
}

function RunNoticeTable({
  notices,
  caption,
  actionLabel,
  currentInvoiceId,
  onReview,
}: {
  notices: RunNotice[];
  caption: string;
  actionLabel: string;
  currentInvoiceId?: string;
  onReview: (invoiceId: string) => void;
}) {
  const part = (notice: RunNotice, channel: PaymentChannel) => {
    const item = notice.parts.find((candidate) => candidate.channel === channel);
    if (!item) return "—";
    return (
      <>
        {signedVnd(item.total)}
        {item.account && <ReceivingAccountLabel account={item.account} />}
      </>
    );
  };
  return (
    <div className="table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Học sinh</th>
            <th>Lớp</th>
            <th className="finance-money">Tài khoản trường</th>
            <th className="finance-money">Tài khoản cá nhân</th>
            <th className="finance-money">Tổng</th>
            <th>Trạng thái</th>
            <th>Tùy chọn</th>
          </tr>
        </thead>
        <tbody>
          {notices.length ? (
            notices.map((notice) => {
              const [label, tone] = noticeStatus(notice);
              return (
                <tr
                  key={notice.studentId}
                  aria-current={
                    currentInvoiceId && notice.parts.some((item) => item.id === currentInvoiceId) ? "true" : undefined
                  }
                >
                  <td>
                    {notice.studentCode} / {notice.studentName}
                    {notice.kind === "SETTLEMENT" && <small> · Quyết toán</small>}
                  </td>
                  <td>{notice.className}</td>
                  <td className="finance-money">{part(notice, "SCHOOL")}</td>
                  <td className="finance-money">{part(notice, "PERSONAL")}</td>
                  <td className="finance-money">
                    <b>{signedVnd(notice.total)}</b>
                  </td>
                  <td>
                    <span className={`finance-badge finance-badge-${tone}`}>{label}</span>
                  </td>
                  <td>
                    <button type="button" onClick={() => onReview(notice.invoiceId)}>
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7}>Chưa có hóa đơn trong đợt thu.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const todayInVietnam = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const defaultPromotion = () => ({
  policyId: "",
  name: "",
  receivableIds: [] as string[],
  discountType: "PERCENTAGE",
  discountValue: "",
  priority: "1",
  stackingMode: "STACKABLE",
  fulfillmentMode: "DISCOUNT" as "DISCOUNT" | "PREPAID_COVERAGE",
  prepaidTermMonths: "",
  effectiveFrom: todayInVietnam(),
  effectiveTo: "",
});

const emptyInvoiceLine = {
  receivableId: "",
  quantity: "",
  unitPrice: "",
  overrideReason: "",
  sourceReason: "",
  serviceDate: "",
  attendanceState: "",
  pickedUpAt: "",
  lateCareMinutes: "",
};

// Decision 2026-10-07: Finance edits the lines of a DRAFT notice inline, like a spreadsheet. The values typed are
// sent to the server preview; every amount shown comes from the server, marked as not saved until Lưu thay đổi.
type InvoiceLine = Invoice["lines"][number];
type LineDraft = {
  quantity: string;
  unitPrice: string;
  overrideReason: string;
  deductionQuantity: string;
  refundUnitPrice: string;
  deductionReason: string;
};
const lineDraft = (line: InvoiceLine): LineDraft => ({
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  overrideReason: "",
  deductionQuantity: line.deductionQuantity ?? "0",
  refundUnitPrice: line.refundUnitPrice ?? "0",
  deductionReason: line.deductionReason ?? "",
});
const priceChanged = (line: InvoiceLine, draft: LineDraft) => draft.unitPrice !== line.unitPrice;
const deductionChanged = (line: InvoiceLine, draft: LineDraft) =>
  draft.deductionQuantity !== (line.deductionQuantity ?? "0") ||
  draft.refundUnitPrice !== (line.refundUnitPrice ?? "0") ||
  draft.deductionReason !== (line.deductionReason ?? "");
const deductionDiffersFromProposal = (line: InvoiceLine, draft: LineDraft) =>
  draft.deductionQuantity !== (line.proposedDeductionQuantity ?? "0") ||
  draft.refundUnitPrice !== (line.deductionSource?.proposedUnitPrice ?? "0");
// Only the values Finance changed are sent for a line.
const lineEdit = (line: InvoiceLine, draft: LineDraft | undefined) => {
  if (!draft) return null;
  const edit: Record<string, string> = { lineId: line.id };
  if (draft.quantity !== line.quantity) edit.quantity = draft.quantity;
  if (priceChanged(line, draft)) Object.assign(edit, { unitPrice: draft.unitPrice, overrideReason: draft.overrideReason });
  if (deductionChanged(line, draft))
    Object.assign(edit, {
      deductionQuantity: draft.deductionQuantity,
      refundUnitPrice: draft.refundUnitPrice,
      deductionReason: draft.deductionReason,
    });
  return Object.keys(edit).length > 1 ? edit : null;
};
// The server locks the lines of a part holding a prepaid package; remove the package to edit them.
const lineEditable = (part: Invoice, line: InvoiceLine) =>
  part.status === "DRAFT" && line.receivableId !== null && (line.kind ?? "NORMAL") === "NORMAL" && !(part.coverageFacts ?? []).length;

function InvoiceLinesTable({
  part,
  caption,
  totalLabel,
  preview,
  prepaidReceivableIds,
  drafts,
  errors,
  disabled,
  onDraft,
  onSource,
  onRemove,
}: {
  part: Invoice;
  caption: string;
  totalLabel?: string;
  preview: Invoice | undefined;
  prepaidReceivableIds: Set<string>;
  drafts: Record<string, LineDraft>;
  errors: Record<string, string>;
  disabled: boolean;
  onDraft: (line: InvoiceLine, draft: LineDraft) => void;
  onSource: (line: InvoiceLine, trigger: HTMLButtonElement) => void;
  onRemove: (line: InvoiceLine, trigger: HTMLButtonElement) => void;
}) {
  const previewPart = preview && (preview.id === part.id ? preview : preview.notice?.invoices?.find((item) => item.id === part.id));
  const total = previewPart?.total ?? part.total;
  const cell = (line: InvoiceLine, name: keyof LineDraft, label: string, extra: { className?: string; placeholder?: string } = {}) => {
    const key = `lines.${line.id}.${name}`;
    const draft = drafts[line.id] ?? lineDraft(line);
    return (
      <span className="finance-cell-field">
        <input
          className={extra.className}
          aria-label={label}
          placeholder={extra.placeholder}
          inputMode={name.endsWith("Reason") ? undefined : "numeric"}
          disabled={disabled}
          value={draft[name]}
          onChange={(event) => onDraft(line, { ...draft, [name]: event.target.value })}
          {...(errors[key]
            ? {
                id: `invoice-invoice-${key}-field`,
                "aria-invalid": true,
                "aria-describedby": `invoice-invoice-${key}-error`,
              }
            : {})}
        />
        {errors[key] && <small id={`invoice-invoice-${key}-error`}>{errors[key]}</small>}
      </span>
    );
  };
  return (
    <div className="table-scroll">
      <table className="finance-lines-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Khoản thu</th>
            <th>Số lượng</th>
            <th className="finance-money">Đơn giá (đ)</th>
            <th className="finance-money">Tổng trước giảm (đ)</th>
            <th className="finance-money">Ưu đãi (đ)</th>
            <th className="finance-money">Bớt (đ)</th>
            <th className="finance-money">Thuế GTGT (đ)</th>
            <th className="finance-money">Tổng phải thu (đ)</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {part.lines.map((item) => {
            const editable = lineEditable(part, item);
            const draft = drafts[item.id];
            const edited = Boolean(lineEdit(item, draft));
            const shown = (edited && previewPart?.lines.find((line) => line.id === item.id)) || item;
            const value = edited ? "finance-preview-value" : undefined;
            const needsPriceReason = Boolean(draft && priceChanged(item, draft));
            const needsDeductionReason = Boolean(draft && deductionChanged(item, draft) && deductionDiffersFromProposal(item, draft));
            const packageRefund = item.deductionSource?.type === "PREPAID_PACKAGE_V1";
            const lineErrors = Object.keys(errors).filter((key) => key.startsWith(`lines.${item.id}.`));
            // Decision 2026-10-07: quantity is Finance's call; a multi-period quantity on a receivable sold as a prepaid package is
            // only warned about, because later runs still charge it and a withdrawal does not refund it.
            const quantity = draft?.quantity ?? item.quantity;
            const multiPeriod =
              editable && item.receivableId !== null && prepaidReceivableIds.has(item.receivableId) && /^\d+$/.test(quantity) && Number(quantity) > 1;
            return (
              <Fragment key={item.id}>
                <tr className={edited ? "finance-line-edited" : undefined}>
                  <td>
                    {item.receivableName}
                    {item.sourceBadge && (
                      <>
                        {" "}
                        <span className="badge neutral" title="Nguồn">
                          {item.sourceBadge.label}
                        </span>
                        {(item.sourceBadge.flags ?? []).map((flag) => (
                          <span key={flag.code} className="badge warning">
                            {" "}
                            {flag.label}
                          </span>
                        ))}
                        {item.sourceBadge.detail && (
                          <>
                            <br />
                            <small className="muted">{item.sourceBadge.detail}</small>
                          </>
                        )}
                      </>
                    )}
                    {item.source && (
                      <small>
                        {" "}
                        Nguồn:{" "}
                        {[
                          item.source.serviceDate,
                          item.source.attendanceState,
                          item.source.pickedUpAt,
                          item.source.lateCareMinutes != null ? `${item.source.lateCareMinutes} phút` : null,
                        ]
                          .filter(Boolean)
                          .join("; ") || "Máy chủ đã ghi nhận"}
                        {item.sourceReason ? `; ${item.sourceReason}` : ""}
                      </small>
                    )}
                    {item.source && (
                      <details>
                        <summary>Thông tin nguồn và kiểm tra</summary>
                        <p>Thời điểm ghi nhận: {item.sourceRecordedAt ?? "Máy chủ không trả về"}</p>
                        <p>Nguồn đã được máy chủ xác nhận cho dòng hóa đơn này.</p>
                      </details>
                    )}
                    {item.overrideReason && !needsPriceReason && (
                      <>
                        <br />
                        <small className="muted">Lý do đổi đơn giá: {item.overrideReason}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <span className="finance-cell-unit">
                        {cell(item, "quantity", `Số lượng · ${item.receivableName}`, { className: "finance-qty-input" })}
                        <span>{item.unitLabel}</span>
                      </span>
                    ) : (
                      `${item.quantity} ${item.unitLabel}`
                    )}
                  </td>
                  <td className="finance-money">
                    {editable
                      ? cell(item, "unitPrice", `Đơn giá · ${item.receivableName}`, { className: "finance-money-input" })
                      : vnd(item.unitPrice)}
                  </td>
                  <td className={value ? `finance-money ${value}` : "finance-money"}>
                    {vnd(shown.grossAmount ?? shown.amount)}
                  </td>
                  <td className={value ? `finance-money ${value}` : "finance-money"}>
                    {vnd(shown.discountAmount ?? "0")}
                    {discountReasons(part.status, shown) && (
                      <>
                        <br />
                        <small className="muted">{discountReasons(part.status, shown)}</small>
                      </>
                    )}
                  </td>
                  <td className="finance-money">
                    {editable && (
                      <span className="finance-cell-unit finance-deduction-inputs">
                        {cell(item, "deductionQuantity", `Số lượng bớt · ${item.receivableName}`, {
                          className: "finance-qty-input",
                        })}
                        <span>×</span>
                        {cell(item, "refundUnitPrice", `Giá hoàn · ${item.receivableName}`, {
                          className: "finance-money-input",
                        })}
                      </span>
                    )}
                    <span className={value}>
                      {BigInt(shown.deductionAmount ?? "0") > 0n ? `-${vnd(shown.deductionAmount!)}` : "0"}
                    </span>
                    {BigInt(item.deductionAmount ?? "0") > 0n || item.deductionSource ? (
                      <small className="finance-deduction-detail">
                        {item.deductionSource?.type === "PREPAID_PACKAGE_V1"
                          ? `Hoàn học phí nộp trước · gói ${item.deductionSource.months} tháng ${deductionMonthLabel(item.deductionSource.firstMonth)} - ${deductionMonthLabel(item.deductionSource.lastMonth)} · đã học ${item.deductionSource.usedMonths}/${item.deductionSource.months} tháng · đã nộp ${vnd(item.deductionSource.paidNet ?? "0")} - giá gốc tháng đã học ${vnd(item.deductionSource.listPriceUsed ?? "0")}${BigInt(item.deductionSource.priorRefundNet ?? "0") > 0n ? ` - đã hoàn ${vnd(item.deductionSource.priorRefundNet!)}` : ""}`
                          : item.deductionSource?.month
                            ? `Đề xuất ${item.proposedDeductionQuantity ?? "0"} ${item.unitLabel} × ${vnd(item.deductionSource.proposedUnitPrice ?? "0")} · nghỉ có phép ${deductionMonth(item.deductionSource)}${deductionDays(item.deductionSource) ? ` (${deductionDays(item.deductionSource)})` : ""}`
                            : editable
                              ? ""
                              : `${item.deductionQuantity} ${item.unitLabel} × ${vnd(item.refundUnitPrice ?? "0")}`}
                        {item.deductionReason && !needsDeductionReason ? ` · Lý do: ${item.deductionReason}` : ""}
                      </small>
                    ) : null}
                  </td>
                  <td className={value ? `finance-money ${value}` : "finance-money"}>
                    {shown.vatRate != null ? (
                      <>
                        {vnd(shown.vatAmount ?? "0")}
                        <br />
                        <small className="muted">{shown.vatRate}%</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={value ? `finance-money ${value}` : "finance-money"}>
                    {vnd(shown.amount)}
                  </td>
                  <td>
                    {editable && (
                      <span className="finance-row-actions">
                        <button
                          type="button"
                          disabled={disabled || edited}
                          onClick={(event) => onSource(item, event.currentTarget)}
                        >
                          Nguồn
                        </button>
                        <button
                          type="button"
                          disabled={disabled || edited}
                          onClick={(event) => onRemove(item, event.currentTarget)}
                        >
                          Xóa
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
                {editable && (multiPeriod || (draft && (needsPriceReason || needsDeductionReason || lineErrors.length > 0))) && (
                  <tr className="finance-line-reasons">
                    <td colSpan={9}>
                      {multiPeriod && (
                        <p className="finance-line-warning">
                          Thu {quantity} {item.unitLabel} bằng số lượng thì các tháng sau vẫn bị thu và không được hoàn khi học
                          sinh nghỉ học. Thu nhiều tháng nên dùng gói nộp trước ở mục Quản lý ưu đãi nộp trước bên dưới.
                        </p>
                      )}
                      {needsPriceReason &&
                        cell(item, "overrideReason", `Lý do đổi đơn giá · ${item.receivableName}`, {
                          placeholder: "Lý do đổi đơn giá (bắt buộc)",
                        })}
                      {needsDeductionReason &&
                        cell(item, "deductionReason", `Lý do sửa phần bớt · ${item.receivableName}`, {
                          placeholder: "Lý do sửa phần bớt (bắt buộc khi khác số đề xuất)",
                        })}
                      {needsDeductionReason && !packageRefund && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            onDraft(item, {
                              ...(draft ?? lineDraft(item)),
                              deductionQuantity: item.proposedDeductionQuantity ?? "0",
                              refundUnitPrice: item.deductionSource?.proposedUnitPrice ?? "0",
                              deductionReason: "",
                            })
                          }
                        >
                          Dùng số đề xuất
                        </button>
                      )}
                      {errors[`lines.${item.id}.lines`] && <small role="alert">{errors[`lines.${item.id}.lines`]}</small>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {/* Last month's shortfall or overpayment on the same account is part of the server total, not a line. */}
          {(part.carries ?? []).map((carry) => (
            <tr key={`${carry.sourceDifferenceId}-${carry.type}`} className="finance-carry-row">
              <th colSpan={7} scope="row">
                {carry.type === "SHORTFALL_CARRY" ? "Khoản thu thiếu kỳ trước" : "Khoản thu thừa kỳ trước được khấu trừ"}
              </th>
              <td className="finance-money">
                {carry.type === "SHORTFALL_CARRY" ? vnd(carry.amount) : `-${vnd(carry.amount)}`}
              </td>
              <td />
            </tr>
          ))}
          <tr>
            <th colSpan={7}>{totalLabel ?? (BigInt(total) < 0n ? "Trường hoàn lại" : "Tổng cần thu")}</th>
            <th className={previewPart ? "finance-money finance-preview-value" : "finance-money"}>
              {BigInt(total) < 0n ? `Hoàn ${vnd((-BigInt(total)).toString())}` : vnd(total)}
            </th>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function FinanceWorkspace({
  schoolId,
  schoolName,
  page,
  runId,
  invoiceId,
  listSearch = "",
  denied,
  onStatusChange,
  onOpenRun,
  onBackToRuns,
  onOpenInvoice,
  onBackToRun,
  onDetailUnavailable,
  onListSearchChange,
  onOpenExtracurricularClasses,
}: {
  schoolId: string;
  schoolName: string;
  page: FinancePage;
  runId?: string;
  invoiceId?: string;
  listSearch?: string;
  denied: () => void;
  onStatusChange?: (status: FinanceStatus) => void;
  onOpenRun?: (runId: string) => void;
  onBackToRuns?: () => void;
  onOpenInvoice?: (runId: string, invoiceId: string) => void;
  onBackToRun?: (runId: string) => void;
  onDetailUnavailable?: (message: string) => void;
  onListSearchChange?: (search: string) => void;
  onOpenExtracurricularClasses?: () => void;
}) {
  void schoolName;
  const [catalog, setCatalog] = useState<Catalog>();
  const [promotionData, setPromotionData] = useState({ schoolId, policies: [] as PromotionPolicy[] });
  const [assignmentFilter, setAssignmentFilter] = useState({ q: "", officialClassId: "" });
  const [assignmentCandidates, setAssignmentCandidates] = useState<PromotionCandidates>();
  const assignmentCandidatesRequest = useRef(0);
  const [promotion, setPromotion] = useState(defaultPromotion);
  const [assignment, setAssignment] = useState({
    versionId: "",
    studentIds: [] as string[],
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  });
  const [draftCoverageVersionId, setDraftCoverageVersionId] = useState("");
  const [endingAssignment, setEndingAssignment] = useState<{ id: string; effectiveTo: string; reason: string }>();
  const [candidates, setCandidates] = useState<Candidates>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsCursor, setRunsCursor] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState(() => new URLSearchParams(listSearch).get("status") ?? "");
  const [runCursor, setRunCursor] = useState(() => new URLSearchParams(listSearch).get("cursor") ?? "");
  const [run, setRun] = useState<Run>();
  const [preview, setPreview] = useState<Preview>();
  const [generateConfirmation, setGenerateConfirmation] = useState(false);
  const [additionConfirmation, setAdditionConfirmation] = useState<Candidate>();
  const [closeConfirmation, setCloseConfirmation] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [generatedOutcome, setGeneratedOutcome] = useState<GenerateOutcome>();
  const [invoice, setInvoice] = useState<Invoice>();
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [issueConfirmation, setIssueConfirmation] = useState(false);
  const [issueBankAccountId, setIssueBankAccountId] = useState("");
  const [issueSchoolBankAccountId, setIssueSchoolBankAccountId] = useState("");
  const [revisionConfirmation, setRevisionConfirmation] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionPartId, setRevisionPartId] = useState("");
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [line, setLine] = useState(emptyInvoiceLine);
  const [lineDialog, setLineDialog] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [linePreview, setLinePreview] = useState<Invoice>();
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const previewRequest = useRef(0);
  const shownInvoiceId = invoice?.id;
  useEffect(() => setLineDrafts({}), [schoolId, shownInvoiceId]);
  const [editingLineId, setEditingLineId] = useState<string>();
  const [editingSource, setEditingSource] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<{ id: string; name: string; invoiceId: string }>();
  const [editingLineInvoiceId, setEditingLineInvoiceId] = useState<string>();
  const [open, setOpen] = useState({ schoolYearId: "", billingMonth: "" });
  const [runDialog, setRunDialog] = useState(false);
  const [invoiceQueue, setInvoiceQueue] = useState<{ runId: string; ids: string[] }>();
  const [templateDialog, setTemplateDialog] = useState<TemplateDialog>();
  const [scopeOptions, setScopeOptions] = useState<ScopeOptions>();
  const [templateRemoval, setTemplateRemoval] = useState<{ id: string; name: string }>();
  const [runClasses, setRunClasses] = useState<RunExtracurricularClass[]>();
  const [classExclusion, setClassExclusion] = useState<{
    id: string;
    name: string;
    excluded: boolean;
    reason: string;
  }>();
  const classExclusionRef = useRef<HTMLDivElement>(null);
  const templateDialogRef = useRef<HTMLDivElement>(null);
  // Scope-picker requests: a response is applied only for the latest request of the current dialog instance, run and School.
  const scopeRequest = useRef({ token: 0, instance: 0 });
  // What a command does once it succeeds; an uncertain command that later reconciles to COMPLETED runs the very same completion.
  const completion = useRef<((outcome: unknown) => Promise<void>) | undefined>(undefined);
  const runClassesRequest = useRef(0);
  const removalDialogRef = useRef<HTMLDivElement>(null);
  const [receivable, setReceivable] = useState({
    kind: "" as ReceivableKind | "",
    code: "",
    displayName: "",
    unitLabel: "",
    defaultUnitPrice: "",
    refundUnitPrice: "0",
    autoLeaveDeduction: false,
    taxCategory: "NOT_DECLARED" as TaxCategory,
  });
  const [settlements, setSettlements] = useState<{ runId: string; students: Settlement[] }>();
  const [priorDebts, setPriorDebts] = useState<{ runId: string; total: string; debts: PriorDebt[] }>();
  const [priorDebtConfirmation, setPriorDebtConfirmation] = useState<{ debts: PriorDebt[]; total: string }>();
  const [lifecycle, setLifecycle] = useState<Lifecycle>();
  const [catalogDialog, setCatalogDialog] = useState<"receivable" | "receivable-edit">();
  const [receivableEdit, setReceivableEdit] = useState<{
    id: string;
    title: string;
    values: ReceivableEditValues;
    original: ReceivableEditValues;
    locked: boolean;
    classNames: string[];
    reason: string;
  }>();
  const [catalogFilter, setCatalogFilter] = useState({ search: "", kind: "", status: "" });
  const [catalogFilterApplied, setCatalogFilterApplied] = useState({ search: "", kind: "", status: "" });
  const [promotionDialog, setPromotionDialog] = useState<"policy" | "assignment">();
  const [promotionTransition, setPromotionTransition] = useState<{
    id: string;
    name: string;
    action: "activate" | "retire";
  }>();
  const [message, setMessage] = useState("");
  // Success confirmations stay out of the error alert so a completed issue never reads as a failure.
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"receivable" | "invoice" | "lifecycle" | "promotion" | "run">("receivable");
  const [pending, setPending] = useState<Pending>();
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>();
  const activeSchool = useRef(schoolId);
  const activeRunId = useRef<string | undefined>(undefined);
  const activePage = useRef(page);
  const activeRouteRunId = useRef(runId);
  activePage.current = page;
  activeRouteRunId.current = runId;
  const summary = useRef<HTMLDivElement>(null);
  const removeDialog = useRef<HTMLDivElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const issueDialog = useRef<HTMLDivElement>(null);
  const issueTrigger = useRef<HTMLButtonElement>(null);
  const revisionDialog = useRef<HTMLDivElement>(null);
  const revisionTrigger = useRef<HTMLButtonElement>(null);
  const discardDialog = useRef<HTMLDivElement>(null);
  const discardTrigger = useRef<HTMLButtonElement>(null);
  const closeDialog = useRef<HTMLDivElement>(null);
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const catalogDialogRef = useRef<HTMLDivElement>(null);
  const runDialogRef = useRef<HTMLDivElement>(null);
  const promotionDialogRef = useRef<HTMLDivElement>(null);
  const lifecycleDialog = useRef<HTMLDivElement>(null);
  const rowMenuTrigger = useRef<HTMLButtonElement>(null);
  const closedHeading = useRef<HTMLHeadingElement>(null);
  const invoiceReview = useRef<HTMLElement>(null);
  const addStudentsTrigger = useRef<HTMLButtonElement>(null);
  const addStudentsDialog = useRef<HTMLDivElement>(null);
  const status = useRef(onStatusChange);
  const submitting = useRef(false);
  const request = useRef(0);
  const invoiceRequest = useRef(0);
  const reconciliationTimer = useRef<number | undefined>(undefined);
  const promotionPolicies = promotionData.schoolId === schoolId ? promotionData.policies : [];
  const activeAssignment = (item: PromotionPolicy["versions"][number]["assignments"][number]) => item.isCurrent;
  const promotionVersions = promotionPolicies.flatMap((policy) =>
    (policy.versions ?? []).map((version) => ({ policy, version })),
  );
  const prepaidReceivableIds = new Set(
    promotionVersions
      .filter(({ version }) => version.status === "ACTIVE" && version.fulfillmentMode === "PREPAID_COVERAGE")
      .flatMap(({ version }) => version.targets.map((target) => target.receivableId)),
  );
  const currentAssignments = promotionVersions.flatMap(({ policy, version }) =>
    (version.assignments ?? []).filter(activeAssignment).map((item) => ({ policy, version, item })),
  );
  const resetReceivable = () =>
    setReceivable({
      kind: "",
      code: "",
      displayName: "",
      unitLabel: "",
      defaultUnitPrice: "",
      refundUnitPrice: "0",
      autoLeaveDeduction: false,
      taxCategory: "NOT_DECLARED",
    });
  const resetPromotion = () => setPromotion(defaultPromotion());

  const get = async <T,>(path: string, mutation = false) => {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      headers: mutation ? { "x-csrf-token": decodeURIComponent(csrf() ?? "") } : undefined,
    });
    if ([401, 403].includes(response.status)) {
      // A run selected by the URL must return to its safe list route, not clear the School shell.
      if (runId && path.endsWith(`/collection-runs/${runId}`)) throw new Error("Không thể mở đợt thu này.");
      denied();
      throw new Error();
    }
    if (!response.ok) throw new Error("Không thể tải dữ liệu Finance.");
    return ((await response.json()) as { data: T }).data;
  };
  const runsPath = (cursor?: string | null) =>
    `/api/app/schools/${schoolId}/finance/collection-runs?limit=25${runStatus ? `&status=${encodeURIComponent(runStatus)}` : ""}${(cursor ?? runCursor) ? `&cursor=${encodeURIComponent(cursor ?? runCursor)}` : ""}`;
  const load = async () => {
    const token = ++request.current;
    const nextCatalog = await get<Catalog>(`/api/app/schools/${schoolId}/finance/receivables`);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setCatalog(nextCatalog);
    if (activePage.current === "receivables") return;
    if (activePage.current === "promotions") {
      const nextPolicies = await get<{ policies: PromotionPolicy[] }>(
        `/api/app/schools/${schoolId}/finance/promotion-policies`,
      );
      if (activeSchool.current === schoolId && token === request.current)
        setPromotionData({ schoolId, policies: nextPolicies.policies ?? [] });
      return;
    }
    if (activeRouteRunId.current) {
      const [nextPolicies, selectedRun] = await Promise.all([
        get<{ policies: PromotionPolicy[] }>(`/api/app/schools/${schoolId}/finance/promotion-policies`),
        get<Run>(`/api/app/schools/${schoolId}/finance/collection-runs/${activeRouteRunId.current}`),
      ]);
      if (activeSchool.current !== schoolId || token !== request.current || activeRouteRunId.current !== selectedRun.id)
        return;
      setPromotionData({ schoolId, policies: nextPolicies.policies ?? [] });
      chooseRun(selectedRun);
      return;
    }
    const [nextPolicies, nextRuns] = await Promise.all([
      get<{ policies: PromotionPolicy[] }>(`/api/app/schools/${schoolId}/finance/promotion-policies`),
      get<{ runs: Run[]; meta: { nextCursor: string | null } }>(runsPath()),
    ]);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setRuns(nextRuns.runs);
    setRunsCursor(nextRuns.meta?.nextCursor ?? null);
    setPromotionData({ schoolId, policies: nextPolicies.policies ?? [] });
  };
  const loadBankAccounts = async () => {
    const next = await get<{ accounts: BankAccount[] }>(`/api/app/schools/${schoolId}/finance/bank-accounts`);
    const accounts = next?.accounts ?? [];
    if (activeSchool.current === schoolId) setBankAccounts(accounts);
    return accounts;
  };
  const loadSettlements = async (runId: string) => {
    const next = await get<{ students: Settlement[] }>(
      `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/settlements`,
    );
    if (activeSchool.current === schoolId && activeRunId.current === runId)
      setSettlements({ runId, students: Array.isArray(next?.students) ? next.students : [] });
  };
  const loadPriorDebts = async (runId: string) => {
    const next = await get<{ total?: string; debts: PriorDebt[] }>(
      `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/prior-debts`,
    );
    if (activeSchool.current === schoolId && activeRunId.current === runId)
      setPriorDebts({ runId, total: typeof next?.total === "string" ? next.total : "0", debts: Array.isArray(next?.debts) ? next.debts : [] });
  };
  const createSettlement = async (student: Settlement) => {
    if (!run) return;
    const runId = run.id;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/settlements`,
      "POST",
      { studentId: student.studentId },
      "run",
    );
    if (outcome) {
      try {
        await refreshRun(runId);
        await loadSettlements(runId);
      } catch {
        setMessage("Đã tạo hóa đơn quyết toán; chưa thể tải lại đợt thu mới nhất.");
      }
      reviewInvoice((outcome as Invoice).id);
    }
  };
  const loadGeneratedStudents = async (runId: string) => {
    const loaded: Candidate[] = [];
    let cursor: string | null = null;
    do {
      const next: { students: Candidate[]; meta: { nextCursor: string | null } } = await get(
        `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/addable-students?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      loaded.push(...next.students);
      cursor = next.meta.nextCursor;
    } while (cursor);
    if (activeSchool.current === schoolId && activeRunId.current === runId)
      setCandidates((current) => ({ schoolYears: current?.schoolYears ?? [], students: loaded }));
  };
  const loadMoreRuns = async () => {
    if (!runsCursor) return;
    const token = ++request.current;
    setInvoiceQueue(undefined);
    const next = await get<{ runs: Run[]; meta: { nextCursor: string | null } }>(runsPath(runsCursor));
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setRuns((current) => [...current, ...next.runs]);
    setRunsCursor(next.meta?.nextCursor ?? null);
  };
  const refreshRun = async (runId: string) => {
    const token = ++request.current;
    setInvoiceQueue(undefined);
    const refreshedRun = await get<Run>(`/api/app/schools/${schoolId}/finance/collection-runs/${runId}`);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    if (!activeRouteRunId.current) {
      const next = await get<{ runs: Run[]; meta: { nextCursor: string | null } }>(runsPath());
      if (activeSchool.current !== schoolId || token !== request.current) return;
      setRuns(next.runs);
      setRunsCursor(next.meta?.nextCursor ?? null);
    }
    chooseRun(refreshedRun);
    return refreshedRun;
  };
  const reconcile = async (operation: Pending) => {
    if (operation.schoolId !== activeSchool.current) return;
    const token = ++request.current;
    setPending(operation);
    try {
      const result = await get<OperationResult>(
        `/api/app/schools/${operation.schoolId}/finance/operations/${operation.id}`,
      );
      if (activeSchool.current !== operation.schoolId || token !== request.current) return;
      if (result.status === "PENDING") {
        if (result.progress) setGenerationProgress(result.progress);
        reconciliationTimer.current = window.setTimeout(() => void reconcile(operation), 750);
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      setGenerationProgress(result.progress ?? undefined);
      submitting.current = false;
      if (result.status === "COMPLETED") {
        setMessage("");
        const generated = result.outcome as GenerateOutcome | undefined;
        if (generated?.created) {
          setGeneratedOutcome(generated);
          try {
            await refreshRun(generated.run.id);
          } catch {
            chooseRun(generated.run);
            setMessage("Đã tạo hóa đơn; chưa thể tải lại đợt thu mới nhất.");
          }
        }
        if ((result.outcome as Invoice | undefined)?.lines) applyInvoice(result.outcome as Invoice);
        if (["DRAFT", "READY", "GENERATED", "CLOSED"].includes((result.outcome as Run | undefined)?.status ?? ""))
          chooseRun(result.outcome as Run);
        if ((result.outcome as Run | undefined)?.status === "CLOSED") {
          chooseRun(result.outcome as Run);
          setCloseConfirmation(false);
          setCloseReason("");
        }
        try {
          await load();
        } catch {
          setMessage("Thao tác đã hoàn tất; chưa thể tải lại dữ liệu mới nhất.");
        }
        const done = completion.current;
        completion.current = undefined;
        if (done) await done(result.outcome);
      } else {
        completion.current = undefined;
        setMessage("Thao tác không thành công.");
      }
    } catch {
      if (activeSchool.current === operation.schoolId && token === request.current)
        setMessage("Kết quả chưa chắc chắn. Đang kiểm tra kết quả với hệ thống trước khi thử lại.");
    }
  };
  const applyInvoice = (next: Invoice) => {
    setInvoice(next);
    const parts = next.notice?.invoices?.length ? next.notice.invoices : [next];
    const patch = (item: Run) => ({
      ...item,
      invoices: (item.invoices ?? []).map((candidate) => {
        const part = parts.find((value) => value.id === candidate.id);
        return part ? { ...candidate, total: part.total, status: part.status } : candidate;
      }),
    });
    setRun((current) => (current ? patch(current) : current));
    setRuns((current) => current.map(patch));
  };
  // Issue pre-selects the Class default School and personal accounts; the only School account is selected without a default.
  const draftInvoiceKey =
    invoice?.status === "DRAFT"
      ? `${invoice.id}:${invoice.notice?.classDefaultBankAccountId ?? ""}:${invoice.notice?.classDefaultSchoolBankAccountId ?? ""}`
      : "";
  useEffect(() => {
    if (!draftInvoiceKey || !invoice) return;
    const expected = schoolId;
    void loadBankAccounts()
      .then((accounts) => {
        if (activeSchool.current !== expected) return;
        const fallback = invoice.notice?.classDefaultBankAccountId;
        setIssueBankAccountId((current) =>
          current && accounts.some((account) => account.id === current)
            ? current
            : accounts.some((account) => account.id === fallback && (account.kind ?? "PERSONAL") === "PERSONAL")
              ? fallback!
              : "",
        );
        const school = accounts.filter((account) => account.kind === "SCHOOL");
        const schoolFallback = invoice.notice?.classDefaultSchoolBankAccountId;
        setIssueSchoolBankAccountId((current) =>
          current && school.some((account) => account.id === current)
            ? current
            : school.some((account) => account.id === schoolFallback)
              ? schoolFallback!
              : school.length === 1
                ? school[0]!.id
                : "",
        );
      })
      .catch(() => undefined);
  }, [draftInvoiceKey]);
  // A line command may answer with another part of the same notice; keep the opened part on screen.
  const applyNoticeOutcome = async (next: Invoice) => {
    if (!invoice || next.id === invoice.id) {
      applyInvoice(next);
      return;
    }
    const opened = next.notice?.invoices?.find((part) => part.id === invoice.id);
    applyInvoice(opened ? { ...opened, notice: next.notice } : next);
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    submitting.current = false;
    ++request.current;
    if (reconciliationTimer.current) window.clearTimeout(reconciliationTimer.current);
    setCatalog(undefined);
    setPromotionData({ schoolId, policies: [] });
    setPromotion(defaultPromotion());
    setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" });
    setDraftCoverageVersionId("");
    setEndingAssignment(undefined);
    setCandidates(undefined);
    setRuns([]);
    setRunsCursor(null);
    setRunStatus("");
    setRun(undefined);
    activeRunId.current = undefined;
    setPreview(undefined);
    setGenerateConfirmation(false);
    setAddStudentsOpen(false);
    setAdditionConfirmation(undefined);
    setCloseConfirmation(false);
    setCloseReason("");
    setGeneratedOutcome(undefined);
    setInvoice(undefined);
    setBankAccounts([]);
    setIssueConfirmation(false);
    setIssueBankAccountId("");
    setRevisionConfirmation(false);
    setRevisionReason("");
    resetLineForm();
    setLineDialog(false);
    setOpen({ schoolYearId: "", billingMonth: "" });
    setRunDialog(false);
    setInvoiceQueue(undefined);
    setTemplateDialog(undefined);
    setTemplateRemoval(undefined);
    setClassExclusion(undefined);
    setRunClasses(undefined);
    resetReceivable();
    setReceivableEdit(undefined);
    setLifecycle(undefined);
    setCatalogDialog(undefined);
    setPromotionDialog(undefined);
    setPromotionTransition(undefined);
    setErrors({});
    setMessage("");
    setNotice("");
    setGenerationProgress(undefined);
    const saved = sessionStorage.getItem(pendingKey);
    if (saved)
      try {
        const operation = JSON.parse(saved) as Pending;
        if (uuid.test(operation.id) && operation.schoolId === schoolId) void reconcile(operation);
        else sessionStorage.removeItem(pendingKey);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    return () => {
      ++request.current;
      if (reconciliationTimer.current) window.clearTimeout(reconciliationTimer.current);
    };
  }, [schoolId]);
  useEffect(() => {
    const nextStatus = new URLSearchParams(listSearch).get("status") ?? "";
    if (nextStatus !== runStatus) setRunStatus(nextStatus);
    const nextCursor = new URLSearchParams(listSearch).get("cursor") ?? "";
    if (nextCursor !== runCursor) setRunCursor(nextCursor);
  }, [listSearch]);
  useEffect(() => {
    setRun(undefined);
    setPreview(undefined);
    setInvoice(undefined);
    setInvoiceQueue(undefined);
  }, [runId]);
  useEffect(() => {
    if (!onOpenInvoice) return;
    if (!invoiceId) {
      setInvoice(undefined);
      setInvoiceQueue(undefined);
      return;
    }
    // The URL only selects; the server re-authorizes the Invoice and a denial returns to its run.
    if (run && run.id === runId)
      void openInvoice(invoiceId, run).then((opened) => {
        if (!opened) onBackToRun?.(run.id);
      });
  }, [invoiceId, run?.id]);
  useEffect(() => {
    if (!pending)
      void load().catch((error: Error) => {
        if (activeSchool.current !== schoolId) return;
        setRun(undefined);
        setPreview(undefined);
        setInvoice(undefined);
        if (runId && onDetailUnavailable)
          onDetailUnavailable("Không thể mở đợt thu này. Vui lòng kiểm tra lại danh sách đợt thu.");
        else setMessage(error.message);
      });
  }, [schoolId, page, runId]);
  const dirty = Boolean(
    open.schoolYearId ||
    open.billingMonth ||
    receivable.kind ||
    receivable.code ||
    receivable.displayName ||
    receivable.unitLabel ||
    receivable.defaultUnitPrice ||
    lifecycle?.reason ||
    templateDialog?.receivableId ||
    promotion.name ||
    promotion.receivableIds.length ||
    promotion.discountValue ||
    assignment.studentIds.length ||
    assignment.reason ||
    endingAssignment?.reason,
  );
  useEffect(() => {
    status.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    status.current?.({
      dirty,
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending]);
  useLayoutEffect(() => {
    const firstError = Object.keys(errors)[0];
    const field = firstError && document.getElementById(`invoice-${scope}-${firstError}-field`);
    if (field instanceof HTMLElement) field.focus();
    else if (message || firstError) summary.current?.focus();
  }, [message, errors]);
  useEffect(() => {
    if (removeConfirmation) removeDialog.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    else removeTrigger.current?.focus();
  }, [removeConfirmation]);
  useEffect(() => {
    if (issueConfirmation) issueDialog.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    else issueTrigger.current?.focus();
  }, [issueConfirmation]);
  useEffect(() => {
    if (revisionConfirmation) revisionDialog.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    else revisionTrigger.current?.focus();
  }, [revisionConfirmation]);
  useEffect(() => {
    if (discardConfirmation) discardDialog.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    else discardTrigger.current?.focus();
  }, [discardConfirmation]);
  useEffect(() => {
    if (closeConfirmation) closeDialog.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    else closeTrigger.current?.focus();
  }, [closeConfirmation]);
  useEffect(() => {
    if (addStudentsOpen) addStudentsDialog.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [addStudentsOpen]);
  useEffect(() => {
    if (!invoice?.id) return;
    if (onOpenInvoice) document.getElementById("invoice-review-title")?.focus();
    else invoiceReview.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [invoice?.id]);
  useLayoutEffect(() => {
    if (run?.status === "CLOSED" && !closeConfirmation) closedHeading.current?.focus();
  }, [run?.status, closeConfirmation]);
  useEffect(() => {
    if (!catalog) return;
    void load().catch((error: Error) => activeSchool.current === schoolId && setMessage(error.message));
  }, [runStatus]);
  useEffect(() => {
    const dialog = catalogDialog ? catalogDialogRef.current : promotionDialog ? promotionDialogRef.current : undefined;
    dialog
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
      )
      ?.focus();
  }, [catalogDialog, promotionDialog]);
  const runRef = useRef<string | undefined>(undefined);
  runRef.current = run?.id;
  // Switching run or School, or closing the dialog, supersedes every in-flight scope request.
  useEffect(() => {
    scopeRequest.current.instance += 1;
    scopeRequest.current.token += 1;
    setScopeOptions(undefined);
  }, [run?.id, schoolId]);
  useEffect(() => {
    if (templateDialog) return;
    scopeRequest.current.instance += 1;
    scopeRequest.current.token += 1;
    setScopeOptions(undefined);
  }, [Boolean(templateDialog)]);
  useEffect(() => {
    runClassesRequest.current += 1;
    setRunClasses(undefined);
    if (run?.status === "DRAFT") void loadRunClasses(run.id);
  }, [run?.id, run?.status]);
  useEffect(() => {
    if (templateDialog && templateDialog.lineId === undefined)
      templateDialogRef.current?.querySelector<HTMLElement>("select")?.focus();
    else if (templateDialog) templateDialogRef.current?.querySelector<HTMLElement>("input:not([disabled])")?.focus();
  }, [Boolean(templateDialog), templateDialog?.lineId]);
  useEffect(() => {
    if (templateRemoval) removalDialogRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [Boolean(templateRemoval)]);
  useEffect(() => {
    if (runDialog) runDialogRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
  }, [runDialog]);
  useEffect(() => {
    if (!runDialog || open.schoolYearId || !catalog?.schoolYears?.length) return;
    const today = todayInVietnam();
    const current = catalog.schoolYears.find((year) => year.startsOn <= today && year.endsOn >= today && !year.closedAt);
    const sole = catalog.schoolYears.length === 1 ? catalog.schoolYears[0] : undefined;
    if (current ?? sole) setOpen((value) => ({ ...value, schoolYearId: (current ?? sole)!.id }));
  }, [runDialog, open.schoolYearId, catalog?.schoolYears]);
  useEffect(() => {
    if (promotionTransition) document.querySelector<HTMLElement>("#finance-promotion-transition-confirm")?.focus();
  }, [promotionTransition]);
  const closeAddStudents = () => {
    setAddStudentsOpen(false);
    addStudentsTrigger.current?.focus();
  };
  const trapDialogFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea, button")].filter(
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
  const closeManagedDialog = (close: () => void) => {
    close();
    if (dialogTrigger.current?.isConnected) dialogTrigger.current.focus();
    dialogTrigger.current = null;
  };
  const openManagedDialog = (trigger: HTMLButtonElement, open: () => void) => {
    dialogTrigger.current = trigger;
    open();
  };
  const closeNewDialog = (close: () => void, reset: () => void) => {
    if (pending) return;
    setErrors({});
    reset();
    closeManagedDialog(close);
  };
  const handleManagedDialogKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    close: () => void,
    reset: () => void = () => {},
  ) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      closeNewDialog(close, reset);
      return;
    }
    trapDialogFocus(event);
  };
  const command = async (path: string, method: "POST" | "PUT" | "DELETE", body: object, nextScope?: typeof scope) => {
    if (submitting.current || pending) return undefined;
    const token = ++request.current;
    setInvoiceQueue(undefined);
    submitting.current = true;
    const operation = { id: crypto.randomUUID(), schoolId };
    setMessage("");
    setErrors({});
    if (nextScope) setScope(nextScope);
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          "idempotency-key": crypto.randomUUID(),
          "x-operation-id": operation.id,
        },
        body: JSON.stringify(body),
      });
      if ([401, 403].includes(response.status)) {
        denied();
        return undefined;
      }
      if (uncertain(response.status)) {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        if (activeSchool.current === schoolId && token === request.current) {
          setPending(operation);
          setMessage("Kết quả chưa chắc chắn. Đang kiểm tra kết quả với hệ thống trước khi thử lại.");
          void reconcile(operation);
        }
        return undefined;
      }
      if (!response.ok) {
        completion.current = undefined;
        const error = (
          (await response.json()) as {
            error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
          }
        ).error;
        if (activeSchool.current === schoolId && token === request.current) {
          setErrors(error?.fieldErrors ?? {});
          if (error?.code === "PROMOTION_REVIEW_REQUIRED") {
            setIssueConfirmation(false);
            setIssueBankAccountId("");
            void openInvoice(path.match(/\/invoices\/([^/]+)/)?.[1] ?? "");
          }
          setMessage(error?.message ?? "Thao tác không thành công.");
        }
        return undefined;
      }
      const result = ((await response.json()) as { data: OperationResult }).data;
      if (activeSchool.current !== schoolId || token !== request.current) return undefined;
      if (result.status === "PENDING") {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        setGenerationProgress(result.progress ?? undefined);
        setGenerateConfirmation(false);
        setMessage("Máy chủ đang tạo hóa đơn nháp. Đang kiểm tra kết quả với hệ thống.");
        void reconcile(operation);
        return undefined;
      }
      return result.status === "FAILED" ? undefined : result.outcome;
    } catch {
      sessionStorage.setItem(pendingKey, JSON.stringify(operation));
      if (activeSchool.current === schoolId && token === request.current) {
        setPending(operation);
        setMessage("Kết nối bị gián đoạn. Đang kiểm tra kết quả với hệ thống trước khi thử lại.");
        void reconcile(operation);
      }
      return undefined;
    } finally {
      if (!pending) submitting.current = false;
    }
  };
  const chooseRun = (next: Run) => {
    setInvoiceQueue(undefined);
    const normalized = { ...next, templateLines: next.templateLines ?? [], invoices: next.invoices ?? [] };
    activeRunId.current = normalized.id;
    setRun(normalized);
    setPreview(undefined);
    if (normalized.status === "GENERATED") {
      void loadGeneratedStudents(normalized.id).catch(() =>
        setMessage("Không thể tải học sinh để thêm vào đợt đã tạo."),
      );
      void loadSettlements(normalized.id).catch(() => setMessage("Không thể tải danh sách học sinh cần quyết toán."));
      void loadPriorDebts(normalized.id).catch(() => setMessage("Không thể tải công nợ kỳ trước."));
    } else {
      setSettlements(undefined);
      setPriorDebts(undefined);
    }
  };
  const openRun = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs`, "POST", open, "run");
    if (outcome) {
      setOpen({ schoolYearId: "", billingMonth: "" });
      closeManagedDialog(() => setRunDialog(false));
      onOpenRun?.((outcome as Run).id);
      if (!onOpenRun) chooseRun(outcome as Run);
      await load();
    }
  };
  const templateBase = () => `/api/app/schools/${schoolId}/finance/collection-runs/${run!.id}`;
  const fetchScopeOptions = (query: string, officialClassId = "") => {
    if (!run) return;
    const scopeSchool = schoolId,
      scopeRun = run.id,
      instance = scopeRequest.current.instance,
      token = ++scopeRequest.current.token;
    void get<ScopeOptions>(
      `/api/app/schools/${scopeSchool}/finance/collection-runs/${scopeRun}/scope-options${(() => {
        const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(officialClassId ? { officialClassId } : {}) });
        return params.toString() ? `?${params}` : "";
      })()}`,
    )
      .then((options) => {
        if (
          activeSchool.current === scopeSchool &&
          runRef.current === scopeRun &&
          scopeRequest.current.instance === instance &&
          scopeRequest.current.token === token
        )
          setScopeOptions(options);
      })
      .catch(() => undefined);
  };
  const openTemplateDialog = (trigger: HTMLButtonElement | null, line?: TemplateLine) => {
    if (!run) return;
    setErrors({});
    setScopeOptions(undefined);
    scopeRequest.current.instance += 1;
    if (trigger) dialogTrigger.current = trigger;
    setTemplateDialog(
      line
        ? {
            lineId: line.id,
            receivableId: line.receivableId,
            name: line.receivableName,
            kind: line.kind ?? null,
            quantity: line.quantity,
            scopeType: line.scope?.type ?? "ALL",
            classIds: (line.scope?.classes ?? []).map((item) => item.id),
            students: (line.scope?.students ?? []).map((item) => ({
              id: item.id,
              label: `${item.studentCode} · ${item.fullName}`,
            })),
            search: "",
            officialClassId: "",
          }
        : {
            receivableId: "",
            name: "",
            kind: null,
            quantity: "1",
            scopeType: "ALL",
            classIds: [],
            students: [],
            search: "",
            officialClassId: "",
          },
    );
    fetchScopeOptions("");
  };
  const closeTemplateDialog = () =>
    closeNewDialog(
      () => setTemplateDialog(undefined),
      () => {},
    );
  const filterScopeStudents = (filter: { search: string; officialClassId: string }) => {
    setTemplateDialog((current) => current && { ...current, ...filter });
    fetchScopeOptions(filter.search, filter.officialClassId);
  };
  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!run || !templateDialog) return;
    const dialog = templateDialog;
    const scope =
      dialog.kind === "FIXED"
        ? { type: "ALL" }
        : dialog.scopeType === "CLASSES"
          ? { type: "CLASSES", classIds: dialog.classIds }
          : dialog.scopeType === "STUDENTS"
            ? { type: "STUDENTS", studentIds: dialog.students.map((item) => item.id) }
            : { type: "ALL" };
    const outcome = await command(
      `${templateBase()}/template-lines`,
      "PUT",
      { receivableId: dialog.receivableId, quantity: dialog.quantity, scope, expectedVersion: run.version },
      "run",
    );
    if (outcome) {
      closeManagedDialog(() => setTemplateDialog(undefined));
      chooseRun(outcome as Run);
      setPreview(undefined);
      await load();
    }
  };
  const removeTemplate = async () => {
    if (!run || !templateRemoval) return;
    const outcome = await command(
      `${templateBase()}/template-lines/${templateRemoval.id}`,
      "DELETE",
      { expectedVersion: run.version },
      "run",
    );
    if (outcome) {
      closeManagedDialog(() => setTemplateRemoval(undefined));
      chooseRun(outcome as Run);
      setPreview(undefined);
      await load();
    }
  };
  const loadRunClasses = async (runId: string) => {
    const token = ++runClassesRequest.current;
    try {
      const data = await get<{ classes: RunExtracurricularClass[] }>(
        `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/extracurricular-classes`,
      );
      if (activeSchool.current === schoolId && runRef.current === runId && runClassesRequest.current === token)
        setRunClasses(data.classes);
    } catch {
      /* the section keeps its last result */
    }
  };
  const completeClassExclusion = async (outcome: unknown) => {
    closeManagedDialog(() => setClassExclusion(undefined));
    chooseRun(outcome as Run);
    setPreview(undefined);
    await loadRunClasses((outcome as Run).id);
    await load();
  };
  const saveClassExclusion = async (event: FormEvent) => {
    event.preventDefault();
    if (!run || !classExclusion) return;
    completion.current = completeClassExclusion;
    const outcome = await command(
      `${templateBase()}/extracurricular-classes/${classExclusion.id}/exclusion`,
      "PUT",
      {
        excluded: classExclusion.excluded,
        ...(classExclusion.reason.trim() ? { reason: classExclusion.reason.trim() } : {}),
        expectedVersion: run.version,
      },
      "run",
    );
    if (outcome) {
      completion.current = undefined;
      await completeClassExclusion(outcome);
    }
  };
  const loadPreview = async () => {
    if (!run) return;
    const runId = run.id;
    const token = ++request.current;
    setMessage("");
    setPreview(undefined);
    try {
      const next = await get<Preview>(`/api/app/schools/${schoolId}/finance/collection-runs/${runId}/preview`, true);
      if (activeSchool.current === schoolId && token === request.current && runId === run.id) setPreview(next);
    } catch {
      if (activeSchool.current === schoolId && token === request.current) {
        setPreview(undefined);
        setMessage("Không thể tạo bản xem trước.");
      }
    }
  };
  const ready = async () => {
    if (!run || !preview) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/ready`, "POST", {
      previewFingerprint: preview.fingerprint,
    });
    if (outcome) {
      try {
        await refreshRun((outcome as Run).id);
      } catch {
        chooseRun(outcome as Run);
        setMessage("Đợt thu đã sẵn sàng; chưa thể tải lại tổng quan mới nhất.");
      }
      await load();
    }
  };
  const generate = async () => {
    if (!run) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/generate`,
      "POST",
      {},
    );
    if (outcome) {
      setGenerateConfirmation(false);
      setGeneratedOutcome(outcome as GenerateOutcome);
      // The generation Operation's run snapshot predates its newly written invoices.
      // Reload the selected run before exposing its server-authorized review rows.
      const generatedRun = (outcome as GenerateOutcome).run;
      try {
        await refreshRun(generatedRun.id);
      } catch {
        chooseRun(generatedRun);
        setMessage("Đã tạo hóa đơn; chưa thể tải lại đợt thu mới nhất.");
      }
    }
  };
  const addGeneratedStudent = async () => {
    if (!run || !additionConfirmation) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/generated-students`,
      "POST",
      { studentId: additionConfirmation.id },
    );
    if (outcome) {
      setAdditionConfirmation(undefined);
      setGeneratedOutcome(outcome as GenerateOutcome);
      await load();
    }
  };
  const transferPriorDebts = async () => {
    if (!run || !priorDebtConfirmation) return;
    const count = priorDebtConfirmation.debts.length;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/prior-debts/transfer`,
      "POST",
      { sourceInvoiceIds: priorDebtConfirmation.debts.map((debt) => debt.sourceInvoiceId) },
    );
    if (outcome) {
      setPriorDebtConfirmation(undefined);
      try {
        await refreshRun(run.id);
        setNotice(`Đã chuyển công nợ của ${count} hóa đơn.`);
      } catch {
        setMessage("Đã chuyển công nợ; chưa thể tải lại đợt thu mới nhất.");
      }
    }
  };
  const closeRun = async () => {
    if (!run) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/close`,
      "POST",
      { reason: closeReason },
      "lifecycle",
    );
    if (outcome) {
      setCloseConfirmation(false);
      setCloseReason("");
      chooseRun(outcome as Run);
      try {
        await load();
      } catch {
        setMessage("Đợt thu đã đóng; chưa thể tải lại dữ liệu mới nhất.");
      }
    }
  };
  // Decision 2026-10-02 §3.5, amended 2026-10-06: one audited edit command carries every changed field, so a refusal (for example
  // a locked kind) saves nothing; the kind is only sent while it can still change.
  const editReceivable = (values: Partial<ReceivableEditValues>) =>
    setReceivableEdit((current) => current && { ...current, values: { ...current.values, ...values } });
  const saveReceivableEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!receivableEdit) return;
    const changed = receivableEditChanges(receivableEdit);
    if (!Object.keys(changed).length) return;
    if (!receivableEdit.reason.trim()) {
      setScope("receivable");
      setErrors({ reason: "Cần nhập lý do khi sửa khoản thu." });
      return;
    }
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/receivables/${receivableEdit.id}`,
        "PUT",
        { ...changed, reason: receivableEdit.reason },
        "receivable",
      )
    ) {
      closeManagedDialog(() => {
        setCatalogDialog(undefined);
        setReceivableEdit(undefined);
      });
      await load();
    }
  };
  const saveReceivable = async (event: FormEvent) => {
    event.preventDefault();
    if (await command(`/api/app/schools/${schoolId}/finance/receivables`, "POST", receivable, "receivable")) {
      resetReceivable();
      closeManagedDialog(() => setCatalogDialog(undefined));
      await load();
    }
  };
  const saveLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!lifecycle) return;
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/${lifecycle.kind}/${lifecycle.id}/lifecycle`,
        "POST",
        { status: lifecycle.next, reason: lifecycle.reason },
        "lifecycle",
      )
    ) {
      closeManagedDialog(() => setLifecycle(undefined));
      await load();
    }
  };
  const savePromotion = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/promotion-policies`,
      "POST",
      {
        ...promotion,
        policyId: promotion.policyId || null,
        effectiveTo: promotion.effectiveTo || null,
        prepaidTermMonths:
          promotion.fulfillmentMode === "PREPAID_COVERAGE" ? Number(promotion.prepaidTermMonths) : null,
      },
      "promotion",
    );
    if (outcome) {
      resetPromotion();
      closeManagedDialog(() => setPromotionDialog(undefined));
      await load();
    }
  };
  // Decision 2026-10-06: the picker reads server-filtered candidates (School year of the start date, official class, search) with an
  // "already assigned" flag; the selection survives filter changes, and Students the server now flags drop out of it.
  useEffect(() => {
    if (promotionDialog !== "assignment" || !assignment.versionId) return;
    const token = ++assignmentCandidatesRequest.current;
    const params = new URLSearchParams({ versionId: assignment.versionId });
    if (assignmentFilter.q.trim()) params.set("q", assignmentFilter.q.trim());
    if (assignmentFilter.officialClassId) params.set("officialClassId", assignmentFilter.officialClassId);
    if (assignment.effectiveFrom) params.set("effectiveFrom", assignment.effectiveFrom);
    if (assignment.effectiveTo) params.set("effectiveTo", assignment.effectiveTo);
    setAssignmentCandidates(undefined);
    get<PromotionCandidates>(`/api/app/schools/${schoolId}/finance/promotion-students?${params}`)
      .then((data) => {
        if (activeSchool.current !== schoolId || token !== assignmentCandidatesRequest.current) return;
        setAssignmentCandidates(data);
        const taken = new Set(data.students.filter((item) => item.assigned).map((item) => item.id));
        setAssignment((current) => ({ ...current, studentIds: current.studentIds.filter((id) => !taken.has(id)) }));
      })
      .catch((error: Error) => {
        if (activeSchool.current === schoolId && token === assignmentCandidatesRequest.current) setMessage(error.message);
      });
  }, [
    promotionDialog,
    schoolId,
    assignment.versionId,
    assignment.effectiveFrom,
    assignment.effectiveTo,
    assignmentFilter.q,
    assignmentFilter.officialClassId,
  ]);
  const saveAssignments = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignment.versionId) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/promotion-policy-versions/${assignment.versionId}/assignments`,
      "POST",
      { ...assignment, effectiveTo: assignment.effectiveTo || null },
      "promotion",
    );
    if (outcome) {
      setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" });
      closeManagedDialog(() => setPromotionDialog(undefined));
      await load();
    }
  };
  const applyCoverage = async (versionId: string) => {
    if (!invoice) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/coverage`,
      "PUT",
      { versionId },
      "invoice",
    );
    if (outcome) {
      await openInvoice(invoice.id, run);
      await load();
    }
  };
  const clearCoverage = async () => {
    if (!invoice) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/coverage`,
      "PUT",
      { versionId: null },
      "invoice",
    );
    if (outcome) {
      setDraftCoverageVersionId("");
      await openInvoice(invoice.id, run);
      await load();
    }
  };
  const endAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!endingAssignment) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/promotion-assignments/${endingAssignment.id}/end`,
      "POST",
      { effectiveTo: endingAssignment.effectiveTo, reason: endingAssignment.reason },
      "promotion",
    );
    if (outcome) {
      closeManagedDialog(() => setEndingAssignment(undefined));
      await load();
    }
  };
  const transitionPromotionVersion = async (versionId: string, action: "activate" | "retire") => {
    dialogTrigger.current = rowMenuTrigger.current;
    setPromotionTransition({
      id: versionId,
      name:
        promotionPolicies
          .flatMap((policy) => (policy.versions ?? []).map((version) => ({ policy, version })))
          .find((item) => item.version.id === versionId)?.policy.name ?? "chính sách này",
      action,
    });
  };
  const confirmPromotionTransition = async (versionId: string, action: "activate" | "retire") => {
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/promotion-policy-versions/${versionId}/${action}`,
      "POST",
      {},
      "promotion",
    );
    if (outcome) {
      closeManagedDialog(() => setPromotionTransition(undefined));
      await load();
    }
  };
  const openInvoice = async (invoiceId: string, sourceRun?: Run) => {
    // Own counter: list/run reloads must not discard the Invoice the user (or URL) just opened.
    const token = ++invoiceRequest.current;
    setInvoiceQueue(undefined);
    try {
      const opened = await get<Invoice>(`/api/app/schools/${schoolId}/finance/invoices/${invoiceId}`);
      // A prepared revision is the part Finance still has to finish, so reopening the notice lands on it.
      const draftRevision = opened.revisesInvoiceId
        ? undefined
        : opened.notice?.invoices?.find((part) => part.revisesInvoiceId && part.status === "DRAFT");
      const next = draftRevision
        ? await get<Invoice>(`/api/app/schools/${schoolId}/finance/invoices/${draftRevision.id}`)
        : opened;
      if (activeSchool.current === schoolId && token === invoiceRequest.current) {
        setInvoice(next);
        setDraftCoverageVersionId(noticeCoverageFacts(next)[0]?.versionId ?? "");
        if (sourceRun) setInvoiceQueue({ runId: sourceRun.id, ids: studentQueueIds(sourceRun.invoices) });
      }
      return true;
    } catch (error: any) {
      if (activeSchool.current === schoolId) {
        setInvoice(undefined);
        setMessage(error.message || "Không thể mở hóa đơn đã chọn.");
      }
      return false;
    }
  };
  const revertLineEdits = () => {
    setLineDrafts({});
    if (scope === "invoice") setErrors({});
  };
  const completeLineEdits = async (outcome: unknown) => {
    setLineDrafts({});
    await applyNoticeOutcome(outcome as Invoice);
    setInvoiceQueue(undefined);
    setNotice("Đã lưu thay đổi các dòng hóa đơn.");
    if (run) {
      try {
        const refreshed = await refreshRun(run.id);
        if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) });
      } catch {
        setMessage("Đã lưu; chưa thể tải lại danh sách hóa đơn mới nhất.");
      }
    }
  };
  const saveLineEdits = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoice || !pendingLineEdits.length) return;
    completion.current = completeLineEdits;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/lines`,
      "PUT",
      { lines: pendingLineEdits },
      "invoice",
    );
    if (outcome) {
      completion.current = undefined;
      await completeLineEdits(outcome);
    }
  };
  const resetLineForm = () => {
    setEditingLineId(undefined);
    setEditingLineInvoiceId(undefined);
    setEditingSource(false);
    setLine(emptyInvoiceLine);
  };
  const completeSaveLine = async (outcome: unknown) => {
    closeManagedDialog(() => setLineDialog(false));
    resetLineForm();
    await applyNoticeOutcome(outcome as Invoice);
    setInvoiceQueue(undefined);
    if (run) {
      try {
        const refreshed = await refreshRun(run.id);
        if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) });
      } catch {
        setMessage("Đã lưu; chưa thể tải lại danh sách hóa đơn mới nhất.");
      }
    }
  };
  const saveLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoice) return;
    completion.current = completeSaveLine;
    const body: Record<string, unknown> = { receivableId: line.receivableId, quantity: line.quantity };
    if (line.unitPrice) {
      body.unitPrice = line.unitPrice;
      body.overrideReason = line.overrideReason;
    }
    if (line.serviceDate || line.attendanceState || line.pickedUpAt || line.lateCareMinutes || line.sourceReason) {
      body.source = {
        serviceDate: line.serviceDate || null,
        attendanceState: line.attendanceState || null,
        pickedUpAt: line.pickedUpAt || null,
        lateCareMinutes: line.lateCareMinutes ? Number(line.lateCareMinutes) : null,
      };
      body.sourceReason = line.sourceReason;
    } else if (editingLineId && editingSource) body.source = null;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${editingLineId ? (editingLineInvoiceId ?? invoice.id) : invoice.id}/lines${editingLineId ? `/${editingLineId}` : ""}`,
      editingLineId ? "PUT" : "POST",
      body,
      "invoice",
    );
    if (outcome) {
      completion.current = undefined;
      await completeSaveLine(outcome);
    }
  };
  const removeLine = async (lineId: string, invoiceId: string) => {
    if (!invoice) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${invoiceId}/lines/${lineId}`,
      "DELETE",
      {},
      "receivable",
    );
    if (outcome) {
      await applyNoticeOutcome(outcome as Invoice);
      setInvoiceQueue(undefined);
      if (run) {
        try {
          const refreshed = await refreshRun(run.id);
          if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) });
        } catch {
          setMessage("Đã xóa; chưa thể tải lại danh sách hóa đơn mới nhất.");
        }
      }
    }
    setRemoveConfirmation(undefined);
  };
  const issueInvoice = async () => {
    if (!invoice || !issueAccountsReady) return;
    const runId = run?.id;
    const personal = issueParts.some((part) => part.channel !== "SCHOOL");
    const school = issueParts.some((part) => part.channel === "SCHOOL");
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/${invoice.revisesInvoiceId ? "issue-revision" : "issue"}`,
      "POST",
      {
        ...(personal ? { personalBankAccountId: issueBankAccountId } : {}),
        ...(school ? { schoolBankAccountId: issueSchoolBankAccountId } : {}),
      },
      "invoice",
    );
    if (outcome) {
      applyInvoice(outcome as Invoice);
      setIssueConfirmation(false);
      setIssueBankAccountId("");
      setIssueSchoolBankAccountId("");
      try {
        if (runId) {
          const refreshed = await refreshRun(runId);
          // Continue with the next draft after the one just issued (server order), wrapping to earlier skipped drafts.
          const ordered = refreshed?.invoices ?? [];
          const current = ordered.findIndex((item) => item.id === invoice.id);
          const isNextDraft = (item: (typeof ordered)[number]) =>
            item.status === "DRAFT" &&
            item.id !== invoice.id &&
            !invoice.notice?.invoices?.some((part) => part.id === item.id);
          const nextDraft = ordered.slice(current + 1).find(isNextDraft) ?? ordered.slice(0, Math.max(current, 0)).find(isNextDraft);
          if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) });
          const issuedNote = `${issueActionLabel.replace("Phát hành", "Đã phát hành")} cho ${invoice.student.code} / ${invoice.student.name}.`;
          if (nextDraft) {
            await reviewInvoice(nextDraft.id);
            setNotice(`${issuedNote} Đang rà soát học sinh tiếp theo.`);
          } else setNotice(`${issuedNote} Đã phát hành toàn bộ hóa đơn trong đợt.`);
        }
      } catch {
        setMessage("Hóa đơn đã phát hành; chưa thể tải lại dữ liệu mới nhất.");
      }
    }
  };
  const prepareRevision = async () => {
    if (!invoice || !revisionPartId) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/invoices/${revisionPartId}/revisions`,
      "POST",
      { reason: revisionReason },
      "invoice",
    );
    if (outcome) {
      // Reopen through the notice so the replacement shows next to the part it leaves unchanged.
      if (!(await openInvoice((outcome as Invoice).id, run))) applyInvoice(outcome as Invoice);
      setRevisionConfirmation(false);
      setRevisionReason("");
      try {
        await load();
      } catch {
        setMessage("Bản điều chỉnh đã được chuẩn bị; chưa thể tải lại dữ liệu mới nhất.");
      }
    }
  };
  const discardRevision = async () => {
    if (!invoice?.revisesInvoiceId || !discardReason.trim()) return;
    const sourceId = invoice.revisesInvoiceId;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/discard-revision`, "POST", { reason: discardReason }, "invoice");
    if (outcome) {
      setDiscardConfirmation(false);
      setDiscardReason("");
      if (!(await openInvoice(sourceId, run))) setInvoice(undefined);
      try {
        await load();
        setNotice("Đã hủy bản điều chỉnh.");
      } catch {
        setMessage("Đã hủy bản điều chỉnh; chưa thể tải lại dữ liệu mới nhất.");
      }
    }
  };
  const openIssueConfirmation = async () => {
    if (!invoice) return;
    setMessage("");
    setNotice("");
    try {
      const accounts = await loadBankAccounts();
      if (!accounts.length) {
        setMessage("Máy chủ không có tài khoản nhận đang hoạt động để phát hành hóa đơn.");
        return;
      }
      const school = accounts.filter((account) => account.kind === "SCHOOL");
      if (issueParts.some((part) => part.channel === "SCHOOL")) {
        if (!school.length) {
          setMessage("Chưa cấu hình tài khoản trường để thu khoản có thuế.");
          return;
        }
        if (!school.some((account) => account.id === issueSchoolBankAccountId))
          setIssueSchoolBankAccountId(
            school.find((account) => account.id === invoice.notice?.classDefaultSchoolBankAccountId)?.id ?? school[0]!.id,
          );
      }
      const personal = accounts.filter((account) => (account.kind ?? "PERSONAL") === "PERSONAL");
      if (issueParts.some((part) => part.channel !== "SCHOOL")) {
        if (!personal.length) {
          setMessage("Chưa có tài khoản cá nhân đang hoạt động để thu khoản không kê khai.");
          return;
        }
        if (!personal.some((account) => account.id === issueBankAccountId))
          setIssueBankAccountId(
            personal.find((account) => account.id === invoice.notice?.classDefaultBankAccountId)?.id ?? personal[0]!.id,
          );
      }
      setIssueConfirmation(true);
    } catch {
      setMessage("Không thể tải tài khoản nhận đang hoạt động từ máy chủ.");
    }
  };
  const trapRemoveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(removeDialog.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
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
  const trapIssueFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) { event.preventDefault(); setIssueConfirmation(false); return; }
    if (event.key !== "Tab") return;
    const items = [...(issueDialog.current?.querySelectorAll<HTMLElement>("input, select, button") ?? [])].filter(
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
  const trapCloseFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) { event.preventDefault(); setCloseConfirmation(false); return; }
    if (event.key !== "Tab") return;
    const items = [...(closeDialog.current?.querySelectorAll<HTMLElement>("textarea, button") ?? [])].filter(
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
  const trapDiscardFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) { event.preventDefault(); setDiscardConfirmation(false); return; }
    if (event.key !== "Tab") return;
    const items = [...(discardDialog.current?.querySelectorAll<HTMLElement>("textarea, input, button") ?? [])].filter(
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
  const trapRevisionFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) { event.preventDefault(); setRevisionConfirmation(false); return; }
    if (event.key !== "Tab") return;
    const items = [...(revisionDialog.current?.querySelectorAll<HTMLElement>("textarea, input, button") ?? [])].filter(
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
  const field = (nextScope: typeof scope, name: string) =>
    scope === nextScope && errors[name]
      ? {
          id: `invoice-${nextScope}-${name}-field`,
          "aria-invalid": true,
          "aria-describedby": `invoice-${nextScope}-${name}-error`,
        }
      : {};
  const invoiceField = (name: string) => field("invoice", name);
  const promotionField = (name: string) => field("promotion", name);
  const invoiceQueueIndex =
    invoice && invoiceQueue
      ? invoiceQueue.ids.findIndex(
          (id) => id === invoice.id || Boolean(invoice.notice?.invoices?.some((part) => part.id === id)),
        )
      : -1;
  const InvoiceHeading = onOpenInvoice ? "h1" : "h2";
  const invoiceRouteActive = Boolean(onOpenInvoice && invoiceId);
  // The review shows the whole payment notice; a revision DRAFT stands in for the source it replaces.
  const noticeParts: Invoice[] = !invoice
    ? []
    : (invoice.notice?.invoices?.length ? invoice.notice.invoices : [invoice]).filter(
        (part) =>
          part.id !== invoice.revisesInvoiceId &&
          !(part.revisesInvoiceId && part.status === "DRAFT" && part.id !== invoice.id),
      );
  // Each issued or paid part of a notice is revised on its own; a part already being revised is left out.
  const revisionParts = noticeParts
    .map((part, index) => ({ part, number: index + 1 }))
    .filter(
      ({ part }) =>
        (part.status === "ISSUED" || part.status === "CLOSED") &&
        !part.revisesInvoiceId &&
        !invoice?.notice?.invoices?.some((other) => other.revisesInvoiceId === part.id),
    );
  const pendingLineEdits = noticeParts.flatMap((part) =>
    part.lines.flatMap((line) => {
      const edit = lineEditable(part, line) ? lineEdit(line, lineDrafts[line.id]) : null;
      return edit ? [edit] : [];
    }),
  );
  const previewKey = invoice && pendingLineEdits.length ? `${invoice.id}:${JSON.stringify(pendingLineEdits)}` : "";
  // The server computes the typed values with the save rules and stores nothing; only the latest request is shown.
  useEffect(() => {
    const token = ++previewRequest.current;
    setPreviewErrors({});
    setPreviewMessage("");
    if (!previewKey || !invoice) {
      setLinePreview(undefined);
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    const invoiceId = invoice.id;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/invoices/${invoiceId}/lines/preview`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? "") },
          body: JSON.stringify({ lines: pendingLineEdits }),
        });
        if (token !== previewRequest.current || activeSchool.current !== schoolId) return;
        if ([401, 403].includes(response.status)) {
          denied();
          return;
        }
        const payload = (await response.json()) as {
          data?: Invoice;
          error?: { message?: string; fieldErrors?: Record<string, string> };
        };
        if (token !== previewRequest.current) return;
        if (response.ok && payload.data) {
          setLinePreview(payload.data);
        } else {
          setLinePreview(undefined);
          setPreviewErrors(payload.error?.fieldErrors ?? {});
          setPreviewMessage(
            payload.error?.fieldErrors ? "Sửa các ô báo lỗi để hệ thống tính lại." : (payload.error?.message ?? "Không tính được số dự kiến."),
          );
        }
      } catch {
        if (token === previewRequest.current) setPreviewMessage("Không tính được số dự kiến; thử lại.");
      } finally {
        if (token === previewRequest.current) setPreviewing(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [previewKey]);
  // Unsaved inline edits survive nothing but this page: leaving asks first.
  useEffect(() => {
    if (!pendingLineEdits.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingLineEdits.length > 0]);
  const keepLineEdits = () =>
    !pendingLineEdits.length || window.confirm("Bỏ các thay đổi chưa lưu trên dòng hóa đơn?");
  const issueParts =
    !invoice || invoice.status !== "DRAFT"
      ? []
      : invoice.revisesInvoiceId
        ? invoice.lines.length && invoice.total !== "0"
          ? [invoice]
          : []
        : noticeParts.filter((part) => part.status === "DRAFT" && !part.revisesInvoiceId && part.lines.length);
  // One label for the trigger, the confirmation title and its primary action, so the document noun never changes mid-flow.
  const issueActionLabel = invoice?.revisesInvoiceId
    ? "Phát hành bản thay thế"
    : issueParts.length && issueParts.every((part) => part.kind === "SETTLEMENT" && BigInt(part.total) < 0n)
      ? "Phát hành phiếu hoàn tiền"
      : issueParts.length > 1
        ? "Phát hành phiếu thu"
        : "Phát hành hóa đơn";
  // Run lock (decision 2026-10-08): the server refuses issuing while an earlier MONTHLY run is open; a revision is exempt.
  const previousRunMessage =
    run?.previousOpenRun && !invoice?.revisesInvoiceId
      ? `Đợt thu tháng ${billingMonthLabel(run.previousOpenRun.billingMonth)} chưa đóng. Cần đóng đợt đó trước khi phát hành hóa đơn đợt này.`
      : "";
  // Amendment A4: a negative monthly part closes at issue and its credit carries into next month.
  const negativeMonthlyPart = issueParts.find((part) => part.kind !== "SETTLEMENT" && BigInt(part.total) < 0n);
  const paymentParts = noticeParts.filter((part) => part.paymentImageAvailable && part.issue);
  const schoolBankAccounts = bankAccounts.filter((account) => account.kind === "SCHOOL");
  const personalBankAccounts = bankAccounts.filter((account) => (account.kind ?? "PERSONAL") === "PERSONAL");
  const issueAccountsReady = issueParts.every((part) =>
    part.channel === "SCHOOL" ? Boolean(issueSchoolBankAccountId) : Boolean(issueBankAccountId),
  );
  const liveNotices = (run?.notices ?? []).filter((notice) => notice.status !== "CANCELLED");
  const draftNoticeCount = liveNotices.filter((notice) => notice.status === "DRAFT").length;
  const reviewInvoice = (id: string) => {
    if (onOpenInvoice && run) onOpenInvoice(run.id, id);
    else void openInvoice(id, run);
  };
  const previousInvoiceId = invoiceQueueIndex > 0 ? invoiceQueue!.ids[invoiceQueueIndex - 1] : undefined;
  const nextInvoiceId =
    invoiceQueueIndex >= 0 && invoiceQueueIndex < invoiceQueue!.ids.length - 1
      ? invoiceQueue!.ids[invoiceQueueIndex + 1]
      : undefined;
  const catalogRows = (catalog?.receivables ?? []).filter((item) => {
    const search = catalogFilterApplied.search.trim().toLocaleLowerCase("vi");
    if (search && !`${item.displayName} ${item.code ?? ""}`.toLocaleLowerCase("vi").includes(search)) return false;
    if (catalogFilterApplied.kind && item.kind !== catalogFilterApplied.kind) return false;
    if (catalogFilterApplied.status && (catalogFilterApplied.status === "ACTIVE") !== item.available) return false;
    return true;
  });

  return (
    <section
      className="finance-workspace"
      aria-labelledby={invoiceRouteActive ? "invoice-review-title" : runId ? "run-detail-title" : "finance-title"}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || pending) return;
        if (endingAssignment)
          closeNewDialog(
            () => setEndingAssignment(undefined),
            () => {},
          );
        else if (promotionTransition)
          closeNewDialog(
            () => setPromotionTransition(undefined),
            () => {},
          );
        else if (promotionDialog === "assignment")
          closeNewDialog(
            () => setPromotionDialog(undefined),
            () => setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" }),
          );
      }}
    >
      {!runId && (
        <h1 id="finance-title">
          {page === "receivables" ? "Khoản thu" : page === "promotions" ? "Ưu đãi" : "Đợt thu"}
        </h1>
      )}
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      {notice && (
        <p className="finance-notice-banner" role="status">
          {notice}
        </p>
      )}
      {page === "promotions" && (
        <section>
          <p>Thay đổi cấu hình tạo phiên bản mới. Giá trị áp dụng do hệ thống đánh giá ở bước sau.</p>
          <form
            className="finance-list-toolbar"
            aria-label="Điều khiển danh sách ưu đãi"
            onSubmit={(event) => event.preventDefault()}
          >
            <button
              className="primary-action"
              type="button"
              disabled={Boolean(pending)}
              onClick={(event) => {
                setErrors({});
                resetPromotion();
                openManagedDialog(event.currentTarget, () => setPromotionDialog("policy"));
              }}
            >
              Thêm chính sách
            </button>
          </form>
          <table>
            <caption>Chính sách ưu đãi theo Trường</caption>
            <thead>
              <tr>
                <th>Chính sách</th>
                <th>Khoản thu</th>
                <th>Mức giảm</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
                <th>Học sinh</th>
                <th>Tùy chọn</th>
              </tr>
            </thead>
            <tbody>
              {promotionVersions.length ? (
                promotionPolicies.flatMap((policy) =>
                  (policy.versions ?? []).map((version) => (
                    <tr key={version.id}>
                      <td>
                        {policy.name} / Phiên bản {version.version}
                      </td>
                      <td>{(version.targets ?? []).map((target) => target.receivableName).join(", ")}</td>
                      <td>
                        {version.discountType === "PERCENTAGE"
                          ? `${version.discountValue}%`
                          : `${vnd(version.discountValue)} đ`}
                      </td>
                      <td>
                        {displayDate(version.effectiveFrom)} -{" "}
                        {version.effectiveTo ? displayDate(version.effectiveTo) : "không xác định"}
                      </td>
                      <td>{promotionStatusLabel(version.status)}</td>
                      <td>{(version.assignments ?? []).filter(activeAssignment).length} đang áp dụng</td>
                      <td>
                        <AnchoredActionMenu
                          label={`Tùy chọn cho ${policy.name} phiên bản ${version.version}`}
                          disabled={Boolean(pending)}
                          onTriggerOpen={(trigger) => {
                            rowMenuTrigger.current = trigger;
                          }}
                        >
                          {version.status === "DRAFT" && (
                            <AnchoredActionMenuItem
                              onClick={() => void transitionPromotionVersion(version.id, "activate")}
                            >
                              Kích hoạt phiên bản
                            </AnchoredActionMenuItem>
                          )}
                          {version.status === "ACTIVE" && (
                            <>
                              <AnchoredActionMenuItem
                                onClick={() => {
                                  dialogTrigger.current = rowMenuTrigger.current;
                                  setAssignment({
                                    versionId: version.id,
                                    studentIds: [],
                                    effectiveFrom: "",
                                    effectiveTo: "",
                                    reason: "",
                                  });
                                  setAssignmentFilter({ q: "", officialClassId: "" });
                                  setPromotionDialog("assignment");
                                }}
                              >
                                Gán học sinh
                              </AnchoredActionMenuItem>
                              <AnchoredActionMenuItem
                                onClick={() => void transitionPromotionVersion(version.id, "retire")}
                              >
                                Ngừng phiên bản
                              </AnchoredActionMenuItem>
                            </>
                          )}
                        </AnchoredActionMenu>
                      </td>
                    </tr>
                  )),
                )
              ) : (
                <tr>
                  <td colSpan={7}>{catalog ? "Chưa có chính sách ưu đãi." : "Đang tải ưu đãi."}</td>
                </tr>
              )}
            </tbody>
          </table>
          {currentAssignments.length > 0 && (
            <table>
              <caption>Học sinh đang áp dụng ưu đãi</caption>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Chính sách</th>
                  <th>Áp dụng từ</th>
                  <th>Lý do</th>
                  <th>Tùy chọn</th>
                </tr>
              </thead>
              <tbody>
                {currentAssignments.map(({ policy, version, item }) => (
                  <tr key={item.id}>
                    <td>
                      {item.studentCode} / {item.studentName}
                    </td>
                    <td>
                      {policy.name} / Phiên bản {version.version}
                    </td>
                    <td>{item.effectiveFrom}</td>
                    <td>{item.reason}</td>
                    <td>
                      <AnchoredActionMenu
                        label={`Tùy chọn cho ${item.studentName}`}
                        disabled={Boolean(pending)}
                        onTriggerOpen={(trigger) => {
                          rowMenuTrigger.current = trigger;
                        }}
                      >
                        <AnchoredActionMenuItem
                          onClick={() => {
                            dialogTrigger.current = rowMenuTrigger.current;
                            setEndingAssignment({ id: item.id, effectiveTo: "", reason: "" });
                          }}
                        >
                          Kết thúc áp dụng
                        </AnchoredActionMenuItem>
                      </AnchoredActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {page === "receivables" && (
        <section>
          <div className="finance-catalog-heading">
            <p className="muted">Danh mục khoản thu cho hóa đơn nháp. Giá và trạng thái do hệ thống xác nhận.</p>
            <button
              className="primary-action"
              type="button"
              disabled={Boolean(pending)}
              onClick={(event) => {
                setErrors({});
                resetReceivable();
                openManagedDialog(event.currentTarget, () => setCatalogDialog("receivable"));
              }}
            >
              Thêm khoản thu
            </button>
          </div>
          <h2>Danh sách khoản thu</h2>
          <p className="muted">Khoản ngừng áp dụng vẫn được giữ để đối soát lịch sử.</p>
          <form
            className="finance-list-toolbar"
            aria-label="Điều khiển danh sách khoản thu"
            onSubmit={(event) => {
              event.preventDefault();
              setCatalogFilterApplied(catalogFilter);
            }}
          >
            <label>
              Tìm kiếm
              <input
                placeholder="Tên hoặc mã khoản thu"
                value={catalogFilter.search}
                onChange={(event) => setCatalogFilter({ ...catalogFilter, search: event.target.value })}
              />
            </label>
            <label>
              Nhóm
              <select
                value={catalogFilter.kind}
                onChange={(event) => setCatalogFilter({ ...catalogFilter, kind: event.target.value })}
              >
                <option value="">Tất cả nhóm</option>
                {receivableKinds.map((item) => (
                  <option key={item.kind} value={item.kind}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={catalogFilter.status}
                onChange={(event) => setCatalogFilter({ ...catalogFilter, status: event.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang áp dụng</option>
                <option value="INACTIVE">Ngừng áp dụng</option>
              </select>
            </label>
            <button type="submit">Lọc</button>
          </form>
          <div className="table-scroll">
            <table>
              <caption>Khoản thu theo trường</caption>
              <thead>
                <tr>
                  <th>Khoản thu</th>
                  <th>Mã</th>
                  <th className="money">Đơn giá mặc định (chưa VAT)</th>
                  <th className="money">Giá hoàn trả</th>
                  <th>Thuế</th>
                  <th>Trạng thái</th>
                  <th>Tùy chọn</th>
                </tr>
              </thead>
              <tbody>
                {catalogRows.length ? (
                  catalogRows.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.displayName}</b>
                        <br />
                        <small className="muted">
                          {[
                            kindLabel(item.kind),
                            item.unitLabel !== "tháng" ? `đơn vị ${item.unitLabel}` : "",
                            item.kind === "EXTRACURRICULAR" && (item.extracurricularClassCount ?? 0) > 0
                              ? `gắn ${item.extracurricularClassCount} lớp ngoại khóa`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </td>
                      <td>{item.code ?? "-"}</td>
                      <td className="money">
                        {vnd(item.defaultUnitPrice)} đ / {item.unitLabel}
                      </td>
                      <td className="money">
                        {BigInt(item.refundUnitPrice ?? "0") > 0n ? (
                          <>
                            {vnd(item.refundUnitPrice!)} đ
                            <br />
                            <small className="muted">
                              {item.autoLeaveDeduction ? "Tự trừ theo ngày nghỉ" : "Bớt nhập tay"}
                            </small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {taxShortLabel[item.taxCategory ?? "NOT_DECLARED"]}
                        <br />
                        <small className="muted">{channelAccountLabel(item.channel)}</small>
                      </td>
                      <td>{item.available ? "Đang áp dụng" : "Ngừng áp dụng"}</td>
                      <td>
                        <AnchoredActionMenu
                          label={`Tùy chọn cho ${item.displayName}`}
                          disabled={Boolean(pending)}
                          onTriggerOpen={(trigger) => {
                            rowMenuTrigger.current = trigger;
                          }}
                        >
                          <AnchoredActionMenuItem
                            onClick={() => {
                              dialogTrigger.current = rowMenuTrigger.current;
                              setErrors({});
                              if (item.kind) {
                                const values = receivableEditValues(item);
                                setReceivableEdit({
                                  id: item.id,
                                  title: item.displayName,
                                  values,
                                  original: values,
                                  locked: Boolean(item.kindLocked),
                                  classNames: item.extracurricularClassNames ?? [],
                                  reason: "",
                                });
                              }
                              setCatalogDialog("receivable-edit");
                            }}
                          >
                            Chỉnh sửa
                          </AnchoredActionMenuItem>
                          {item.kind === "EXTRACURRICULAR" && onOpenExtracurricularClasses && (
                            <AnchoredActionMenuItem onClick={onOpenExtracurricularClasses}>
                              Xem lớp ngoại khóa
                            </AnchoredActionMenuItem>
                          )}
                          <AnchoredActionMenuItem
                            onClick={() => {
                              dialogTrigger.current = rowMenuTrigger.current;
                              setLifecycle({
                                kind: "receivables",
                                id: item.id,
                                name: item.displayName,
                                next: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                reason: "",
                              });
                            }}
                          >
                            {item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                          </AnchoredActionMenuItem>
                        </AnchoredActionMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      {catalog
                        ? catalog.receivables?.length
                          ? "Không có khoản thu khớp bộ lọc."
                          : "Chưa có khoản thu."
                        : "Đang tải khoản thu."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <details className="finance-guide">
            <summary>Hướng dẫn</summary>
            <p>Mỗi Trường có đúng ba nhóm khoản thu, không thêm, đổi tên hoặc ngừng nhóm.</p>
            <ul>
              <li>
                <b>Khoản thu cố định</b>: tự thêm vào mỗi đợt thu, áp dụng cho toàn bộ học sinh.
              </li>
              <li>
                <b>Khoản thu linh hoạt</b>: thêm vào đợt thu khi cần, chọn phạm vi áp dụng.
              </li>
              <li>
                <b>Ngoại khóa</b>: thu theo thành viên của lớp ngoại khóa.
              </li>
            </ul>
            <p>Khoản thu đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa không đổi được nhóm.</p>
          </details>
        </section>
      )}
      {page === "collection-runs" && (!runId || !onOpenRun) && (
        <section>
          <form
            className="finance-list-toolbar finance-run-toolbar"
            aria-label="Điều khiển danh sách đợt thu"
            onSubmit={(event) => event.preventDefault()}
          >
            <label>
              Lọc trạng thái
              <select
                value={runStatus}
                onChange={(event) => {
                  const status = event.target.value;
                  setRunStatus(status);
                  setRunCursor("");
                  const search = new URLSearchParams(listSearch);
                  status ? search.set("status", status) : search.delete("status");
                  search.delete("cursor");
                  onListSearchChange?.(search.toString() ? `?${search}` : "");
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="DRAFT">Nháp</option>
                <option value="READY">Sẵn sàng tạo hóa đơn</option>
                <option value="GENERATED">Đã tạo hóa đơn</option>
                <option value="CLOSED">Đã đóng</option>
              </select>
            </label>
            <button
              className="primary-action"
              type="button"
              disabled={Boolean(pending)}
              onClick={(event) => {
                setErrors({});
                setOpen({ schoolYearId: "", billingMonth: "" });
                openManagedDialog(event.currentTarget, () => setRunDialog(true));
              }}
            >
              Tạo đợt thu
            </button>
          </form>
          {runDialog && (
            <div className="dialog-backdrop">
              <div
                ref={runDialogRef}
                className="dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-run-title"
                onKeyDown={(event) =>
                  handleManagedDialogKeyDown(
                    event,
                    () => setRunDialog(false),
                    () => setOpen({ schoolYearId: "", billingMonth: "" }),
                  )
                }
              >
                <form onSubmit={openRun}>
                  <h3 id="finance-run-title">Tạo hoặc mở đợt thu</h3>
                  <p className="muted">Mỗi tháng có một đợt thu. Máy chủ tạo mới hoặc mở đúng đợt đã có.</p>
                  <div className="dialog-grid">
                    <label>
                      Năm học
                      <select
                        value={open.schoolYearId}
                        onChange={(event) => {
                          const schoolYearId = event.target.value;
                          setOpen({ schoolYearId, billingMonth: "" });
                          setPreview(undefined);
                        }}
                        {...field("run", "schoolYearId")}
                      >
                        <option value="">Chọn năm học</option>
                        {(catalog?.schoolYears ?? []).map((year) => (
                          <option key={year.id} value={year.id} disabled={Boolean(year.closedAt)}>
                            {year.name}
                            {year.closedAt ? " (đã đóng)" : ""}
                          </option>
                        ))}
                      </select>
                      {scope === "run" && errors.schoolYearId && (
                        <small id="invoice-run-schoolYearId-error" role="alert">
                          {errors.schoolYearId}
                        </small>
                      )}
                    </label>
                    <label>
                      Tháng thu
                      <select
                        value={open.billingMonth}
                        disabled={!open.schoolYearId}
                        onChange={(event) => setOpen({ ...open, billingMonth: event.target.value })}
                        {...field("run", "billingMonth")}
                      >
                        <option value="">Chọn tháng thu</option>
                        {schoolYearMonths(catalog?.schoolYears?.find((year) => year.id === open.schoolYearId)).map(
                          (month) => (
                            <option key={month} value={month}>
                              Tháng {billingMonthLabel(month)}
                            </option>
                          ),
                        )}
                      </select>
                      {scope === "run" && errors.billingMonth && (
                        <small id="invoice-run-billingMonth-error" role="alert">
                          {errors.billingMonth}
                        </small>
                      )}
                    </label>
                  </div>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() =>
                        closeNewDialog(
                          () => setRunDialog(false),
                          () => setOpen({ schoolYearId: "", billingMonth: "" }),
                        )
                      }
                    >
                      Hủy
                    </button>
                    <button className="primary-action" disabled={Boolean(pending)}>
                      Xác nhận tạo hoặc mở
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <caption>Đợt thu theo trường</caption>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Năm học</th>
                  <th>Trạng thái</th>
                  <th>Tùy chọn</th>
                </tr>
              </thead>
              <tbody>
                {runs.length ? (
                  runs.map((item) => (
                    <tr key={item.id}>
                      <td>{billingMonthLabel(item.billingMonth)}</td>
                      <td>
                        {(catalog?.schoolYears ?? []).find((year) => year.id === item.schoolYearId)?.name ??
                          "Không xác định"}
                      </td>
                      <td>
                        <span
                          className={`finance-badge finance-badge-${item.status === "DRAFT" ? "neutral" : item.status === "READY" ? "info" : "success"}`}
                        >
                          {runStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <AnchoredActionMenu
                          label={`Tùy chọn cho đợt thu ${item.billingMonth}`}
                          disabled={Boolean(pending)}
                          onTriggerOpen={(trigger) => {
                            rowMenuTrigger.current = trigger;
                          }}
                        >
                          <AnchoredActionMenuItem onClick={() => onOpenRun?.(item.id) ?? chooseRun(item)}>
                            Mở chi tiết
                          </AnchoredActionMenuItem>
                        </AnchoredActionMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>{catalog ? "Chưa có đợt thu." : "Đang tải đợt thu."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {runsCursor && (
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => {
                const search = new URLSearchParams(listSearch);
                search.set("cursor", runsCursor);
                onListSearchChange?.(`?${search}`);
                void loadMoreRuns().catch(() => setMessage("Không thể tải thêm đợt thu."));
              }}
            >
              Xem thêm đợt thu
            </button>
          )}
        </section>
      )}
      {page === "collection-runs" && (runId || !onOpenRun) && run && !invoiceRouteActive && (
        <>
          <header className="finance-run-header">
            <div>
              <p className="finance-eyebrow">
                Đợt thu ·{" "}
                {(catalog?.schoolYears ?? []).find((year) => year.id === run.schoolYearId)?.name ??
                  "Năm học không xác định"}
              </p>
              <h1 id="run-detail-title" tabIndex={-1}>
                Đợt thu tháng {billingMonthLabel(run.billingMonth)} · {runStatusLabel(run.status)}
              </h1>
              <p>
                Máy chủ xác định học sinh đang theo học, có phân lớp hiệu lực và lớp đang hoạt động tại đầu tháng thu.
              </p>
            </div>
            {onBackToRuns && (
              <button type="button" onClick={onBackToRuns}>
                Quay lại danh sách đợt thu
              </button>
            )}
          </header>
          <ol className="finance-steps" aria-label="Tiến trình đợt thu">
            {runSteps.map((step) => (
              <li key={step} aria-current={run.status === step ? "step" : undefined}>
                {runStatusLabel(step)}
              </li>
            ))}
          </ol>
          <dl className="finance-metrics" aria-label="Tổng quan do máy chủ tính">
            {runMetrics(run, preview).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {run.status === "DRAFT" && (
            <section aria-labelledby="run-template-title">
              <div className="finance-card-heading finance-catalog-heading">
                <div>
                  <h2 id="run-template-title">Khoản thu trong đợt</h2>
                  <p>
                    Khoản cố định được tự thêm khi mở đợt thu. Số học sinh và tạm tính do máy chủ tính sau khi xem
                    trước.
                  </p>
                </div>
                <button
                  className="primary-action"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={(event) => openTemplateDialog(event.currentTarget)}
                >
                  Thêm khoản thu
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <caption>Khoản thu mẫu của đợt</caption>
                  <thead>
                    <tr>
                      <th>Khoản thu</th>
                      <th>Loại</th>
                      <th>Áp dụng cho</th>
                      <th>Số lượng</th>
                      <th className="finance-money">Đơn giá</th>
                      <th className="finance-money">Số HS</th>
                      <th className="finance-money">Tạm tính</th>
                      <th>Tùy chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(run.templateLines ?? []).length ? (
                      (run.templateLines ?? []).map((item) => {
                        const summary = preview?.lineSummaries?.find((line) => line.templateLineId === item.id);
                        return (
                          <tr key={item.id}>
                            <td>{item.receivableName}</td>
                            <td>
                              <span className="badge neutral">{kindShortLabel(item.kind)}</span>
                              {item.kind === "FIXED" && (
                                <>
                                  <br />
                                  <small className="muted">Tự thêm khi mở đợt thu</small>
                                </>
                              )}
                            </td>
                            <td>{item.scope?.label ?? "Toàn bộ"}</td>
                            <td>
                              {item.quantity} {item.unitLabel}
                            </td>
                            <td className="finance-money">{vnd(item.defaultUnitPrice)} đ</td>
                            <td className="finance-money">{summary ? summary.studentCount : "—"}</td>
                            <td className="finance-money">{summary ? `${vnd(summary.subtotal)} đ` : "—"}</td>
                            <td>
                              <div className="finance-list-actions">
                                <button
                                  type="button"
                                  disabled={Boolean(pending)}
                                  aria-label={`Sửa ${item.receivableName}`}
                                  onClick={(event) => openTemplateDialog(event.currentTarget, item)}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(pending)}
                                  aria-label={`Bỏ ${item.receivableName}`}
                                  onClick={(event) => {
                                    dialogTrigger.current = event.currentTarget;
                                    setTemplateRemoval({ id: item.id, name: item.receivableName });
                                  }}
                                >
                                  Bỏ
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8}>
                          Chưa có khoản thu mẫu. Thêm khoản thu linh hoạt hoặc xem trước để biết học sinh nào không có
                          khoản thu áp dụng.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {run.status === "DRAFT" && (
            <section aria-labelledby="run-extracurricular-title">
              <div className="finance-card-heading">
                <h2 id="run-extracurricular-title">Lớp ngoại khóa trong đợt</h2>
                <p>
                  Máy chủ lấy thành viên có hiệu lực ít nhất một ngày trong tháng của mỗi lớp ngoại khóa đang hoạt động.
                </p>
              </div>
              <div className="table-scroll">
                <table>
                  <caption>Lớp ngoại khóa tính vào đợt thu tháng {billingMonthLabel(run.billingMonth)}</caption>
                  <thead>
                    <tr>
                      <th>Lớp ngoại khóa</th>
                      <th>Khoản thu</th>
                      <th className="finance-money">Số HS trong tháng</th>
                      <th className="finance-money">Tạm tính</th>
                      <th>Trạng thái trong đợt</th>
                      <th>Tùy chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runClasses ? (
                      runClasses.length ? (
                        runClasses.map((item) => {
                          const summary = preview?.extracurricularClasses?.find((entry) => entry.id === item.id);
                          const billable = !item.excluded && item.receivableActive;
                          return (
                            <tr key={item.id}>
                              <td>
                                {onOpenExtracurricularClasses ? (
                                  <button type="button" className="link-action" onClick={onOpenExtracurricularClasses}>
                                    {item.name}
                                  </button>
                                ) : (
                                  item.name
                                )}
                              </td>
                              <td>
                                {item.receivableName}
                                <br />
                                <small className="muted">
                                  {vnd(item.defaultUnitPrice)} đ/{item.unitLabel}
                                </small>
                              </td>
                              <td className="finance-money">
                                {item.memberCount}
                                {item.transferredCount > 0 && (
                                  <>
                                    <br />
                                    <small className="muted">
                                      {item.transferredCount} HS chuyển từ lớp khác, tính một lần
                                    </small>
                                  </>
                                )}
                              </td>
                              <td className="finance-money">
                                {summary && billable ? `${vnd(summary.subtotal)} đ` : "—"}
                              </td>
                              <td>
                                <span
                                  className={`badge ${billable ? "success" : item.receivableActive ? "neutral" : "warning"}`}
                                >
                                  {!item.receivableActive
                                    ? "Khoản thu ngừng áp dụng"
                                    : item.excluded
                                      ? "Loại khỏi đợt này"
                                      : "Tính trong đợt"}
                                </span>
                              </td>
                              <td>
                                {item.receivableActive || item.excluded ? (
                                  <button
                                    type="button"
                                    disabled={Boolean(pending)}
                                    aria-label={`${item.excluded ? "Khôi phục" : "Loại khỏi đợt này"} ${item.name}`}
                                    onClick={(event) => {
                                      dialogTrigger.current = event.currentTarget;
                                      setClassExclusion({
                                        id: item.id,
                                        name: item.name,
                                        excluded: !item.excluded,
                                        reason: "",
                                      });
                                    }}
                                  >
                                    {item.excluded ? "Khôi phục" : "Loại khỏi đợt này"}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6}>Chưa có lớp ngoại khóa đang hoạt động trong năm học này.</td>
                        </tr>
                      )
                    ) : (
                      <tr>
                        <td colSpan={6}>Đang tải lớp ngoại khóa.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {run.status === "DRAFT" && (
            <section aria-labelledby="preview-title">
              <div className="finance-card-heading">
                <h2 id="preview-title">{preview ? "Kết quả xem trước từ máy chủ" : "Xem trước danh sách học sinh"}</h2>
                <p>Bản xem trước do máy chủ xác định từ danh sách học sinh hợp lệ tại đầu tháng thu.</p>
              </div>
              {!preview && (
                <div className="finance-actions">
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void loadPreview()}
                  >
                    Xem trước từ máy chủ
                  </button>
                </div>
              )}
              {preview && (
                <>
                  <div className="table-scroll">
                    <table>
                      <caption>Tạm tính theo dòng khoản thu</caption>
                      <thead>
                        <tr>
                          <th>Khoản thu</th>
                          <th>Loại</th>
                          <th>Áp dụng cho</th>
                          <th className="finance-money">Số HS</th>
                          <th className="finance-money">Tạm tính</th>
                          <th className="finance-money">Ưu đãi</th>
                          <th className="finance-money">Bớt</th>
                          <th className="finance-money">Thuế GTGT</th>
                          <th className="finance-money">Tổng phải thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.lineSummaries ?? []).map((line) => (
                          <tr key={line.templateLineId ?? `extra-${line.receivableId}`}>
                            <td>{line.receivableName}</td>
                            <td>{kindShortLabel(line.kind)}</td>
                            <td>{line.scope.label}</td>
                            <td className="finance-money">
                              {line.studentCount}
                              {line.note && (
                                <>
                                  <br />
                                  <small className="muted">{line.note}</small>
                                </>
                              )}
                            </td>
                            <td className="finance-money">{vnd(line.subtotal)} đ</td>
                            <td className="finance-money">{reductionVnd(line.discountAmount)}</td>
                            <td className="finance-money">{reductionVnd(line.deductionAmount)}</td>
                            <td className="finance-money">{vnd(line.vatAmount ?? "0")} đ</td>
                            <td className="finance-money">{vnd(line.totalAmount ?? line.subtotal)} đ</td>
                          </tr>
                        ))}
                        {preview.summary && (
                          <tr>
                            <td>
                              <b>Tổng cộng</b>
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td className="finance-money">
                              <b>{vnd(preview.summary.grossAmount ?? "0")} đ</b>
                            </td>
                            <td className="finance-money">
                              <b>{reductionVnd(preview.summary.discountAmount)}</b>
                            </td>
                            <td className="finance-money">
                              <b>{reductionVnd(preview.summary.deductionAmount)}</b>
                            </td>
                            <td className="finance-money">
                              <b>{vnd(preview.summary?.vatAmount ?? "0")} đ</b>
                            </td>
                            <td className="finance-money">
                              <b>{vnd(preview.summary?.expectedTotal ?? "0")} đ</b>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <PreviewEligibleTable key={preview.fingerprint} eligible={preview.eligible} />
                  {(preview.futureCoverageFacts ?? []).length > 0 && (
                    <div className="table-scroll">
                      <table>
                        <caption>Ưu đãi trả trước do máy chủ xác nhận</caption>
                        <thead>
                          <tr>
                            <th>Kỳ</th>
                            <th>Khoản thu</th>
                            <th className="finance-money">Giá gốc (đ)</th>
                            <th className="finance-money">Giảm trừ (đ)</th>
                            <th>Khoảng dịch vụ</th>
                            <th>Lịch áp dụng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.futureCoverageFacts?.map((fact) => (
                            <tr key={`${fact.studentId}-${fact.versionId}-${fact.receivableId}-${fact.billingMonth}`}>
                              <td>{fact.billingMonth}</td>
                              <td>{fact.receivableName}</td>
                              <td className="finance-money">{vnd(fact.originalPrice)}</td>
                              <td className="finance-money">{vnd(fact.reduction)}</td>
                              <td>
                                {fact.serviceStart} đến {fact.serviceEnd}
                              </td>
                              <td>
                                {fact.calendarEffectiveFrom} / {fact.timezone}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="table-scroll">
                    <table>
                      <caption>Học sinh bị bỏ qua</caption>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.skips.length ? (
                          preview.skips.map((item) => (
                            <tr key={item.studentId}>
                              <td>
                                {item.studentCode && item.fullName
                                  ? `${item.studentCode} / ${item.fullName}`
                                  : "Không xác định"}
                              </td>
                              <td>{skipReason(item.reason)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>Không có học sinh bị bỏ qua.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="finance-actions">
                    <button type="button" disabled={Boolean(pending)} onClick={() => void loadPreview()}>
                      Xem trước từ máy chủ
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => void ready()}
                    >
                      Xác nhận xem trước và chuyển sẵn sàng
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {run.status === "DRAFT" && (
            <details className="finance-guide">
              <summary>Hướng dẫn</summary>
              <p>
                Khoản thu cố định được tự thêm khi mở đợt thu và áp dụng cho toàn bộ học sinh; sửa số lượng hoặc bỏ dòng
                khi đợt còn Nháp. Khoản thu linh hoạt thêm khi cần, kèm phạm vi toàn bộ, lớp chính thức hoặc học sinh cụ
                thể. Khoản Ngoại khóa không thêm vào khoản thu mẫu.
              </p>
              <p>
                Đơn giá, số học sinh và tạm tính do máy chủ xác nhận. Mọi thay đổi khoản thu hoặc phạm vi sau khi xem
                trước cần xem trước lại.
              </p>
            </details>
          )}
        </>
      )}
      {page === "collection-runs" && (runId || !onOpenRun) && (
        <>
          {!invoiceRouteActive && run?.status === "READY" && (
            <section aria-labelledby="run-generate-title">
              <div className="finance-card-heading">
                <h2 id="run-generate-title">Tạo hóa đơn nháp</h2>
                <p>
                  Bản xem trước đã được xác nhận. Máy chủ sẽ đánh giá lại danh sách học sinh khi tạo và dùng bản chốt
                  khoản thu của đợt.
                </p>
              </div>
              <div className="table-scroll">
                <table>
                  <caption>Khoản thu đã chốt cho đợt</caption>
                  <thead>
                    <tr>
                      <th>Khoản thu</th>
                      <th>Số lượng</th>
                      <th className="finance-money">Đơn giá (đ)</th>
                      <th className="finance-money">Số tiền (đ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(run.templateLines ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.receivableName}</td>
                        <td>
                          {item.quantity} {item.unitLabel}
                        </td>
                        <td className="finance-money">{vnd(item.defaultUnitPrice)}</td>
                        <td className="finance-money">{vnd(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="finance-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => setGenerateConfirmation(true)}
                >
                  Tạo hóa đơn nháp
                </button>
              </div>
            </section>
          )}
          {!invoiceRouteActive && generationProgress && !generatedOutcome && (
            <section aria-live="polite" aria-label="Tiến độ tạo hóa đơn từ máy chủ">
              <h2>Tiến độ tạo hóa đơn từ máy chủ</h2>
              <p>
                Đang xử lý {generationProgress.processed}/{generationProgress.total}; đủ điều kiện{" "}
                {generationProgress.eligible}; bỏ qua {generationProgress.skipped}.
              </p>
              {generationProgress.lastError && (
                <p role="alert">{generationProgress.lastError.message ?? "Máy chủ không thể tạo hóa đơn."}</p>
              )}
            </section>
          )}
          {!invoiceRouteActive && generatedOutcome && (
            <section className="finance-notice" role="status" aria-labelledby="generated-outcome-title">
              <h2 id="generated-outcome-title">Kết quả tạo hóa đơn từ máy chủ</h2>
              <p>
                Đã tạo {generatedOutcome.created.length} hóa đơn nháp; bỏ qua {generatedOutcome.skipped.length} học
                sinh.
              </p>
              {generatedOutcome.skipped.length > 0 && (
                <details>
                  <summary>Xem học sinh bị bỏ qua</summary>
                  <div className="table-scroll">
                    <table>
                      <caption>Học sinh bị bỏ qua khi tạo</caption>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedOutcome.skipped.map((item) => (
                          <tr key={item.studentId}>
                            <td>
                              {item.studentCode && item.fullName
                                ? `${item.studentCode} / ${item.fullName}`
                                : "Không xác định"}
                            </td>
                            <td>{skipReason(item.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </section>
          )}
          {!invoiceRouteActive && run?.status === "GENERATED" && (
            <section aria-labelledby="run-invoices-title">
              <div className="finance-actions finance-actions-split">
                <div className="finance-card-heading">
                  <h2 id="run-invoices-title">Hóa đơn trong đợt</h2>
                  <p>
                    {liveNotices.filter((notice) => notice.status !== "DRAFT").length}/{liveNotices.length} phiếu thu đã
                    phát hành hoặc hoàn tất. Mỗi dòng là một phiếu thu gồm phần tài khoản trường và phần tài khoản cá
                    nhân.
                  </p>
                </div>
                <button
                  ref={addStudentsTrigger}
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => setAddStudentsOpen(true)}
                >
                  Thêm học sinh
                </button>
              </div>
              <RunNoticeTable
                notices={run.notices ?? []}
                caption="Hóa đơn hiện có trong đợt thu"
                actionLabel="Rà soát hóa đơn"
                currentInvoiceId={invoice?.id}
                onReview={reviewInvoice}
              />
              {priorDebts?.runId === run.id && priorDebts.debts.length > 0 && (
                <section aria-labelledby="run-prior-debts-title">
                  <div className="finance-actions finance-actions-split">
                    <div className="finance-card-heading">
                      <h3 id="run-prior-debts-title">Công nợ kỳ trước</h3>
                      <p>
                        Hóa đơn đã phát hành nhưng chưa thu của các đợt đã đóng. Chuyển vào hóa đơn tháng này để phụ
                        huynh nộp cùng; hóa đơn cũ sẽ không còn ở trang Thu tiền.
                      </p>
                    </div>
                    <button type="button" disabled={Boolean(pending)} onClick={() => setPriorDebtConfirmation({ debts: priorDebts.debts, total: priorDebts.total })}>
                      Chuyển tất cả công nợ
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption>Công nợ kỳ trước chưa thu</caption>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Lớp</th>
                          <th>Tháng</th>
                          <th>Tài khoản nhận</th>
                          <th className="finance-money">Còn nợ (đ)</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priorDebts.debts.map((debt) => (
                          <tr key={debt.sourceInvoiceId}>
                            <td>
                              {debt.student.code} / {debt.student.name}
                            </td>
                            <td>{debt.className}</td>
                            <td>{billingMonthLabel(debt.billingMonth)}</td>
                            <td>{debt.account ? <ReceivingAccountLabel account={debt.account} /> : "—"}</td>
                            <td className="finance-money">{vnd(debt.outstanding)}</td>
                            <td>
                              <button type="button" disabled={Boolean(pending)} onClick={() => setPriorDebtConfirmation({ debts: [debt], total: debt.outstanding })}>
                                Chuyển vào hóa đơn tháng này
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {settlements?.runId === run.id && settlements.students.length > 0 && (
                <section aria-labelledby="run-settlements-title">
                  <div className="finance-card-heading">
                    <h3 id="run-settlements-title">Cần quyết toán</h3>
                    <p>
                      Học sinh đã nghỉ học trong tháng trước. Hóa đơn quyết toán không có khoản thu mới, chỉ gồm phần
                      bớt tiền ăn chưa dùng và hoàn học phí nộp trước do hệ thống tính.
                    </p>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption>Học sinh cần quyết toán trong đợt</caption>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Lớp</th>
                          <th>Nghỉ học từ</th>
                          <th>Trạng thái</th>
                          <th className="finance-money">Tổng (đ)</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.students.map((student) => {
                          return (
                            <tr key={student.studentId}>
                              <td>
                                {student.studentCode} / {student.fullName}
                              </td>
                              <td>{student.className ?? "-"}</td>
                              <td>{displayDate(student.endedOn)}</td>
                              <td>
                                {student.invoices.length ? invoiceStatusLabel(student.invoices[0]!.status) : "Chưa tạo"}
                              </td>
                              <td className="finance-money">
                                {student.invoices.length
                                  ? BigInt(student.invoiceTotal) < 0n
                                    ? `Hoàn ${vnd((-BigInt(student.invoiceTotal)).toString())}`
                                    : vnd(student.invoiceTotal)
                                  : "—"}
                              </td>
                              <td>
                                {student.invoices.length ? (
                                  <button type="button" onClick={() => reviewInvoice(student.invoices[0]!.id)}>
                                    Rà soát hóa đơn
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={Boolean(pending)}
                                    onClick={() => void createSettlement(student)}
                                  >
                                    Tạo hóa đơn quyết toán
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {run.previousOpenRun && (
                <div className="finance-actions finance-actions-split">
                  <p className="finance-alert">
                    Đợt thu tháng {billingMonthLabel(run.previousOpenRun.billingMonth)} chưa đóng. Cần đóng đợt đó trước
                    khi phát hành hóa đơn đợt này.
                  </p>
                  {onOpenRun && (
                    <button type="button" onClick={() => onOpenRun(run.previousOpenRun!.id)}>
                      Mở đợt thu {billingMonthLabel(run.previousOpenRun.billingMonth)}
                    </button>
                  )}
                </div>
              )}
              <div className="finance-actions finance-actions-split">
                {run.invoices?.some((invoice) => invoice.status === "DRAFT" && invoice.total !== "0") ? (
                  <p>
                    {draftNoticeCount
                      ? `Chưa thể đóng: còn ${draftNoticeCount} phiếu thu nháp cần phát hành.`
                      : "Chưa thể đóng: còn hóa đơn nháp cần phát hành."}
                  </p>
                ) : (
                  <p>Mọi hóa đơn đã phát hành; có thể đóng đợt thu.</p>
                )}
                <button
                  ref={closeTrigger}
                  type="button"
                  disabled={
                    Boolean(pending) ||
                    Boolean(
                      run.invoices?.some(
                        (invoice) =>
                          !["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status) &&
                          !(invoice.status === "DRAFT" && invoice.total === "0"),
                      ),
                    )
                  }
                  onClick={() => {
                    setCloseReason("");
                    setCloseConfirmation(true);
                  }}
                >
                  Đóng đợt thu
                </button>
              </div>
            </section>
          )}
          {!invoiceRouteActive && run?.status === "CLOSED" && (
            <section aria-label="Đợt thu đã đóng">
              <div className="finance-card-heading">
                <h2 ref={closedHeading} tabIndex={-1}>
                  Đợt thu đã đóng
                </h2>
                <p>Máy chủ đã khóa đợt thu này. Không thể thêm học sinh hoặc tạo, sửa hóa đơn trong đợt thu đã đóng.</p>
              </div>
              <RunNoticeTable
                notices={run.notices ?? []}
                caption="Hóa đơn đã khóa theo đợt thu"
                actionLabel="Xem hóa đơn"
                onReview={reviewInvoice}
              />
            </section>
          )}
          {invoiceRouteActive && !invoice && <p>Đang tải hóa đơn.</p>}
          {invoice && (!onOpenInvoice || invoiceId) && (
            <section
              ref={invoiceReview}
              className="finance-invoice-review"
              aria-labelledby="invoice-review-title invoice-review-student"
            >
              <header className="finance-run-header">
                <div>
                  <p className="finance-eyebrow">
                    Đợt thu tháng {billingMonthLabel(invoice.billingMonth)} ·{" "}
                    <span id="invoice-review-student">
                      {invoice.student.code} / {invoice.student.name}
                    </span>{" "}
                    · {invoice.student.className}
                  </p>
                  <div className="finance-title-row">
                    <InvoiceHeading id="invoice-review-title" tabIndex={-1}>
                      Rà soát hóa đơn
                    </InvoiceHeading>
                    <span
                      className={`finance-badge finance-badge-${invoice.status === "DRAFT" ? "warning" : invoice.status === "CANCELLED" ? "neutral" : "success"}`}
                    >
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                    {invoice.kind === "SETTLEMENT" && (
                      <span className="finance-badge finance-badge-info">Quyết toán</span>
                    )}
                  </div>
                  {invoice.kind === "SETTLEMENT" && (
                    <p>
                      Hóa đơn cuối cùng sau khi học sinh nghỉ học
                      {invoice.enrollmentEndedOn ? ` từ ${displayDate(invoice.enrollmentEndedOn)}` : ""}: không có khoản
                      thu mới, chỉ gồm phần bớt tiền ăn chưa dùng và hoàn học phí nộp trước. Học phí của tháng nghỉ học
                      không được hoàn.
                    </p>
                  )}
                  {invoiceQueueIndex >= 0 && invoiceQueue && <p className="muted">Học sinh {invoiceQueueIndex + 1}/{invoiceQueue.ids.length}</p>}
                </div>
                <div className="finance-actions">
                  {onOpenInvoice && run && (
                    <button type="button" onClick={() => keepLineEdits() && onBackToRun?.(run.id)}>
                      Quay lại đợt thu
                    </button>
                  )}
                  {previousInvoiceId && (
                    <button type="button" disabled={Boolean(pending)} onClick={() => keepLineEdits() && reviewInvoice(previousInvoiceId)}>
                      Học sinh trước
                    </button>
                  )}
                  {nextInvoiceId && (
                    <button type="button" disabled={Boolean(pending)} onClick={() => keepLineEdits() && reviewInvoice(nextInvoiceId)}>
                      Học sinh tiếp theo
                    </button>
                  )}
                </div>
              </header>
              <div className="finance-invoice-split">
                <section aria-labelledby="invoice-lines-title">
                  <div className="finance-section-heading">
                    <h2 id="invoice-lines-title">Chi tiết hóa đơn</h2>
                    {invoice.status === "DRAFT" && (
                      <button
                        type="button"
                        disabled={Boolean(pending) || pendingLineEdits.length > 0}
                        onClick={(event) => {
                          dialogTrigger.current = event.currentTarget;
                          resetLineForm();
                          setErrors({});
                          setLineDialog(true);
                        }}
                      >
                        Thêm dòng
                      </button>
                    )}
                  </div>
                  <form className="finance-lines-form" onSubmit={saveLineEdits}>
                    {noticeParts.map((part, index) => (
                      <div key={part.id} className="finance-notice-part" aria-labelledby={`notice-part-${part.id}`}>
                        {noticeParts.length > 1 && (
                          <div className="finance-title-row">
                            <h3 id={`notice-part-${part.id}`}>
                              Phần {index + 1} · Thu vào {channelAccountLabel(part.channel).toLocaleLowerCase("vi")}
                            </h3>
                            <span
                              className={`finance-badge finance-badge-${part.status === "DRAFT" ? "warning" : "success"}`}
                            >
                              {invoiceStatusLabel(part.status)}
                            </span>
                          </div>
                        )}
                        <InvoiceLinesTable
                          part={part}
                          caption={
                            noticeParts.length > 1 ? `Dòng phần ${index + 1} do máy chủ tính` : "Dòng hóa đơn do máy chủ tính"
                          }
                          totalLabel={noticeParts.length > 1 ? `Tổng phần ${index + 1}` : undefined}
                          preview={linePreview}
                          prepaidReceivableIds={prepaidReceivableIds}
                          drafts={lineDrafts}
                          errors={{ ...(scope === "invoice" ? errors : {}), ...previewErrors }}
                          disabled={Boolean(pending)}
                          onDraft={(item, draft) => {
                            if (scope === "invoice") setErrors({});
                            setLineDrafts((current) => ({ ...current, [item.id]: draft }));
                          }}
                          onSource={(item, trigger) => {
                            dialogTrigger.current = trigger;
                            setErrors({});
                            setLineDialog(true);
                            setEditingLineId(item.id);
                            setEditingLineInvoiceId(part.id);
                            setEditingSource(Boolean(item.source));
                            setLine({
                              receivableId: item.receivableId ?? "",
                              quantity: item.quantity,
                              unitPrice: item.overrideReason ? item.unitPrice : "",
                              overrideReason: item.overrideReason ?? "",
                              sourceReason: item.sourceReason ?? "",
                              serviceDate: item.source?.serviceDate ?? "",
                              attendanceState: item.source?.attendanceState ?? "",
                              pickedUpAt: item.source?.pickedUpAt ?? "",
                              lateCareMinutes: item.source?.lateCareMinutes?.toString() ?? "",
                            });
                          }}
                          onRemove={(item, trigger) => {
                            removeTrigger.current = trigger;
                            setRemoveConfirmation({ id: item.id, name: item.receivableName, invoiceId: part.id });
                          }}
                        />
                      </div>
                    ))}
                    {noticeParts.length > 1 && (
                      <p className="finance-payment-total">
                        <span>
                          {BigInt((linePreview ?? invoice).noticeTotal ?? "0") < 0n
                            ? "Trường hoàn lại cho phụ huynh"
                            : "Tổng cần thu do hệ thống xác nhận"}{" "}
                          <small>{noticeParts.length} phần</small>
                        </span>
                        <b className={linePreview ? "finance-preview-value" : undefined}>
                          {signedVnd((linePreview ?? invoice).noticeTotal ?? "0")}
                        </b>
                      </p>
                    )}
                    {pendingLineEdits.length > 0 && (
                      <div className="finance-save-bar" role="region" aria-label="Thay đổi chưa lưu">
                        <span role="status">
                          {pendingLineEdits.length} dòng đã sửa ·{" "}
                          {previewing
                            ? "Đang tính lại…"
                            : previewMessage || "Số in nghiêng là số dự kiến do hệ thống tính, chưa lưu."}
                        </span>
                        <button type="button" disabled={Boolean(pending)} onClick={revertLineEdits}>
                          Hoàn tác
                        </button>
                        <button className="primary-action" disabled={Boolean(pending)}>
                          Lưu thay đổi
                        </button>
                      </div>
                    )}
                  </form>
                  {invoice.status !== "DRAFT" && (
                    <p>
                      Hóa đơn {invoiceStatusLabel(invoice.status).toLocaleLowerCase("vi")} chỉ đọc; dòng hóa đơn không
                      thể thay đổi.
                    </p>
                  )}
                </section>
                <aside aria-labelledby="invoice-issue-title">
                  {paymentParts.length === 1 && noticeParts.length === 1 ? (
                    <>
                      {BigInt(paymentParts[0]!.issue!.obligationTotal) < 0n ? (
                        <>
                          <div className="finance-card-heading">
                            <h2 id="invoice-issue-title">Hoàn tiền cho phụ huynh</h2>
                            <p>Mã hóa đơn {paymentParts[0]!.issue!.obligationCode} · Chờ chi hoàn</p>
                          </div>
                          <p className="finance-payment-total">
                            <span>Trường hoàn lại</span>
                            <b>{vnd((-BigInt(paymentParts[0]!.issue!.obligationTotal)).toString())} đ</b>
                          </p>
                          <p>Sau khi chi, ghi nhận đã chi tại Thu tiền.</p>
                        </>
                      ) : (
                        <>
                          <div className="finance-card-heading">
                            <h2 id="invoice-issue-title">Thanh toán</h2>
                            <p>
                              Mã hóa đơn {paymentParts[0]!.issue!.obligationCode} · Hạn thanh toán{" "}
                              {displayDate(paymentParts[0]!.issue!.dueOn)}
                            </p>
                          </div>
                          <dl className="finance-payment-facts">
                            <div>
                              <dt>Tổng cần nộp</dt>
                              <dd className="finance-payment-amount">{vnd(paymentParts[0]!.issue!.obligationTotal)} đ</dd>
                            </div>
                            <div>
                              <dt>Ngân hàng</dt>
                              <dd>{paymentParts[0]!.issue!.bankAccount.receivingBank}</dd>
                            </div>
                            <div>
                              <dt>Số tài khoản</dt>
                              <dd>{paymentParts[0]!.issue!.bankAccount.accountNumber}</dd>
                            </div>
                            <div>
                              <dt>Chủ tài khoản</dt>
                              <dd>{paymentParts[0]!.issue!.bankAccount.accountHolderName}</dd>
                            </div>
                            <div>
                              <dt>Nội dung chuyển khoản</dt>
                              <dd>{paymentParts[0]!.issue!.transferContent}</dd>
                            </div>
                          </dl>
                        </>
                      )}
                      <PaymentImagePanel
                        apiUrl={apiUrl}
                        schoolId={schoolId}
                        invoiceId={paymentParts[0]!.id}
                        fallbackFileName={`${paymentParts[0]!.issue!.obligationCode ?? paymentParts[0]!.id}-${invoice.student.code}.png`}
                        denied={denied}
                      />
                    </>
                  ) : paymentParts.length ? (
                    <>
                      <div className="finance-card-heading">
                        <h2 id="invoice-issue-title">Thanh toán</h2>
                        <p>
                          Hạn thanh toán {displayDate(paymentParts[0]!.issue!.dueOn)} · {paymentParts.length} lần chuyển
                          khoản
                        </p>
                      </div>
                      <div className="finance-notice-parts">
                        {noticeParts.map((part, index) => (
                          <div key={part.id} className="finance-notice-part" aria-labelledby={`payment-part-${part.id}`}>
                            <div className="finance-title-row">
                              <b id={`payment-part-${part.id}`}>
                                Phần {index + 1} · {channelAccountLabel(part.channel)}
                              </b>
                              <span
                                className={`finance-badge finance-badge-${part.paymentImageAvailable ? "neutral" : "success"}`}
                              >
                                {part.paymentImageAvailable
                                  ? BigInt(part.issue?.obligationTotal ?? "0") < 0n
                                    ? "Chờ chi hoàn"
                                    : "Chưa thu"
                                  : invoiceStatusLabel(part.status)}
                              </span>
                            </div>
                            {part.issue && (
                              <>
                                <p>Mã hóa đơn {part.issue.obligationCode}</p>
                                <p className="finance-payment-total">
                                  <span>
                                    {BigInt(part.issue.obligationTotal) < 0n
                                      ? `Trường hoàn lại phần ${index + 1}`
                                      : `Tổng phần ${index + 1}`}
                                  </span>
                                  <b>{signedVnd(part.issue.obligationTotal)}</b>
                                </p>
                                <p className="muted">
                                  {part.issue.bankAccount.receivingBank} · {part.issue.bankAccount.accountNumber} ·{" "}
                                  {part.issue.bankAccount.accountHolderName}
                                </p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <dl className="finance-payment-facts">
                        <div>
                          <dt>
                            {BigInt(invoice.paymentTotal ?? "0") < 0n ? "Trường hoàn lại cho phụ huynh" : "Tổng cần nộp"}
                          </dt>
                          <dd className="finance-payment-amount">{signedVnd(invoice.paymentTotal ?? "0")}</dd>
                        </div>
                        <div>
                          <dt>Nội dung chuyển khoản</dt>
                          <dd>{paymentParts[0]!.issue!.transferContent}</dd>
                        </div>
                      </dl>
                      <PaymentImagePanel
                        apiUrl={apiUrl}
                        schoolId={schoolId}
                        invoiceId={paymentParts[0]!.id}
                        fallbackFileName={`${paymentParts[0]!.issue!.obligationCode ?? paymentParts[0]!.id}-${invoice.student.code}.png`}
                        denied={denied}
                      />
                    </>
                  ) : (
                    <div className="finance-card-heading">
                      <h2 id="invoice-issue-title">Rà soát trước khi phát hành</h2>
                      <p>
                        {invoice.status === "DRAFT"
                          ? `Chính sách ưu đãi sẽ được kiểm tra lại trước khi phát hành. Không thể chỉnh sửa sau phát hành.${issueParts.length > 1 ? " Hai phần được phát hành cùng lúc." : ""}`
                          : "Hóa đơn đã phát hành giữ nguyên snapshot nghĩa vụ và hướng dẫn thanh toán."}
                      </p>
                    </div>
                  )}
                  {invoice.status === "DRAFT" && (
                    <div className="finance-notice-parts">
                      {issueParts.map((part) => (
                        <div key={part.id} className="finance-notice-part">
                          <p className="finance-payment-total">
                            <span>
                              {issueParts.length > 1
                                ? `Phần ${noticeParts.findIndex((item) => item.id === part.id) + 1} · ${channelAccountLabel(part.channel)}`
                                : channelAccountLabel(part.channel)}
                            </span>
                            <b>{signedVnd(part.total)}</b>
                          </p>
                          {part.channel === "SCHOOL" ? (
                            schoolBankAccounts.length ? (
                              <>
                                <label>
                                  Tài khoản trường
                                  <select
                                    value={issueSchoolBankAccountId}
                                    onChange={(event) => setIssueSchoolBankAccountId(event.target.value)}
                                    aria-describedby="school-account-hint"
                                  >
                                    <option value="">Chọn tài khoản trường</option>
                                    {schoolBankAccounts.map((account) => (
                                      <option key={account.id} value={account.id}>
                                        {account.receivingBank} · {account.accountNumber} · {account.accountHolderName}
                                        {account.id === invoice.notice?.classDefaultSchoolBankAccountId
                                          ? ` (mặc định lớp ${invoice.student.className})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <small id="school-account-hint">
                                  Chọn sẵn theo tài khoản trường mặc định của lớp; có thể chọn tài khoản trường khác đang
                                  hiệu lực.
                                </small>
                              </>
                            ) : (
                              <p role="alert">Chưa cấu hình tài khoản trường để thu khoản có thuế.</p>
                            )
                          ) : (
                            <>
                              <label>
                                Tài khoản cá nhân
                                <select
                                  value={issueBankAccountId}
                                  onChange={(event) => setIssueBankAccountId(event.target.value)}
                                  aria-describedby="personal-account-hint"
                                >
                                  <option value="">Chọn tài khoản cá nhân</option>
                                  {personalBankAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.receivingBank} · {account.accountNumber} · {account.accountHolderName}
                                      {account.id === invoice.notice?.classDefaultBankAccountId
                                        ? ` (mặc định lớp ${invoice.student.className})`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <small id="personal-account-hint">
                                Chọn sẵn theo tài khoản mặc định của lớp; có thể chọn tài khoản cá nhân khác đang hiệu
                                lực.
                              </small>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(invoice.revisesInvoiceId || invoice.replacementInvoiceId) && (
                    <p>
                      Liên kết điều chỉnh:{" "}
                      {invoice.revisesInvoiceId
                        ? "Hóa đơn này thay thế hóa đơn trước đó."
                        : "Hóa đơn này đã được thay thế."}{" "}
                      {invoice.revisionReason ? `Lý do: ${invoice.revisionReason}.` : ""}
                    </p>
                  )}
                  {negativeMonthlyPart && (
                    <p className="finance-alert">
                      Tổng âm: tiền thừa {vnd((-BigInt(negativeMonthlyPart.total)).toString())} đ không hoàn ngay mà trừ
                      vào hóa đơn tháng sau. Hóa đơn tự đóng khi phát hành.
                    </p>
                  )}
                  {invoice.status === "DRAFT" && previousRunMessage && <p className="finance-alert">{previousRunMessage}</p>}
                  <div className="finance-actions">
                    {invoice.status === "DRAFT" && (
                      <button
                        ref={issueTrigger}
                        className="primary-action"
                        type="button"
                        disabled={Boolean(pending) || !issueParts.length || pendingLineEdits.length > 0 || Boolean(previousRunMessage)}
                        title={previousRunMessage || (pendingLineEdits.length ? "Lưu hoặc hoàn tác thay đổi trên dòng trước khi phát hành." : undefined)}
                        onClick={() => void openIssueConfirmation()}
                      >
                        {issueActionLabel}
                      </button>
                    )}
                    {invoice.status === "DRAFT" && invoice.revisesInvoiceId && (
                      <button
                        ref={discardTrigger}
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => {
                          setDiscardReason("");
                          setDiscardConfirmation(true);
                        }}
                      >
                        Hủy bản điều chỉnh
                      </button>
                    )}
                    {!invoice.revisesInvoiceId && revisionParts.length > 0 && (
                      <button
                        ref={revisionTrigger}
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => {
                          setRevisionReason("");
                          setRevisionPartId(revisionParts.length === 1 ? revisionParts[0]!.part.id : "");
                          setRevisionConfirmation(true);
                        }}
                      >
                        Chuẩn bị bản điều chỉnh
                      </button>
                    )}
                  </div>
                </aside>
              </div>
              {["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status) &&
                !(invoice.paymentImageAvailable && !(invoice.carries ?? []).length) && (
                  <section aria-label="Thông tin thanh toán đã phát hành">
                    <h4>Hướng dẫn thanh toán đã phát hành</h4>
                    <p>
                      Tổng nghĩa vụ: {vnd(invoice.issue?.obligationTotal ?? invoice.total)} đ. Hạn thanh toán:{" "}
                      {invoice.issue?.dueOn}.
                    </p>
                    <p>
                      {invoice.issue?.bankAccount.receivingBank} / {invoice.issue?.bankAccount.accountNumber} /{" "}
                      {invoice.issue?.bankAccount.accountHolderName}
                    </p>
                    <p>Nội dung chuyển khoản: {invoice.issue?.transferContent}</p>
                    {invoice.receipt ? (
                      <p>
                        Thực nhận: {vnd(invoice.receipt.actualAmount)} đ. Kết quả máy chủ:{" "}
                        {invoice.receipt.outcome === "EXACT"
                          ? "Đủ"
                          : invoice.receipt.outcome === "SHORTFALL"
                            ? "Thu thiếu"
                            : "Thu thừa"}
                        . Chênh lệch: {vnd(invoice.receipt.difference?.signedAmount ?? "0")} đ.
                      </p>
                    ) : invoice.settlementTransfer ? (
                      <p>
                        Đã tất toán theo khoản thu đã ghi nhận trước đó: {vnd(invoice.settlementTransfer.amount)} đ,
                        ghi nhận {invoice.settlementTransfer.postedAt}.
                      </p>
                    ) : (
                      <p>
                        {invoice.status === "CANCELLED"
                          ? "Hóa đơn đã hủy và chỉ đọc."
                          : "Chưa có trạng thái thanh toán trong phạm vi này."}
                      </p>
                    )}
                    {(invoice.carries ?? []).map((carry) => (
                      <p key={`${carry.sourceDifferenceId}-${carry.type}`}>
                        {carry.type === "SHORTFALL_CARRY" ? "Khoản thu thiếu chuyển sang" : "Khoản thu thừa khấu trừ"}:{" "}
                        {vnd(carry.amount)} đ. Phần còn lại của chênh lệch chỉ được máy chủ chuyển vào đợt thu tháng
                        kế tiếp đủ điều kiện.
                      </p>
                    ))}
                  </section>
                )}
              {(invoice.sourceDebtTransfers ?? []).length > 0 && (
                <section aria-label="Công nợ nguồn đã chuyển">
                  <h4>Công nợ đã chuyển</h4>
                  <p>Công nợ nguồn còn lại do máy chủ xác nhận: {vnd(invoice.sourceOutstanding ?? "0")} đ.</p>
                  {invoice.sourceDebtTransfers?.map((transfer) => (
                    <p key={`${transfer.targetInvoiceId}-${transfer.postedAt}`}>
                      Đã chuyển sang hóa đơn kỳ sau: {vnd(transfer.amount)} đ. Lý do: {transfer.reason}. Ghi nhận{" "}
                      {transfer.postedAt}.
                    </p>
                  ))}
                </section>
              )}
              {(invoice.priorDebtTransfers ?? []).length > 0 && (
                <section aria-label="Nguồn công nợ kỳ trước">
                  <h4>Công nợ kỳ trước</h4>
                  {invoice.priorDebtTransfers?.map((transfer) => (
                    <p key={`${transfer.sourceInvoiceId}-${transfer.postedAt}`}>
                      Hóa đơn nguồn: {vnd(transfer.amount)} đ. Lý do: {transfer.reason}. Ghi nhận {transfer.postedAt}.
                    </p>
                  ))}
                </section>
              )}
              {invoice.status === "DRAFT" && (
                <section aria-label="Ưu đãi nộp trước đang soạn">
                  <h4>Quản lý ưu đãi nộp trước</h4>
                  <p>
                    Chọn chính sách ưu đãi nộp trước cho hóa đơn nháp. Kỳ bắt đầu là kỳ của hóa đơn (
                    {invoice.billingMonth}), máy chủ sẽ tự động tạo đủ số kỳ liên tiếp.
                  </p>
                  <label>
                    Chính sách ưu đãi nộp trước
                    <select
                      value={draftCoverageVersionId}
                      onChange={(event) => setDraftCoverageVersionId(event.target.value)}
                      aria-invalid={Boolean(errors.versionId)}
                      aria-describedby={errors.versionId ? "finance-coverage-version-error" : undefined}
                    >
                      <option value="">Chọn chính sách ưu đãi nộp trước</option>
                      {promotionVersions
                        .filter(
                          ({ version }) =>
                            version.status === "ACTIVE" && version.fulfillmentMode === "PREPAID_COVERAGE",
                        )
                        .map(({ policy, version }) => (
                          <option key={version.id} value={version.id}>
                            {policy.name} / Phiên bản {version.version} ({version.prepaidTermMonths ?? 1} tháng)
                          </option>
                        ))}
                    </select>
                  </label>
                  {errors.versionId && <small id="finance-coverage-version-error">{errors.versionId}</small>}
                  <button
                    type="button"
                    disabled={Boolean(pending) || !draftCoverageVersionId}
                    onClick={() => void applyCoverage(draftCoverageVersionId)}
                  >
                    Áp dụng ưu đãi nộp trước
                  </button>
                  {noticeCoverageFacts(invoice).length > 0 && (
                    <button type="button" disabled={Boolean(pending)} onClick={() => void clearCoverage()}>
                      Xóa ưu đãi nộp trước
                    </button>
                  )}
                </section>
              )}
              {noticeCoverageFacts(invoice).length > 0 && (
                <section aria-label="Thông tin ưu đãi nộp trước">
                  <h4>Ưu đãi nộp trước</h4>
                  <table>
                    <caption>Thông tin ưu đãi nộp trước cho hóa đơn</caption>
                    <thead>
                      <tr>
                        <th>Kỳ</th>
                        <th>Khoản thu</th>
                        <th>Giá gốc (đ)</th>
                        <th>Ưu đãi (đ)</th>
                        <th>Thành tiền (đ)</th>
                        <th>Thời gian</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noticeCoverageFacts(invoice).map((fact) => {
                        return (
                          <tr key={`table-${fact.receivableId}-${fact.billingMonth}`}>
                            <td>{fact.billingMonth}</td>
                            <td>{noticeLineName(invoice, fact.receivableId)}</td>
                            <td style={{ textAlign: "right" }}>{vnd(fact.originalPrice)}</td>
                            <td style={{ textAlign: "right" }}>{vnd(fact.reduction)}</td>
                            <td style={{ textAlign: "right" }}>{vnd(fact.netPrice)}</td>
                            <td>
                              {fact.serviceStart} đến {fact.serviceEnd}
                            </td>
                            <td>{fact.issuedAt ? `Đã phát hành ${fact.issuedAt}` : "Chờ hóa đơn đóng"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {noticeCoverageFacts(invoice).map((fact) => (
                    <p key={`${fact.receivableId}-${fact.billingMonth}`}>
                      Kỳ {fact.billingMonth}: giá gốc {vnd(fact.originalPrice)} đ, giảm {vnd(fact.reduction)} đ,
                      khoảng dịch vụ {fact.serviceStart} đến {fact.serviceEnd}, lịch {fact.calendarEffectiveFrom} /{" "}
                      {fact.timezone}.{" "}
                      {fact.issuedAt ? `Đã phát hành ${fact.issuedAt}.` : "Chờ hóa đơn đóng đúng số tiền."}
                    </p>
                  ))}
                </section>
              )}
              <details className="finance-guide">
                <summary>Hướng dẫn</summary>
                <p>
                  Ưu đãi, phần bớt đề xuất và thuế GTGT theo từng khoản thu do hệ thống tính. Không sửa trực tiếp giá
                  trị ưu đãi hay thuế; phần bớt sửa được kèm lý do.
                </p>
                <p>Dòng, chính sách và số tiền được chốt khi phát hành.</p>
              </details>
            </section>
          )}
          {removeConfirmation && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={removeDialog}
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-remove-line-title"
                onKeyDown={trapRemoveFocus}
              >
                <h3 id="finance-remove-line-title">Xóa dòng {removeConfirmation.name}</h3>
                <p>Dòng này sẽ không còn áp dụng cho hóa đơn nháp.</p>
                <div className="dialog-actions"><button data-dialog-cancel autoFocus type="button" disabled={Boolean(pending)} onClick={() => setRemoveConfirmation(undefined)}>
                  Hủy
                </button><button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => void removeLine(removeConfirmation.id, removeConfirmation.invoiceId)}>Xóa dòng {removeConfirmation.name}</button></div>
              </div>
            </>
          )}
          {issueConfirmation && invoice && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={issueDialog}
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-issue-title"
                onKeyDown={trapIssueFocus}
              >
                <h3 id="finance-issue-title">
                  {issueActionLabel} cho {invoice.student.code} / {invoice.student.name} · tháng{" "}
                  {billingMonthLabel(invoice.billingMonth)}
                </h3>
                <p>
                  Lớp {invoice.student.className}. Tổng cần thu do máy chủ xác nhận:{" "}
                  {vnd(invoice.noticeTotal ?? invoice.total)} đ, đã gồm thuế
                  GTGT.
                </p>
                <p>Sau khi phát hành, hóa đơn không sửa trực tiếp được; muốn thay đổi phải tạo bản điều chỉnh.</p>
                {issueParts.map((part) =>
                  part.channel === "SCHOOL" ? (
                    <label key={part.id}>
                      {issueParts.length > 1 ? `Tài khoản trường · ${vnd(part.total)} đ` : "Tài khoản nhận"}
                      <select
                        value={issueSchoolBankAccountId}
                        onChange={(event) => setIssueSchoolBankAccountId(event.target.value)}
                      >
                        <option value="">Chọn tài khoản</option>
                        {schoolBankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.receivingBank} / {account.accountNumber} / {account.accountHolderName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label key={part.id}>
                      {issueParts.length > 1 ? `Tài khoản cá nhân · ${vnd(part.total)} đ` : "Tài khoản nhận"}
                      <select
                        value={issueBankAccountId}
                        onChange={(event) => setIssueBankAccountId(event.target.value)}
                      >
                        <option value="">Chọn tài khoản</option>
                        {personalBankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.receivingBank} / {account.accountNumber} / {account.accountHolderName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
                <div className="dialog-actions">
                  <button data-dialog-cancel type="button" disabled={Boolean(pending)} onClick={() => setIssueConfirmation(false)}>
                    Hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending) || !issueAccountsReady}
                    onClick={() => void issueInvoice()}
                  >
                    {issueActionLabel}
                  </button>
                </div>
              </div>
            </>
          )}
          {revisionConfirmation && invoice && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={revisionDialog}
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-revision-title"
                onKeyDown={trapRevisionFocus}
              >
                <h3 id="finance-revision-title">
                  Chuẩn bị bản điều chỉnh cho {invoice.student.code} / {invoice.student.name} · tháng{" "}
                  {billingMonthLabel(invoice.billingMonth)}
                </h3>
                <p>Hóa đơn đã phát hành vẫn giữ nguyên cho đến khi bản thay thế được phát hành.</p>
                {revisionParts.length > 1 && (
                  <fieldset>
                    <legend>Phần cần điều chỉnh</legend>
                    {revisionParts.map(({ part, number }) => (
                      <label key={part.id}>
                        <input
                          type="radio"
                          name="finance-revision-part"
                          checked={revisionPartId === part.id}
                          onChange={() => setRevisionPartId(part.id)}
                        />
                        Phần {number} · {channelAccountLabel(part.channel)} · {vnd(part.total)} đ
                        {part.status === "CLOSED" ? " · đã thu" : ""}
                      </label>
                    ))}
                  </fieldset>
                )}
                <label>
                  Lý do điều chỉnh
                  <textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} />
                </label>
                <div className="dialog-actions">
                  <button data-dialog-cancel type="button" disabled={Boolean(pending)} onClick={() => setRevisionConfirmation(false)}>
                    Hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending) || !revisionReason.trim() || !revisionPartId}
                    onClick={() => void prepareRevision()}
                  >
                    Chuẩn bị bản điều chỉnh
                  </button>
                </div>
              </div>
            </>
          )}
          {discardConfirmation && invoice && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={discardDialog}
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-discard-title"
                onKeyDown={trapDiscardFocus}
              >
                <h3 id="finance-discard-title">
                  Hủy bản điều chỉnh cho {invoice.student.code} / {invoice.student.name} · tháng{" "}
                  {billingMonthLabel(invoice.billingMonth)}
                </h3>
                <p>Bản điều chỉnh sẽ bị xóa; hóa đơn đã phát hành giữ nguyên.</p>
                <label>
                  Lý do hủy
                  <textarea value={discardReason} onChange={(event) => setDiscardReason(event.target.value)} />
                </label>
                <div className="dialog-actions">
                  <button data-dialog-cancel type="button" disabled={Boolean(pending)} onClick={() => setDiscardConfirmation(false)}>
                    Không hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending) || !discardReason.trim()}
                    onClick={() => void discardRevision()}
                  >
                    Hủy bản điều chỉnh
                  </button>
                </div>
              </div>
            </>
          )}
          {closeConfirmation && run && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={closeDialog}
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-close-run-title"
                onKeyDown={trapCloseFocus}
              >
                <h3 id="finance-close-run-title">Đóng đợt thu {billingMonthLabel(run.billingMonth)}</h3>
                <p>
                  {run.summary && "invoiceCount" in run.summary
                    ? `${run.summary.invoiceCount} hóa đơn, tổng ${vnd(run.summary.invoiceTotal)} đ do máy chủ xác nhận.`
                    : "Máy chủ sẽ xác nhận trạng thái hóa đơn trước khi đóng."}
                </p>
                <p>Sau khi đóng, máy chủ từ chối thêm học sinh và các thao tác tạo hoặc sửa.</p>
                <label>
                  Lý do đóng đợt thu
                  <textarea
                    id="finance-close-reason-field"
                    aria-invalid={Boolean(errors.reason)}
                    aria-describedby={errors.reason ? "finance-close-reason-error" : undefined}
                    value={closeReason}
                    onChange={(event) => setCloseReason(event.target.value)}
                  />
                </label>
                {errors.reason && <small id="finance-close-reason-error">{errors.reason}</small>}
                <div className="dialog-actions">
                  <button
                    data-dialog-cancel
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => {
                      setCloseConfirmation(false);
                      setCloseReason("");
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending) || !closeReason.trim()}
                    onClick={() => void closeRun()}
                  >
                    Đóng đợt thu {billingMonthLabel(run.billingMonth)}
                  </button>
                </div>
              </div>
            </>
          )}
          {generateConfirmation && run && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-generate-title"
                onKeyDown={(event) => { if (event.key === "Escape" && !pending) setGenerateConfirmation(false); else trapDialogFocus(event); }}
              >
                <h3 id="finance-generate-title">Tạo hóa đơn nháp cho đợt {billingMonthLabel(run.billingMonth)}</h3>
                <p>
                  {run.summary && "eligibleCount" in run.summary
                    ? `${run.summary.eligibleCount} học sinh đủ điều kiện, ${run.summary.skippedCount} học sinh bị bỏ qua, cần thu dự kiến ${vnd(run.summary.expectedTotal)} đ.`
                    : "Chưa có số liệu xem trước."}
                </p>
                <p>Máy chủ sẽ đánh giá lại danh sách học sinh trước khi tạo hóa đơn.</p>
                <div className="dialog-actions"><button data-dialog-cancel autoFocus type="button" disabled={Boolean(pending)} onClick={() => setGenerateConfirmation(false)}>Hủy</button><button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => void generate()}>
                  {run.summary && "eligibleCount" in run.summary
                    ? `Tạo hóa đơn nháp cho ${run.summary.eligibleCount} học sinh`
                    : "Tạo hóa đơn nháp"}
                </button></div>
              </div>
            </>
          )}
          {addStudentsOpen && run?.status === "GENERATED" && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                ref={addStudentsDialog}
                className="dialog finance-list-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="generated-student-addition-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeAddStudents();
                  else trapDialogFocus(event);
                }}
              >
                <h3 id="generated-student-addition-title">Thêm học sinh vào đợt đã tạo</h3>
                <p>Máy chủ sẽ tự xác nhận điều kiện học sinh và dùng bản chốt khoản thu của đợt.</p>
                <div className="table-scroll">
                  <table>
                    <caption>Học sinh có thể yêu cầu thêm</caption>
                    <thead>
                      <tr>
                        <th>Học sinh</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(candidates?.students) && candidates.students.length ? (
                        candidates.students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              {student.studentCode} / {student.fullName}
                            </td>
                            <td>
                              <button
                                type="button"
                                disabled={Boolean(pending)}
                                onClick={() => {
                                  setAddStudentsOpen(false);
                                  setAdditionConfirmation(student);
                                }}
                              >
                                Yêu cầu thêm
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2}>
                            {candidates ? "Không có học sinh nào có thể thêm." : "Đang tải học sinh có thể thêm."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={closeAddStudents}>
                  Đóng
                </button>
              </div>
            </>
          )}
          {priorDebtConfirmation && run && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-prior-debt-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !pending) setPriorDebtConfirmation(undefined);
                  else trapDialogFocus(event);
                }}
              >
                <h3 id="finance-prior-debt-title">Chuyển công nợ kỳ trước</h3>
                <p>
                  Chuyển {priorDebtConfirmation.debts.length} hóa đơn, tổng{" "}
                  {vnd(priorDebtConfirmation.total)} đ,
                  vào hóa đơn tháng {billingMonthLabel(run.billingMonth)}. Thao tác này không hoàn tác được.
                </p>
                <div className="dialog-actions">
                  <button
                    data-dialog-cancel
                    type="button"
                    disabled={Boolean(pending)}
                    autoFocus
                    onClick={() => setPriorDebtConfirmation(undefined)}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void transferPriorDebts()}
                  >
                    Chuyển công nợ
                  </button>
                </div>
              </div>
            </>
          )}
          {additionConfirmation && run && (
            <>
              <div className="dialog-backdrop" aria-hidden="true" />
              <div
                className="dialog finance-confirm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-add-student-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !pending) setAdditionConfirmation(undefined);
                  else trapDialogFocus(event);
                }}
              >
                <h3 id="finance-add-student-title">
                  Thêm {additionConfirmation.studentCode} / {additionConfirmation.fullName} vào đợt{" "}
                  {billingMonthLabel(run.billingMonth)}
                </h3>
                <p>Máy chủ sẽ xác nhận điều kiện học sinh và dùng bản chốt khoản thu của đợt.</p>
                <div className="dialog-actions">
                  <button
                    data-dialog-cancel type="button"
                    disabled={Boolean(pending)}
                    autoFocus
                    onClick={() => setAdditionConfirmation(undefined)}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void addGeneratedStudent()}
                  >
                    Thêm học sinh vào đợt
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {lifecycle && (
        <div className="dialog-backdrop">
          <div
            ref={lifecycleDialog}
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-lifecycle-title"
            onKeyDown={trapDialogFocus}
          >
            <form onSubmit={saveLifecycle}>
              <h3 id="finance-lifecycle-title">
                {lifecycle.next === "ACTIVE" ? "Kích hoạt" : "Ngừng áp dụng"} {lifecycle.name}
              </h3>
              <label>
                Lý do
                <input
                  autoFocus
                  value={lifecycle.reason}
                  onChange={(event) => setLifecycle({ ...lifecycle, reason: event.target.value })}
                  {...field("lifecycle", "reason")}
                />
              </label>
              {scope === "lifecycle" && errors.reason && <small id="lifecycle-reason-error">{errors.reason}</small>}
              <button disabled={Boolean(pending)}>Xác nhận</button>
              <button type="button" onClick={() => closeManagedDialog(() => setLifecycle(undefined))}>
                Hủy
              </button>
            </form>
          </div>
        </div>
      )}
      {catalogDialog === "receivable" && (
        <div className="dialog-backdrop">
          <div
            ref={catalogDialogRef}
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-receivable-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setCatalogDialog(undefined), resetReceivable)}
          >
            <form onSubmit={saveReceivable}>
              <h3 id="finance-receivable-title">Thêm khoản thu</h3>
              <p className="muted">Khoản thu mới chỉ dùng được sau khi máy chủ xác nhận trong đúng Trường.</p>
              <div className="dialog-grid">
                <label>
                  Tên khoản thu
                  <input
                    placeholder="Ví dụ: Phí hoạt động"
                    value={receivable.displayName}
                    onChange={(event) => setReceivable({ ...receivable, displayName: event.target.value })}
                    {...field("receivable", "displayName")}
                  />
                </label>
                <label>
                  Mã khoản thu
                  <input
                    placeholder="Không bắt buộc"
                    value={receivable.code}
                    onChange={(event) => setReceivable({ ...receivable, code: event.target.value })}
                  />
                </label>
                <fieldset className="chip-group full" aria-describedby="receivable-kind-hint">
                  <legend>Nhóm khoản thu</legend>
                  {receivableKinds.map((item) => (
                    <label key={item.kind}>
                      <input
                        type="radio"
                        name="receivable-kind"
                        value={item.kind}
                        checked={receivable.kind === item.kind}
                        onChange={() => setReceivable({ ...receivable, kind: item.kind })}
                      />
                      {item.label}
                    </label>
                  ))}
                </fieldset>
                <small className="muted full" id="receivable-kind-hint">
                  {receivableKinds.find((item) => item.kind === receivable.kind)?.hint ??
                    "Chọn một trong ba nhóm cố định của Trường."}
                </small>
                <label>
                  Giá / đơn vị (chưa VAT)
                  <input
                    inputMode="numeric"
                    placeholder="Ví dụ: 350000"
                    value={receivable.defaultUnitPrice}
                    onChange={(event) => setReceivable({ ...receivable, defaultUnitPrice: event.target.value })}
                    {...field("receivable", "defaultUnitPrice")}
                  />
                </label>
                <div>
                  <label>
                    Giá hoàn trả / đơn vị (chưa VAT)
                    <input
                      inputMode="numeric"
                      value={receivable.refundUnitPrice}
                      onChange={(event) =>
                        setReceivable({
                          ...receivable,
                          refundUnitPrice: event.target.value,
                          autoLeaveDeduction: /^0*$/.test(event.target.value) ? false : receivable.autoLeaveDeduction,
                        })
                      }
                      aria-describedby="receivable-refund-hint"
                      {...field("receivable", "refundUnitPrice")}
                    />
                  </label>
                  <small className="muted" id="receivable-refund-hint">
                    Số tiền trả lại cho mỗi đơn vị bớt, không vượt giá thu. Để 0 nếu không hoàn trả.
                  </small>
                </div>
                <label>
                  Đơn vị tính
                  <input
                    list="receivable-units"
                    placeholder="Ví dụ: tháng, ngày, buổi"
                    value={receivable.unitLabel}
                    onChange={(event) => setReceivable({ ...receivable, unitLabel: event.target.value })}
                    {...field("receivable", "unitLabel")}
                  />
                  <UnitSuggestions id="receivable-units" />
                </label>
                <AutoLeaveDeductionField
                  id="receivable-auto"
                  checked={receivable.autoLeaveDeduction}
                  refundUnitPrice={receivable.refundUnitPrice}
                  onChange={(autoLeaveDeduction) => setReceivable({ ...receivable, autoLeaveDeduction })}
                  field={(name) => field("receivable", name)}
                />
                <div>
                  <label>
                    Mức thuế suất
                    <select
                      value={receivable.taxCategory}
                      onChange={(event) =>
                        setReceivable({ ...receivable, taxCategory: event.target.value as TaxCategory })
                      }
                      aria-describedby="receivable-tax-channel-hint"
                    >
                      {taxCategoryOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small className="muted" id="receivable-tax-channel-hint">
                    {taxChannelHint(receivable.taxCategory)}
                  </small>
                </div>
                <p className="muted full">
                  Hệ thống tính thuế GTGT trên số tiền sau ưu đãi và phần bớt, chuyển khoản thu vào đúng tài khoản; đổi
                  mức thuế hoặc giá hoàn trả chỉ áp dụng cho dòng hóa đơn thêm mới hoặc làm mới sau đó.
                </p>
              </div>
              {scope === "receivable" &&
                Object.entries(errors).map(([name, error]) => (
                  <small key={name} id={`receivable-${name}-error`}>
                    {error}
                  </small>
                ))}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => closeNewDialog(() => setCatalogDialog(undefined), resetReceivable)}
                >
                  Hủy
                </button>
                <button className="primary-action" disabled={Boolean(pending)}>
                  Lưu khoản thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {catalogDialog === "receivable-edit" && receivableEdit && (
        <div className="dialog-backdrop">
          <div
            ref={catalogDialogRef}
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-receivable-edit-title"
            onKeyDown={(event) =>
              handleManagedDialogKeyDown(
                event,
                () => setCatalogDialog(undefined),
                () => setReceivableEdit(undefined),
              )
            }
          >
            <form onSubmit={saveReceivableEdit}>
              <h3 id="finance-receivable-edit-title">Chỉnh sửa · {receivableEdit.title}</h3>
              <p className="muted">
                Thay đổi chỉ áp dụng sau khi máy chủ xác nhận trong đúng Trường. Hóa đơn đã tạo giữ nguyên tên, đơn vị,
                giá và mức thuế lúc tạo.
              </p>
              <ReceivableEditFields
                values={receivableEdit.values}
                locked={receivableEdit.locked}
                reason={receivableEdit.reason}
                classNames={receivableEdit.classNames}
                onChange={editReceivable}
                onReason={(reason) => setReceivableEdit({ ...receivableEdit, reason })}
                field={(name) => field("receivable", name)}
              />
              {scope === "receivable" &&
                Object.entries(errors).map(([name, error]) => <small key={name}>{error}</small>)}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() =>
                    closeNewDialog(
                      () => setCatalogDialog(undefined),
                      () => setReceivableEdit(undefined),
                    )
                  }
                >
                  Hủy
                </button>
                <button
                  className="primary-action"
                  disabled={Boolean(pending) || !Object.keys(receivableEditChanges(receivableEdit)).length}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {templateDialog && (
        <div className="dialog-backdrop">
          <div
            ref={templateDialogRef}
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-template-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setTemplateDialog(undefined))}
          >
            <form onSubmit={saveTemplate}>
              <h3 id="finance-template-title">
                {templateDialog.lineId ? `Sửa · ${templateDialog.name}` : "Thêm khoản thu"}
              </h3>
              <div className="dialog-grid">
                <div>
                  <label>
                    Khoản thu
                    <select
                      required
                      disabled={Boolean(templateDialog.lineId)}
                      aria-describedby="template-receivable-hint"
                      value={templateDialog.receivableId}
                      onChange={(event) => setTemplateDialog({ ...templateDialog, receivableId: event.target.value })}
                    >
                      {templateDialog.lineId ? (
                        <option value={templateDialog.receivableId}>{templateDialog.name}</option>
                      ) : (
                        <>
                          <option value="">Chọn khoản thu linh hoạt</option>
                          {(catalog?.receivables ?? [])
                            .filter((item) => item.available && item.kind === "FLEXIBLE")
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.displayName} · {vnd(item.defaultUnitPrice)} đ/{item.unitLabel}
                              </option>
                            ))}
                        </>
                      )}
                    </select>
                  </label>
                  {!templateDialog.lineId && <small className="muted" id="template-receivable-hint">Chỉ khoản thu linh hoạt đang áp dụng. Khoản Ngoại khóa thu theo lớp ngoại khóa.</small>}
                  {errors.receivableId && <small role="alert">{errors.receivableId}</small>}
                </div>
                <div>
                  <label>
                    Số lượng{templateDialog.lineId && templateDialog.kind === "FIXED" ? ` (${catalog?.receivables.find((item) => item.id === templateDialog.receivableId)?.unitLabel ?? "đơn vị"})` : ""}
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      inputMode="numeric"
                      value={templateDialog.quantity}
                      onChange={(event) => setTemplateDialog({ ...templateDialog, quantity: event.target.value })}
                    />
                  </label>
                  {errors.quantity && <small role="alert">{errors.quantity}</small>}
                </div>
                <fieldset className="chip-group full" disabled={templateDialog.kind === "FIXED"}>
                  <legend>Phạm vi</legend>
                  {(
                    [
                      ["ALL", "Toàn bộ"],
                      ["CLASSES", "Lớp chính thức"],
                      ["STUDENTS", "Học sinh cụ thể"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="template-scope"
                        value={value}
                        checked={templateDialog.scopeType === value}
                        onChange={() => setTemplateDialog({ ...templateDialog, scopeType: value })}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {templateDialog.kind === "FIXED" && (
                  <small className="muted full">Khoản thu cố định luôn áp dụng cho toàn bộ học sinh.</small>
                )}
                {templateDialog.scopeType === "CLASSES" && templateDialog.kind !== "FIXED" && (
                  <fieldset className="chip-group full">
                    <legend>Lớp chính thức</legend>
                    {scopeOptions ? (
                      scopeOptions.classes.map((item) => (
                        <label key={item.id}>
                          <input
                            type="checkbox"
                            checked={templateDialog.classIds.includes(item.id)}
                            onChange={(event) =>
                              setTemplateDialog({
                                ...templateDialog,
                                classIds: event.target.checked
                                  ? [...templateDialog.classIds, item.id]
                                  : templateDialog.classIds.filter((id) => id !== item.id),
                              })
                            }
                          />
                          {item.name}
                        </label>
                      ))
                    ) : (
                      <small className="muted">Đang tải lớp.</small>
                    )}
                  </fieldset>
                )}
                {templateDialog.scopeType === "STUDENTS" && templateDialog.kind !== "FIXED" && (
                  <>
                    <label>
                      Lớp chính thức
                      <select
                        value={templateDialog.officialClassId}
                        onChange={(event) =>
                          filterScopeStudents({ search: templateDialog.search, officialClassId: event.target.value })
                        }
                      >
                        <option value="">Tất cả lớp</option>
                        {scopeOptions?.classes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                        <option value="EXTRACURRICULAR_ONLY">Chỉ ngoại khóa</option>
                      </select>
                    </label>
                    <label>
                      Tìm học sinh
                      <input
                        type="search"
                        placeholder="Mã hoặc tên học sinh"
                        autoComplete="off"
                        value={templateDialog.search}
                        onChange={(event) =>
                          filterScopeStudents({
                            search: event.target.value,
                            officialClassId: templateDialog.officialClassId,
                          })
                        }
                      />
                    </label>
                    <div className="full table-scroll picker-scroll">
                      <table>
                        <caption>Học sinh</caption>
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                aria-label="Chọn tất cả học sinh đang hiện"
                                checked={
                                  Boolean(scopeOptions?.students.length) &&
                                  (scopeOptions?.students ?? []).every((item) =>
                                    templateDialog.students.some((student) => student.id === item.id),
                                  )
                                }
                                onChange={(event) => {
                                  const visible = scopeOptions?.students ?? [];
                                  const kept = templateDialog.students.filter(
                                    (student) => !visible.some((item) => item.id === student.id),
                                  );
                                  setTemplateDialog({
                                    ...templateDialog,
                                    students: event.target.checked
                                      ? [
                                          ...kept,
                                          ...visible.map((item) => ({
                                            id: item.id,
                                            label: `${item.studentCode} · ${item.fullName}`,
                                          })),
                                        ]
                                      : kept,
                                  });
                                }}
                              />
                            </th>
                            <th>Mã HS</th>
                            <th>Họ tên</th>
                            <th>Lớp chính thức</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!scopeOptions ? (
                            <tr>
                              <td colSpan={4}>Đang tải học sinh.</td>
                            </tr>
                          ) : scopeOptions.students.length ? (
                            scopeOptions.students.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    aria-label={`Chọn ${item.fullName}`}
                                    checked={templateDialog.students.some((student) => student.id === item.id)}
                                    onChange={(event) =>
                                      setTemplateDialog({
                                        ...templateDialog,
                                        students: event.target.checked
                                          ? [
                                              ...templateDialog.students,
                                              { id: item.id, label: `${item.studentCode} · ${item.fullName}` },
                                            ]
                                          : templateDialog.students.filter((student) => student.id !== item.id),
                                      })
                                    }
                                  />
                                </td>
                                <td>{item.studentCode}</td>
                                <td>
                                  <b>{item.fullName}</b>
                                </td>
                                <td>{item.className ?? "—"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4}>Không có học sinh phù hợp.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted full" aria-live="polite">
                      {templateDialog.students.length
                        ? `Đã chọn ${templateDialog.students.length} học sinh.`
                        : "Chưa chọn học sinh nào."}
                    </p>
                  </>
                )}
                {errors.scope && (
                  <small className="full" role="alert">
                    {errors.scope}
                  </small>
                )}
              </div>
              <div className="dialog-actions">
                <button type="button" disabled={Boolean(pending)} onClick={closeTemplateDialog}>
                  Hủy
                </button>
                <button className="primary-action" disabled={Boolean(pending)}>
                  Lưu khoản thu mẫu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {templateRemoval && (
        <div className="dialog-backdrop">
          <div
            ref={removalDialogRef}
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-template-remove-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setTemplateRemoval(undefined))}
          >
            <h3 id="finance-template-remove-title">Bỏ {templateRemoval.name} khỏi đợt thu</h3>
            <p>Khoản thu sẽ không có trong hóa đơn nháp của đợt này. Cần xem trước lại sau khi bỏ.</p>
            <div className="dialog-actions">
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() =>
                  closeNewDialog(
                    () => setTemplateRemoval(undefined),
                    () => {},
                  )
                }
              >
                Hủy
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void removeTemplate()}
              >
                Bỏ khoản thu
              </button>
            </div>
          </div>
        </div>
      )}
      {classExclusion && (
        <div className="dialog-backdrop">
          <div
            ref={classExclusionRef}
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-class-exclusion-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setClassExclusion(undefined))}
          >
            <form onSubmit={saveClassExclusion}>
              <h3 id="finance-class-exclusion-title">
                {classExclusion.excluded
                  ? `Loại ${classExclusion.name} khỏi đợt này`
                  : `Khôi phục ${classExclusion.name} vào đợt này`}
              </h3>
              <p className="muted">
                {classExclusion.excluded
                  ? "Thành viên của lớp sẽ không có dòng khoản thu ngoại khóa trong đợt này. Lớp và thành viên không thay đổi; cần xem trước lại."
                  : "Thành viên có hiệu lực trong tháng sẽ được tính lại khoản thu của lớp; cần xem trước lại."}
              </p>
              <label>
                Lý do (không bắt buộc)
                <input
                  autoFocus
                  placeholder="Ví dụ: Lớp nghỉ cả tháng"
                  value={classExclusion.reason}
                  onChange={(event) => setClassExclusion({ ...classExclusion, reason: event.target.value })}
                />
              </label>
              {scope === "run" &&
                Object.entries(errors).map(([name, error]) => (
                  <small key={name} role="alert">
                    {error}
                  </small>
                ))}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() =>
                    closeNewDialog(
                      () => setClassExclusion(undefined),
                      () => {},
                    )
                  }
                >
                  Hủy
                </button>
                <button className="primary-action" disabled={Boolean(pending)}>
                  {classExclusion.excluded ? "Loại khỏi đợt này" : "Khôi phục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {lineDialog && invoice?.status === "DRAFT" && (
        <div className="dialog-backdrop">
          <div
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-line-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setLineDialog(false), resetLineForm)}
          >
            <form onSubmit={saveLine}>
              <h3 id="finance-line-title">{editingLineId
                  ? `Nguồn giải thích · ${noticeParts.flatMap((part) => part.lines).find((item) => item.id === editingLineId)?.receivableName ?? ""}`
                  : "Thêm dòng"}</h3>
              <div className="dialog-grid">
                {!editingLineId && (
                  <>
                <div className="full">
                  <label>
                    Khoản thu
                    <select
                      autoFocus={!editingLineId}
                      disabled={Boolean(editingLineId)}
                      value={line.receivableId}
                      onChange={(event) => setLine({ ...line, receivableId: event.target.value })}
                      {...invoiceField("receivableId")}
                    >
                      <option value="">Chọn khoản thu</option>
                      {(catalog?.receivables ?? [])
                        .filter((item) => item.available || item.id === line.receivableId)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                  {scope === "invoice" && errors.receivableId && (
                    <small id="invoice-invoice-receivableId-error">{errors.receivableId}</small>
                  )}
                </div>
                <div>
                  <label>
                    Số lượng
                    <input
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(event) => setLine({ ...line, quantity: event.target.value })}
                      {...invoiceField("quantity")}
                    />
                  </label>
                  {scope === "invoice" && errors.quantity && (
                    <small id="invoice-invoice-quantity-error">{errors.quantity}</small>
                  )}
                </div>
                <div>
                  <label>
                    Đơn giá điều chỉnh (đ, không bắt buộc)
                    <input
                      inputMode="numeric"
                      value={line.unitPrice}
                      onChange={(event) => setLine({ ...line, unitPrice: event.target.value })}
                      {...invoiceField("unitPrice")}
                    />
                  </label>
                  {scope === "invoice" && errors.unitPrice && (
                    <small id="invoice-invoice-unitPrice-error">{errors.unitPrice}</small>
                  )}
                </div>
                <div className="full">
                  <label>
                    Lý do điều chỉnh
                    <input
                      value={line.overrideReason}
                      onChange={(event) => setLine({ ...line, overrideReason: event.target.value })}
                      {...invoiceField("overrideReason")}
                    />
                  </label>
                  {scope === "invoice" && errors.overrideReason && (
                    <small id="invoice-invoice-overrideReason-error">{errors.overrideReason}</small>
                  )}
                </div>
                  </>
                )}
                <details
                  className="full"
                  open={Boolean(
                    editingLineId ||
                    line.serviceDate || line.attendanceState || line.pickedUpAt || line.lateCareMinutes || line.sourceReason,
                  )}
                >
                  <summary>Nguồn giải thích thủ công</summary>
                  <div className="dialog-grid">
                    <label>
                      Ngày dịch vụ
                      <DateInput
                        autoFocus={Boolean(editingLineId)}
                        value={line.serviceDate}
                        onChange={(event) => setLine({ ...line, serviceDate: event.target.value })}
                      />
                    </label>
                    <label>
                      Điểm danh
                      <select
                        value={line.attendanceState}
                        onChange={(event) => setLine({ ...line, attendanceState: event.target.value })}
                      >
                        <option value="">Không có</option>
                        <option value="PRESENT">Có mặt</option>
                        <option value="ABSENT">Vắng mặt</option>
                      </select>
                    </label>
                    <label>
                      Giờ đón (HH:MM)
                      <input
                        value={line.pickedUpAt}
                        onChange={(event) => setLine({ ...line, pickedUpAt: event.target.value })}
                      />
                    </label>
                    <label>
                      Số phút trông muộn
                      <input
                        inputMode="numeric"
                        value={line.lateCareMinutes}
                        onChange={(event) => setLine({ ...line, lateCareMinutes: event.target.value })}
                      />
                    </label>
                    <label className="full">
                      Lý do nguồn giải thích
                      <input
                        value={line.sourceReason}
                        onChange={(event) => setLine({ ...line, sourceReason: event.target.value })}
                      />
                    </label>
                  </div>
                </details>
              </div>
              <p className="muted">
                {editingLineId
                  ? "Số lượng, đơn giá và phần bớt sửa trực tiếp trên dòng."
                  : "Hệ thống tính lại ưu đãi, thuế GTGT và tổng phần sau khi lưu."}
              </p>
              {scope === "invoice" && message && <p className="finance-alert">{message}</p>}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => closeNewDialog(() => setLineDialog(false), resetLineForm)}
                >
                  Hủy
                </button>
                <button className="primary-action" disabled={Boolean(pending)}>
                  {editingLineId ? "Lưu nguồn" : "Thêm dòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {promotionDialog === "policy" && <div className="dialog-backdrop" aria-hidden="true" />}
      {promotionDialog === "policy" && (
        <div
          ref={promotionDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-policy-title"
          onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setPromotionDialog(undefined), resetPromotion)}
        >
          <form onSubmit={savePromotion}>
            <h3 id="finance-policy-title">Thêm chính sách ưu đãi</h3>
            <p>Hệ thống kiểm tra khoản thu, hiệu lực và quy tắc kết hợp trong đúng Trường.</p>
            {promotionPolicies.length > 0 && (
              <>
                <label className="finance-policy-full">
                  Chính sách hiện có (để tạo phiên bản mới)
                  <select
                    value={promotion.policyId}
                    onChange={(event) => {
                      const policy = promotionPolicies.find((item) => item.id === event.target.value);
                      setPromotion({ ...promotion, policyId: event.target.value, name: policy?.name ?? "" });
                    }}
                    {...promotionField("policyId")}
                  >
                    <option value="">Chính sách mới</option>
                    {promotionPolicies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {scope === "promotion" && errors.policyId && (
                  <small id="invoice-promotion-policyId-error" className="finance-policy-full">
                    {errors.policyId}
                  </small>
                )}
              </>
            )}
            <label className="finance-policy-full">
              Tên chính sách
              <input
                value={promotion.name}
                disabled={Boolean(promotion.policyId)}
                onChange={(event) => setPromotion({ ...promotion, name: event.target.value })}
                {...promotionField("name")}
              />
            </label>
            {scope === "promotion" && errors.name && (
              <small id="invoice-promotion-name-error" className="finance-policy-full">
                {errors.name}
              </small>
            )}
            <fieldset className="finance-policy-full" {...promotionField("receivableIds")}>
              <legend>Khoản thu áp dụng</legend>
              {(catalog?.receivables ?? [])
                .filter((item) => item.available)
                .map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={promotion.receivableIds.includes(item.id)}
                      onChange={() =>
                        setPromotion({
                          ...promotion,
                          receivableIds: promotion.receivableIds.includes(item.id)
                            ? promotion.receivableIds.filter((id) => id !== item.id)
                            : [...promotion.receivableIds, item.id],
                        })
                      }
                    />
                    {item.displayName}
                  </label>
                ))}
            </fieldset>
            {scope === "promotion" && errors.receivableIds && (
              <small id="invoice-promotion-receivableIds-error" className="finance-policy-full">
                {errors.receivableIds}
              </small>
            )}
            <label>
              Loại giảm
              <select
                value={promotion.discountType}
                onChange={(event) => setPromotion({ ...promotion, discountType: event.target.value })}
              >
                <option value="PERCENTAGE">Phần trăm</option>
                <option value="FIXED_VND">Số tiền (đ)</option>
              </select>
            </label>
            <label>
              Mức giảm
              <input
                inputMode="numeric"
                value={promotion.discountValue}
                onChange={(event) => setPromotion({ ...promotion, discountValue: event.target.value })}
                {...promotionField("discountValue")}
              />
            </label>
            {promotion.fulfillmentMode === "PREPAID_COVERAGE" && (
              <small className="muted finance-policy-full">Gói nộp trước có thể để mức giảm 0 nếu trường không giảm giá.</small>
            )}
            {scope === "promotion" && errors.discountValue && (
              <small id="invoice-promotion-discountValue-error" className="finance-policy-full">
                {errors.discountValue}
              </small>
            )}
            <label>
              Hiệu lực từ
              <DateInput
                value={promotion.effectiveFrom}
                onChange={(event) => setPromotion({ ...promotion, effectiveFrom: event.target.value })}
              />
            </label>
            <label>
              Hiệu lực đến (bao gồm)
              <DateInput
                value={promotion.effectiveTo}
                onChange={(event) => setPromotion({ ...promotion, effectiveTo: event.target.value })}
              />
            </label>
            <label>
              Ưu tiên
              <input
                inputMode="numeric"
                value={promotion.priority}
                onChange={(event) => setPromotion({ ...promotion, priority: event.target.value })}
              />
            </label>
            <label>
              Quy tắc kết hợp
              <select
                value={promotion.stackingMode}
                onChange={(event) => setPromotion({ ...promotion, stackingMode: event.target.value })}
              >
                <option value="STACKABLE">Có thể kết hợp</option>
                <option value="EXCLUSIVE">Độc quyền</option>
              </select>
            </label>
            <fieldset className="finance-policy-full finance-policy-fulfillment">
              <legend>Cách thực hiện</legend>
              <div className="finance-policy-options">
                <label
                  className={`finance-policy-option-card ${promotion.fulfillmentMode === "DISCOUNT" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="fulfillmentMode"
                    value="DISCOUNT"
                    checked={promotion.fulfillmentMode === "DISCOUNT"}
                    onChange={(event) =>
                      setPromotion({
                        ...promotion,
                        fulfillmentMode: event.target.value as "DISCOUNT" | "PREPAID_COVERAGE",
                        prepaidTermMonths: "",
                      })
                    }
                  />
                  <div className="finance-policy-option-text">
                    <strong>Giảm trên hóa đơn</strong>
                    <span>Giảm trực tiếp số tiền phải nộp trên hóa đơn của kỳ thu hiện tại.</span>
                  </div>
                </label>
                <label
                  className={`finance-policy-option-card ${promotion.fulfillmentMode === "PREPAID_COVERAGE" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="fulfillmentMode"
                    value="PREPAID_COVERAGE"
                    checked={promotion.fulfillmentMode === "PREPAID_COVERAGE"}
                    onChange={(event) =>
                      setPromotion({
                        ...promotion,
                        fulfillmentMode: event.target.value as "DISCOUNT" | "PREPAID_COVERAGE",
                        prepaidTermMonths: promotion.prepaidTermMonths || "1",
                      })
                    }
                  />
                  <div className="finance-policy-option-text">
                    <strong>Ưu đãi nộp trước</strong>
                    <span>
                      Thu trước các kỳ tương lai liên tiếp tính từ kỳ của hóa đơn; chỉ phát hành quyền ưu đãi sau khi
                      hóa đơn đóng đủ số tiền.
                    </span>
                  </div>
                </label>
              </div>
            </fieldset>
            {promotion.fulfillmentMode === "PREPAID_COVERAGE" && (
              <label className="finance-policy-full">
                Thời hạn nộp trước (tháng)
                <input
                  inputMode="numeric"
                  value={promotion.prepaidTermMonths}
                  onChange={(event) => setPromotion({ ...promotion, prepaidTermMonths: event.target.value })}
                  {...promotionField("prepaidTermMonths")}
                />
              </label>
            )}
            {scope === "promotion" && errors.prepaidTermMonths && (
              <small id="invoice-promotion-prepaidTermMonths-error" className="finance-policy-full">
                {errors.prepaidTermMonths}
              </small>
            )}
            <div className="finance-policy-actions">
              <button disabled={Boolean(pending)}>Lưu phiên bản ưu đãi</button>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => closeNewDialog(() => setPromotionDialog(undefined), resetPromotion)}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
      {promotionTransition && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-promotion-transition-title"
          onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setPromotionTransition(undefined))}
        >
          <h3 id="finance-promotion-transition-title">
            {promotionTransition.action === "activate" ? "Kích hoạt" : "Ngừng"} phiên bản {promotionTransition.name}
          </h3>
          <p>
            {promotionTransition.action === "activate"
              ? "Phiên bản này sẽ trở thành trạng thái do máy chủ xác nhận."
              : "Phiên bản này sẽ không còn được áp dụng cho các đánh giá mới."}
          </p>
          <button
            id="finance-promotion-transition-confirm"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void confirmPromotionTransition(promotionTransition.id, promotionTransition.action)}
          >
            Xác nhận {promotionTransition.action === "activate" ? "kích hoạt" : "ngừng phiên bản"}
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() =>
              closeNewDialog(
                () => setPromotionTransition(undefined),
                () => {},
              )
            }
          >
            Hủy
          </button>
        </div>
      )}
      {promotionDialog === "assignment" && (
        <div className="dialog-backdrop">
          <div
            ref={promotionDialogRef}
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-assignment-title"
            onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setPromotionDialog(undefined))}
          >
            <form onSubmit={saveAssignments}>
              <h3 id="finance-assignment-title">Gán ưu đãi cho học sinh</h3>
              <p className="muted">
                Chọn một hoặc nhiều học sinh. Cả nhóm dùng chung thời hạn và lý do; máy chủ chỉ lưu khi toàn bộ danh sách
                hợp lệ.
              </p>
              <div className="dialog-grid">
                <label className="full">
                  Phiên bản đang áp dụng
                  <select
                    value={assignment.versionId}
                    onChange={(event) => setAssignment({ ...assignment, versionId: event.target.value, studentIds: [] })}
                  >
                    <option value="">Chọn phiên bản</option>
                    {promotionPolicies.flatMap((policy) =>
                      (policy.versions ?? [])
                        .filter((version) => version.status === "ACTIVE")
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            {policy.name} / Phiên bản {version.version}
                          </option>
                        )),
                    )}
                  </select>
                </label>
                <label>
                  Áp dụng từ
                  <DateInput
                    value={assignment.effectiveFrom}
                    onChange={(event) => setAssignment({ ...assignment, effectiveFrom: event.target.value })}
                  />
                </label>
                <label>
                  Áp dụng đến (bao gồm)
                  <DateInput
                    value={assignment.effectiveTo}
                    onChange={(event) => setAssignment({ ...assignment, effectiveTo: event.target.value })}
                  />
                </label>
                <label>
                  Lớp chính thức
                  <select
                    value={assignmentFilter.officialClassId}
                    onChange={(event) => setAssignmentFilter({ ...assignmentFilter, officialClassId: event.target.value })}
                  >
                    <option value="">Tất cả lớp</option>
                    {assignmentCandidates?.officialClasses.map((item) => (
                      <option key={item.id} value={item.id ?? ""}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tìm học sinh
                  <input
                    type="search"
                    placeholder="Mã hoặc tên học sinh"
                    autoComplete="off"
                    value={assignmentFilter.q}
                    onChange={(event) => setAssignmentFilter({ ...assignmentFilter, q: event.target.value })}
                  />
                </label>
                <div className="full table-scroll picker-scroll">
                  <table>
                    <caption>
                      Học sinh{assignmentCandidates?.schoolYear ? ` · ${assignmentCandidates.schoolYear.name}` : ""}
                    </caption>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả học sinh đang hiện"
                            checked={(() => {
                              const open = assignmentCandidates?.students.filter((item) => !item.assigned) ?? [];
                              return open.length > 0 && open.every((item) => assignment.studentIds.includes(item.id));
                            })()}
                            onChange={(event) => {
                              const visible = (assignmentCandidates?.students ?? [])
                                .filter((item) => !item.assigned)
                                .map((item) => item.id);
                              setAssignment({
                                ...assignment,
                                studentIds: event.target.checked
                                  ? [...new Set([...assignment.studentIds, ...visible])]
                                  : assignment.studentIds.filter((id) => !visible.includes(id)),
                              });
                            }}
                          />
                        </th>
                        <th>Mã HS</th>
                        <th>Họ tên</th>
                        <th>Lớp chính thức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!assignment.versionId ? (
                        <tr>
                          <td colSpan={4}>Chọn phiên bản để xem học sinh.</td>
                        </tr>
                      ) : !assignmentCandidates ? (
                        <tr>
                          <td colSpan={4}>Đang tải học sinh.</td>
                        </tr>
                      ) : assignmentCandidates.students.length ? (
                        assignmentCandidates.students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${student.fullName}`}
                                disabled={student.assigned}
                                checked={assignment.studentIds.includes(student.id)}
                                onChange={(event) =>
                                  setAssignment({
                                    ...assignment,
                                    studentIds: event.target.checked
                                      ? [...assignment.studentIds, student.id]
                                      : assignment.studentIds.filter((id) => id !== student.id),
                                  })
                                }
                              />
                            </td>
                            <td>{student.studentCode}</td>
                            <td>
                              <b>{student.fullName}</b>
                              {student.assigned && (
                                <>
                                  <br />
                                  <small className="muted">Đã gán ưu đãi này</small>
                                </>
                              )}
                            </td>
                            <td>{student.officialClassName ?? "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>Không có học sinh phù hợp.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="muted full" aria-live="polite">
                  {assignment.studentIds.length
                    ? `Đã chọn ${assignment.studentIds.length} học sinh.`
                    : "Chưa chọn học sinh nào."}
                </p>
                <label className="full">
                  Lý do
                  <input
                    placeholder="Ví dụ: Con của nhân viên trường"
                    value={assignment.reason}
                    onChange={(event) => setAssignment({ ...assignment, reason: event.target.value })}
                  />
                </label>
              </div>
              {scope === "promotion" &&
                Object.entries(errors).map(([name, error]) => <small key={name}>{error}</small>)}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => closeManagedDialog(() => setPromotionDialog(undefined))}
                >
                  Hủy
                </button>
                <button className="primary-action" disabled={Boolean(pending) || !assignment.studentIds.length}>
                  Lưu gán học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {endingAssignment && (
        <div role="dialog" aria-modal="true" aria-labelledby="finance-end-assignment-title" onKeyDown={trapDialogFocus}>
          <form onSubmit={endAssignment}>
            <h3 id="finance-end-assignment-title">Kết thúc áp dụng ưu đãi</h3>
            <label>
              Ngày kết thúc (bao gồm)
              <DateInput
                autoFocus
                value={endingAssignment.effectiveTo}
                onChange={(event) => setEndingAssignment({ ...endingAssignment, effectiveTo: event.target.value })}
              />
            </label>
            <label>
              Lý do
              <textarea
                value={endingAssignment.reason}
                onChange={(event) => setEndingAssignment({ ...endingAssignment, reason: event.target.value })}
              />
            </label>
            <button disabled={Boolean(pending)}>Xác nhận kết thúc</button>
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => closeManagedDialog(() => setEndingAssignment(undefined))}
            >
              Hủy
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
