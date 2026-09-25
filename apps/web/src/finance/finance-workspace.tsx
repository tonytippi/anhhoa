import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

type Group = { id: string; name: string; status: "ACTIVE" | "INACTIVE" | null };
type Receivable = {
  id: string;
  groupId: string;
  code: string | null;
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  status: "ACTIVE" | "INACTIVE" | null;
  available: boolean;
};
type Catalog = { groups: Group[]; receivables: Receivable[] };
type PromotionPolicy = { id: string; name: string; versions: Array<{ id: string; version: number; status: "DRAFT" | "ACTIVE" | "RETIRED"; discountType: "FIXED_VND" | "PERCENTAGE"; discountValue: string; priority: number; stackingMode: "STACKABLE" | "EXCLUSIVE"; fulfillmentMode: "DISCOUNT" | "PREPAID_COVERAGE"; effectiveFrom: string; effectiveTo: string | null; targets: Array<{ id: string; receivableId: string; receivableName: string }>; assignments: Array<{ id: string; studentId: string; studentCode: string; studentName: string; effectiveFrom: string; effectiveTo: string | null; isCurrent: boolean; reason: string; endReason: string | null }> }> };
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
  selectedStudentIds: string[];
  templateLines: Array<{ id: string; receivableId: string; receivableName: string; unitLabel: string; defaultUnitPrice: string; quantity: string; amount: string }>;
  coverageSelections?: Array<{ studentId: string; versionId: string; billingMonth: string }>;
  invoices?: Array<{ id: string; studentId: string; studentCode: string; studentName: string; className: string; status: string; total: string }>;
};
type Preview = {
  run: Run;
  eligible: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
    lines: Array<{ receivableId: string; receivableName: string; grossAmount: string; discountAmount: string; netAmount: string; promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> } }>;
  }>;
  skips: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
  fingerprint: string;
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
type BankAccount = { id: string; receivingBank: string; accountNumber: string; accountHolderName: string };
type Invoice = { id: string; status: string; total: string; sourceOutstanding?: string | null; billingMonth: string; revisesInvoiceId: string | null; revisionReason: string | null; replacementInvoiceId: string | null; receipt: { actualAmount: string; outcome: "EXACT" | "SHORTFALL" | "OVERPAYMENT"; postedAt: string; difference: { signedAmount: string } | null } | null; settlementTransfer: { sourceInvoiceId: string; sourceReceiptId: string; amount: string; postedAt: string } | null; sourceDebtTransfers?: Array<{ targetInvoiceId: string; amount: string; reason: string; postedAt: string }>; priorDebtTransfers?: Array<{ sourceInvoiceId: string; amount: string; reason: string; postedAt: string }>; carries: Array<{ type: "SHORTFALL_CARRY" | "OVERPAYMENT_CARRY"; amount: string; sourceDifferenceId: string }>; coverageFacts?: Array<{ coverageId: string | null; receivableId: string; billingMonth: string; policyId: string; versionId: string; originalPrice: string; reduction: string; serviceStart: string; serviceEnd: string; calendarEffectiveFrom: string; timezone: string; issuedAt: string | null }>; student: { code: string; name: string; className: string }; lines: Array<{ id: string; kind?: "NORMAL" | "PRIOR_DEBT"; receivableId: string | null; receivableName: string; unitLabel: string; unitPrice: string; quantity: string; amount: string; grossAmount: string; discountAmount: string; netAmount: string; promotionEvaluation: { applications: Array<{ assignmentReason: string; appliedDiscount: string }> } | null; promotionApplicationSnapshot: Array<{ assignmentReason: string; appliedDiscount: string }> | null; overrideReason: string | null; source: Source | null; sourceReason: string | null; sourceRecordedAt: string | null; sourceProvenance: unknown; sourceAudit: { actorIdentityId: string; membershipId: string } | null }>; issue?: { obligationTotal: string; dueOn: string; bankAccount: BankAccount; transferContent: string; policy: { effectiveFrom: string; dueDaysAfterIssue: number; taxTreatment: string; debtScope: string; reversalMode: string } } };
type Pending = { id: string; schoolId: string };
type CoverageReversalPreview = { coverageId: string; effectiveOn: string; denominator: number; remainingDays: number; calculatedAmount: string; availableAmount: string; source: { studentName: string; reversalMode: "DIRECT" | "SCHOOL_ADMIN_APPROVAL"; invoiceId: string; receiptId: string; serviceStart: string; serviceEnd: string; calendarEffectiveFrom: string; timezone: string } };
type CoverageReversalRequest = { id: string; coverageId: string; studentName: string; amount: string; effectiveOn: string; reason: string; canDecide: boolean };
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
const skipReason = (reason: string) =>
  ({
    NO_ENROLLMENT: "Không còn hồ sơ nhập học.",
    ENROLLMENT_NOT_EFFECTIVE: "Nhập học không hiệu lực vào đầu tháng thu.",
    NOT_ENROLLED: "Học sinh không ở trạng thái đang theo học.",
    NO_CLASS_ASSIGNMENT: "Chưa có lớp được phân công hiệu lực vào đầu tháng thu.",
    CLASS_INACTIVE: "Lớp được phân công đã ngừng hoạt động.",
    INVOICE_EXISTS: "Học sinh đã có hóa đơn trong đợt thu này.",
  })[reason] ?? "Không đủ điều kiện theo roster hiện tại.";

