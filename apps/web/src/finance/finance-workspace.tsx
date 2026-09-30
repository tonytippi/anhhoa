import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";
import { PaymentImagePanel } from "./payment-image-panel";

type Group = { id: string; name: string; status: "ACTIVE" | "INACTIVE" | null };
type Receivable = {
  id: string;
  groupId: string;
  code: string | null;
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  taxCategory?: TaxCategory;
  channel?: PaymentChannel;
  status: "ACTIVE" | "INACTIVE" | null;
  available: boolean;
};
type TaxCategory = "NOT_DECLARED" | "EXEMPT" | "VAT_0" | "VAT_5" | "VAT_8" | "VAT_10";
type PaymentChannel = "SCHOOL" | "PERSONAL";
// Labels follow the reviewed receivable mockup; the API alone derives rate, VAT and channel.
const taxCategoryOptions: Array<[TaxCategory, string]> = [["NOT_DECLARED", "Không kê khai nộp thuế"], ["EXEMPT", "Không chịu thuế"], ["VAT_0", "Thuế suất 0%"], ["VAT_5", "Thuế suất 5%"], ["VAT_8", "Thuế suất 8%"], ["VAT_10", "Thuế suất 10%"]];
const taxShortLabel: Record<TaxCategory, string> = { NOT_DECLARED: "Không kê khai", EXEMPT: "Không chịu thuế", VAT_0: "0%", VAT_5: "5%", VAT_8: "8%", VAT_10: "10%" };
const channelAccountLabel = (channel: PaymentChannel | undefined) => channel === "SCHOOL" ? "Tài khoản trường" : "Tài khoản cá nhân";
// Review moves student by student: the first part of each payment notice stands for the Student.
const studentQueueIds = (invoices: Array<{ id: string; studentId: string }> | undefined) => [...new Map((invoices ?? []).map((item) => [item.studentId, item.id] as const).reverse()).values()].reverse();
const taxChannelHint = (category: TaxCategory) => category === "NOT_DECLARED" ? "Thu vào tài khoản cá nhân" : "Thu vào tài khoản trường";
type Catalog = { groups: Group[]; receivables: Receivable[]; schoolYears?: Year[] };
type PromotionPolicy = { id: string; name: string; versions: Array<{ id: string; version: number; status: "DRAFT" | "ACTIVE" | "RETIRED"; discountType: "FIXED_VND" | "PERCENTAGE"; discountValue: string; priority: number; stackingMode: "STACKABLE" | "EXCLUSIVE"; fulfillmentMode: "DISCOUNT" | "PREPAID_COVERAGE"; prepaidTermMonths?: number | null; effectiveFrom: string; effectiveTo: string | null; targets: Array<{ id: string; receivableId: string; receivableName: string }>; assignments: Array<{ id: string; studentId: string; studentCode: string; studentName: string; effectiveFrom: string; effectiveTo: string | null; isCurrent: boolean; reason: string; endReason: string | null }> }> };
type Year = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  closedAt: string | null;
};
type Candidate = { id: string; studentCode: string; fullName: string };
type Candidates = { schoolYears: Year[]; students: Candidate[] };
type Run = {
  id: string;
  schoolYearId: string;
  billingMonth: string;
  type: "MONTHLY";
  status: "DRAFT" | "READY" | "GENERATED" | "CLOSED";
  version: number;
  templateLines: Array<{ id: string; receivableId: string; receivableName: string; unitLabel: string; defaultUnitPrice: string; quantity: string; amount: string }>;
  coverageSelections?: Array<{ studentId: string; versionId: string; billingMonth: string }>;
  invoices?: Array<{ id: string; studentId: string; studentCode: string; studentName: string; className: string; status: string; total: string; channel?: PaymentChannel }>;
  summary?: PreviewSummary | InvoiceSummary;
};
type PreviewSummary = { eligibleCount: number; skippedCount: number; expectedTotal: string };
type InvoiceSummary = { invoiceCount: number; issuedCount: number; invoiceTotal: string };
type Preview = {
  run: Run;
  eligible: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
    lines: Array<{ receivableId: string; receivableName: string; grossAmount: string; discountAmount: string; netAmount: string; taxCategory?: TaxCategory | null; vatRate?: number | null; vatAmount?: string; promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> } }>;
  }>;
  skips: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
  fingerprint: string;
  summary?: PreviewSummary;
  coverageSelections?: Array<{ studentId: string; versionId: string; billingMonth: string }>;
  futureCoverageFacts?: Array<{ studentId: string; billingMonth: string; policyId: string; versionId: string; receivableId: string; receivableName: string; originalPrice: string; reduction: string; serviceStart: string; serviceEnd: string; calendarEffectiveFrom: string; timezone: string }>;
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
type Source = { serviceDate: string | null; attendanceState: "PRESENT" | "ABSENT" | null; pickedUpAt: string | null; lateCareMinutes: number | null };
type BankAccount = { id: string; kind?: PaymentChannel; receivingBank: string; bankBin?: string | null; accountNumber: string; accountHolderName: string };
type Invoice = { id: string; channel?: PaymentChannel; notice?: { classDefaultBankAccountId: string | null; invoices: Invoice[] }; status: string; total: string; sourceOutstanding?: string | null; billingMonth: string; revisesInvoiceId: string | null; revisionReason: string | null; replacementInvoiceId: string | null; receipt: { actualAmount: string; outcome: "EXACT" | "SHORTFALL" | "OVERPAYMENT"; postedAt: string; difference: { signedAmount: string } | null } | null; settlementTransfer: { sourceInvoiceId: string; sourceReceiptId: string; amount: string; postedAt: string } | null; sourceDebtTransfers?: Array<{ targetInvoiceId: string; amount: string; reason: string; postedAt: string }>; priorDebtTransfers?: Array<{ sourceInvoiceId: string; amount: string; reason: string; postedAt: string }>; carries: Array<{ type: "SHORTFALL_CARRY" | "OVERPAYMENT_CARRY"; amount: string; sourceDifferenceId: string }>; coverageFacts?: Array<{ coverageId: string | null; receivableId: string; billingMonth: string; policyId: string; versionId: string; originalPrice: string; reduction: string; serviceStart: string; serviceEnd: string; calendarEffectiveFrom: string; timezone: string; issuedAt: string | null }>; paymentImageAvailable?: boolean; student: { code: string; name: string; className: string }; lines: Array<{ id: string; kind?: "NORMAL" | "PRIOR_DEBT"; receivableId: string | null; receivableName: string; unitLabel: string; unitPrice: string; quantity: string; amount: string; grossAmount: string; discountAmount: string; netAmount: string; taxCategory?: TaxCategory | null; vatRate?: number | null; vatAmount?: string; promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> } | null; promotionApplicationSnapshot: Array<{ assignmentReason: string; appliedDiscount: string }> | null; overrideReason: string | null; source: Source | null; sourceReason: string | null; sourceRecordedAt: string | null; sourceProvenance: unknown; sourceAudit: { actorIdentityId: string; membershipId: string } | null }>; issue?: { obligationCode?: string | null; obligationTotal: string; dueOn: string; bankAccount: BankAccount; transferContent: string; policy: { effectiveFrom: string; dueDaysAfterIssue: number; taxTreatment: string; debtScope: string; reversalMode: string } } };
type Pending = { id: string; schoolId: string };
type CoverageReversalPreview = { coverageId: string; effectiveOn: string; denominator: number; remainingDays: number; calculatedAmount: string; calculatedVatAmount?: string; vatRate?: number | null; availableAmount: string; source: { studentName: string; reversalMode: "DIRECT" | "SCHOOL_ADMIN_APPROVAL"; invoiceId: string; receiptId: string; serviceStart: string; serviceEnd: string; calendarEffectiveFrom: string; timezone: string; eligibility: { id: string; reason: string; effectiveOn: string } } };
type CoverageReversalRequest = { id: string; coverageId: string; studentName: string; amount: string; vatAmount?: string; effectiveOn: string; reason: string; canDecide: boolean };
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
  kind: "receivable-groups" | "receivables";
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
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-finance-operation";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
const displayDate = (value: string) => value.split("-").reverse().join("/");
const skipReason = (reason: string) =>
  ({
    NO_ENROLLMENT: "Không còn hồ sơ nhập học.",
    ENROLLMENT_NOT_EFFECTIVE: "Nhập học không hiệu lực vào đầu tháng thu.",
    NOT_ENROLLED: "Học sinh không ở trạng thái đang theo học.",
    NO_CLASS_ASSIGNMENT: "Chưa có lớp được phân công hiệu lực vào đầu tháng thu.",
    CLASS_INACTIVE: "Lớp được phân công đã ngừng hoạt động.",
    INVOICE_EXISTS: "Học sinh đã có hóa đơn trong đợt thu này.",
  })[reason] ?? "Không đủ điều kiện theo roster hiện tại.";