export function FinanceWorkspace({
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
  const [catalog, setCatalog] = useState<Catalog>();
  const [promotionData, setPromotionData] = useState({ schoolId, policies: [] as PromotionPolicy[], students: [] as Candidate[] });
  const [promotion, setPromotion] = useState({ policyId: "", name: "", receivableIds: [] as string[], discountType: "PERCENTAGE", discountValue: "", priority: "1", stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "", effectiveTo: "" });
  const [assignment, setAssignment] = useState({ versionId: "", studentIds: [] as string[], effectiveFrom: "", effectiveTo: "", reason: "" });
  const [coverage, setCoverage] = useState({ studentId: "", versionId: "", billingMonth: "" });
  const [endingAssignment, setEndingAssignment] = useState<{ id: string; effectiveTo: string; reason: string }>();
  const [candidates, setCandidates] = useState<Candidates>();
  const [runs, setRuns] = useState<Run[]>([]);
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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [issueConfirmation, setIssueConfirmation] = useState(false);
  const [issueConfirmationName, setIssueConfirmationName] = useState("");
  const [issueBankAccountId, setIssueBankAccountId] = useState("");
  const [revisionConfirmation, setRevisionConfirmation] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionConfirmationName, setRevisionConfirmationName] = useState("");
  const [receiptConfirmation, setReceiptConfirmation] = useState(false);
  const [actualReceipt, setActualReceipt] = useState("");
  const [coverageReversal, setCoverageReversal] = useState({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" });
  const [coverageReversalPreview, setCoverageReversalPreview] = useState<CoverageReversalPreview>();
  const [coverageReversalRequests, setCoverageReversalRequests] = useState<CoverageReversalRequest[]>([]);
  const [coverageDecision, setCoverageDecision] = useState<{ request: CoverageReversalRequest; decision: "APPROVE" | "REFUSE"; reason: string }>();
  const [line, setLine] = useState({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" });
  const [editingLineId, setEditingLineId] = useState<string>();
  const [editingSource, setEditingSource] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<{ id: string; name: string }>();
  const [open, setOpen] = useState({ schoolYearId: "", billingMonth: "" });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [template, setTemplate] = useState({ receivableId: "", quantity: "" });
  const [group, setGroup] = useState({ name: "" });
  const [receivable, setReceivable] = useState({
    groupId: "",
    code: "",
    displayName: "",
    unitLabel: "",
    defaultUnitPrice: "",
  });
  const [lifecycle, setLifecycle] = useState<Lifecycle>();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"group" | "receivable" | "invoice" | "lifecycle" | "promotion">(
    "group",
  );
  const [pending, setPending] = useState<Pending>();
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>();
  const activeSchool = useRef(schoolId);
  const summary = useRef<HTMLDivElement>(null);
  const removeDialog = useRef<HTMLDivElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const issueDialog = useRef<HTMLDivElement>(null);
  const issueTrigger = useRef<HTMLButtonElement>(null);
  const revisionDialog = useRef<HTMLDivElement>(null);
  const revisionTrigger = useRef<HTMLButtonElement>(null);
  const receiptDialog = useRef<HTMLDivElement>(null);
  const receiptTrigger = useRef<HTMLButtonElement>(null);
  const closeDialog = useRef<HTMLDivElement>(null);
  const closeTrigger = useRef<HTMLButtonElement>(null);
  const coverageDecisionDialog = useRef<HTMLDivElement>(null);
  const coverageDecisionTrigger = useRef<HTMLButtonElement>(null);
  const closedHeading = useRef<HTMLHeadingElement>(null);
  const status = useRef(onStatusChange);
  const submitting = useRef(false);
  const request = useRef(0);
  const reconciliationTimer = useRef<number | undefined>(undefined);
  const promotionPolicies = promotionData.schoolId === schoolId ? promotionData.policies : [];
  const promotionStudents = promotionData.schoolId === schoolId ? promotionData.students : [];
  const activeAssignment = (item: PromotionPolicy["versions"][number]["assignments"][number]) => item.isCurrent;

  const get = async <T,>(path: string, mutation = false) => {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      headers: mutation
        ? { "x-csrf-token": decodeURIComponent(csrf() ?? "") }
        : undefined,
    });
    if ([401, 403].includes(response.status)) {
      denied();
      throw new Error();
    }
    if (!response.ok) throw new Error("Không thể tải dữ liệu Finance.");
    return ((await response.json()) as { data: T }).data;
  };
  const load = async () => {
    const token = ++request.current;
    const [nextCatalog, nextRuns, nextCandidates, nextPolicies, nextPromotionStudents, nextReversalRequests] = await Promise.all([
      get<Catalog>(`/api/app/schools/${schoolId}/finance/receivables`),
      get<{ runs: Run[] }>(
        `/api/app/schools/${schoolId}/finance/collection-runs`,
      ),
      get<Candidates>(
        `/api/app/schools/${schoolId}/finance/collection-run-candidates${(run?.schoolYearId ?? open.schoolYearId) ? `?schoolYearId=${run?.schoolYearId ?? open.schoolYearId}` : ""}`,
      ),
      get<{ policies: PromotionPolicy[] }>(`/api/app/schools/${schoolId}/finance/promotion-policies`),
      get<{ students: Candidate[] }>(`/api/app/schools/${schoolId}/finance/promotion-students`),
      get<{ requests: CoverageReversalRequest[] }>(`/api/app/schools/${schoolId}/finance/coverage-reversal-requests`),
    ]);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setCatalog(nextCatalog);
    setRuns(nextRuns.runs);
    setCandidates(nextCandidates);
    setPromotionData({ schoolId, policies: nextPolicies.policies ?? [], students: nextPromotionStudents.students ?? [] });
    setCoverageReversalRequests(nextReversalRequests.requests ?? []);
    if (run) {
      const refreshedRun = nextRuns.runs.find((item) => item.id === run.id);
      setRun(refreshedRun);
      if (refreshedRun && refreshedRun.status !== "DRAFT")
        setSelectedStudentIds(refreshedRun.selectedStudentIds);
    }
  };
  const loadBankAccounts = async () => {
    const next = await get<{ accounts: BankAccount[] }>(`/api/app/schools/${schoolId}/finance/bank-accounts`);
    if (activeSchool.current === schoolId) setBankAccounts(next.accounts);
    return next.accounts;
  };
  const loadCandidates = async (yearId: string) => {
    const token = ++request.current;
    const next = await get<Candidates>(
      `/api/app/schools/${schoolId}/finance/collection-run-candidates${yearId ? `?schoolYearId=${yearId}` : ""}`,
    );
    if (activeSchool.current === schoolId && token === request.current)
      setCandidates(next);
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
        if ((result.outcome as GenerateOutcome | undefined)?.created)
          setGeneratedOutcome(result.outcome as GenerateOutcome);
        if ((result.outcome as Invoice | undefined)?.lines) applyInvoice(result.outcome as Invoice);
        if ((result.outcome as Invoice | undefined)?.receipt) {
          setReceiptConfirmation(false);
          setActualReceipt("");
        }
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
    const patch = (item: Run) => ({ ...item, invoices: (item.invoices ?? []).map((candidate) => candidate.id === next.id ? { ...candidate, total: next.total, status: next.status } : candidate) });
    setRun((current) => current ? patch(current) : current);
    setRuns((current) => current.map(patch));
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    submitting.current = false;
    ++request.current;
    if (reconciliationTimer.current)
      window.clearTimeout(reconciliationTimer.current);
    setCatalog(undefined);
    setPromotionData({ schoolId, policies: [], students: [] });
    setPromotion({ policyId: "", name: "", receivableIds: [], discountType: "PERCENTAGE", discountValue: "", priority: "1", stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "", effectiveTo: "" });
    setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" });
    setCoverage({ studentId: "", versionId: "", billingMonth: "" });
    setEndingAssignment(undefined);
    setCandidates(undefined);
    setRuns([]);
    setRun(undefined);
    setPreview(undefined);
    setGenerateConfirmation(false);
    setGenerateConfirmationMonth("");
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
    setReceiptConfirmation(false);
    setActualReceipt("");
    setCoverageReversal({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" });
    setCoverageReversalPreview(undefined);
    setCoverageReversalRequests([]);
    setCoverageDecision(undefined);
    setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" });
    setEditingLineId(undefined);
    setEditingSource(false);
    setOpen({ schoolYearId: "", billingMonth: "" });
    setSelectedStudentIds([]);
    setTemplate({ receivableId: "", quantity: "" });
    setGroup({ name: "" });
    setReceivable({
      groupId: "",
      code: "",
      displayName: "",
      unitLabel: "",
      defaultUnitPrice: "",
    });
    setLifecycle(undefined);
    setErrors({});
    setMessage("");
    setGenerationProgress(undefined);
    void load().catch(
      (error: Error) =>
        activeSchool.current === schoolId && setMessage(error.message),
    );
    void loadBankAccounts().catch(() => {
      if (activeSchool.current === schoolId) setBankAccounts([]);
    });
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
  const selectionDirty = Boolean(
    run &&
      (selectedStudentIds.length !== run.selectedStudentIds.length ||
        selectedStudentIds.some((id) => !run.selectedStudentIds.includes(id))),
  );
  const dirty = Boolean(
    open.schoolYearId ||
    open.billingMonth ||
    selectionDirty ||
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
    if (receiptConfirmation) receiptDialog.current?.querySelector<HTMLElement>("input")?.focus();
    else receiptTrigger.current?.focus();
  }, [receiptConfirmation]);
  useEffect(() => {
    if (closeConfirmation) closeDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
    else closeTrigger.current?.focus();
  }, [closeConfirmation]);
  useEffect(() => {
    if (coverageDecision) coverageDecisionDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
    else coverageDecisionTrigger.current?.focus();
  }, [coverageDecision]);
  useEffect(() => {
    if (run?.status === "CLOSED" && !closeConfirmation) closedHeading.current?.focus();
  }, [run?.status, closeConfirmation]);
  const command = async (
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body: object,
    nextScope?: typeof scope,
  ) => {
    if (submitting.current || pending) return undefined;
    const token = ++request.current;
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
    setRun(next);
    setSelectedStudentIds(next.selectedStudentIds);
    setPreview(undefined);
    void loadCandidates(next.schoolYearId).catch(() =>
      setMessage("Không thể tải danh sách học sinh."),
    );
  };
  const openRun = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs`,
      "POST",
      open,
    );
    if (outcome) {
      setOpen({ schoolYearId: "", billingMonth: "" });
      chooseRun(outcome as Run);
      await load();
    }
  };
  const saveSelection = async (event: FormEvent) => {
    event.preventDefault();
    if (!run) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/selection`,
      "PUT",
      { studentIds: selectedStudentIds },
    );
    if (outcome) {
      chooseRun(outcome as Run);
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
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
    setPreview(undefined);
  };
  const loadPreview = async () => {
    if (!run) return;
    const runId = run.id;
    const token = ++request.current;
    setMessage("");
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
      if (activeSchool.current === schoolId && token === request.current)
        setMessage("Không thể tạo bản xem trước.");
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
      chooseRun(outcome as Run);
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
      chooseRun((outcome as GenerateOutcome).run);
      await load();
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
      setReceivable({
        groupId: "",
        code: "",
        displayName: "",
        unitLabel: "",
        defaultUnitPrice: "",
      });
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
      setLifecycle(undefined);
      await load();
    }
  };
  const savePromotion = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-policies`, "POST", { ...promotion, effectiveTo: promotion.effectiveTo || null }, "promotion");
    if (outcome) { setPromotion({ policyId: "", name: "", receivableIds: [], discountType: "PERCENTAGE", discountValue: "", priority: "1", stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "", effectiveTo: "" }); await load(); }
  };
  const saveAssignments = async (event: FormEvent) => {
    event.preventDefault(); if (!assignment.versionId) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-policy-versions/${assignment.versionId}/assignments`, "POST", { ...assignment, effectiveTo: assignment.effectiveTo || null }, "promotion");
    if (outcome) { setAssignment({ versionId: "", studentIds: [], effectiveFrom: "", effectiveTo: "", reason: "" }); await load(); }
  };
  const saveCoverage = async (event: FormEvent) => {
    event.preventDefault(); if (!run || !coverage.studentId || !coverage.versionId || !coverage.billingMonth) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/coverage-selection`, "PUT", { selections: [...(run.coverageSelections ?? []).filter((item) => !(item.studentId === coverage.studentId && item.versionId === coverage.versionId && item.billingMonth === coverage.billingMonth)), coverage] }, "promotion");
    if (outcome) { chooseRun(outcome as Run); setCoverage({ studentId: "", versionId: "", billingMonth: "" }); await load(); }
  };
  const endAssignment = async (event: FormEvent) => {
    event.preventDefault(); if (!endingAssignment) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-assignments/${endingAssignment.id}/end`, "POST", { effectiveTo: endingAssignment.effectiveTo, reason: endingAssignment.reason }, "promotion");
    if (outcome) { setEndingAssignment(undefined); await load(); }
  };
  const transitionPromotionVersion = async (versionId: string, action: "activate" | "retire") => {
    const outcome = await command(`/api/app/schools/${schoolId}/finance/promotion-policy-versions/${versionId}/${action}`, "POST", {}, "promotion");
    if (outcome) await load();
  };
  const openInvoice = async (invoiceId: string) => {
    const token = ++request.current;
    try {
      const next = await get<Invoice>(`/api/app/schools/${schoolId}/finance/invoices/${invoiceId}`);
      if (activeSchool.current === schoolId && token === request.current) setInvoice(next);
    } catch (error: any) {
      if (activeSchool.current === schoolId) setMessage(error.message);
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
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/lines${editingLineId ? `/${editingLineId}` : ""}`, editingLineId ? "PUT" : "POST", body, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setEditingLineId(undefined); setEditingSource(false); setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" }); }
  };
  const removeLine = async (lineId: string) => {
    if (!invoice) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/lines/${lineId}`, "DELETE", {}, "receivable");
    if (outcome) applyInvoice(outcome as Invoice);
    setRemoveConfirmation(undefined);
  };
  const issueInvoice = async () => {
    if (!invoice || !issueBankAccountId) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/${invoice.revisesInvoiceId ? "issue-revision" : "issue"}`, "POST", { bankAccountId: issueBankAccountId }, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setIssueConfirmation(false); setIssueConfirmationName(""); setIssueBankAccountId(""); try { await load(); } catch { setMessage("Hóa đơn đã phát hành; chưa thể tải lại dữ liệu mới nhất."); } }
  };
  const prepareRevision = async () => {
    if (!invoice) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/revisions`, "POST", { reason: revisionReason }, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setRevisionConfirmation(false); setRevisionReason(""); setRevisionConfirmationName(""); try { await load(); } catch { setMessage("Bản điều chỉnh đã được chuẩn bị; chưa thể tải lại dữ liệu mới nhất."); } }
  };
  const closeInvoice = async () => {
    if (!invoice) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/invoices/${invoice.id}/receipt`, "POST", { actualAmount: actualReceipt }, "invoice");
    if (outcome) { applyInvoice(outcome as Invoice); setReceiptConfirmation(false); setActualReceipt(""); try { await load(); } catch { setMessage("Đã ghi thực nhận; chưa thể tải lại dữ liệu mới nhất."); } }
  };
  const previewCoverageReversal = async () => {
    if (!coverageReversal.coverageId || !coverageReversal.effectiveOn) return;
    const token = ++request.current;
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/finance/coverage-reversals/preview`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf() ?? "") }, body: JSON.stringify({ coverageId: coverageReversal.coverageId, effectiveOn: coverageReversal.effectiveOn }) });
      if (!response.ok) throw new Error(); const next = ((await response.json()) as { data: CoverageReversalPreview }).data;
       if (activeSchool.current === schoolId && token === request.current) setCoverageReversalPreview(next);
    } catch { setMessage("Không thể tải preview hoàn coverage từ máy chủ."); }
  };
  const postCoverageReversal = async () => {
    if (!coverageReversalPreview) return;
    const outcome = await command(`/api/app/schools/${schoolId}/finance/coverage-reversals`, "POST", { ...coverageReversal, amount: coverageReversal.amount || null }, "invoice");
    if (outcome) { setMessage(coverageReversalPreview.source.reversalMode === "DIRECT" ? "Máy chủ đã ghi nhận hoàn/reverse coverage." : "Yêu cầu hoàn coverage đã được gửi chờ School Admin duyệt."); setCoverageReversal({ coverageId: "", effectiveOn: "", reason: "", amount: "", confirmation: "" }); setCoverageReversalPreview(undefined); await load(); }
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
      setIssueBankAccountId(accounts[0]!.id); setIssueConfirmationName(""); setIssueConfirmation(true);
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
  const trapReceiptFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const items = [...(receiptDialog.current?.querySelectorAll<HTMLElement>("input, button") ?? [])].filter((item) => !item.hasAttribute("disabled"));
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

  return (
    <section aria-labelledby="finance-title">
      <h2 id="finance-title">Finance</h2>
      <p>
        {schoolName} / Eligibility, lifecycle và đơn giá được máy chủ xác nhận.
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      <section aria-labelledby="promotion-title">
        <h3 id="promotion-title">Ưu đãi</h3>
        <p>Thay đổi cấu hình tạo phiên bản mới. Giá trị áp dụng do hệ thống đánh giá ở bước sau.</p>
        <form onSubmit={savePromotion}>
          <label>Chính sách hiện có (để tạo phiên bản mới)<select value={promotion.policyId} onChange={(event) => { const policy = promotionPolicies.find((item) => item.id === event.target.value); setPromotion({ ...promotion, policyId: event.target.value, name: policy?.name ?? "" }); }}><option value="">Chính sách mới</option>{promotionPolicies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Tên chính sách<input value={promotion.name} disabled={Boolean(promotion.policyId)} onChange={(event) => setPromotion({ ...promotion, name: event.target.value })} {...promotionField("name")} /></label>{scope === "promotion" && errors.name && <small id="invoice-promotion-name-error">{errors.name}</small>}
          <fieldset {...promotionField("receivableIds")}><legend>Khoản thu áp dụng</legend>{(catalog?.receivables ?? []).filter((item) => item.available).map((item) => <label key={item.id}><input type="checkbox" checked={promotion.receivableIds.includes(item.id)} onChange={() => setPromotion({ ...promotion, receivableIds: promotion.receivableIds.includes(item.id) ? promotion.receivableIds.filter((id) => id !== item.id) : [...promotion.receivableIds, item.id] })} />{item.displayName}</label>)}</fieldset>{scope === "promotion" && errors.receivableIds && <small id="invoice-promotion-receivableIds-error">{errors.receivableIds}</small>}
          <label>Loại giảm<select value={promotion.discountType} onChange={(event) => setPromotion({ ...promotion, discountType: event.target.value })}><option value="PERCENTAGE">Phần trăm</option><option value="FIXED_VND">Số tiền VND</option></select></label>
          <label>Mức giảm<input inputMode="numeric" value={promotion.discountValue} onChange={(event) => setPromotion({ ...promotion, discountValue: event.target.value })} {...promotionField("discountValue")} /></label>{scope === "promotion" && errors.discountValue && <small id="invoice-promotion-discountValue-error">{errors.discountValue}</small>}
          <label>Hiệu lực từ<input type="date" value={promotion.effectiveFrom} onChange={(event) => setPromotion({ ...promotion, effectiveFrom: event.target.value })} /></label>
          <label>Hiệu lực đến (bao gồm)<input type="date" value={promotion.effectiveTo} onChange={(event) => setPromotion({ ...promotion, effectiveTo: event.target.value })} /></label>
          <label>Ưu tiên<input inputMode="numeric" value={promotion.priority} onChange={(event) => setPromotion({ ...promotion, priority: event.target.value })} /></label>
           <label>Quy tắc kết hợp<select value={promotion.stackingMode} onChange={(event) => setPromotion({ ...promotion, stackingMode: event.target.value })}><option value="STACKABLE">Có thể kết hợp</option><option value="EXCLUSIVE">Độc quyền</option></select></label><label>Cách thực hiện<select value={promotion.fulfillmentMode} onChange={(event) => setPromotion({ ...promotion, fulfillmentMode: event.target.value })}><option value="DISCOUNT">Giảm trên hóa đơn</option><option value="PREPAID_COVERAGE">Coverage nộp trước</option></select></label>
          <button disabled={Boolean(pending)}>Lưu phiên bản ưu đãi</button>
        </form>
        <table><caption>Chính sách ưu đãi theo Trường</caption><thead><tr><th>Chính sách</th><th>Khoản thu</th><th>Mức giảm</th><th>Hiệu lực</th><th>Trạng thái</th><th>Học sinh</th><th>Thao tác</th></tr></thead><tbody>{promotionPolicies.length ? promotionPolicies.flatMap((policy) => (policy.versions ?? []).map((version) => <tr key={version.id}><td>{policy.name} / Phiên bản {version.version}</td><td>{(version.targets ?? []).map((target) => target.receivableName).join(", ")}</td><td>{version.discountType === "PERCENTAGE" ? `${version.discountValue}%` : `${vnd(version.discountValue)} VND`}</td><td>{version.effectiveFrom} - {version.effectiveTo ?? "không xác định"}</td><td>{version.status}</td><td>{(version.assignments ?? []).filter(activeAssignment).length} đang áp dụng</td><td>{version.status === "DRAFT" && <button type="button" disabled={Boolean(pending)} onClick={() => void transitionPromotionVersion(version.id, "activate")}>Kích hoạt phiên bản</button>}{version.status === "ACTIVE" && <button type="button" disabled={Boolean(pending)} onClick={() => void transitionPromotionVersion(version.id, "retire")}>Ngừng phiên bản</button>}</td></tr>)) : <tr><td colSpan={7}>{catalog ? "Chưa có chính sách ưu đãi." : "Đang tải ưu đãi."}</td></tr>}</tbody></table>
        <form onSubmit={saveAssignments}>
          <h4>Gán học sinh</h4><p>Cả nhóm dùng chung thời hạn và lý do; máy chủ chỉ lưu khi toàn bộ danh sách hợp lệ.</p>
          <label>Phiên bản đang áp dụng<select value={assignment.versionId} onChange={(event) => setAssignment({ ...assignment, versionId: event.target.value })}><option value="">Chọn phiên bản</option>{promotionPolicies.flatMap((policy) => (policy.versions ?? []).filter((version) => version.status === "ACTIVE").map((version) => <option key={version.id} value={version.id}>{policy.name} / Phiên bản {version.version}</option>))}</select></label>
          <fieldset><legend>Học sinh</legend>{promotionStudents.map((student) => <label key={student.id}><input type="checkbox" checked={assignment.studentIds.includes(student.id)} onChange={() => setAssignment({ ...assignment, studentIds: assignment.studentIds.includes(student.id) ? assignment.studentIds.filter((id) => id !== student.id) : [...assignment.studentIds, student.id] })} />{student.studentCode} / {student.fullName}</label>)}</fieldset>
          <label>Áp dụng từ<input type="date" value={assignment.effectiveFrom} onChange={(event) => setAssignment({ ...assignment, effectiveFrom: event.target.value })} /></label><label>Áp dụng đến (bao gồm)<input type="date" value={assignment.effectiveTo} onChange={(event) => setAssignment({ ...assignment, effectiveTo: event.target.value })} /></label><label>Lý do<textarea value={assignment.reason} onChange={(event) => setAssignment({ ...assignment, reason: event.target.value })} /></label><button disabled={Boolean(pending)}>Lưu gán học sinh</button>
        </form>
        {promotionPolicies.flatMap((policy) => policy.versions ?? []).flatMap((version) => (version.assignments ?? []).filter(activeAssignment).map((item) => <div key={item.id}><span>{item.studentCode} / {item.studentName}: {item.effectiveFrom}</span><button type="button" disabled={Boolean(pending)} onClick={() => setEndingAssignment({ id: item.id, effectiveTo: "", reason: "" })}>Kết thúc áp dụng</button></div>))}
        {endingAssignment && <form onSubmit={endAssignment}><h4>Kết thúc áp dụng học sinh</h4><label>Ngày kết thúc (bao gồm)<input type="date" value={endingAssignment.effectiveTo} onChange={(event) => setEndingAssignment({ ...endingAssignment, effectiveTo: event.target.value })} /></label><label>Lý do<textarea value={endingAssignment.reason} onChange={(event) => setEndingAssignment({ ...endingAssignment, reason: event.target.value })} /></label><button disabled={Boolean(pending)}>Xác nhận kết thúc</button><button type="button" onClick={() => setEndingAssignment(undefined)}>Hủy</button></form>}
      </section>
      {coverageReversalRequests.length > 0 && <section aria-labelledby="coverage-approval-title"><h3 id="coverage-approval-title">Yêu cầu hoàn coverage chờ duyệt</h3><table><caption>Chỉ School Admin khác người yêu cầu được quyết định</caption><thead><tr><th>Học sinh</th><th>Ngày hiệu lực</th><th>Số tiền</th><th>Lý do</th><th>Thao tác</th></tr></thead><tbody>{coverageReversalRequests.map((item) => <tr key={item.id}><td>{item.studentName}</td><td>{item.effectiveOn}</td><td style={{ textAlign: "right" }}>{vnd(item.amount)}</td><td>{item.reason}</td><td>{item.canDecide ? <><button ref={coverageDecisionTrigger} type="button" disabled={Boolean(pending)} onClick={() => setCoverageDecision({ request: item, decision: "APPROVE", reason: "" })}>Duyệt</button><button type="button" disabled={Boolean(pending)} onClick={() => setCoverageDecision({ request: item, decision: "REFUSE", reason: "" })}>Từ chối</button></> : "Không có quyền quyết định"}</td></tr>)}</tbody></table></section>}
      <section>
        <h3>Nhóm khoản thu</h3>
        <form onSubmit={saveGroup}>
          <label>
            Tên nhóm
            <input
              value={group.name}
              onChange={(event) => setGroup({ name: event.target.value })}
              {...field("group", "name")}
            />
          </label>
          {scope === "group" && errors.name && (
            <small id="group-name-error">{errors.name}</small>
          )}
          <button disabled={Boolean(pending)}>Thêm nhóm</button>
        </form>
        <table>
          <caption>Nhóm khoản thu theo trường</caption>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {catalog?.groups.length ? (
              catalog.groups.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {item.status === "ACTIVE"
                      ? "Đang áp dụng"
                      : "Ngừng áp dụng"}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() =>
                        setLifecycle({
                          kind: "receivable-groups",
                          id: item.id,
                          name: item.name,
                          next:
                            item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          reason: "",
                        })
                      }
                    >
                      {item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>
                  {catalog
                    ? "Chưa có nhóm khoản thu."
                    : "Đang tải nhóm khoản thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Khoản thu</h3>
        <form onSubmit={saveReceivable}>
          <label>
            Nhóm
            <select
              value={receivable.groupId}
              onChange={(event) =>
                setReceivable({ ...receivable, groupId: event.target.value })
              }
              {...field("receivable", "groupId")}
            >
              <option value="">Chọn nhóm</option>
              {(catalog?.groups ?? [])
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Mã khoản thu
            <input
              value={receivable.code}
              onChange={(event) =>
                setReceivable({ ...receivable, code: event.target.value })
              }
            />
          </label>
          <label>
            Tên khoản thu
            <input
              value={receivable.displayName}
              onChange={(event) =>
                setReceivable({
                  ...receivable,
                  displayName: event.target.value,
                })
              }
              {...field("receivable", "displayName")}
            />
          </label>
          <label>
            Đơn vị
            <input
              value={receivable.unitLabel}
              onChange={(event) =>
                setReceivable({ ...receivable, unitLabel: event.target.value })
              }
              {...field("receivable", "unitLabel")}
            />
          </label>
          <label>
            Đơn giá mặc định (VND)
            <input
              inputMode="numeric"
              value={receivable.defaultUnitPrice}
              onChange={(event) =>
                setReceivable({
                  ...receivable,
                  defaultUnitPrice: event.target.value,
                })
              }
              {...field("receivable", "defaultUnitPrice")}
            />
          </label>
          {scope === "receivable" &&
            Object.entries(errors).map(([name, error]) => (
              <small key={name} id={`receivable-${name}-error`}>
                {error}
              </small>
            ))}
          <button disabled={Boolean(pending)}>Thêm khoản thu</button>
        </form>
        <table>
          <caption>Khoản thu theo trường</caption>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Đơn vị</th>
              <th>Đơn giá VND</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {catalog?.receivables.length ? (
              catalog.receivables.map((item) => (
                <tr key={item.id}>
                  <td>{item.code ?? ""}</td>
                  <td>{item.displayName}</td>
                  <td>{item.unitLabel}</td>
                  <td>{item.defaultUnitPrice}</td>
                  <td>{item.available ? "Đang áp dụng" : "Ngừng áp dụng"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() =>
                        setLifecycle({
                          kind: "receivables",
                          id: item.id,
                          name: item.displayName,
                          next:
                            item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          reason: "",
                        })
                      }
                    >
                      {item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  {catalog ? "Chưa có khoản thu." : "Đang tải khoản thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Mở đợt thu tháng</h3>
        <form onSubmit={openRun}>
          <label>
            Năm học
            <select
              value={open.schoolYearId}
              onChange={(event) => {
                const schoolYearId = event.target.value;
                setOpen({ ...open, schoolYearId });
                setPreview(undefined);
                void loadCandidates(schoolYearId).catch(() =>
                  setMessage("Không thể tải danh sách học sinh."),
                );
              }}
              aria-invalid={Boolean(errors.schoolYearId)}
            >
              <option value="">Chọn năm học</option>
              {candidates?.schoolYears?.map((year) => (
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
          </label>
          <label>
            Tháng thu
            <input
              type="month"
              value={open.billingMonth}
              onChange={(event) =>
                setOpen({ ...open, billingMonth: event.target.value })
              }
              aria-invalid={Boolean(errors.billingMonth)}
            />
          </label>
          <button disabled={Boolean(pending)}>Mở hoặc vào đợt thu</button>
        </form>
        <table>
          <caption>Đợt thu theo trường</caption>
          <thead>
            <tr>
              <th>Tháng</th>
              <th>Năm học</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {runs.length ? (
              runs.map((item) => (
                <tr key={item.id}>
                  <td>{item.billingMonth}</td>
                  <td>
                    {candidates?.schoolYears?.find(
                      (year) => year.id === item.schoolYearId,
                    )?.name ?? item.schoolYearId}
                  </td>
                  <td>{item.status}</td>
                  <td>
                    <button type="button" onClick={() => chooseRun(item)}>
                      Mở chi tiết
                    </button>
                  </td>
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
      </section>
      {run && (
        <section aria-labelledby="run-detail-title">
          <h3 id="run-detail-title">
            Đợt thu {run.billingMonth} / {run.status}
          </h3>
          <p>
            Năm học:{" "}
            {candidates?.schoolYears?.find(
              (year) => year.id === run.schoolYearId,
            )?.name ?? run.schoolYearId}
            . Đã chọn {selectedStudentIds.length} học sinh.
          </p>
           {run.status === "DRAFT" && (
            <>
              <section aria-labelledby="run-template-title">
                <h4 id="run-template-title">Khoản thu trong đợt</h4>
                <p>Đơn giá và thành tiền do máy chủ xác nhận. Dòng được hiển thị theo số tiền giảm dần.</p>
                <table><caption>Khoản thu mẫu chung</caption><thead><tr><th>Khoản thu</th><th>Số lượng</th><th>Đơn giá VND</th><th>Số tiền VND</th><th>Thao tác</th></tr></thead><tbody>{(run.templateLines ?? []).map((item) => <tr key={item.id}><td>{item.receivableName}</td><td>{item.quantity} {item.unitLabel}</td><td style={{ textAlign: "right" }}>{vnd(item.defaultUnitPrice)}</td><td style={{ textAlign: "right" }}>{vnd(item.amount)}</td><td><button type="button" disabled={Boolean(pending)} onClick={() => void removeTemplate(item.id)}>Bỏ</button></td></tr>)}</tbody></table>
                <form onSubmit={saveTemplate}><label>Khoản thu<select value={template.receivableId} onChange={(event) => setTemplate({ ...template, receivableId: event.target.value })}><option value="">Chọn khoản thu</option>{(catalog?.receivables ?? []).filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Số lượng<input inputMode="numeric" value={template.quantity} onChange={(event) => setTemplate({ ...template, quantity: event.target.value })} /></label><button disabled={Boolean(pending)}>Lưu khoản thu mẫu</button></form>
              </section>
              <form onSubmit={saveSelection}>
                <table>
                  <caption>
                    Chọn học sinh thuộc năm học từ dữ liệu máy chủ
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Chọn</th>
                      <th scope="col">Mã học sinh</th>
                      <th scope="col">Họ tên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates?.students?.length ? (
                      candidates.students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${student.studentCode} ${student.fullName}`}
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                            />
                          </td>
                          <td>{student.studentCode}</td>
                          <td>{student.fullName}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          Không có học sinh trong năm học này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <button disabled={Boolean(pending)}>
                  Lưu danh sách đã chọn
                </button>
              </form>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void loadPreview()}
              >
                Xem trước từ máy chủ
              </button>
              <form onSubmit={saveCoverage}>
                <h4>Coverage nộp trước</h4><p>Chỉ chọn phiên bản coverage và kỳ tương lai do máy chủ xác nhận. Fact chỉ được phát hành sau khi hóa đơn đóng đủ.</p>
                <label>Học sinh<select value={coverage.studentId} onChange={(event) => setCoverage({ ...coverage, studentId: event.target.value })}><option value="">Chọn học sinh</option>{(candidates?.students ?? []).map((student) => <option key={student.id} value={student.id}>{student.studentCode} / {student.fullName}</option>)}</select></label>
                <label>Phiên bản coverage<select value={coverage.versionId} onChange={(event) => setCoverage({ ...coverage, versionId: event.target.value })}><option value="">Chọn phiên bản</option>{promotionPolicies.flatMap((policy) => policy.versions.filter((version) => version.status === "ACTIVE" && version.fulfillmentMode === "PREPAID_COVERAGE").map((version) => <option key={version.id} value={version.id}>{policy.name} / Phiên bản {version.version}</option>))}</select></label>
                <label>Kỳ được coverage<input type="month" value={coverage.billingMonth} onChange={(event) => setCoverage({ ...coverage, billingMonth: event.target.value })} /></label>
                <button disabled={Boolean(pending)}>Lưu lựa chọn coverage</button>
              </form>
              {(run.coverageSelections ?? []).length > 0 && <p>Coverage đã chọn: {(run.coverageSelections ?? []).map((item) => `${item.billingMonth}`).join(", ")}. Máy chủ sẽ snapshot các fact trước khi hóa đơn nháp được hiển thị.</p>}
            </>
          )}
          {preview && (
            <section aria-labelledby="preview-title">
              <h4 id="preview-title">Xem trước authoritative</h4>
               <table>
                <caption>Học sinh đủ điều kiện</caption>
                <thead>
                  <tr>
                    <th>Học sinh</th><th>Lớp</th><th>Khoản thu</th><th>Gross VND</th><th>Ưu đãi VND</th><th>Net VND</th><th>Lý do ưu đãi</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.eligible.length ? (
                    preview.eligible.flatMap((item) => (item.lines ?? []).map((line) => (
                      <tr key={`${item.studentId}-${line.receivableId}`}><td>{item.studentCode} / {item.fullName}</td><td>{item.className}</td><td>{line.receivableName}</td><td style={{ textAlign: "right" }}>{vnd(line.grossAmount)}</td><td style={{ textAlign: "right" }}>{vnd(line.discountAmount)}</td><td style={{ textAlign: "right" }}>{vnd(line.netAmount)}</td><td>{line.promotionEvaluation.applications.map((application) => application.assignmentReason).join(", ") || "Không áp dụng"}</td></tr>
                    )))
                  ) : (
                    <tr>
                      <td colSpan={7}>Không có học sinh đủ điều kiện.</td>
                    </tr>
                  )}
                </tbody>
               </table>
               {(preview.futureCoverageFacts ?? []).length > 0 && <table><caption>Fact coverage tương lai từ máy chủ</caption><thead><tr><th>Kỳ</th><th>Khoản thu</th><th>Giá gốc VND</th><th>Giảm VND</th><th>Khoảng dịch vụ</th><th>Lịch</th></tr></thead><tbody>{preview.futureCoverageFacts?.map((fact) => <tr key={`${fact.studentId}-${fact.versionId}-${fact.receivableId}-${fact.billingMonth}`}><td>{fact.billingMonth}</td><td>{fact.receivableName}</td><td style={{ textAlign: "right" }}>{vnd(fact.originalPrice)}</td><td style={{ textAlign: "right" }}>{vnd(fact.reduction)}</td><td>{fact.serviceStart} đến {fact.serviceEnd}</td><td>{fact.calendarEffectiveFrom} / {fact.timezone}</td></tr>)}</tbody></table>}
              <table>
                <caption>Học sinh bị bỏ qua</caption>
                <thead>
                  <tr>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.skips.length ? (
                    preview.skips.map((item, index) => (
                      <tr key={item.studentId}>
                        <td>
                          {index + 1}. {item.studentCode && item.fullName
                            ? `${item.studentCode} / ${item.fullName}: `
                            : ""}
                          {skipReason(item.reason)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>Không có học sinh bị bỏ qua.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void ready()}
              >
                Xác nhận preview và chuyển READY
              </button>
            </section>
          )}
        </section>
      )}
      {run?.status === "READY" && (
        <button
          type="button"
          disabled={Boolean(pending)}
                  onClick={() => {
                    setGenerateConfirmationMonth("");
                    setGenerateConfirmation(true);
                  }}
        >
          Tạo hóa đơn nháp
        </button>
      )}
      {generationProgress && (
        <section aria-live="polite" aria-label="Tiến độ tạo hóa đơn từ máy chủ">
          <h3>Tiến độ tạo hóa đơn từ máy chủ</h3>
          <p>
            {generationProgress.status}: đã xử lý {generationProgress.processed}/{generationProgress.total};
            đủ điều kiện {generationProgress.eligible}; bỏ qua {generationProgress.skipped}.
          </p>
          {generationProgress.lastError && <p role="alert">{generationProgress.lastError.message ?? "Máy chủ không thể tạo hóa đơn."}</p>}
        </section>
      )}
      {run?.status === "GENERATED" && (
        <section aria-labelledby="generated-student-addition-title">
          <h3 id="generated-student-addition-title">Thêm học sinh vào đợt đã tạo</h3>
           <p>Máy chủ sẽ tự xác nhận điều kiện roster và dùng snapshot khoản thu đã khóa của đợt.</p>
          <table>
            <caption>Học sinh có thể yêu cầu thêm</caption>
            <tbody>
              {(candidates?.students ?? []).map((student) => (
                <tr key={student.id}>
                  <td>{student.studentCode} / {student.fullName}</td>
                  <td><button type="button" disabled={Boolean(pending)} onClick={() => { setAdditionConfirmation(student); setAdditionConfirmationName(""); }}>Yêu cầu thêm</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <caption>Hóa đơn hiện có trong đợt thu</caption>
            <thead><tr><th>Học sinh</th><th>Lớp</th><th>Trạng thái</th><th>Tổng VND</th><th>Thao tác</th></tr></thead>
            <tbody>{(run.invoices ?? []).map((item) => <tr key={item.id}><td>{item.studentCode} / {item.studentName}</td><td>{item.className}</td><td>{item.status}</td><td style={{ textAlign: "right" }}>{vnd(item.total)}</td><td><button type="button" onClick={() => void openInvoice(item.id)}>Rà soát hóa đơn</button></td></tr>)}</tbody>
          </table>
           {run.invoices?.some((invoice) => invoice.status === "DRAFT" && invoice.total !== "0") ? <p>Chưa thể đóng: còn hóa đơn nháp cần phát hành.</p> : null}
            <button ref={closeTrigger} type="button" disabled={Boolean(pending) || Boolean(run.invoices?.some((invoice) => !["CLOSED", "CANCELLED"].includes(invoice.status) && !(invoice.status === "DRAFT" && invoice.total === "0")))} onClick={() => { setCloseReason(""); setCloseConfirmationMonth(""); setCloseConfirmation(true); }}>Đóng đợt thu</button>
        </section>
      )}
      {run?.status === "CLOSED" && (
        <section aria-label="Đợt thu đã đóng">
          <h3 ref={closedHeading} tabIndex={-1}>Đợt thu đã đóng</h3>
          <p>Máy chủ đã khóa đợt thu này. Không thể thêm học sinh hoặc tạo, sửa hóa đơn trong đợt thu đã đóng.</p>
          <table>
            <caption>Hóa đơn đã khóa theo đợt thu</caption>
            <thead><tr><th>Học sinh</th><th>Lớp</th><th>Trạng thái</th><th>Tổng VND</th><th>Chi tiết</th></tr></thead>
            <tbody>{(run.invoices ?? []).map((item) => <tr key={item.id}><td>{item.studentCode} / {item.studentName}</td><td>{item.className}</td><td>{item.status}</td><td style={{ textAlign: "right" }}>{vnd(item.total)}</td><td><button type="button" onClick={() => void openInvoice(item.id)}>Xem hóa đơn</button></td></tr>)}</tbody>
          </table>
        </section>
      )}
      {generatedOutcome && (
        <section aria-labelledby="generated-outcome-title">
          <h3 id="generated-outcome-title">Kết quả tạo hóa đơn từ máy chủ</h3>
          <p>
            Đã tạo {generatedOutcome.created.length} hóa đơn nháp; bỏ qua{" "}
            {generatedOutcome.skipped.length} học sinh.
          </p>
          <table>
            <caption>Hóa đơn nháp đã tạo</caption>
            <tbody>
              {generatedOutcome.created.map((item) => (
                <tr key={item.studentId}>
                  <td>
                    {item.studentCode} / {item.fullName}
                  </td>
                  <td>{item.className}</td>
                  <td>{item.invoiceId && <button type="button" onClick={() => void openInvoice(item.invoiceId!)}>Rà soát hóa đơn</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <caption>Học sinh bị bỏ qua khi tạo</caption>
            <tbody>
              {generatedOutcome.skipped.map((item) => (
                <tr key={item.studentId}>
                    <td>
                      {item.studentCode && item.fullName
                        ? `${item.studentCode} / ${item.fullName}: `
                        : ""}
                      {skipReason(item.reason)}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {invoice && (
        <section aria-labelledby="invoice-review-title">
          <h3 id="invoice-review-title">Rà soát hóa đơn {invoice.student.code} / {invoice.student.name}</h3>
          <p>Đợt {invoice.billingMonth}, lớp {invoice.student.className}, trạng thái {invoice.status}.</p>
           {invoice.status === "DRAFT" && <button ref={issueTrigger} type="button" disabled={Boolean(pending) || !invoice.lines.length || invoice.total === "0"} onClick={() => void openIssueConfirmation()}>{invoice.revisesInvoiceId ? "Phát hành bản thay thế" : "Phát hành hóa đơn"}</button>}
               {invoice.status === "ISSUED" && <>{!invoice.revisesInvoiceId && <button ref={revisionTrigger} type="button" disabled={Boolean(pending)} onClick={() => { setRevisionReason(""); setRevisionConfirmationName(""); setRevisionConfirmation(true); }}>Chuẩn bị bản điều chỉnh</button>}<button ref={receiptTrigger} type="button" disabled={Boolean(pending)} onClick={() => { setActualReceipt(invoice.sourceOutstanding ?? invoice.issue?.obligationTotal ?? invoice.total); setReceiptConfirmation(true); }}>Ghi thực nhận và đóng hóa đơn</button></>}
           {(invoice.revisesInvoiceId || invoice.replacementInvoiceId) && <p>Lineage: {invoice.revisesInvoiceId ? `thay thế ${invoice.revisesInvoiceId}` : `được thay thế bởi ${invoice.replacementInvoiceId}`}. {invoice.revisionReason ? `Lý do: ${invoice.revisionReason}.` : ""}</p>}
                {(["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status)) && <section aria-label="Snapshot phát hành"><h4>Hướng dẫn thanh toán đã phát hành</h4><p>Tổng nghĩa vụ: {vnd(invoice.issue?.obligationTotal ?? invoice.total)} VND. Hạn thanh toán: {invoice.issue?.dueOn}.</p><p>{invoice.issue?.bankAccount.receivingBank} / {invoice.issue?.bankAccount.accountNumber} / {invoice.issue?.bankAccount.accountHolderName}</p><p>Nội dung chuyển khoản: {invoice.issue?.transferContent}</p>{invoice.receipt ? <p>Thực nhận: {vnd(invoice.receipt.actualAmount)} VND. Kết quả máy chủ: {invoice.receipt.outcome === "EXACT" ? "Đủ" : invoice.receipt.outcome === "SHORTFALL" ? "Thu thiếu" : "Thu thừa"}. Chênh lệch: {vnd(invoice.receipt.difference?.signedAmount ?? "0")} VND.</p> : invoice.settlementTransfer ? <p>Đã settled qua Receipt nguồn chuyển tiếp: {vnd(invoice.settlementTransfer.amount)} VND, ghi nhận {invoice.settlementTransfer.postedAt}, Invoice nguồn {invoice.settlementTransfer.sourceInvoiceId}, Receipt nguồn {invoice.settlementTransfer.sourceReceiptId}.</p> : <p>{invoice.status === "CANCELLED" ? "Hóa đơn đã hủy và chỉ đọc." : "Chưa có trạng thái thanh toán trong phạm vi này."}</p>}{(invoice.carries ?? []).map((carry) => <p key={`${carry.sourceDifferenceId}-${carry.type}`}>{carry.type === "SHORTFALL_CARRY" ? "Khoản thu thiếu chuyển sang" : "Khoản thu thừa khấu trừ"}: {vnd(carry.amount)} VND. Phần còn lại của chênh lệch chỉ được máy chủ chuyển vào đợt monthly kế tiếp đủ điều kiện.</p>)}</section>}
               {(invoice.sourceDebtTransfers ?? []).length > 0 && <section aria-label="Công nợ nguồn đã chuyển"><h4>Công nợ đã chuyển</h4><p>Công nợ nguồn còn lại do máy chủ xác nhận: {vnd(invoice.sourceOutstanding ?? "0")} VND.</p>{invoice.sourceDebtTransfers?.map((transfer) => <p key={`${transfer.targetInvoiceId}-${transfer.postedAt}`}>Đã chuyển sang Invoice {transfer.targetInvoiceId}: {vnd(transfer.amount)} VND. Lý do: {transfer.reason}. Ghi nhận {transfer.postedAt}.</p>)}</section>}
               {(invoice.priorDebtTransfers ?? []).length > 0 && <section aria-label="Nguồn công nợ kỳ trước"><h4>Công nợ kỳ trước</h4>{invoice.priorDebtTransfers?.map((transfer) => <p key={`${transfer.sourceInvoiceId}-${transfer.postedAt}`}>Invoice nguồn {transfer.sourceInvoiceId}: {vnd(transfer.amount)} VND. Lý do: {transfer.reason}. Ghi nhận {transfer.postedAt}.</p>)}</section>}
              {(invoice.coverageFacts ?? []).length > 0 && <section aria-label="Coverage snapshot"><h4>Coverage nộp trước</h4>{invoice.coverageFacts?.map((fact) => <p key={`${fact.receivableId}-${fact.billingMonth}`}>Kỳ {fact.billingMonth}: giá gốc {vnd(fact.originalPrice)} VND, giảm {vnd(fact.reduction)} VND, khoảng dịch vụ {fact.serviceStart} đến {fact.serviceEnd}, lịch {fact.calendarEffectiveFrom} / {fact.timezone}. {fact.issuedAt ? `Đã phát hành ${fact.issuedAt}.` : "Chờ hóa đơn đóng đúng số tiền."}</p>)}</section>}
              {(invoice.coverageFacts ?? []).some((fact) => fact.issuedAt && fact.coverageId) && <section aria-label="Hoàn coverage"><h4>Hoàn/reverse coverage</h4><p>Chọn coverage đã phát hành; ngày vận hành, số tiền floor và giới hạn đều do máy chủ trả về.</p><label>Coverage fact<select value={coverageReversal.coverageId} onChange={(event) => { setCoverageReversal({ ...coverageReversal, coverageId: event.target.value }); setCoverageReversalPreview(undefined); }}><option value="">Chọn coverage</option>{invoice.coverageFacts?.filter((fact) => fact.issuedAt && fact.coverageId).map((fact) => <option key={fact.coverageId} value={fact.coverageId!}>{fact.billingMonth} / {fact.receivableId}</option>)}</select></label><label>Ngày hiệu lực<input type="date" value={coverageReversal.effectiveOn} onChange={(event) => setCoverageReversal({ ...coverageReversal, effectiveOn: event.target.value })} /></label><button type="button" onClick={() => void previewCoverageReversal()}>Xem preview hoàn từ máy chủ</button>{coverageReversalPreview && <div><p>Snapshot: {coverageReversalPreview.remainingDays}/{coverageReversalPreview.denominator} ngày, tính floor {vnd(coverageReversalPreview.calculatedAmount)} VND, còn {vnd(coverageReversalPreview.availableAmount)} VND.</p><p>{coverageReversalPreview.source.reversalMode === "DIRECT" ? "Direct cần xác nhận tên học sinh." : "Workflow này sẽ gửi yêu cầu chờ School Admin khác duyệt."}</p><label>Số tiền override (VND)<input inputMode="numeric" value={coverageReversal.amount} onChange={(event) => setCoverageReversal({ ...coverageReversal, amount: event.target.value })} /></label><label>Lý do<textarea value={coverageReversal.reason} onChange={(event) => setCoverageReversal({ ...coverageReversal, reason: event.target.value })} /></label>{coverageReversalPreview.source.reversalMode === "DIRECT" && <label>Nhập tên học sinh {coverageReversalPreview.source.studentName} để xác nhận direct<input value={coverageReversal.confirmation} onChange={(event) => setCoverageReversal({ ...coverageReversal, confirmation: event.target.value })} /></label>}<button type="button" disabled={Boolean(pending) || !coverageReversal.reason || (coverageReversalPreview.source.reversalMode === "DIRECT" && coverageReversal.confirmation !== coverageReversalPreview.source.studentName)} onClick={() => void postCoverageReversal()}>{coverageReversalPreview.source.reversalMode === "DIRECT" ? "Xác nhận hoàn/reverse coverage" : "Gửi yêu cầu duyệt hoàn coverage"}</button></div>}</section>}
           <table><caption>Dòng hóa đơn do máy chủ tính</caption><thead><tr><th>Khoản thu</th><th>Số lượng</th><th>Đơn giá VND</th><th>Gross VND</th><th>Ưu đãi VND</th><th>Net VND</th><th>Lý do ưu đãi</th><th>Thao tác</th></tr></thead><tbody>{invoice.lines.map((item) => <tr key={item.id}><td>{item.receivableName}{item.source && <small> Nguồn: {item.source.serviceDate ?? ""} {item.source.attendanceState ?? ""} {item.source.pickedUpAt ?? ""} {item.source.lateCareMinutes ?? ""}; {item.sourceReason}; ghi lúc {item.sourceRecordedAt ?? ""}; actor {item.sourceAudit?.actorIdentityId ?? ""}; membership {item.sourceAudit?.membershipId ?? ""}; provenance {JSON.stringify(item.sourceProvenance)}</small>}</td><td>{item.quantity} {item.unitLabel}</td><td style={{ textAlign: "right" }}>{vnd(item.unitPrice)}</td><td style={{ textAlign: "right" }}>{vnd(item.grossAmount ?? item.amount)}</td><td style={{ textAlign: "right" }}>{vnd(item.discountAmount ?? "0")}</td><td style={{ textAlign: "right" }}>{vnd(item.netAmount ?? item.amount)}</td><td>{(invoice.status === "DRAFT" ? item.promotionEvaluation?.applications : item.promotionApplicationSnapshot)?.map((application) => application.assignmentReason).join(", ") || "Không áp dụng"}</td><td>{invoice.status === "DRAFT" && item.receivableId !== null && <><button type="button" disabled={Boolean(pending)} onClick={() => { setEditingLineId(item.id); setEditingSource(Boolean(item.source)); setLine({ receivableId: item.receivableId ?? "", quantity: item.quantity, unitPrice: item.overrideReason ? item.unitPrice : "", overrideReason: item.overrideReason ?? "", sourceReason: item.sourceReason ?? "", serviceDate: item.source?.serviceDate ?? "", attendanceState: item.source?.attendanceState ?? "", pickedUpAt: item.source?.pickedUpAt ?? "", lateCareMinutes: item.source?.lateCareMinutes?.toString() ?? "" }); }}>Sửa</button><button ref={removeTrigger} type="button" disabled={Boolean(pending)} onClick={() => setRemoveConfirmation({ id: item.id, name: item.receivableName })}>Xóa</button></>}</td></tr>)}<tr><th colSpan={5}>Tổng cần thu</th><th style={{ textAlign: "right" }}>{vnd(invoice.total)}</th><td colSpan={2} /></tr></tbody></table>
          {invoice.status === "DRAFT" ? <form onSubmit={saveLine}><h4>{editingLineId ? "Sửa dòng" : "Thêm dòng"}</h4><label>Khoản thu<select disabled={Boolean(editingLineId)} value={line.receivableId} onChange={(event) => setLine({ ...line, receivableId: event.target.value })} {...invoiceField("receivableId")}><option value="">Chọn khoản thu</option>{(catalog?.receivables ?? []).filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>{scope === "invoice" && errors.receivableId && <small id="invoice-invoice-receivableId-error">{errors.receivableId}</small>}<label>Số lượng<input inputMode="numeric" value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} {...invoiceField("quantity")} /></label>{scope === "invoice" && errors.quantity && <small id="invoice-invoice-quantity-error">{errors.quantity}</small>}<label>Đơn giá override VND (không bắt buộc)<input inputMode="numeric" value={line.unitPrice} onChange={(event) => setLine({ ...line, unitPrice: event.target.value })} {...invoiceField("unitPrice")} /></label>{scope === "invoice" && errors.unitPrice && <small id="invoice-invoice-unitPrice-error">{errors.unitPrice}</small>}<label>Lý do override<input value={line.overrideReason} onChange={(event) => setLine({ ...line, overrideReason: event.target.value })} {...invoiceField("overrideReason")} /></label>{scope === "invoice" && errors.overrideReason && <small id="invoice-invoice-overrideReason-error">{errors.overrideReason}</small>}<fieldset><legend>Nguồn giải thích thủ công</legend><label>Ngày dịch vụ<input type="date" value={line.serviceDate} onChange={(event) => setLine({ ...line, serviceDate: event.target.value })} /></label><label>Điểm danh<select value={line.attendanceState} onChange={(event) => setLine({ ...line, attendanceState: event.target.value })}><option value="">Không có</option><option value="PRESENT">Có mặt</option><option value="ABSENT">Vắng mặt</option></select></label><label>Giờ đón (HH:MM)<input value={line.pickedUpAt} onChange={(event) => setLine({ ...line, pickedUpAt: event.target.value })} /></label><label>Số phút trông muộn<input inputMode="numeric" value={line.lateCareMinutes} onChange={(event) => setLine({ ...line, lateCareMinutes: event.target.value })} /></label><label>Lý do nguồn giải thích<input value={line.sourceReason} onChange={(event) => setLine({ ...line, sourceReason: event.target.value })} /></label></fieldset><button disabled={Boolean(pending)}>{editingLineId ? "Lưu dòng" : "Thêm dòng"}</button>{editingLineId && <button type="button" onClick={() => { setEditingLineId(undefined); setEditingSource(false); setLine({ receivableId: "", quantity: "", unitPrice: "", overrideReason: "", sourceReason: "", serviceDate: "", attendanceState: "", pickedUpAt: "", lateCareMinutes: "" }); }}>Hủy sửa</button>}</form> : <p>Hóa đơn {invoice.status} chỉ đọc; dòng hóa đơn không thể thay đổi.</p>}
        </section>
      )}
      {removeConfirmation && <div ref={removeDialog} role="dialog" aria-modal="true" aria-labelledby="finance-remove-line-title" onKeyDown={trapRemoveFocus}><h3 id="finance-remove-line-title">Xóa dòng {removeConfirmation.name}</h3><p>Dòng này sẽ không còn áp dụng cho hóa đơn nháp.</p><button type="button" disabled={Boolean(pending)} onClick={() => void removeLine(removeConfirmation.id)}>Xác nhận xóa dòng</button><button type="button" disabled={Boolean(pending)} onClick={() => setRemoveConfirmation(undefined)}>Hủy</button></div>}
       {issueConfirmation && invoice && <div ref={issueDialog} role="dialog" aria-modal="true" aria-labelledby="finance-issue-title" onKeyDown={trapIssueFocus}><h3 id="finance-issue-title">{invoice.revisesInvoiceId ? "Phát hành bản thay thế" : "Phát hành hóa đơn"} cho {invoice.student.name}</h3><p>Chỉ snapshot tài khoản đang hoạt động từ máy chủ được dùng. Không thể chỉnh sửa sau phát hành.</p><label>Tài khoản nhận<select value={issueBankAccountId} onChange={(event) => setIssueBankAccountId(event.target.value)}><option value="">Chọn tài khoản</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.receivingBank} / {account.accountNumber} / {account.accountHolderName}</option>)}</select></label><label>Nhập chính xác tên học sinh {invoice.student.name} để xác nhận<input value={issueConfirmationName} onChange={(event) => setIssueConfirmationName(event.target.value)} /></label><button type="button" disabled={Boolean(pending) || !issueBankAccountId || issueConfirmationName !== invoice.student.name} onClick={() => void issueInvoice()}>Xác nhận phát hành</button><button type="button" disabled={Boolean(pending)} onClick={() => { setIssueConfirmation(false); setIssueConfirmationName(""); setIssueBankAccountId(""); }}>Hủy</button></div>}
       {revisionConfirmation && invoice && <div ref={revisionDialog} role="dialog" aria-modal="true" aria-labelledby="finance-revision-title" onKeyDown={trapRevisionFocus}><h3 id="finance-revision-title">Chuẩn bị bản điều chỉnh cho {invoice.student.name}</h3><p>Hóa đơn đã phát hành vẫn giữ nguyên cho đến khi bản thay thế được phát hành.</p><label>Lý do điều chỉnh<textarea value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} /></label><label>Nhập chính xác tên học sinh {invoice.student.name} để xác nhận<input value={revisionConfirmationName} onChange={(event) => setRevisionConfirmationName(event.target.value)} /></label><button type="button" disabled={Boolean(pending) || !revisionReason.trim() || revisionConfirmationName !== invoice.student.name} onClick={() => void prepareRevision()}>Xác nhận chuẩn bị bản điều chỉnh</button><button type="button" disabled={Boolean(pending)} onClick={() => setRevisionConfirmation(false)}>Hủy</button></div>}
        {receiptConfirmation && invoice && <div ref={receiptDialog} role="dialog" aria-modal="true" aria-labelledby="finance-receipt-title" onKeyDown={trapReceiptFocus}><h3 id="finance-receipt-title">Ghi thực nhận cho {invoice.student.name}</h3><p>{invoice.sourceOutstanding != null ? `Công nợ nguồn còn lại do máy chủ xác nhận: ${vnd(invoice.sourceOutstanding)} VND.` : `Nghĩa vụ đã phát hành: ${vnd(invoice.issue?.obligationTotal ?? invoice.total)} VND.`} {(invoice.coverageFacts ?? []).length ? "Hóa đơn này có coverage: chỉ số tiền đúng bằng nghĩa vụ mới có thể đóng và phát hành coverage." : "Kết quả, chênh lệch và phần còn lại chuyển kỳ do máy chủ xác định."}</p><label>Số thực nhận (VND)<input inputMode="numeric" value={actualReceipt} onChange={(event) => setActualReceipt(event.target.value)} {...invoiceField("actualAmount")} /></label>{scope === "invoice" && errors.actualAmount && <small id="invoice-invoice-actualAmount-error" role="alert">{errors.actualAmount}</small>}<button type="button" disabled={Boolean(pending) || !actualReceipt} onClick={() => void closeInvoice()}>Xác nhận ghi thực nhận</button><button type="button" disabled={Boolean(pending)} onClick={() => { setReceiptConfirmation(false); setActualReceipt(""); }}>Hủy</button></div>}
         {coverageDecision && <div ref={coverageDecisionDialog} role="dialog" aria-modal="true" aria-labelledby="coverage-decision-title" onKeyDown={trapCoverageDecisionFocus}><h3 id="coverage-decision-title">{coverageDecision.decision === "APPROVE" ? "Duyệt" : "Từ chối"} hoàn coverage cho {coverageDecision.request.studentName}</h3><p>Số tiền server đã chốt: {vnd(coverageDecision.request.amount)} VND. Bạn không thể tự duyệt yêu cầu của mình.</p><label>Lý do quyết định<textarea autoFocus value={coverageDecision.reason} onChange={(event) => setCoverageDecision({ ...coverageDecision, reason: event.target.value })} /></label><button type="button" disabled={Boolean(pending) || !coverageDecision.reason.trim()} onClick={() => void decideCoverageReversal()}>Xác nhận {coverageDecision.decision === "APPROVE" ? "duyệt" : "từ chối"}</button><button type="button" disabled={Boolean(pending)} onClick={() => setCoverageDecision(undefined)}>Hủy</button></div>}
      {closeConfirmation && run && <div ref={closeDialog} role="dialog" aria-modal="true" aria-labelledby="finance-close-run-title" onKeyDown={trapCloseFocus}><h3 id="finance-close-run-title">Đóng đợt thu {run.billingMonth}</h3><p>Chỉ đóng được khi mọi hóa đơn đã phát hành. Sau khi đóng, máy chủ từ chối thêm học sinh và các thao tác tạo hoặc sửa.</p><label>Nhập chính xác tháng thu {run.billingMonth} để xác nhận<input value={closeConfirmationMonth} onChange={(event) => setCloseConfirmationMonth(event.target.value)} /></label><label>Lý do đóng đợt thu<textarea id="finance-close-reason-field" aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? "finance-close-reason-error" : undefined} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>{errors.reason && <small id="finance-close-reason-error">{errors.reason}</small>}<button type="button" disabled={Boolean(pending) || !closeReason.trim() || closeConfirmationMonth !== run.billingMonth} onClick={() => void closeRun()}>Xác nhận đóng đợt thu</button><button type="button" disabled={Boolean(pending)} onClick={() => { setCloseConfirmation(false); setCloseReason(""); setCloseConfirmationMonth(""); }}>Hủy</button></div>}
      {generateConfirmation && run && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-generate-title"
        >
          <h3 id="finance-generate-title">
            Xác nhận tạo hóa đơn nháp cho đợt {run.billingMonth}
          </h3>
              <p>Máy chủ sẽ đánh giá lại roster trước khi tạo hóa đơn.</p>
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
      )}
      {additionConfirmation && run && (
        <div role="dialog" aria-modal="true" aria-labelledby="finance-add-student-title">
          <h3 id="finance-add-student-title">Xác nhận thêm {additionConfirmation.fullName}</h3>
          <p>Máy chủ có thể từ chối nếu học sinh không đủ điều kiện hoặc đã có hóa đơn.</p>
          <label>
            Nhập chính xác tên học sinh {additionConfirmation.fullName} để xác nhận
            <input autoFocus value={additionConfirmationName} onChange={(event) => setAdditionConfirmationName(event.target.value)} />
          </label>
          <button disabled={Boolean(pending) || additionConfirmationName !== additionConfirmation.fullName} onClick={() => void addGeneratedStudent()}>Xác nhận thêm học sinh</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => { setAdditionConfirmation(undefined); setAdditionConfirmationName(""); }}>Hủy</button>
        </div>
      )}
      {lifecycle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-lifecycle-title"
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
            <button type="button" onClick={() => setLifecycle(undefined)}>
              Hủy
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