const runStatusLabel = (status: Run["status"]) => ({
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
      ["Cần thu dự kiến", summary ? `${vnd(summary.expectedTotal)} VND` : missing],
    ];
  }
  const summary = run.summary as InvoiceSummary | undefined;
  return [
    ["Hóa đơn", summary ? String(summary.invoiceCount) : "Chưa có số liệu"],
    ["Đã phát hành", summary ? String(summary.issuedCount) : "Chưa có số liệu"],
    ["Tổng phải thu", summary ? `${vnd(summary.invoiceTotal)} VND` : "Chưa có số liệu"],
  ];
};
const billingMonthLabel = (month: string) => {
  const [year, value] = (month ?? "").split("-");
  return year && value ? `${value}/${year}` : month;
};
const invoiceStatusLabel = (status: string) => ({
  DRAFT: "Nháp",
  ISSUED: "Đã phát hành",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
})[status] ?? "Đã cập nhật";

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
}) {
  void schoolName;
  const [catalog, setCatalog] = useState<Catalog>();
  const [promotionData, setPromotionData] = useState({ schoolId, policies: [] as PromotionPolicy[], students: [] as Candidate[] });
  const [promotion, setPromotion] = useState(defaultPromotion);
  const [assignment, setAssignment] = useState({ versionId: "", studentIds: [] as string[], effectiveFrom: "", effectiveTo: "", reason: "" });
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
  const [generateConfirmationMonth, setGenerateConfirmationMonth] = useState("");
  const [additionConfirmation, setAdditionConfirmation] = useState<Candidate>();
  const [additionConfirmationName, setAdditionConfirmationName] = useState("");
  const [closeConfirmation, setCloseConfirmation] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeConfirmationMonth, setCloseConfirmationMonth] = useState("");
  const [generatedOutcome, setGeneratedOutcome] = useState<GenerateOutcome>();
  const [invoice, setInvoice] = useState<Invoice>();
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [issueConfirmation, setIssueConfirmation] = useState(false);
  const [issueConfirmationName, setIssueConfirmationName] = useState("");
  const [issueBankAccountId, setIssueBankAccountId] = useState("");
  const [revisionConfirmation, setRevisionConfirmation] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionConfirmationName, setRevisionConfirmationName] = useState("");
  const [coverageReversal, setCoverageReversal] = useState({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" });
  const [coverageReversalPreview, setCoverageReversalPreview] = useState<CoverageReversalPreview>();
  const [coverageDecision, setCoverageDecision] = useState<{ request: CoverageReversalRequest; decision: "APPROVE" | "REFUSE"; reason: string }>();
  const [line, setLine] = useState({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" });
  const [editingLineId, setEditingLineId] = useState<string>();
  const [editingSource, setEditingSource] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<{ id: string; name: string; invoiceId: string }>();
  const [editingLineInvoiceId, setEditingLineInvoiceId] = useState<string>();
  const [open, setOpen] = useState({ schoolYearId: "", billingMonth: "" });
  const [runDialog, setRunDialog] = useState(false);
  const [invoiceQueue, setInvoiceQueue] = useState<{ runId: string; ids: string[] }>();
  const [template, setTemplate] = useState({ receivableId: "", quantity: "" });
  const [group, setGroup] = useState({ name: "" });
  const [receivable, setReceivable] = useState({
    groupId: "",
    code: "",
    displayName: "",
    unitLabel: "",
    defaultUnitPrice: "",
    taxCategory: "NOT_DECLARED" as TaxCategory,
  });
  const [taxChange, setTaxChange] = useState<{ id: string; name: string; taxCategory: TaxCategory }>();
  const [lifecycle, setLifecycle] = useState<Lifecycle>();
  const [catalogDialog, setCatalogDialog] = useState<"group" | "group-form" | "receivable">();
  const [promotionDialog, setPromotionDialog] = useState<"policy" | "assignment">();
  const [promotionTransition, setPromotionTransition] = useState<{
    id: string;
    name: string;
    action: "activate" | "retire";
  }>();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"group" | "receivable" | "invoice" | "lifecycle" | "promotion" | "run">(
    "group",
  );
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
  const closeDialog = useRef<HTMLDivElement>(null);
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const coverageDecisionDialog = useRef<HTMLDivElement>(null);
  const coverageDecisionTrigger = useRef<HTMLButtonElement>(null);
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
  const promotionStudents = promotionData.schoolId === schoolId ? promotionData.students : [];
  const activeAssignment = (item: PromotionPolicy["versions"][number]["assignments"][number]) => item.isCurrent;
  const promotionVersions = promotionPolicies.flatMap((policy) => (policy.versions ?? []).map((version) => ({ policy, version })));
  const currentAssignments = promotionVersions.flatMap(({ policy, version }) => (version.assignments ?? []).filter(activeAssignment).map((item) => ({ policy, version, item })));
  const resetReceivable = () => setReceivable({ groupId: "", code: "", displayName: "", unitLabel: "", defaultUnitPrice: "", taxCategory: "NOT_DECLARED" });
  const resetPromotion = () => setPromotion(defaultPromotion());

  const get = async <T,>(path: string, mutation = false) => {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      headers: mutation
        ? { "x-csrf-token": decodeURIComponent(csrf() ?? "") }
        : undefined,
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
  const runsPath = (cursor?: string | null) => `/api/app/schools/${schoolId}/finance/collection-runs?limit=25${runStatus ? `&status=${encodeURIComponent(runStatus)}` : ""}${cursor ?? runCursor ? `&cursor=${encodeURIComponent(cursor ?? runCursor)}` : ""}`;
  const load = async () => {
    const token = ++request.current;
    const nextCatalog = await get<Catalog>(`/api/app/schools/${schoolId}/finance/receivables`);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setCatalog(nextCatalog);
    if (activePage.current === "receivables") return;
    if (activePage.current === "promotions") {
      const [nextPolicies, nextPromotionStudents] = await Promise.all([
        get<{ policies: PromotionPolicy[] }>(`/api/app/schools/${schoolId}/finance/promotion-policies`),
        get<{ students: Candidate[] }>(`/api/app/schools/${schoolId}/finance/promotion-students`),
      ]);
      if (activeSchool.current === schoolId && token === request.current)
        setPromotionData({ schoolId, policies: nextPolicies.policies ?? [], students: nextPromotionStudents.students ?? [] });
      return;
    }
    if (activeRouteRunId.current) {
      const [nextPolicies, selectedRun] = await Promise.all([
        get<{ policies: PromotionPolicy[] }>(`/api/app/schools/${schoolId}/finance/promotion-policies`),
        get<Run>(`/api/app/schools/${schoolId}/finance/collection-runs/${activeRouteRunId.current}`),
      ]);
      if (activeSchool.current !== schoolId || token !== request.current || activeRouteRunId.current !== selectedRun.id) return;
      setPromotionData({ schoolId, policies: nextPolicies.policies ?? [], students: [] });
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
    setPromotionData({ schoolId, policies: nextPolicies.policies ?? [], students: [] });
  };
  const loadBankAccounts = async () => {
    const next = await get<{ accounts: BankAccount[] }>(`/api/app/schools/${schoolId}/finance/bank-accounts`);
    const accounts = next?.accounts ?? [];
    if (activeSchool.current === schoolId) setBankAccounts(accounts);
    return accounts;
  };
  const loadGeneratedStudents = async (runId: string) => {
    const loaded: Candidate[] = [];
    let cursor: string | null = null;
    do {
      const next: { students: Candidate[]; meta: { nextCursor: string | null } } = await get(`/api/app/schools/${schoolId}/finance/collection-runs/${runId}/addable-students?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      loaded.push(...next.students);
      cursor = next.meta.nextCursor;
    } while (cursor);
    if (activeSchool.current === schoolId && activeRunId.current === runId) setCandidates((current) => ({ schoolYears: current?.schoolYears ?? [], students: loaded }));
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
      if (
        activeSchool.current !== operation.schoolId ||
        token !== request.current
      )
        return;
      if (result.status === "PENDING") {
        if (result.progress) setGenerationProgress(result.progress);
        reconciliationTimer.current = window.setTimeout(
          () => void reconcile(operation),
          750,
        );
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
          try { await refreshRun(generated.run.id); } catch { chooseRun(generated.run); setMessage("Đã tạo hóa đơn; chưa thể tải lại đợt thu mới nhất."); }
        }
        if ((result.outcome as Invoice | undefined)?.lines) applyInvoice(result.outcome as Invoice);
        if (["DRAFT", "READY", "GENERATED", "CLOSED"].includes((result.outcome as Run | undefined)?.status ?? ""))
          chooseRun(result.outcome as Run);
        if ((result.outcome as Run | undefined)?.status === "CLOSED") {
          chooseRun(result.outcome as Run);
          setCloseConfirmation(false);
          setCloseReason("");
          setCloseConfirmationMonth("");
        }
        try { await load(); } catch { setMessage("Thao tác đã hoàn tất; chưa thể tải lại dữ liệu mới nhất."); }
      } else setMessage("Thao tác không thành công.");
    } catch {
      if (
        activeSchool.current === operation.schoolId &&
        token === request.current
      )
        setMessage(
          "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
        );
    }
  };
  const applyInvoice = (next: Invoice) => {
    setInvoice(next);
    const parts = next.notice?.invoices?.length ? next.notice.invoices : [next];
    const patch = (item: Run) => ({ ...item, invoices: (item.invoices ?? []).map((candidate) => { const part = parts.find((value) => value.id === candidate.id); return part ? { ...candidate, total: part.total, status: part.status } : candidate; }) });
    setRun((current) => current ? patch(current) : current);
    setRuns((current) => current.map(patch));
  };
  // Issue pre-selects the Class default personal account; the School account is shown read-only.
  const draftInvoiceKey = invoice?.status === "DRAFT" ? `${invoice.id}:${invoice.notice?.classDefaultBankAccountId ?? ""}` : "";
  useEffect(() => {
    if (!draftInvoiceKey || !invoice) return;
    const expected = schoolId;
    void loadBankAccounts().then((accounts) => {
      if (activeSchool.current !== expected) return;
      const fallback = invoice.notice?.classDefaultBankAccountId;
      setIssueBankAccountId((current) => current && accounts.some((account) => account.id === current) ? current : accounts.some((account) => account.id === fallback && (account.kind ?? "PERSONAL") === "PERSONAL") ? fallback! : "");
    }).catch(() => undefined);
  }, [draftInvoiceKey]);
  // A line command may answer with another part of the same notice; keep the opened part on screen.
  const applyNoticeOutcome = async (next: Invoice) => {
    if (!invoice || next.id === invoice.id) { applyInvoice(next); return; }
    const opened = next.notice?.invoices?.find((part) => part.id === invoice.id);
    applyInvoice(opened ? { ...opened, notice: next.notice } : next);
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    submitting.current = false;
    ++request.current;
    if (reconciliationTimer.current)
      window.clearTimeout(reconciliationTimer.current);
    setCatalog(undefined);
    setPromotionData({ schoolId, policies: [], students: [] });
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
    setGenerateConfirmationMonth("");
    setAddStudentsOpen(false);
    setAdditionConfirmation(undefined);
    setAdditionConfirmationName("");
    setCloseConfirmation(false);
    setCloseReason("");
    setCloseConfirmationMonth("");
    setGeneratedOutcome(undefined);
    setInvoice(undefined);
    setBankAccounts([]);
    setIssueConfirmation(false);
    setIssueConfirmationName("");
    setIssueBankAccountId("");
    setRevisionConfirmation(false);
    setRevisionReason("");
    setRevisionConfirmationName("");
    setCoverageReversal({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" });
    setCoverageReversalPreview(undefined);
    setCoverageDecision(undefined);
    setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" });
    setEditingLineId(undefined);
    setEditingSource(false);
    setOpen({ schoolYearId: "", billingMonth: "" });
    setRunDialog(false);
    setInvoiceQueue(undefined);
    setTemplate({ receivableId: "", quantity: "" });
    setGroup({ name: "" });
    resetReceivable();
    setLifecycle(undefined);
    setCatalogDialog(undefined);
    setPromotionDialog(undefined);
    setPromotionTransition(undefined);
    setErrors({});
    setMessage("");
    setGenerationProgress(undefined);
    const saved = sessionStorage.getItem(pendingKey);
    if (saved)
      try {
        const operation = JSON.parse(saved) as Pending;
        if (uuid.test(operation.id) && operation.schoolId === schoolId)
          void reconcile(operation);
        else sessionStorage.removeItem(pendingKey);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    return () => {
      ++request.current;
      if (reconciliationTimer.current)
        window.clearTimeout(reconciliationTimer.current);
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
    if (!invoiceId) { setInvoice(undefined); setInvoiceQueue(undefined); return; }
    // The URL only selects; the server re-authorizes the Invoice and a denial returns to its run.
    if (run && run.id === runId) void openInvoice(invoiceId, run).then((opened) => { if (!opened) onBackToRun?.(run.id); });
  }, [invoiceId, run?.id]);
  useEffect(() => {
    if (!pending) void load().catch((error: Error) => {
      if (activeSchool.current !== schoolId) return;
      setRun(undefined);
      setPreview(undefined);
      setInvoice(undefined);
      if (runId && onDetailUnavailable) onDetailUnavailable("Không thể mở đợt thu này. Vui lòng kiểm tra lại danh sách đợt thu.");
      else setMessage(error.message);
    });
  }, [schoolId, page, runId]);
  const dirty = Boolean(
    open.schoolYearId ||
    open.billingMonth ||
    group.name ||
    receivable.groupId ||
    receivable.code ||
    receivable.displayName ||
    receivable.unitLabel ||
    receivable.defaultUnitPrice ||
    lifecycle?.reason ||
     template.receivableId ||
      template.quantity ||
      promotion.name || promotion.receivableIds.length || promotion.discountValue || assignment.studentIds.length || assignment.reason || endingAssignment?.reason,
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
    if (removeConfirmation) removeDialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    else removeTrigger.current?.focus();
  }, [removeConfirmation]);
  useEffect(() => {
    if (issueConfirmation) issueDialog.current?.querySelector<HTMLElement>("select")?.focus();
    else issueTrigger.current?.focus();
  }, [issueConfirmation]);
  useEffect(() => {
    if (revisionConfirmation) revisionDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
    else revisionTrigger.current?.focus();
  }, [revisionConfirmation]);
  useEffect(() => {
    if (closeConfirmation) closeDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
    else closeTrigger.current?.focus();
  }, [closeConfirmation]);
  useEffect(() => {
    if (coverageDecision) coverageDecisionDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
    else coverageDecisionTrigger.current?.focus();
  }, [coverageDecision]);
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
    dialog?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])")?.focus();
  }, [catalogDialog, promotionDialog]);
  useEffect(() => {
    if (runDialog) runDialogRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
  }, [runDialog]);
  useEffect(() => {
    if (promotionTransition)
      document.querySelector<HTMLElement>("#finance-promotion-transition-confirm")?.focus();
  }, [promotionTransition]);
  const closeAddStudents = () => { setAddStudentsOpen(false); addStudentsTrigger.current?.focus(); };
  const trapDialogFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea, button")]
      .filter((item) => !item.hasAttribute("disabled"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const closeManagedDialog = (close: () => void) => {
    close();
    if (dialogTrigger.current?.isConnected) dialogTrigger.current.focus();
    dialogTrigger.current = null;
  };
  const openManagedDialog = (
    trigger: HTMLButtonElement,
    open: () => void,
  ) => {
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
  const command = async (
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body: object,
    nextScope?: typeof scope,
  ) => {
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
          setMessage(
            "Kết quả chưa chắc chắn. Đang đối soát Operation trước khi thử lại.",
          );
          void reconcile(operation);
        }
        return undefined;
      }
      if (!response.ok) {
        const error = (
          (await response.json()) as {
            error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
          }
        ).error;
        if (activeSchool.current === schoolId && token === request.current) {
          setErrors(error?.fieldErrors ?? {});
          if (error?.code === "PROMOTION_REVIEW_REQUIRED") {
            setIssueConfirmation(false);
            setIssueConfirmationName("");
            setIssueBankAccountId("");
            void openInvoice(path.match(/\/invoices\/([^/]+)/)?.[1] ?? "");
          }
          setMessage(error?.message ?? "Thao tác không thành công.");
        }
        return undefined;
      }
      const result = ((await response.json()) as { data: OperationResult }).data;
      if (activeSchool.current !== schoolId || token !== request.current)
        return undefined;
      if (result.status === "PENDING") {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        setGenerationProgress(result.progress ?? undefined);
        setGenerateConfirmation(false);
        setGenerateConfirmationMonth("");
        setMessage("Máy chủ đang tạo hóa đơn nháp. Đang đối soát tiến độ Operation.");
        void reconcile(operation);
        return undefined;
      }
      return result.status === "FAILED" ? undefined : result.outcome;
    } catch {
      sessionStorage.setItem(pendingKey, JSON.stringify(operation));
      if (activeSchool.current === schoolId && token === request.current) {
        setPending(operation);
        setMessage(
          "Kết nối bị gián đoạn. Đang đối soát Operation trước khi thử lại.",
        );
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
    if (normalized.status === "GENERATED")
      void loadGeneratedStudents(normalized.id).catch(() => setMessage("Không thể tải học sinh để thêm vào đợt đã tạo."));
  };
  const openRun = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs`,
      "POST",
      open,
      "run",
    );
    if (outcome) {
      setOpen({ schoolYearId: "", billingMonth: "" });
      closeManagedDialog(() => setRunDialog(false));
      onOpenRun?.((outcome as Run).id);
      if (!onOpenRun) chooseRun(outcome as Run);
      await load();
    }
  };
  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault(); if (!run) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/template-lines`, "PUT", { ...template, expectedVersion: run.version });
    if (outcome) { chooseRun(outcome as Run); setTemplate({ receivableId: "", quantity: "" }); await load(); }
  };
  const removeTemplate = async (lineId: string) => {
    if (!run) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/template-lines/${lineId}`, "DELETE", { expectedVersion: run.version });
    if (outcome) { chooseRun(outcome as Run); await load(); }
  };
  const loadPreview = async () => {
    if (!run) return;
    const runId = run.id;
    const token = ++request.current;
    setMessage("");
    setPreview(undefined);
    try {
      const next = await get<Preview>(
        `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/preview`,
        true,
      );
      if (
        activeSchool.current === schoolId &&
        token === request.current &&
        runId === run.id
      )
        setPreview(next);
    } catch {
      if (activeSchool.current === schoolId && token === request.current) {
        setPreview(undefined);
        setMessage("Không thể tạo bản xem trước.");
      }
    }
  };
  const ready = async () => {
    if (!run || !preview) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/ready`,
      "POST",
      { previewFingerprint: preview.fingerprint },
    );
    if (outcome) {
      try { await refreshRun((outcome as Run).id); } catch { chooseRun(outcome as Run); setMessage("Đợt thu đã sẵn sàng; chưa thể tải lại tổng quan mới nhất."); }
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
      setGenerateConfirmationMonth("");
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
      setAdditionConfirmationName("");
      setGeneratedOutcome(outcome as GenerateOutcome);
      await load();
    }
  };
  const closeRun = async () => {
    if (!run) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/close`, "POST", { reason: closeReason }, "lifecycle");
    if (outcome) {
      setCloseConfirmation(false);
      setCloseReason("");
      setCloseConfirmationMonth("");
      chooseRun(outcome as Run);
      try { await load(); } catch { setMessage("Đợt thu đã đóng; chưa thể tải lại dữ liệu mới nhất."); }
    }
  };
  const saveGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/receivable-groups`,
        "POST",
        group,
        "group",
      )
    ) {
      setGroup({ name: "" });
      closeManagedDialog(() => setCatalogDialog("group"));
      await load();
    }
  };
  const saveReceivable = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/receivables`,
        "POST",
        receivable,
        "receivable",
      )
    ) {
      resetReceivable();
      closeManagedDialog(() => setCatalogDialog(undefined));
      await load();
    }
  };
  const saveTaxCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!taxChange) return;
    if (await command(`/api/app/schools/${schoolId}/finance/receivables/${taxChange.id}/tax-category`, "PUT", { taxCategory: taxChange.taxCategory }, "receivable")) {
      closeManagedDialog(() => setTaxChange(undefined));
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
        prepaidTermMonths: promotion.fulfillmentMode === "PREPAID_COVERAGE" ? Number(promotion.prepaidTermMonths) : null,
      },
      "promotion",
    );
    if (outcome) {
      resetPromotion();
      closeManagedDialog(() => setPromotionDialog(undefined));
      await load();
    }
  };
  const saveAssignments = async (event: FormEvent) => {
    event.preventDefault(); if (!assignment.versionId) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-policy-versions/${assignment.versionId}/assignments`, "POST", { ...assignment, effectiveTo: assignment.effectiveTo || null }, "promotion");
    if (outcome) { setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" }); closeManagedDialog(() => setPromotionDialog(undefined)); await load(); }
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
    event.preventDefault(); if (!endingAssignment) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-assignments/${endingAssignment.id}/end`, "POST", { effectiveTo: endingAssignment.effectiveTo, reason: endingAssignment.reason }, "promotion");
    if (outcome) { closeManagedDialog(() => setEndingAssignment(undefined)); await load(); }
  };
  const transitionPromotionVersion = async (versionId: string, action: "activate" | "retire") => {
    dialogTrigger.current = rowMenuTrigger.current;
    setPromotionTransition({
      id: versionId,
      name: promotionPolicies
        .flatMap((policy) => (policy.versions ?? []).map((version) => ({ policy, version })))
        .find((item) => item.version.id === versionId)?.policy.name ?? "chính sách này",
      action,
    });
  };
  const confirmPromotionTransition = async (versionId: string, action: "activate" | "retire") => {
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-policy-versions/${versionId}/${action}`, "POST", {}, "promotion");
    if (outcome) { closeManagedDialog(() => setPromotionTransition(undefined)); await load(); }
  };
  const openInvoice = async (invoiceId: string, sourceRun?: Run) => {
    // Own counter: list/run reloads must not discard the Invoice the user (or URL) just opened.
    const token = ++invoiceRequest.current;
    setInvoiceQueue(undefined);
    try {
      const next = await get<Invoice>(`/api/app/schools/${schoolId}/finance/invoices/${invoiceId}`);
      if (activeSchool.current === schoolId && token === invoiceRequest.current) {
        setInvoice(next);
        setDraftCoverageVersionId(next.coverageFacts?.[0]?.versionId ?? "");
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
  const saveLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoice) return;
    const body: Record<string, unknown> = { receivableId: line.receivableId, quantity: line.quantity };
    if (line.unitPrice) { body.unitPrice = line.unitPrice; body.overrideReason = line.overrideReason; }
    if (line.serviceDate || line.attendanceState || line.pickedUpAt || line.lateCareMinutes || line.sourceReason) {
      body.source = { serviceDate: line.serviceDate || null, attendanceState: line.attendanceState || null, pickedUpAt: line.pickedUpAt || null, lateCareMinutes: line.lateCareMinutes ? Number(line.lateCareMinutes) : null };
      body.sourceReason = line.sourceReason;
    } else if (editingLineId && editingSource) body.source = null;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${editingLineId ? editingLineInvoiceId ?? invoice.id : invoice.id}/lines${editingLineId ? `/${editingLineId}` : ""}`, editingLineId ? "PUT" : "POST", body, "invoice");
    if (outcome) { await applyNoticeOutcome(outcome as Invoice); setInvoiceQueue(undefined); setEditingLineId(undefined); setEditingLineInvoiceId(undefined); setEditingSource(false); setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" }); if (run) { try { const refreshed = await refreshRun(run.id); if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) }); } catch { setMessage("Đã lưu; chưa thể tải lại danh sách hóa đơn mới nhất."); } } }
  };
  const removeLine = async (lineId: string, invoiceId: string) => {
    if (!invoice) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoiceId}/lines/${lineId}`, "DELETE", {}, "receivable");
    if (outcome) { await applyNoticeOutcome(outcome as Invoice); setInvoiceQueue(undefined); if (run) { try { const refreshed = await refreshRun(run.id); if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) }); } catch { setMessage("Đã xóa; chưa thể tải lại danh sách hóa đơn mới nhất."); } } }
    setRemoveConfirmation(undefined);
  };
  const issueInvoice = async () => {
    if (!invoice || !issueAccountsReady) return;
    const runId = run?.id;
    const personal = issueParts.some((part) => part.channel !== "SCHOOL");
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/${invoice.revisesInvoiceId ? "issue-revision" : "issue"}`, "POST", personal ? { personalBankAccountId: issueBankAccountId } : {}, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setInvoiceQueue(undefined); setIssueConfirmation(false); setIssueConfirmationName(""); setIssueBankAccountId(""); try { if (runId) { const refreshed = await refreshRun(runId); if (refreshed) setInvoiceQueue({ runId: refreshed.id, ids: studentQueueIds(refreshed.invoices) }); } } catch { setMessage("Hóa đơn đã phát hành; chưa thể tải lại dữ liệu mới nhất."); } }
  };
  const prepareRevision = async () => {
    if (!invoice) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/revisions`, "POST", { reason: revisionReason }, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setRevisionConfirmation(false); setRevisionReason(""); setRevisionConfirmationName(""); try { await load(); } catch { setMessage("Bản điều chỉnh đã được chuẩn bị; chưa thể tải lại dữ liệu mới nhất."); } }
  };
  const previewCoverageReversal = async () => {
    if (!coverageReversal.coverageId || !coverageReversal.effectiveOn) return;
    const token = ++request.current;
    setCoverageReversalPreview(undefined);
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/coverage-reversals/preview`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? "") }, body: JSON.stringify({ coverageId: coverageReversal.coverageId, effectiveOn: coverageReversal.effectiveOn }) });
      if ([401, 403].includes(response.status)) { denied(); return; }
      if (!response.ok) throw new Error(); const next = ((await response.json()) as { data: CoverageReversalPreview }).data;
       if (activeSchool.current === schoolId && token === request.current) setCoverageReversalPreview(next);
    } catch { if (activeSchool.current === schoolId && token === request.current) { setCoverageReversalPreview(undefined); setMessage("Không thể tải thông tin khoản hoàn từ máy chủ."); } }
  };
  const postCoverageReversal = async () => {
    if (!coverageReversalPreview) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/coverage-reversals`, "POST", { ...coverageReversal, effectiveOn: coverageReversalPreview.effectiveOn, amount: coverageReversal.amount || null }, "invoice");
    if (outcome) { setMessage(coverageReversalPreview.source.reversalMode === "DIRECT" ? "Máy chủ đã ghi nhận hoàn ưu đãi nộp trước." : "Yêu cầu hoàn ưu đãi nộp trước đã được gửi chờ duyệt."); setCoverageReversal({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" }); setCoverageReversalPreview(undefined); await load(); }
  };
  const decideCoverageReversal = async () => {
    if (!coverageDecision) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/coverage-reversal-requests/${coverageDecision.request.id}/decision`, "POST", { decision: coverageDecision.decision, reason: coverageDecision.reason }, "invoice");
    if (outcome) { setCoverageDecision(undefined); await load(); }
  };
  const openIssueConfirmation = async () => {
    if (!invoice) return;
    setMessage("");
    try {
      const accounts = await loadBankAccounts();
      if (!accounts.length) { setMessage("Máy chủ không có tài khoản nhận đang hoạt động để phát hành hóa đơn."); return; }
      if (issueParts.some((part) => part.channel === "SCHOOL") && !accounts.some((account) => account.kind === "SCHOOL")) { setMessage("Chưa cấu hình tài khoản trường để thu khoản có thuế."); return; }
      const personal = accounts.filter((account) => (account.kind ?? "PERSONAL") === "PERSONAL");
      if (issueParts.some((part) => part.channel !== "SCHOOL")) {
        if (!personal.length) { setMessage("Chưa có tài khoản cá nhân đang hoạt động để thu khoản không kê khai."); return; }
        if (!personal.some((account) => account.id === issueBankAccountId)) setIssueBankAccountId(personal.find((account) => account.id === invoice.notice?.classDefaultBankAccountId)?.id ?? personal[0]!.id);
      }
      setIssueConfirmationName(""); setIssueConfirmation(true);
    } catch { setMessage("Không thể tải tài khoản nhận đang hoạt động từ máy chủ."); }
  };
  const trapRemoveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(removeDialog.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const trapIssueFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(issueDialog.current?.querySelectorAll<HTMLElement>("input, select, button") ?? [])].filter((item) => !item.hasAttribute("disabled"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const trapCloseFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(closeDialog.current?.querySelectorAll<HTMLElement>("textarea, button") ?? [])].filter((item) => !item.hasAttribute("disabled"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const trapRevisionFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(revisionDialog.current?.querySelectorAll<HTMLElement>("textarea, input, button") ?? [])].filter((item) => !item.hasAttribute("disabled"));
    const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const trapCoverageDecisionFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(coverageDecisionDialog.current?.querySelectorAll<HTMLElement>("textarea, button") ?? [])].filter((item) => !item.hasAttribute("disabled")); const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
  const invoiceQueueIndex = invoice && invoiceQueue ? invoiceQueue.ids.findIndex((id) => id === invoice.id || Boolean(invoice.notice?.invoices?.some((part) => part.id === id))) : -1;
  const InvoiceHeading = onOpenInvoice ? "h1" : "h2";
  const invoiceRouteActive = Boolean(onOpenInvoice && invoiceId);
  // The review shows the whole payment notice; a revision DRAFT stands in for the source it replaces.
  const noticeParts: Invoice[] = !invoice ? [] : (invoice.notice?.invoices?.length ? invoice.notice.invoices : [invoice]).filter((part) => part.id !== invoice.revisesInvoiceId && !(part.revisesInvoiceId && part.status === "DRAFT" && part.id !== invoice.id));
  const issueParts = !invoice || invoice.status !== "DRAFT" ? [] : invoice.revisesInvoiceId ? (invoice.lines.length && invoice.total !== "0" ? [invoice] : []) : noticeParts.filter((part) => part.status === "DRAFT" && !part.revisesInvoiceId && part.lines.length && part.total !== "0");
  const paymentParts = noticeParts.filter((part) => part.paymentImageAvailable && part.issue);
  const schoolBankAccount = bankAccounts.find((account) => account.kind === "SCHOOL");
  const personalBankAccounts = bankAccounts.filter((account) => (account.kind ?? "PERSONAL") === "PERSONAL");
  const issueAccountsReady = issueParts.every((part) => part.channel === "SCHOOL" ? Boolean(schoolBankAccount) : Boolean(issueBankAccountId));
  const reviewInvoice = (id: string) => { if (onOpenInvoice && run) onOpenInvoice(run.id, id); else void openInvoice(id, run); };
  const previousInvoiceId = invoiceQueueIndex > 0 ? invoiceQueue!.ids[invoiceQueueIndex - 1] : undefined;
  const nextInvoiceId = invoiceQueueIndex >= 0 && invoiceQueueIndex < invoiceQueue!.ids.length - 1 ? invoiceQueue!.ids[invoiceQueueIndex + 1] : undefined;
  const receivableGroupNames = new Map((catalog?.groups ?? []).map((group) => [group.id, group.name]));

  return (
    <section className="finance-workspace" aria-labelledby={invoiceRouteActive ? "invoice-review-title" : runId ? "run-detail-title" : "finance-title"} onKeyDownCapture={(event) => {
      if (event.key !== "Escape" || pending) return;
      if (endingAssignment) closeNewDialog(() => setEndingAssignment(undefined), () => {});
      else if (promotionTransition) closeNewDialog(() => setPromotionTransition(undefined), () => {});
      else if (promotionDialog === "assignment") closeNewDialog(() => setPromotionDialog(undefined), () => setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" }));
    }}>
      {!runId && <h1 id="finance-title">{page === "receivables" ? "Khoản thu" : page === "promotions" ? "Ưu đãi" : "Đợt thu"}</h1>}
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      {page === "promotions" && <section>
        <p>Thay đổi cấu hình tạo phiên bản mới. Giá trị áp dụng do hệ thống đánh giá ở bước sau.</p>
        <form className="finance-list-toolbar" aria-label="Điều khiển danh sách ưu đãi" onSubmit={(event) => event.preventDefault()}>
          <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={(event) => { setErrors({}); resetPromotion(); openManagedDialog(event.currentTarget, () => setPromotionDialog("policy")); }}>Thêm chính sách</button>
        </form>
        <table><caption>Chính sách ưu đãi theo Trường</caption><thead><tr><th>Chính sách</th><th>Khoản thu</th><th>Mức giảm</th><th>Hiệu lực</th><th>Trạng thái</th><th>Học sinh</th><th>Tùy chọn</th></tr></thead><tbody>{promotionVersions.length ? promotionPolicies.flatMap((policy) => (policy.versions ?? []).map((version) => <tr key={version.id}><td>{policy.name} / Phiên bản {version.version}</td><td>{(version.targets ?? []).map((target) => target.receivableName).join(", ")}</td><td>{version.discountType === "PERCENTAGE" ? `${version.discountValue}%` : `${vnd(version.discountValue)} VND`}</td><td>{version.effectiveFrom} - {version.effectiveTo ?? "không xác định"}</td><td>{version.status}</td><td>{(version.assignments ?? []).filter(activeAssignment).length} đang áp dụng</td><td><AnchoredActionMenu label={`Tùy chọn cho ${policy.name} phiên bản ${version.version}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { rowMenuTrigger.current = trigger; }}>{version.status === "DRAFT" && <AnchoredActionMenuItem onClick={() => void transitionPromotionVersion(version.id, "activate")}>Kích hoạt phiên bản</AnchoredActionMenuItem>}{version.status === "ACTIVE" && <><AnchoredActionMenuItem onClick={() => { dialogTrigger.current = rowMenuTrigger.current; setAssignment({ versionId: version.id, studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" }); setPromotionDialog("assignment"); }}>Gán học sinh</AnchoredActionMenuItem><AnchoredActionMenuItem onClick={() => void transitionPromotionVersion(version.id, "retire")}>Ngừng phiên bản</AnchoredActionMenuItem></>}</AnchoredActionMenu></td></tr>)) : <tr><td colSpan={7}>{catalog ? "Chưa có chính sách ưu đãi." : "Đang tải ưu đãi."}</td></tr>}</tbody></table>
        {currentAssignments.length > 0 && <table><caption>Học sinh đang áp dụng ưu đãi</caption><thead><tr><th>Học sinh</th><th>Chính sách</th><th>Áp dụng từ</th><th>Lý do</th><th>Tùy chọn</th></tr></thead><tbody>{currentAssignments.map(({ policy, version, item }) => <tr key={item.id}><td>{item.studentCode} / {item.studentName}</td><td>{policy.name} / Phiên bản {version.version}</td><td>{item.effectiveFrom}</td><td>{item.reason}</td><td><AnchoredActionMenu label={`Tùy chọn cho ${item.studentName}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { rowMenuTrigger.current = trigger; }}><AnchoredActionMenuItem onClick={() => { dialogTrigger.current = rowMenuTrigger.current; setEndingAssignment({ id: item.id, effectiveTo: "", reason: "" }); }}>Kết thúc áp dụng</AnchoredActionMenuItem></AnchoredActionMenu></td></tr>)}</tbody></table>}
      </section>}
      {page === "receivables" && <section>
        <form className="finance-list-toolbar" aria-label="Điều khiển danh sách khoản thu" onSubmit={(event) => event.preventDefault()}>
          <div className="finance-list-actions">
            <button type="button" disabled={Boolean(pending)} onClick={(event) => { setErrors({}); setGroup({ name: "" }); openManagedDialog(event.currentTarget, () => setCatalogDialog("group")); }}>Quản lý nhóm</button>
            <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={(event) => { setErrors({}); resetReceivable(); openManagedDialog(event.currentTarget, () => setCatalogDialog("receivable")); }}>Thêm khoản thu</button>
          </div>
        </form>
        <div className="table-scroll">
          <table>
            <caption>Khoản thu theo trường</caption>
            <thead>
              <tr>
                <th aria-label="Số thứ tự">#</th>
                <th>Tên khoản thu</th>
                <th>Mã</th>
                <th className="money">Giá / đơn vị (chưa VAT)</th>
                <th>Thuế</th>
                <th>Nhóm khoản thu</th>
                <th>Trạng thái</th>
                <th>Tùy chọn</th>
              </tr>
            </thead>
            <tbody>
              {catalog?.receivables?.length ? (
                catalog.receivables.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.displayName}</td>
                    <td>{item.code ?? "-"}</td>
                    <td className="money">{vnd(item.defaultUnitPrice)} VND / {item.unitLabel}</td>
                    <td>{taxShortLabel[item.taxCategory ?? "NOT_DECLARED"]}<br /><small className="muted">{channelAccountLabel(item.channel)}</small></td>
                    <td>{receivableGroupNames.get(item.groupId) ?? "-"}</td>
                    <td>{item.available ? "Đang áp dụng" : "Ngừng áp dụng"}</td>
                    <td><AnchoredActionMenu label={`Tùy chọn cho ${item.displayName}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { rowMenuTrigger.current = trigger; }}><AnchoredActionMenuItem onClick={() => { dialogTrigger.current = rowMenuTrigger.current; setErrors({}); setTaxChange({ id: item.id, name: item.displayName, taxCategory: item.taxCategory ?? "NOT_DECLARED" }); }}>Đổi mức thuế suất</AnchoredActionMenuItem><AnchoredActionMenuItem onClick={() => { dialogTrigger.current = rowMenuTrigger.current; setLifecycle({ kind: "receivables", id: item.id, name: item.displayName, next: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: "" }); }}>{item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}</AnchoredActionMenuItem></AnchoredActionMenu></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    {catalog ? "Chưa có khoản thu." : "Đang tải khoản thu."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}
      {page === "collection-runs" && (!runId || !onOpenRun) && <section>
        <form className="finance-list-toolbar" aria-label="Điều khiển danh sách đợt thu" onSubmit={(event) => event.preventDefault()}>
          <label>Lọc trạng thái<select value={runStatus} onChange={(event) => { const status = event.target.value; setRunStatus(status); setRunCursor(""); const search = new URLSearchParams(listSearch); status ? search.set("status", status) : search.delete("status"); search.delete("cursor"); onListSearchChange?.(search.toString() ? `?${search}` : ""); }}><option value="">Tất cả trạng thái</option><option value="DRAFT">Nháp</option><option value="READY">Sẵn sàng tạo hóa đơn</option><option value="GENERATED">Đã tạo hóa đơn</option><option value="CLOSED">Đã đóng</option></select></label>
          <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={(event) => { setErrors({}); setOpen({ schoolYearId: "", billingMonth: "" }); openManagedDialog(event.currentTarget, () => setRunDialog(true)); }}>Tạo đợt thu</button>
        </form>
        {runDialog && <div ref={runDialogRef} role="dialog" aria-modal="true" aria-labelledby="finance-run-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setRunDialog(false), () => setOpen({ schoolYearId: "", billingMonth: "" }))}>
        <h4 id="finance-run-title">Tạo hoặc mở đợt thu</h4><p>Máy chủ sẽ tạo đợt thu mới hoặc mở đợt thu đã có cho tháng này.</p>
        <form onSubmit={openRun}>
          <label>
            Năm học
            <select
              value={open.schoolYearId}
              onChange={(event) => {
                const schoolYearId = event.target.value;
                setOpen({ ...open, schoolYearId });
                setPreview(undefined);
              }}
              {...field("run", "schoolYearId")}
            >
              <option value="">Chọn năm học</option>
              {(catalog?.schoolYears ?? []).map((year) => (
                <option
                  key={year.id}
                  value={year.id}
                  disabled={Boolean(year.closedAt)}
                >
                  {year.name}
                  {year.closedAt ? " (đã đóng)" : ""}
                </option>
              ))}
            </select>
            {scope === "run" && errors.schoolYearId && <small id="invoice-run-schoolYearId-error" role="alert">{errors.schoolYearId}</small>}
          </label>
          <label>
            Tháng thu
            <input
              type="month"
              value={open.billingMonth}
              onChange={(event) =>
                setOpen({ ...open, billingMonth: event.target.value })
              }
              {...field("run", "billingMonth")}
            />
            {scope === "run" && errors.billingMonth && <small id="invoice-run-billingMonth-error" role="alert">{errors.billingMonth}</small>}
          </label>
          <button disabled={Boolean(pending)}>Xác nhận tạo hoặc mở</button><button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setRunDialog(false), () => setOpen({ schoolYearId: "", billingMonth: "" }))}>Hủy</button>
        </form>
        </div>}
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
                     {(catalog?.schoolYears ?? []).find(
                      (year) => year.id === item.schoolYearId,
                      )?.name ?? "Không xác định"}
                  </td>
                  <td><span className={`finance-badge finance-badge-${item.status === "DRAFT" ? "neutral" : item.status === "READY" ? "info" : "success"}`}>{runStatusLabel(item.status)}</span></td>
                    <td><AnchoredActionMenu label={`Tùy chọn cho đợt thu ${item.billingMonth}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { rowMenuTrigger.current = trigger; }}><AnchoredActionMenuItem onClick={() => onOpenRun?.(item.id) ?? chooseRun(item)}>Mở chi tiết</AnchoredActionMenuItem></AnchoredActionMenu></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  {catalog ? "Chưa có đợt thu." : "Đang tải đợt thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {runsCursor && <button type="button" disabled={Boolean(pending)} onClick={() => { const search = new URLSearchParams(listSearch); search.set("cursor", runsCursor); onListSearchChange?.(`?${search}`); void loadMoreRuns().catch(() => setMessage("Không thể tải thêm đợt thu.")); }}>Xem thêm đợt thu</button>}
      </section>}
      {page === "collection-runs" && (runId || !onOpenRun) && run && !invoiceRouteActive && <>
        <header className="finance-run-header">
          <div>
            <p className="finance-eyebrow">
              Đợt thu ·{" "}
              {(catalog?.schoolYears ?? []).find(
                (year) => year.id === run.schoolYearId,
              )?.name ?? "Năm học không xác định"}
            </p>
            <h1 id="run-detail-title" tabIndex={-1}>
              Đợt thu tháng {billingMonthLabel(run.billingMonth)} · {runStatusLabel(run.status)}
            </h1>
            <p>Máy chủ xác định học sinh đang theo học, có phân lớp hiệu lực và lớp đang hoạt động tại đầu tháng thu.</p>
          </div>
          {onBackToRuns && <button type="button" onClick={onBackToRuns}>Quay lại danh sách đợt thu</button>}
        </header>
        <ol className="finance-steps" aria-label="Tiến trình đợt thu">
          {runSteps.map((step) => <li key={step} aria-current={run.status === step ? "step" : undefined}>{runStatusLabel(step)}</li>)}
        </ol>
        <dl className="finance-metrics" aria-label="Tổng quan do máy chủ tính">
          {runMetrics(run, preview).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {run.status === "DRAFT" && (
          <section aria-labelledby="run-template-title">
            <div className="finance-card-heading">
              <h2 id="run-template-title">Khoản thu trong đợt</h2>
              <p>Đơn giá và thành tiền do máy chủ xác nhận. Dòng được hiển thị theo số tiền giảm dần.</p>
            </div>
            <div className="table-scroll"><table><caption>Khoản thu mẫu chung</caption><thead><tr><th>Khoản thu</th><th>Số lượng</th><th className="finance-money">Đơn giá VND</th><th className="finance-money">Số tiền VND</th><th>Thao tác</th></tr></thead><tbody>{(run.templateLines ?? []).length ? (run.templateLines ?? []).map((item) => <tr key={item.id}><td>{item.receivableName}</td><td>{item.quantity} {item.unitLabel}</td><td className="finance-money">{vnd(item.defaultUnitPrice)}</td><td className="finance-money">{vnd(item.amount)}</td><td><button type="button" disabled={Boolean(pending)} onClick={() => void removeTemplate(item.id)}>Bỏ</button></td></tr>) : <tr><td colSpan={5}>Chưa có khoản thu mẫu. Thêm khoản thu trước khi xem trước.</td></tr>}</tbody></table></div>
            <form className="finance-inline-form" onSubmit={saveTemplate}><label>Khoản thu<select value={template.receivableId} onChange={(event) => setTemplate({ ...template, receivableId: event.target.value })}><option value="">Chọn khoản thu</option>{(catalog?.receivables ?? []).filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Số lượng<input inputMode="numeric" value={template.quantity} onChange={(event) => setTemplate({ ...template, quantity: event.target.value })} /></label><button disabled={Boolean(pending)}>Lưu khoản thu mẫu</button></form>
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
                <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => void loadPreview()}>
                  Xem trước từ máy chủ
                </button>
              </div>
            )}
            {preview && <>
              <div className="table-scroll">
                <table>
                  <caption>Học sinh đủ điều kiện</caption>
                  <thead>
                    <tr>
                      <th>Học sinh</th><th>Lớp</th><th>Khoản thu</th><th className="finance-money">Tổng trước giảm (VND)</th><th className="finance-money">Giảm trừ (VND)</th><th className="finance-money">Tổng phải thu (VND)</th><th>Lý do ưu đãi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.eligible.length ? (
                      preview.eligible.flatMap((item) => (item.lines ?? []).map((line) => (
                        <tr key={`${item.studentId}-${line.receivableId}`}><td>{item.studentCode} / {item.fullName}</td><td>{item.className}</td><td>{line.receivableName}</td><td className="finance-money">{vnd(line.grossAmount)}</td><td className="finance-money">{vnd(line.discountAmount)}</td><td className="finance-money">{vnd(line.netAmount)}</td><td>{line.promotionEvaluation.applications.map((application) => application.assignmentReason).join(", ") || "Không áp dụng"}</td></tr>
                      )))
                    ) : (
                      <tr>
                        <td colSpan={7}>Không có học sinh đủ điều kiện.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(preview.futureCoverageFacts ?? []).length > 0 && <div className="table-scroll"><table><caption>Ưu đãi trả trước do máy chủ xác nhận</caption><thead><tr><th>Kỳ</th><th>Khoản thu</th><th className="finance-money">Giá gốc (VND)</th><th className="finance-money">Giảm trừ (VND)</th><th>Khoảng dịch vụ</th><th>Lịch áp dụng</th></tr></thead><tbody>{preview.futureCoverageFacts?.map((fact) => <tr key={`${fact.studentId}-${fact.versionId}-${fact.receivableId}-${fact.billingMonth}`}><td>{fact.billingMonth}</td><td>{fact.receivableName}</td><td className="finance-money">{vnd(fact.originalPrice)}</td><td className="finance-money">{vnd(fact.reduction)}</td><td>{fact.serviceStart} đến {fact.serviceEnd}</td><td>{fact.calendarEffectiveFrom} / {fact.timezone}</td></tr>)}</tbody></table></div>}
              <div className="table-scroll">
                <table>
                  <caption>Học sinh bị bỏ qua</caption>
                  <thead>
                    <tr>
                      <th>Học sinh</th><th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.skips.length ? (
                      preview.skips.map((item) => (
                        <tr key={item.studentId}>
                          <td>{item.studentCode && item.fullName ? `${item.studentCode} / ${item.fullName}` : "Không xác định"}</td>
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
                <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => void ready()}>
                  Xác nhận xem trước và chuyển sẵn sàng
                </button>
              </div>
            </>}
          </section>
        )}
      </>}
      {page === "collection-runs" && (runId || !onOpenRun) && <>
      {!invoiceRouteActive && run?.status === "READY" && (
        <section aria-labelledby="run-generate-title">
          <div className="finance-card-heading">
            <h2 id="run-generate-title">Tạo hóa đơn nháp</h2>
            <p>Bản xem trước đã được xác nhận. Máy chủ sẽ đánh giá lại danh sách học sinh khi tạo và dùng bản chốt khoản thu của đợt.</p>
          </div>
          <div className="table-scroll"><table><caption>Khoản thu đã chốt cho đợt</caption><thead><tr><th>Khoản thu</th><th>Số lượng</th><th className="finance-money">Đơn giá VND</th><th className="finance-money">Số tiền VND</th></tr></thead><tbody>{(run.templateLines ?? []).map((item) => <tr key={item.id}><td>{item.receivableName}</td><td>{item.quantity} {item.unitLabel}</td><td className="finance-money">{vnd(item.defaultUnitPrice)}</td><td className="finance-money">{vnd(item.amount)}</td></tr>)}</tbody></table></div>
          <div className="finance-actions">
            <button
              className="primary-action"
              type="button"
              disabled={Boolean(pending)}
              onClick={() => {
                setGenerateConfirmationMonth("");
                setGenerateConfirmation(true);
              }}
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
            Đang xử lý {generationProgress.processed}/{generationProgress.total};
            đủ điều kiện {generationProgress.eligible}; bỏ qua {generationProgress.skipped}.
          </p>
          {generationProgress.lastError && <p role="alert">{generationProgress.lastError.message ?? "Máy chủ không thể tạo hóa đơn."}</p>}
        </section>
      )}
      {!invoiceRouteActive && generatedOutcome && (
        <section className="finance-notice" role="status" aria-labelledby="generated-outcome-title">
          <h2 id="generated-outcome-title">Kết quả tạo hóa đơn từ máy chủ</h2>
          <p>
            Đã tạo {generatedOutcome.created.length} hóa đơn nháp; bỏ qua{" "}
            {generatedOutcome.skipped.length} học sinh.
          </p>
          {generatedOutcome.skipped.length > 0 && (
            <details>
              <summary>Xem học sinh bị bỏ qua</summary>
              <div className="table-scroll">
                <table>
                  <caption>Học sinh bị bỏ qua khi tạo</caption>
                  <thead><tr><th>Học sinh</th><th>Lý do</th></tr></thead>
                  <tbody>
                    {generatedOutcome.skipped.map((item) => (
                      <tr key={item.studentId}>
                        <td>{item.studentCode && item.fullName ? `${item.studentCode} / ${item.fullName}` : "Không xác định"}</td>
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
              <p>Mở từng hóa đơn để rà soát và phát hành theo thứ tự máy chủ trả về.</p>
            </div>
            <button ref={addStudentsTrigger} type="button" disabled={Boolean(pending)} onClick={() => setAddStudentsOpen(true)}>Thêm học sinh</button>
          </div>
          <div className="table-scroll">
            <table>
              <caption>Hóa đơn hiện có trong đợt thu</caption>
              <thead><tr><th>Học sinh</th><th>Lớp</th><th>Tài khoản nhận</th><th>Trạng thái</th><th className="finance-money">Tổng (VND)</th><th>Thao tác</th></tr></thead>
              <tbody>{(run.invoices ?? []).length ? (run.invoices ?? []).map((item) => <tr key={item.id} aria-current={invoice?.id === item.id ? "true" : undefined}><td>{item.studentCode} / {item.studentName}</td><td>{item.className}</td><td>{channelAccountLabel(item.channel)}</td><td><span className={`finance-badge finance-badge-${item.status === "DRAFT" ? "neutral" : item.status === "CANCELLED" ? "warning" : "success"}`}>{invoiceStatusLabel(item.status)}</span></td><td className="finance-money">{vnd(item.total)}</td><td><button type="button" onClick={() => reviewInvoice(item.id)}>Rà soát hóa đơn</button></td></tr>) : <tr><td colSpan={6}>Chưa có hóa đơn trong đợt thu.</td></tr>}</tbody>
            </table>
          </div>
          <div className="finance-actions finance-actions-split">
            {run.invoices?.some((invoice) => invoice.status === "DRAFT" && invoice.total !== "0") ? <p>Chưa thể đóng: còn hóa đơn nháp cần phát hành.</p> : <p>Mọi hóa đơn đã phát hành; có thể đóng đợt thu.</p>}
            <button ref={closeTrigger} type="button" disabled={Boolean(pending) || Boolean(run.invoices?.some((invoice) => !["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status) && !(invoice.status === "DRAFT" && invoice.total === "0")))} onClick={() => { setCloseReason(""); setCloseConfirmationMonth(""); setCloseConfirmation(true); }}>Đóng đợt thu</button>
          </div>
        </section>
      )}
      {!invoiceRouteActive && run?.status === "CLOSED" && (
        <section aria-label="Đợt thu đã đóng">
          <div className="finance-card-heading">
            <h2 ref={closedHeading} tabIndex={-1}>Đợt thu đã đóng</h2>
            <p>Máy chủ đã khóa đợt thu này. Không thể thêm học sinh hoặc tạo, sửa hóa đơn trong đợt thu đã đóng.</p>
          </div>
          <div className="table-scroll">
            <table>
              <caption>Hóa đơn đã khóa theo đợt thu</caption>
              <thead><tr><th>Học sinh</th><th>Lớp</th><th>Tài khoản nhận</th><th>Trạng thái</th><th className="finance-money">Tổng (VND)</th><th>Chi tiết</th></tr></thead>
              <tbody>{(run.invoices ?? []).map((item) => <tr key={item.id}><td>{item.studentCode} / {item.studentName}</td><td>{item.className}</td><td>{channelAccountLabel(item.channel)}</td><td>{invoiceStatusLabel(item.status)}</td><td className="finance-money">{vnd(item.total)}</td><td><button type="button" onClick={() => reviewInvoice(item.id)}>Xem hóa đơn</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {invoiceRouteActive && !invoice && <p>Đang tải hóa đơn.</p>}
      {invoice && (!onOpenInvoice || invoiceId) && (
        <section ref={invoiceReview} className="finance-invoice-review" aria-labelledby="invoice-review-title invoice-review-student">
          <header className="finance-run-header">
            <div>
              <p className="finance-eyebrow">Đợt thu tháng {billingMonthLabel(invoice.billingMonth)} · <span id="invoice-review-student">{invoice.student.code} / {invoice.student.name}</span> · {invoice.student.className}</p>
              <div className="finance-title-row"><InvoiceHeading id="invoice-review-title" tabIndex={-1}>Rà soát hóa đơn</InvoiceHeading><span className={`finance-badge finance-badge-${invoice.status === "DRAFT" ? "warning" : invoice.status === "CANCELLED" ? "neutral" : "success"}`}>{invoiceStatusLabel(invoice.status)}</span></div>
              <p>Giảm trừ theo từng khoản thu do hệ thống đánh giá. Không sửa trực tiếp giá trị ưu đãi.</p>
            </div>
            <div className="finance-actions">{onOpenInvoice && run && <button type="button" onClick={() => onBackToRun?.(run.id)}>Quay lại đợt thu</button>}{previousInvoiceId && <button type="button" disabled={Boolean(pending)} onClick={() => reviewInvoice(previousInvoiceId)}>Học sinh trước</button>}{nextInvoiceId && <button type="button" disabled={Boolean(pending)} onClick={() => reviewInvoice(nextInvoiceId)}>Học sinh tiếp theo</button>}</div>
          </header>
          <div className="finance-invoice-split">
            <section aria-labelledby="invoice-lines-title">
              <div className="finance-card-heading"><h2 id="invoice-lines-title">Chi tiết hóa đơn</h2><p>Dòng, chính sách và số tiền được chốt khi phát hành.</p></div>
           {noticeParts.map((part, index) => <div key={part.id} className="finance-notice-part" aria-labelledby={`notice-part-${part.id}`}>{noticeParts.length > 1 && <div className="finance-title-row"><h3 id={`notice-part-${part.id}`}>Phần {index + 1} · Thu vào {channelAccountLabel(part.channel).toLocaleLowerCase("vi")}</h3><span className={`finance-badge finance-badge-${part.status === "DRAFT" ? "warning" : "success"}`}>{invoiceStatusLabel(part.status)}</span></div>}<div className="table-scroll"><table><caption>{noticeParts.length > 1 ? `Dòng phần ${index + 1} do máy chủ tính` : "Dòng hóa đơn do máy chủ tính"}</caption><thead><tr><th>Khoản thu</th><th>Số lượng</th><th>Đơn giá (VND)</th><th>Tổng trước giảm (VND)</th><th>Giảm trừ (VND)</th><th>Thuế GTGT (VND)</th><th>Tổng phải thu (VND)</th><th>Lý do ưu đãi</th><th>Thao tác</th></tr></thead><tbody>{part.lines.map((item) => <tr key={item.id}><td>{item.receivableName}{item.source && <small> Nguồn: {[item.source.serviceDate, item.source.attendanceState, item.source.pickedUpAt, item.source.lateCareMinutes != null ? `${item.source.lateCareMinutes} phút` : null].filter(Boolean).join("; ") || "Máy chủ đã ghi nhận"}{item.sourceReason ? `; ${item.sourceReason}` : ""}</small>}{item.source && <details><summary>Thông tin nguồn và kiểm tra</summary><p>Thời điểm ghi nhận: {item.sourceRecordedAt ?? "Máy chủ không trả về"}</p><p>Nguồn đã được máy chủ xác nhận cho dòng hóa đơn này.</p></details>}</td><td>{item.quantity} {item.unitLabel}</td><td style={{ textAlign: "right" }}>{vnd(item.unitPrice)}</td><td style={{ textAlign: "right" }}>{vnd(item.grossAmount ?? item.amount)}</td><td style={{ textAlign: "right" }}>{vnd(item.discountAmount ?? "0")}</td><td style={{ textAlign: "right" }}>{item.vatRate != null ? `${vnd(item.vatAmount ?? "0")} (${item.vatRate}%)` : "—"}</td><td style={{ textAlign: "right" }}>{vnd(item.amount)}</td><td>{(part.status === "DRAFT" ? item.promotionEvaluation?.applications : item.promotionApplicationSnapshot)?.map((application) => application.assignmentReason).join(", ") || "Không áp dụng"}</td><td>{part.status === "DRAFT" && item.receivableId !== null && <><button type="button" disabled={Boolean(pending)} onClick={() => { setEditingLineId(item.id); setEditingLineInvoiceId(part.id); setEditingSource(Boolean(item.source)); setLine({ receivableId: item.receivableId ?? "", quantity: item.quantity, unitPrice: item.overrideReason ? item.unitPrice : "", overrideReason: item.overrideReason ?? "", sourceReason: item.sourceReason ?? "", serviceDate: item.source?.serviceDate ?? "", attendanceState: item.source?.attendanceState ?? "", pickedUpAt: item.source?.pickedUpAt ?? "", lateCareMinutes: item.source?.lateCareMinutes?.toString() ?? "" }); }}>Sửa</button><button ref={removeTrigger} type="button" disabled={Boolean(pending)} onClick={() => setRemoveConfirmation({ id: item.id, name: item.receivableName, invoiceId: part.id })}>Xóa</button></>}</td></tr>)}<tr><th colSpan={6}>{noticeParts.length > 1 ? `Tổng phần ${index + 1}` : "Tổng cần thu"}</th><th style={{ textAlign: "right" }}>{vnd(part.total)}</th><td colSpan={2} /></tr></tbody></table></div></div>)}{noticeParts.length > 1 && <p className="finance-payment-total"><span>Tổng cần thu do hệ thống xác nhận <small>{noticeParts.length} lần chuyển khoản</small></span><b>{vnd(noticeParts.reduce((sum, part) => sum + BigInt(part.total), 0n).toString())} VND</b></p>}
          {invoice.status === "DRAFT" ? <form className="finance-form-grid" onSubmit={saveLine}><h4>{editingLineId ? "Sửa dòng" : "Thêm dòng"}</h4><label>Khoản thu<select disabled={Boolean(editingLineId)} value={line.receivableId} onChange={(event) => setLine({ ...line, receivableId: event.target.value })} {...invoiceField("receivableId")}><option value="">Chọn khoản thu</option>{(catalog?.receivables ?? []).filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>{scope === "invoice" && errors.receivableId && <small id="invoice-invoice-receivableId-error">{errors.receivableId}</small>}<label>Số lượng<input inputMode="numeric" value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} {...invoiceField("quantity")} /></label>{scope === "invoice" && errors.quantity && <small id="invoice-invoice-quantity-error">{errors.quantity}</small>}<label>Đơn giá điều chỉnh (VND, không bắt buộc)<input inputMode="numeric" value={line.unitPrice} onChange={(event) => setLine({ ...line, unitPrice: event.target.value })} {...invoiceField("unitPrice")} /></label>{scope === "invoice" && errors.unitPrice && <small id="invoice-invoice-unitPrice-error">{errors.unitPrice}</small>}<label>Lý do điều chỉnh<input value={line.overrideReason} onChange={(event) => setLine({ ...line, overrideReason: event.target.value })} {...invoiceField("overrideReason")} /></label>{scope === "invoice" && errors.overrideReason && <small id="invoice-invoice-overrideReason-error">{errors.overrideReason}</small>}<fieldset><legend>Nguồn giải thích thủ công</legend><label>Ngày dịch vụ<input type="date" value={line.serviceDate} onChange={(event) => setLine({ ...line, serviceDate: event.target.value })} /></label><label>Điểm danh<select value={line.attendanceState} onChange={(event) => setLine({ ...line, attendanceState: event.target.value })}><option value="">Không có</option><option value="PRESENT">Có mặt</option><option value="ABSENT">Vắng mặt</option></select></label><label>Giờ đón (HH:MM)<input value={line.pickedUpAt} onChange={(event) => setLine({ ...line, pickedUpAt: event.target.value })} /></label><label>Số phút trông muộn<input inputMode="numeric" value={line.lateCareMinutes} onChange={(event) => setLine({ ...line, lateCareMinutes: event.target.value })} /></label><label>Lý do nguồn giải thích<input value={line.sourceReason} onChange={(event) => setLine({ ...line, sourceReason: event.target.value })} /></label></fieldset><button disabled={Boolean(pending)}>{editingLineId ? "Lưu dòng" : "Thêm dòng"}</button>{editingLineId && <button type="button" onClick={() => { setEditingLineId(undefined); setEditingLineInvoiceId(undefined); setEditingSource(false); setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" }); }}>Hủy sửa</button>}</form> : <p>Hóa đơn {invoiceStatusLabel(invoice.status).toLocaleLowerCase("vi")} chỉ đọc; dòng hóa đơn không thể thay đổi.</p>}
            </section>
            <aside aria-labelledby="invoice-issue-title">
              {paymentParts.length === 1 && noticeParts.length === 1 ? <>
                <div className="finance-card-heading"><h2 id="invoice-issue-title">Thanh toán</h2><p>Mã hóa đơn {paymentParts[0]!.issue!.obligationCode} · Hạn thanh toán {displayDate(paymentParts[0]!.issue!.dueOn)}</p></div>
                <p className="finance-payment-total"><span>Tổng cần nộp</span><b>{vnd(paymentParts[0]!.issue!.obligationTotal)} VND</b></p>
                <dl className="finance-payment-facts"><dt>Ngân hàng</dt><dd>{paymentParts[0]!.issue!.bankAccount.receivingBank}</dd><dt>Số tài khoản</dt><dd>{paymentParts[0]!.issue!.bankAccount.accountNumber}</dd><dt>Chủ tài khoản</dt><dd>{paymentParts[0]!.issue!.bankAccount.accountHolderName}</dd><dt>Nội dung chuyển khoản</dt><dd>{paymentParts[0]!.issue!.transferContent}</dd></dl>
                <PaymentImagePanel apiUrl={apiUrl} schoolId={schoolId} invoiceId={paymentParts[0]!.id} fallbackFileName={`${paymentParts[0]!.issue!.obligationCode ?? paymentParts[0]!.id}-${invoice.student.code}.png`} denied={denied} />
              </> : paymentParts.length ? <>
                <div className="finance-card-heading"><h2 id="invoice-issue-title">Thanh toán</h2><p>Hạn thanh toán {displayDate(paymentParts[0]!.issue!.dueOn)} · {paymentParts.length} lần chuyển khoản</p></div>
                {noticeParts.map((part, index) => <div key={part.id} className="finance-notice-part" aria-labelledby={`payment-part-${part.id}`}>
                  <div className="finance-title-row"><b id={`payment-part-${part.id}`}>Phần {index + 1} · {channelAccountLabel(part.channel)}</b><span className={`finance-badge finance-badge-${part.paymentImageAvailable ? "neutral" : "success"}`}>{part.paymentImageAvailable ? "Chưa thu" : invoiceStatusLabel(part.status)}</span></div>
                  {part.issue && <><p>Mã hóa đơn {part.issue.obligationCode}</p>
                  <p className="finance-payment-total"><span>Tổng phần {index + 1}</span><b>{vnd(part.issue.obligationTotal)} VND</b></p>
                  <dl className="finance-payment-facts"><dt>Ngân hàng</dt><dd>{part.issue.bankAccount.receivingBank}</dd><dt>Số tài khoản</dt><dd>{part.issue.bankAccount.accountNumber}</dd><dt>Chủ tài khoản</dt><dd>{part.issue.bankAccount.accountHolderName}</dd></dl></>}
                </div>)}
                <p className="finance-payment-total"><span>Tổng cần nộp</span><b>{vnd(paymentParts.reduce((sum, part) => sum + BigInt(part.issue!.obligationTotal), 0n).toString())} VND</b></p>
                <dl className="finance-payment-facts"><dt>Nội dung chuyển khoản</dt><dd>{paymentParts[0]!.issue!.transferContent}</dd></dl>
                <PaymentImagePanel apiUrl={apiUrl} schoolId={schoolId} invoiceId={paymentParts[0]!.id} fallbackFileName={`${paymentParts[0]!.issue!.obligationCode ?? paymentParts[0]!.id}-${invoice.student.code}.png`} denied={denied} />
              </> : <div className="finance-card-heading"><h2 id="invoice-issue-title">Rà soát trước khi phát hành</h2><p>{invoice.status === "DRAFT" ? `Chính sách ưu đãi sẽ được kiểm tra lại trước khi phát hành. Không thể chỉnh sửa sau phát hành.${issueParts.length > 1 ? " Hai phần được phát hành cùng lúc." : ""}` : "Hóa đơn đã phát hành giữ nguyên snapshot nghĩa vụ và hướng dẫn thanh toán."}</p></div>}
              {invoice.status === "DRAFT" && issueParts.map((part) => <div key={part.id} className="finance-notice-part">
                <p className="finance-payment-total"><span>{issueParts.length > 1 ? `Phần ${noticeParts.findIndex((item) => item.id === part.id) + 1} · ${channelAccountLabel(part.channel)}` : channelAccountLabel(part.channel)}</span><b>{vnd(part.total)} VND</b></p>
                {part.channel === "SCHOOL" ? <>{schoolBankAccount ? <p>{schoolBankAccount.receivingBank} · {schoolBankAccount.accountNumber} · {schoolBankAccount.accountHolderName}</p> : <p role="alert">Chưa cấu hình tài khoản trường để thu khoản có thuế.</p>}<small>Hệ thống tự dùng tài khoản trường đang hiệu lực; không đổi tại đây.</small></> : <><label>Tài khoản cá nhân<select value={issueBankAccountId} onChange={(event) => setIssueBankAccountId(event.target.value)} aria-describedby="personal-account-hint"><option value="">Chọn tài khoản cá nhân</option>{personalBankAccounts.map((account) => <option key={account.id} value={account.id}>{account.receivingBank} · {account.accountNumber} · {account.accountHolderName}{account.id === invoice.notice?.classDefaultBankAccountId ? ` (mặc định lớp ${invoice.student.className})` : ""}</option>)}</select></label><small id="personal-account-hint">Chọn sẵn theo tài khoản mặc định của lớp; có thể chọn tài khoản cá nhân khác đang hiệu lực.</small></>}
              </div>)}
              {(invoice.revisesInvoiceId || invoice.replacementInvoiceId) && <p>Liên kết điều chỉnh: {invoice.revisesInvoiceId ? "Hóa đơn này thay thế hóa đơn trước đó." : "Hóa đơn này đã được thay thế."} {invoice.revisionReason ? `Lý do: ${invoice.revisionReason}.` : ""}</p>}
              <div className="finance-actions">
              {invoice.status === "DRAFT" && <button ref={issueTrigger} className="primary-action" type="button" disabled={Boolean(pending) || !issueParts.length} onClick={() => void openIssueConfirmation()}>{invoice.revisesInvoiceId ? "Phát hành bản thay thế" : issueParts.length > 1 ? "Phát hành phiếu thu" : "Phát hành hóa đơn"}</button>}
              {invoice.status === "ISSUED" && !invoice.revisesInvoiceId && <button ref={revisionTrigger} type="button" disabled={Boolean(pending)} onClick={() => { setRevisionReason(""); setRevisionConfirmationName(""); setRevisionConfirmation(true); }}>Chuẩn bị bản điều chỉnh</button>}
              </div>
            </aside>
          </div>
                {(["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status)) && !(invoice.paymentImageAvailable && !(invoice.carries ?? []).length) && <section aria-label="Thông tin thanh toán đã phát hành"><h4>Hướng dẫn thanh toán đã phát hành</h4><p>Tổng nghĩa vụ: {vnd(invoice.issue?.obligationTotal ?? invoice.total)} VND. Hạn thanh toán: {invoice.issue?.dueOn}.</p><p>{invoice.issue?.bankAccount.receivingBank} / {invoice.issue?.bankAccount.accountNumber} / {invoice.issue?.bankAccount.accountHolderName}</p><p>Nội dung chuyển khoản: {invoice.issue?.transferContent}</p>{invoice.receipt ? <p>Thực nhận: {vnd(invoice.receipt.actualAmount)} VND. Kết quả máy chủ: {invoice.receipt.outcome === "EXACT" ? "Đủ" : invoice.receipt.outcome === "SHORTFALL" ? "Thu thiếu" : "Thu thừa"}. Chênh lệch: {vnd(invoice.receipt.difference?.signedAmount ?? "0")} VND.</p> : invoice.settlementTransfer ? <p>Đã tất toán theo khoản thu đã ghi nhận trước đó: {vnd(invoice.settlementTransfer.amount)} VND, ghi nhận {invoice.settlementTransfer.postedAt}.</p> : <p>{invoice.status === "CANCELLED" ? "Hóa đơn đã hủy và chỉ đọc." : "Chưa có trạng thái thanh toán trong phạm vi này."}</p>}{(invoice.carries ?? []).map((carry) => <p key={`${carry.sourceDifferenceId}-${carry.type}`}>{carry.type === "SHORTFALL_CARRY" ? "Khoản thu thiếu chuyển sang" : "Khoản thu thừa khấu trừ"}: {vnd(carry.amount)} VND. Phần còn lại của chênh lệch chỉ được máy chủ chuyển vào đợt thu tháng kế tiếp đủ điều kiện.</p>)}</section>}
                {(invoice.sourceDebtTransfers ?? []).length > 0 && <section aria-label="Công nợ nguồn đã chuyển"><h4>Công nợ đã chuyển</h4><p>Công nợ nguồn còn lại do máy chủ xác nhận: {vnd(invoice.sourceOutstanding ?? "0")} VND.</p>{invoice.sourceDebtTransfers?.map((transfer) => <p key={`${transfer.targetInvoiceId}-${transfer.postedAt}`}>Đã chuyển sang hóa đơn kỳ sau: {vnd(transfer.amount)} VND. Lý do: {transfer.reason}. Ghi nhận {transfer.postedAt}.</p>)}</section>}
                {(invoice.priorDebtTransfers ?? []).length > 0 && <section aria-label="Nguồn công nợ kỳ trước"><h4>Công nợ kỳ trước</h4>{invoice.priorDebtTransfers?.map((transfer) => <p key={`${transfer.sourceInvoiceId}-${transfer.postedAt}`}>Hóa đơn nguồn: {vnd(transfer.amount)} VND. Lý do: {transfer.reason}. Ghi nhận {transfer.postedAt}.</p>)}</section>}
              {invoice.status === "DRAFT" && (
                <section aria-label="Ưu đãi nộp trước đang soạn">
                  <h4>Quản lý ưu đãi nộp trước</h4>
                  <p>Chọn chính sách ưu đãi nộp trước cho hóa đơn nháp. Kỳ bắt đầu là kỳ của hóa đơn ({invoice.billingMonth}), máy chủ sẽ tự động tạo đủ số kỳ liên tiếp.</p>
                  <label>
                    Chính sách ưu đãi nộp trước
                    <select
                      value={draftCoverageVersionId}
                      onChange={(event) => setDraftCoverageVersionId(event.target.value)}
                    >
                      <option value="">Chọn chính sách ưu đãi nộp trước</option>
                      {promotionVersions
                        .filter(({ version }) => version.status === "ACTIVE" && version.fulfillmentMode === "PREPAID_COVERAGE")
                        .map(({ policy, version }) => (
                          <option key={version.id} value={version.id}>
                            {policy.name} / Phiên bản {version.version} ({version.prepaidTermMonths ?? 1} tháng)
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(pending) || !draftCoverageVersionId}
                    onClick={() => void applyCoverage(draftCoverageVersionId)}
                  >
                    Áp dụng ưu đãi nộp trước
                  </button>
                  {(invoice.coverageFacts ?? []).length > 0 && (
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => void clearCoverage()}
                    >
                      Xóa ưu đãi nộp trước
                    </button>
                  )}
                </section>
              )}
              {(invoice.coverageFacts ?? []).length > 0 && (
                <section aria-label="Thông tin ưu đãi nộp trước">
                  <h4>Ưu đãi nộp trước</h4>
                  <table>
                    <caption>Thông tin ưu đãi nộp trước cho hóa đơn</caption>
                    <thead>
                      <tr>
                        <th>Kỳ</th>
                        <th>Khoản thu</th>
                        <th>Giá gốc (VND)</th>
                        <th>Giảm trừ (VND)</th>
                        <th>Thành tiền (VND)</th>
                        <th>Thời gian</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.coverageFacts?.map((fact) => {
                        const original = BigInt(fact.originalPrice || "0");
                        const red = BigInt(fact.reduction || "0");
                        const net = original - red;
                        return (
                          <tr key={`table-${fact.receivableId}-${fact.billingMonth}`}>
                            <td>{fact.billingMonth}</td>
                            <td>Khoản thu theo hóa đơn</td>
                            <td style={{ textAlign: "right" }}>{vnd(fact.originalPrice)}</td>
                            <td style={{ textAlign: "right" }}>{vnd(fact.reduction)}</td>
                            <td style={{ textAlign: "right" }}>{vnd(net.toString())}</td>
                            <td>{fact.serviceStart} đến {fact.serviceEnd}</td>
                            <td>{fact.issuedAt ? `Đã phát hành ${fact.issuedAt}` : "Chờ hóa đơn đóng"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {invoice.coverageFacts?.map((fact) => (
                    <p key={`${fact.receivableId}-${fact.billingMonth}`}>
                      Kỳ {fact.billingMonth}: giá gốc {vnd(fact.originalPrice)} VND, giảm {vnd(fact.reduction)} VND, khoảng dịch vụ {fact.serviceStart} đến {fact.serviceEnd}, lịch {fact.calendarEffectiveFrom} / {fact.timezone}. {fact.issuedAt ? `Đã phát hành ${fact.issuedAt}.` : "Chờ hóa đơn đóng đúng số tiền."}
                    </p>
                  ))}
                </section>
              )}
              {(invoice.coverageFacts ?? []).some((fact) => fact.issuedAt && fact.coverageId) && <section aria-label="Hoàn ưu đãi nộp trước"><h4>Hoàn ưu đãi nộp trước</h4><p>Chọn ưu đãi đã phát hành; ngày hiệu lực, số tiền làm tròn xuống và giới hạn đều do máy chủ trả về.</p><label>Ưu đãi đã phát hành<select value={coverageReversal.coverageId} onChange={(event) => { setCoverageReversal({ ...coverageReversal, coverageId: event.target.value }); setCoverageReversalPreview(undefined); }}><option value="">Chọn ưu đãi</option>{invoice.coverageFacts?.filter((fact) => fact.issuedAt && fact.coverageId).map((fact) => <option key={fact.coverageId} value={fact.coverageId!}>{invoice.lines.find((line) => line.receivableId === fact.receivableId)?.receivableName ? `${fact.billingMonth} / ${invoice.lines.find((line) => line.receivableId === fact.receivableId)?.receivableName}` : fact.billingMonth}</option>)}</select></label><label>Ngày hiệu lực<input type="date" value={coverageReversal.effectiveOn} onChange={(event) => setCoverageReversal({ ...coverageReversal, effectiveOn: event.target.value })} /></label><button type="button" onClick={() => void previewCoverageReversal()}>Xem trước khoản hoàn từ máy chủ</button>{coverageReversalPreview && <div><p>Thông tin tính toán: {coverageReversalPreview.remainingDays}/{coverageReversalPreview.denominator} ngày, số tiền sau khi làm tròn xuống {vnd(coverageReversalPreview.calculatedAmount)} VND{coverageReversalPreview.calculatedVatAmount && coverageReversalPreview.calculatedVatAmount !== "0" ? ` (gồm thuế GTGT ${coverageReversalPreview.vatRate}% ${vnd(coverageReversalPreview.calculatedVatAmount)} VND)` : ""}, còn có thể hoàn {vnd(coverageReversalPreview.availableAmount)} VND.</p><p>{coverageReversalPreview.source.reversalMode === "DIRECT" ? "Cần xác nhận tên học sinh." : "Yêu cầu sẽ được gửi để một quản trị viên khác của trường duyệt."}</p><label>Số tiền điều chỉnh (VND)<input inputMode="numeric" value={coverageReversal.amount} onChange={(event) => setCoverageReversal({ ...coverageReversal, amount: event.target.value })} /></label><label>Lý do<textarea value={coverageReversal.reason} onChange={(event) => setCoverageReversal({ ...coverageReversal, reason: event.target.value })} /></label>{coverageReversalPreview.source.reversalMode === "DIRECT" && <label>Nhập tên học sinh {coverageReversalPreview.source.studentName} để xác nhận<input value={coverageReversal.confirmation} onChange={(event) => setCoverageReversal({ ...coverageReversal, confirmation: event.target.value })} /></label>}<button type="button" disabled={Boolean(pending) || !coverageReversal.reason || (coverageReversalPreview.source.reversalMode === "DIRECT" && coverageReversal.confirmation !== coverageReversalPreview.source.studentName)} onClick={() => void postCoverageReversal()}>{coverageReversalPreview.source.reversalMode === "DIRECT" ? "Xác nhận hoàn ưu đãi nộp trước" : "Gửi yêu cầu duyệt hoàn ưu đãi nộp trước"}</button></div>}</section>}
        </section>
      )}
      {removeConfirmation && <><div className="dialog-backdrop" aria-hidden="true" /><div ref={removeDialog} className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-remove-line-title" onKeyDown={trapRemoveFocus}><h3 id="finance-remove-line-title">Xóa dòng {removeConfirmation.name}</h3><p>Dòng này sẽ không còn áp dụng cho hóa đơn nháp.</p><button type="button" disabled={Boolean(pending)} onClick={() => void removeLine(removeConfirmation.id, removeConfirmation.invoiceId)}>Xác nhận xóa dòng</button><button type="button" disabled={Boolean(pending)} onClick={() => setRemoveConfirmation(undefined)}>Hủy</button></div></>}
       {issueConfirmation && invoice && <><div className="dialog-backdrop" aria-hidden="true" /><div ref={issueDialog} className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-issue-title" onKeyDown={trapIssueFocus}><h3 id="finance-issue-title">{invoice.revisesInvoiceId ? "Phát hành bản thay thế" : issueParts.length > 1 ? "Phát hành phiếu thu" : "Phát hành hóa đơn"} cho {invoice.student.name}</h3><p>Chỉ thông tin tài khoản đang hoạt động do máy chủ xác nhận được dùng. Không thể chỉnh sửa sau phát hành.</p>{issueParts.map((part) => part.channel === "SCHOOL" ? <p key={part.id}>{channelAccountLabel(part.channel)} · {vnd(part.total)} VND: {schoolBankAccount ? `${schoolBankAccount.receivingBank} / ${schoolBankAccount.accountNumber} / ${schoolBankAccount.accountHolderName}` : "chưa cấu hình"}</p> : <label key={part.id}>{issueParts.length > 1 ? `Tài khoản cá nhân · ${vnd(part.total)} VND` : "Tài khoản nhận"}<select value={issueBankAccountId} onChange={(event) => setIssueBankAccountId(event.target.value)}><option value="">Chọn tài khoản</option>{personalBankAccounts.map((account) => <option key={account.id} value={account.id}>{account.receivingBank} / {account.accountNumber} / {account.accountHolderName}</option>)}</select></label>)}<label>Nhập chính xác tên học sinh {invoice.student.name} để xác nhận<input value={issueConfirmationName} onChange={(event) => setIssueConfirmationName(event.target.value)} /></label><button type="button" disabled={Boolean(pending) || !issueAccountsReady || issueConfirmationName !== invoice.student.name} onClick={() => void issueInvoice()}>Xác nhận phát hành</button><button type="button" disabled={Boolean(pending)} onClick={() => { setIssueConfirmation(false); setIssueConfirmationName(""); }}>Hủy</button></div></>}
       {revisionConfirmation && invoice && <><div className="dialog-backdrop" aria-hidden="true" /><div ref={revisionDialog} className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-revision-title" onKeyDown={trapRevisionFocus}><h3 id="finance-revision-title">Chuẩn bị bản điều chỉnh cho {invoice.student.name}</h3><p>Hóa đơn đã phát hành vẫn giữ nguyên cho đến khi bản thay thế được phát hành.</p><label>Lý do điều chỉnh<textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} /></label><label>Nhập chính xác tên học sinh {invoice.student.name} để xác nhận<input value={revisionConfirmationName} onChange={(event) => setRevisionConfirmationName(event.target.value)} /></label><button type="button" disabled={Boolean(pending) || !revisionReason.trim() || revisionConfirmationName !== invoice.student.name} onClick={() => void prepareRevision()}>Xác nhận chuẩn bị bản điều chỉnh</button><button type="button" disabled={Boolean(pending)} onClick={() => setRevisionConfirmation(false)}>Hủy</button></div></>}
          {coverageDecision && <><div className="dialog-backdrop" aria-hidden="true" /><div ref={coverageDecisionDialog} className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="coverage-decision-title" onKeyDown={trapCoverageDecisionFocus}><h3 id="coverage-decision-title">{coverageDecision.decision === "APPROVE" ? "Duyệt" : "Từ chối"} hoàn ưu đãi nộp trước cho {coverageDecision.request.studentName}</h3><p>Số tiền máy chủ đã chốt: {vnd(coverageDecision.request.amount)} VND{coverageDecision.request.vatAmount && coverageDecision.request.vatAmount !== "0" ? ` (gồm thuế GTGT ${vnd(coverageDecision.request.vatAmount)} VND)` : ""}. Bạn không thể tự duyệt yêu cầu của mình.</p><label>Lý do quyết định<textarea autoFocus value={coverageDecision.reason} onChange={(event) => setCoverageDecision({ ...coverageDecision, reason: event.target.value })} /></label><button type="button" disabled={Boolean(pending) || !coverageDecision.reason.trim()} onClick={() => void decideCoverageReversal()}>Xác nhận {coverageDecision.decision === "APPROVE" ? "duyệt" : "từ chối"}</button><button type="button" disabled={Boolean(pending)} onClick={() => setCoverageDecision(undefined)}>Hủy</button></div></>}
      {closeConfirmation && run && <><div className="dialog-backdrop" aria-hidden="true" /><div ref={closeDialog} className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-close-run-title" onKeyDown={trapCloseFocus}><h3 id="finance-close-run-title">Đóng đợt thu {run.billingMonth}</h3><p>Chỉ đóng được khi mọi hóa đơn đã phát hành. Sau khi đóng, máy chủ từ chối thêm học sinh và các thao tác tạo hoặc sửa.</p><label>Nhập chính xác tháng thu {run.billingMonth} để xác nhận<input value={closeConfirmationMonth} onChange={(event) => setCloseConfirmationMonth(event.target.value)} /></label><label>Lý do đóng đợt thu<textarea id="finance-close-reason-field" aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? "finance-close-reason-error" : undefined} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>{errors.reason && <small id="finance-close-reason-error">{errors.reason}</small>}<button type="button" disabled={Boolean(pending) || !closeReason.trim() || closeConfirmationMonth !== run.billingMonth} onClick={() => void closeRun()}>Xác nhận đóng đợt thu</button><button type="button" disabled={Boolean(pending)} onClick={() => { setCloseConfirmation(false); setCloseReason(""); setCloseConfirmationMonth(""); }}>Hủy</button></div></>}
      {generateConfirmation && run && (<>
        <div className="dialog-backdrop" aria-hidden="true" />
        <div
          className="dialog finance-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-generate-title"
        >
          <h3 id="finance-generate-title">
            Xác nhận tạo hóa đơn nháp cho đợt {run.billingMonth}
          </h3>
              <p>Máy chủ sẽ đánh giá lại danh sách học sinh trước khi tạo hóa đơn.</p>
              <label>
                Nhập chính xác tháng thu {run.billingMonth} để xác nhận
                <input
                  autoFocus
                  value={generateConfirmationMonth}
                  onChange={(event) =>
                    setGenerateConfirmationMonth(event.target.value)
                  }
                />
              </label>
              <button
                disabled={Boolean(pending) || generateConfirmationMonth !== run.billingMonth}
                onClick={() => void generate()}
              >
            Xác nhận tạo hóa đơn nháp
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
                onClick={() => {
                  setGenerateConfirmation(false);
                  setGenerateConfirmationMonth("");
                }}
          >
            Hủy
          </button>
        </div>
      </>)}
      {addStudentsOpen && run?.status === "GENERATED" && (<>
        <div className="dialog-backdrop" aria-hidden="true" />
        <div ref={addStudentsDialog} className="dialog finance-list-dialog" role="dialog" aria-modal="true" aria-labelledby="generated-student-addition-title" onKeyDown={(event) => { if (event.key === "Escape") closeAddStudents(); else trapDialogFocus(event); }}>
          <h3 id="generated-student-addition-title">Thêm học sinh vào đợt đã tạo</h3>
          <p>Máy chủ sẽ tự xác nhận điều kiện học sinh và dùng bản chốt khoản thu của đợt.</p>
          <div className="table-scroll">
            <table>
              <caption>Học sinh có thể yêu cầu thêm</caption>
              <thead><tr><th>Học sinh</th><th>Thao tác</th></tr></thead>
              <tbody>
                {Array.isArray(candidates?.students) && candidates.students.length ? candidates.students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.studentCode} / {student.fullName}</td>
                    <td><button type="button" disabled={Boolean(pending)} onClick={() => { setAddStudentsOpen(false); setAdditionConfirmation(student); setAdditionConfirmationName(""); }}>Yêu cầu thêm</button></td>
                  </tr>
                )) : <tr><td colSpan={2}>{candidates ? "Không có học sinh nào có thể thêm." : "Đang tải học sinh có thể thêm."}</td></tr>}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={closeAddStudents}>Đóng</button>
        </div>
      </>)}
      {additionConfirmation && run && (<>
        <div className="dialog-backdrop" aria-hidden="true" />
        <div className="dialog finance-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-add-student-title">
          <h3 id="finance-add-student-title">Xác nhận thêm {additionConfirmation.fullName}</h3>
          <p>Máy chủ có thể từ chối nếu học sinh không đủ điều kiện hoặc đã có hóa đơn.</p>
          <label>
            Nhập chính xác tên học sinh {additionConfirmation.fullName} để xác nhận
            <input autoFocus value={additionConfirmationName} onChange={(event) => setAdditionConfirmationName(event.target.value)} />
          </label>
          <button disabled={Boolean(pending) || additionConfirmationName !== additionConfirmation.fullName} onClick={() => void addGeneratedStudent()}>Xác nhận thêm học sinh</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => { setAdditionConfirmation(undefined); setAdditionConfirmationName(""); }}>Hủy</button>
        </div>
      </>)}
      </>}
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
                {lifecycle.next === "ACTIVE" ? "Kích hoạt" : "Ngừng áp dụng"}{" "}
                {lifecycle.name}
              </h3>
              <label>
                Lý do
                <input
                  autoFocus
                  value={lifecycle.reason}
                  onChange={(event) =>
                    setLifecycle({ ...lifecycle, reason: event.target.value })
                  }
                  {...field("lifecycle", "reason")}
                />
              </label>
              {scope === "lifecycle" && errors.reason && (
                <small id="lifecycle-reason-error">{errors.reason}</small>
              )}
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
          <div ref={catalogDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="finance-receivable-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setCatalogDialog(undefined), resetReceivable)}>
            <form onSubmit={saveReceivable}>
              <h3 id="finance-receivable-title">Thêm khoản thu</h3><p>Khoản thu mới chỉ dùng được sau khi máy chủ xác nhận trong đúng Trường.</p>
              <label>Nhóm<select value={receivable.groupId} onChange={(event) => setReceivable({ ...receivable, groupId: event.target.value })} {...field("receivable", "groupId")}><option value="">Chọn nhóm</option>{(catalog?.groups ?? []).filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Mã khoản thu<input value={receivable.code} onChange={(event) => setReceivable({ ...receivable, code: event.target.value })} /></label>
              <label>Tên khoản thu<input value={receivable.displayName} onChange={(event) => setReceivable({ ...receivable, displayName: event.target.value })} {...field("receivable", "displayName")} /></label>
              <label>Đơn vị tính<input placeholder="Ví dụ: tháng, ngày, buổi" value={receivable.unitLabel} onChange={(event) => setReceivable({ ...receivable, unitLabel: event.target.value })} {...field("receivable", "unitLabel")} /></label>
              <label>Giá / đơn vị (chưa VAT)<input inputMode="numeric" value={receivable.defaultUnitPrice} onChange={(event) => setReceivable({ ...receivable, defaultUnitPrice: event.target.value })} {...field("receivable", "defaultUnitPrice")} /></label>
              <label>Mức thuế suất<select value={receivable.taxCategory} onChange={(event) => setReceivable({ ...receivable, taxCategory: event.target.value as TaxCategory })} aria-describedby="receivable-tax-channel-hint">{taxCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><small className="muted" id="receivable-tax-channel-hint">{taxChannelHint(receivable.taxCategory)}</small>
              <p className="muted">Hệ thống tính thuế GTGT trên giá sau giảm trừ và chuyển khoản thu vào đúng tài khoản; đổi mức thuế chỉ áp dụng cho dòng hóa đơn thêm mới sau đó.</p>
              {scope === "receivable" && Object.entries(errors).map(([name, error]) => <small key={name} id={`receivable-${name}-error`}>{error}</small>)}
              <button disabled={Boolean(pending)}>Lưu khoản thu</button><button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setCatalogDialog(undefined), resetReceivable)}>Hủy</button>
            </form>
          </div>
        </div>
      )}
      {taxChange && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="finance-tax-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setTaxChange(undefined))}>
            <form onSubmit={saveTaxCategory}>
              <h3 id="finance-tax-title">Đổi mức thuế suất · {taxChange.name}</h3>
              <p>Hóa đơn đã phát hành giữ nguyên. Dòng nháp hiện có giữ mức thuế cũ; xóa rồi thêm lại dòng để áp dụng mức mới.</p>
              <label>Mức thuế suất<select autoFocus value={taxChange.taxCategory} onChange={(event) => setTaxChange({ ...taxChange, taxCategory: event.target.value as TaxCategory })} aria-describedby="tax-change-channel-hint">{taxCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><small className="muted" id="tax-change-channel-hint">{taxChannelHint(taxChange.taxCategory)}</small>
              {scope === "receivable" && Object.entries(errors).map(([name, error]) => <small key={name}>{error}</small>)}
              <button disabled={Boolean(pending)}>Lưu mức thuế suất</button><button type="button" disabled={Boolean(pending)} onClick={() => closeManagedDialog(() => setTaxChange(undefined))}>Hủy</button>
            </form>
          </div>
        </div>
      )}
      {catalogDialog === "group" && (
        <div className="dialog-backdrop">
          <div ref={catalogDialogRef} className="dialog finance-group-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-group-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setCatalogDialog(undefined), () => setGroup({ name: "" }))}>
            <h3 id="finance-group-title">Quản lý nhóm khoản thu</h3><p>Nhóm đang dùng trong lịch sử không bị xóa.</p>
            <button type="button" className="primary-action" disabled={Boolean(pending)} onClick={(event) => { setErrors({}); setGroup({ name: "" }); openManagedDialog(event.currentTarget, () => setCatalogDialog("group-form")); }}>Thêm nhóm</button>
            <table><caption>Nhóm khoản thu theo Trường</caption><thead><tr><th>Tên</th><th>Trạng thái</th><th>Tùy chọn</th></tr></thead><tbody>{catalog?.groups?.length ? catalog.groups.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.status === "ACTIVE" ? "Đang áp dụng" : "Ngừng áp dụng"}</td><td><AnchoredActionMenu label={`Tùy chọn cho ${item.name}`} disabled={Boolean(pending)} onTriggerOpen={(trigger) => { rowMenuTrigger.current = trigger; }}><AnchoredActionMenuItem onClick={() => { dialogTrigger.current = rowMenuTrigger.current; setCatalogDialog(undefined); setLifecycle({ kind: "receivable-groups", id: item.id, name: item.name, next: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: "" }); }}>{item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}</AnchoredActionMenuItem></AnchoredActionMenu></td></tr>) : <tr><td colSpan={3}>{catalog ? "Chưa có nhóm khoản thu." : "Đang tải nhóm khoản thu."}</td></tr>}</tbody></table>
            <button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setCatalogDialog(undefined), () => setGroup({ name: "" }))}>Đóng</button>
          </div>
        </div>
      )}
      {catalogDialog === "group-form" && (
        <div className="dialog-backdrop">
          <div ref={catalogDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="finance-new-group-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setCatalogDialog("group"), () => setGroup({ name: "" }))}>
            <form onSubmit={saveGroup}><h3 id="finance-new-group-title">Thêm nhóm khoản thu</h3><label>Tên nhóm<input value={group.name} onChange={(event) => setGroup({ name: event.target.value })} {...field("group", "name")} /></label>{scope === "group" && errors.name && <small id="group-name-error">{errors.name}</small>}<button disabled={Boolean(pending)}>Lưu nhóm</button><button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setCatalogDialog("group"), () => setGroup({ name: "" }))}>Hủy</button></form>
          </div>
        </div>
      )}
      {promotionDialog === "policy" && <div className="dialog-backdrop" aria-hidden="true" />}
      {promotionDialog === "policy" && (
        <div ref={promotionDialogRef} role="dialog" aria-modal="true" aria-labelledby="finance-policy-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setPromotionDialog(undefined), resetPromotion)}>
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
                    {promotionPolicies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
              <input value={promotion.name} disabled={Boolean(promotion.policyId)} onChange={(event) => setPromotion({ ...promotion, name: event.target.value })} {...promotionField("name")} />
            </label>
            {scope === "promotion" && errors.name && <small id="invoice-promotion-name-error" className="finance-policy-full">{errors.name}</small>}
            <fieldset className="finance-policy-full" {...promotionField("receivableIds")}>
              <legend>Khoản thu áp dụng</legend>
              {(catalog?.receivables ?? []).filter((item) => item.available).map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={promotion.receivableIds.includes(item.id)} onChange={() => setPromotion({ ...promotion, receivableIds: promotion.receivableIds.includes(item.id) ? promotion.receivableIds.filter((id) => id !== item.id) : [...promotion.receivableIds, item.id] })} />
                  {item.displayName}
                </label>
              ))}
            </fieldset>
            {scope === "promotion" && errors.receivableIds && <small id="invoice-promotion-receivableIds-error" className="finance-policy-full">{errors.receivableIds}</small>}
            <label>
              Loại giảm
              <select value={promotion.discountType} onChange={(event) => setPromotion({ ...promotion, discountType: event.target.value })}>
                <option value="PERCENTAGE">Phần trăm</option>
                <option value="FIXED_VND">Số tiền VND</option>
              </select>
            </label>
            <label>
              Mức giảm
              <input inputMode="numeric" value={promotion.discountValue} onChange={(event) => setPromotion({ ...promotion, discountValue: event.target.value })} {...promotionField("discountValue")} />
            </label>
            {scope === "promotion" && errors.discountValue && <small id="invoice-promotion-discountValue-error" className="finance-policy-full">{errors.discountValue}</small>}
            <label>
              Hiệu lực từ
              <input type="date" value={promotion.effectiveFrom} onChange={(event) => setPromotion({ ...promotion, effectiveFrom: event.target.value })} />
            </label>
            <label>
              Hiệu lực đến (bao gồm)
              <input type="date" value={promotion.effectiveTo} onChange={(event) => setPromotion({ ...promotion, effectiveTo: event.target.value })} />
            </label>
            <label>
              Ưu tiên
              <input inputMode="numeric" value={promotion.priority} onChange={(event) => setPromotion({ ...promotion, priority: event.target.value })} />
            </label>
            <label>
              Quy tắc kết hợp
              <select value={promotion.stackingMode} onChange={(event) => setPromotion({ ...promotion, stackingMode: event.target.value })}>
                <option value="STACKABLE">Có thể kết hợp</option>
                <option value="EXCLUSIVE">Độc quyền</option>
              </select>
            </label>
            <fieldset className="finance-policy-full finance-policy-fulfillment">
              <legend>Cách thực hiện</legend>
              <div className="finance-policy-options">
                <label className={`finance-policy-option-card ${promotion.fulfillmentMode === "DISCOUNT" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="fulfillmentMode"
                    value="DISCOUNT"
                    checked={promotion.fulfillmentMode === "DISCOUNT"}
                    onChange={(event) => setPromotion({ ...promotion, fulfillmentMode: event.target.value as "DISCOUNT" | "PREPAID_COVERAGE", prepaidTermMonths: "" })}
                  />
                  <div className="finance-policy-option-text">
                    <strong>Giảm trên hóa đơn</strong>
                    <span>Giảm trừ trực tiếp số tiền phải nộp trên hóa đơn của kỳ thu hiện tại.</span>
                  </div>
                </label>
                <label className={`finance-policy-option-card ${promotion.fulfillmentMode === "PREPAID_COVERAGE" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="fulfillmentMode"
                    value="PREPAID_COVERAGE"
                    checked={promotion.fulfillmentMode === "PREPAID_COVERAGE"}
                    onChange={(event) => setPromotion({ ...promotion, fulfillmentMode: event.target.value as "DISCOUNT" | "PREPAID_COVERAGE", prepaidTermMonths: promotion.prepaidTermMonths || "1" })}
                  />
                  <div className="finance-policy-option-text">
                    <strong>Ưu đãi nộp trước</strong>
                    <span>Thu trước các kỳ tương lai liên tiếp tính từ kỳ của hóa đơn; chỉ phát hành quyền ưu đãi sau khi hóa đơn đóng đủ số tiền.</span>
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
              <button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setPromotionDialog(undefined), resetPromotion)}>Hủy</button>
            </div>
          </form>
        </div>
      )}
      {promotionTransition && (
        <div role="dialog" aria-modal="true" aria-labelledby="finance-promotion-transition-title" onKeyDown={(event) => handleManagedDialogKeyDown(event, () => setPromotionTransition(undefined))}>
          <h3 id="finance-promotion-transition-title">{promotionTransition.action === "activate" ? "Kích hoạt" : "Ngừng"} phiên bản {promotionTransition.name}</h3>
          <p>{promotionTransition.action === "activate" ? "Phiên bản này sẽ trở thành trạng thái do máy chủ xác nhận." : "Phiên bản này sẽ không còn được áp dụng cho các đánh giá mới."}</p>
          <button id="finance-promotion-transition-confirm" type="button" disabled={Boolean(pending)} onClick={() => void confirmPromotionTransition(promotionTransition.id, promotionTransition.action)}>Xác nhận {promotionTransition.action === "activate" ? "kích hoạt" : "ngừng phiên bản"}</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => closeNewDialog(() => setPromotionTransition(undefined), () => {})}>Hủy</button>
        </div>
      )}
      {promotionDialog === "assignment" && (
        <div ref={promotionDialogRef} role="dialog" aria-modal="true" aria-labelledby="finance-assignment-title" onKeyDown={trapDialogFocus}><form onSubmit={saveAssignments}><h3 id="finance-assignment-title">Gán ưu đãi cho học sinh</h3><p>Cả nhóm dùng chung thời hạn và lý do; máy chủ chỉ lưu khi toàn bộ danh sách hợp lệ.</p><label>Phiên bản đang áp dụng<select value={assignment.versionId} onChange={(event) => setAssignment({ ...assignment, versionId: event.target.value })}><option value="">Chọn phiên bản</option>{promotionPolicies.flatMap((policy) => (policy.versions ?? []).filter((version) => version.status === "ACTIVE").map((version) => <option key={version.id} value={version.id}>{policy.name} / Phiên bản {version.version}</option>))}</select></label><fieldset><legend>Học sinh</legend>{promotionStudents.map((student) => <label key={student.id}><input type="checkbox" checked={assignment.studentIds.includes(student.id)} onChange={() => setAssignment({ ...assignment, studentIds: assignment.studentIds.includes(student.id) ? assignment.studentIds.filter((id) => id !== student.id) : [...assignment.studentIds, student.id] })} />{student.studentCode} / {student.fullName}</label>)}</fieldset><label>Áp dụng từ<input type="date" value={assignment.effectiveFrom} onChange={(event) => setAssignment({ ...assignment, effectiveFrom: event.target.value })} /></label><label>Áp dụng đến (bao gồm)<input type="date" value={assignment.effectiveTo} onChange={(event) => setAssignment({ ...assignment, effectiveTo: event.target.value })} /></label><label>Lý do<textarea value={assignment.reason} onChange={(event) => setAssignment({ ...assignment, reason: event.target.value })} /></label><button disabled={Boolean(pending)}>Lưu gán học sinh</button><button type="button" disabled={Boolean(pending)} onClick={() => closeManagedDialog(() => setPromotionDialog(undefined))}>Hủy</button></form></div>
      )}
      {endingAssignment && (
        <div role="dialog" aria-modal="true" aria-labelledby="finance-end-assignment-title" onKeyDown={trapDialogFocus}><form onSubmit={endAssignment}><h3 id="finance-end-assignment-title">Kết thúc áp dụng ưu đãi</h3><label>Ngày kết thúc (bao gồm)<input autoFocus type="date" value={endingAssignment.effectiveTo} onChange={(event) => setEndingAssignment({ ...endingAssignment, effectiveTo: event.target.value })} /></label><label>Lý do<textarea value={endingAssignment.reason} onChange={(event) => setEndingAssignment({ ...endingAssignment, reason: event.target.value })} /></label><button disabled={Boolean(pending)}>Xác nhận kết thúc</button><button type="button" disabled={Boolean(pending)} onClick={() => closeManagedDialog(() => setEndingAssignment(undefined))}>Hủy</button></form></div>
      )}
    </section>
  );
}
