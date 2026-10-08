import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { auditData } from "../common/audit.js";
import { requestFingerprint } from "../common/mutation-protection.js";
import { isOperationIdempotencyCollision } from "../common/operation-idempotency.js";
import { PrismaService } from "../identity/prisma.service.js";
import { renderPaymentImage } from "./payment-image.js";
import { isTaxCategory, taxChannel, taxedLine, vatAmount, vatRate, type PaymentChannel, type TaxCategory } from "./tax.js";
import { transferContent, vietQrBankCode, vietQrPayload } from "./vietqr.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Decision 2026-10-02: pre-registered (SCHEDULED_TO_START) Students may join; billing eligibility stays with the run.
const membershipLifecycles = ["ENROLLED", "SCHEDULED_TO_START", "EXTRACURRICULAR_ONLY"] as const;
// Decision 2026-10-08: an EXTRACURRICULAR_ONLY enrollment has no official class; filters use this value and DTOs this label.
const EXTRACURRICULAR_ONLY = "EXTRACURRICULAR_ONLY" as const;
const extracurricularOnlyLabel = "Chỉ ngoại khóa";
const classLabel = (name: string | null | undefined) => name ?? extracurricularOnlyLabel;
const monthLabel = (billingMonth: string) => `${billingMonth.slice(5, 7)}/${billingMonth.slice(0, 4)}`;
const officialClassFilter = (value: unknown) => (value === EXTRACURRICULAR_ONLY ? EXTRACURRICULAR_ONLY : null);
const receivableGroupKinds = ["FIXED", "FLEXIBLE", "EXTRACURRICULAR"] as const;
const routes = {
  receivable: "POST /api/app/schools/:schoolId/finance/receivables",
  receivableLifecycle:
    "POST /api/app/schools/:schoolId/finance/receivables/:receivableId/lifecycle",
  classDefaultBankAccount: "PUT /api/app/schools/:schoolId/finance/classes/:classId/default-bank-account",
  extracurricularClass: "POST /api/app/schools/:schoolId/finance/extracurricular-classes",
  runExtracurricularExclusion: "PUT /api/app/schools/:schoolId/finance/collection-runs/:runId/extracurricular-classes/:classId/exclusion",
  extracurricularEdit: "PUT /api/app/schools/:schoolId/finance/extracurricular-classes/:classId",
  extracurricularLifecycle: "POST /api/app/schools/:schoolId/finance/extracurricular-classes/:classId/lifecycle",
  extracurricularMembershipAdd: "POST /api/app/schools/:schoolId/finance/extracurricular-classes/:classId/memberships",
  extracurricularMembershipEnd: "POST /api/app/schools/:schoolId/finance/extracurricular-classes/:classId/memberships/end",
  receivableEdit: "PUT /api/app/schools/:schoolId/finance/receivables/:receivableId",
  openRun: "POST /api/app/schools/:schoolId/finance/collection-runs",
  template:
    "PUT /api/app/schools/:schoolId/finance/collection-runs/:runId/template-lines",
  removeTemplate:
    "DELETE /api/app/schools/:schoolId/finance/collection-runs/:runId/template-lines/:lineId",
  ready: "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/ready",
  generate:
    "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/generate",
  addGeneratedStudent:
    "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/generated-students",
  closeRun:
    "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/close",
  settlement: "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/settlements",
  addInvoiceLine: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines",
  editInvoiceLine: "PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/:lineId",
  removeInvoiceLine: "DELETE /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/:lineId",
  lineDeduction: "PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/:lineId/deduction",
  editInvoiceLines: "PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines",
  invoiceCoverage: "PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/coverage",
  issueInvoice: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/issue",
  prepareRevision: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/revisions",
  issueRevision: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/issue-revision",
  discardRevision: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/discard-revision",
  priorDebtTransfer: "POST /api/app/schools/:schoolId/finance/collection-runs/:runId/prior-debts/transfer",
  closeInvoice: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/receipt",
  invoicePayout: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/payout",
  debtTransfer: "POST /api/app/schools/:schoolId/finance/debt-transfers",
  reportExport: "POST /api/app/schools/:schoolId/finance/reports/:workspace/exports",
  promotionPolicy: "POST /api/app/schools/:schoolId/finance/promotion-policies",
  promotionActivate: "POST /api/app/schools/:schoolId/finance/promotion-policy-versions/:versionId/activate",
  promotionRetire: "POST /api/app/schools/:schoolId/finance/promotion-policy-versions/:versionId/retire",
  promotionAssignments: "POST /api/app/schools/:schoolId/finance/promotion-policy-versions/:versionId/assignments",
  promotionAssignmentEnd: "POST /api/app/schools/:schoolId/finance/promotion-assignments/:assignmentId/end",
};
const validation = (field: string, message: string) =>
  new BadRequestException({
    code: "VALIDATION_ERROR",
    message: "Dữ liệu không hợp lệ.",
    fieldErrors: { [field]: message },
  });

// Field errors of one invoice line are keyed `lines.<lineId>.<field>` so the page shows them on that row.
const lineFieldErrors = (lineId: string, error: unknown) => {
  const response = error instanceof BadRequestException ? (error.getResponse() as any) : null;
  if (!response?.fieldErrors) return error;
  return new BadRequestException({ ...response, fieldErrors: Object.fromEntries(Object.entries(response.fieldErrors).map(([field, message]) => [`lines.${lineId}.${field}`, message])) });
};
// Carries a preview outcome out of the transaction it was computed in, so the transaction rolls back.
class PreviewRollback {
  constructor(readonly outcome: unknown) {}
}
type LineEdit = {
  lineId: string;
  quantity: number | null;
  unitPrice: bigint | null;
  overrideReason: string | null;
  deduction: { deductionQuantity: number; refundUnitPrice: bigint; reason: string | null } | null;
};

const promotionPolicyNameConstraints = new Set(["PromotionPolicy_schoolId_name_key"]);
const promotionPolicyNameColumns = "schoolId,name";

function promotionPolicyNameCollision(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") return false;
  const matches = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    for (const candidate of [record.target, record.name, record.fields]) {
      if (typeof candidate === "string" && promotionPolicyNameConstraints.has(candidate.replace(/^.*\./, "").replace(/"/g, ""))) return true;
      if (Array.isArray(candidate) && candidate.every((column) => typeof column === "string") && candidate.map((column) => column.replace(/^.*\./, "").replace(/"/g, "")).join(",") === promotionPolicyNameColumns) return true;
    }
    return Object.values(record).some(matches);
  };
  return matches((error as { meta?: unknown }).meta);
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}
  private school(schoolId: string) {
    if (!uuid.test(schoolId))
      throw validation("schoolId", "ID trường không hợp lệ.");
    return schoolId;
  }
  private actor(identityId: string, schoolId: string) {
    return this.authorization.resolve(
      identityId,
      this.school(schoolId),
      "app",
      "FINANCE_MANAGE",
    );
  }
  private async ledger(tx: any, invoice: any, type: string, amount = 0n, provenance: Record<string, unknown> = {}, postedAt = new Date()) {
    const lines = await tx.invoiceLine.findMany({ where: { schoolId: invoice.schoolId, invoiceId: invoice.id }, include: { receivable: { include: { group: true } } } });
    const grossAmount = lines.reduce((total: bigint, line: any) => total + BigInt(line.grossAmount ?? line.amount), 0n);
    const discountAmount = lines.reduce((total: bigint, line: any) => total + BigInt(line.discountAmount ?? 0), 0n);
    const invoiceVat = lines.reduce((total: bigint, line: any) => total + BigInt(line.vatAmount ?? 0), 0n);
    const deductionAmount = lines.reduce((total: bigint, line: any) => total + BigInt(line.deductionAmount ?? 0), 0n);
    const sourceKey = String(provenance.coverageReversalId ?? provenance.coverageId ?? provenance.settlementDifferenceId ?? provenance.settlementCarryId ?? provenance.settlementTransferId ?? provenance.debtTransferId ?? provenance.receiptId ?? provenance.payoutId ?? `${invoice.id}:${type}`);
    const statusSnapshot = typeof provenance.statusSnapshot === "string" ? provenance.statusSnapshot : invoice.status;
    await tx.financeLedgerEvent.create({ data: { schoolId: invoice.schoolId, type, sourceKey, postedAt, invoiceId: invoice.id, collectionRunId: invoice.collectionRunId, schoolYearId: invoice.schoolYearId, studentId: invoice.studentId, billingMonth: invoice.billingMonth, className: invoice.classNameSnapshot, groupName: lines.map((line: any) => line.receivable?.group?.name).filter(Boolean).sort().join(" | ") || null, statusSnapshot, amount, grossAmount, discountAmount, deductionAmount, netAmount: invoice.obligationTotalSnapshot ?? invoice.total, vatAmount: invoiceVat, provenance: { ...provenance, invoiceId: invoice.id, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, collectionRunId: invoice.collectionRunId, billingMonth: invoice.billingMonth, className: invoice.classNameSnapshot, status: statusSnapshot, lines: lines.map((line: any) => ({ id: line.id, kind: line.kind, receivableId: line.receivableId, receivableName: line.receivableNameSnapshot, groupName: line.receivable?.group?.name ?? null, grossAmount: line.grossAmount.toString(), discountAmount: line.discountAmount.toString(), deductionAmount: (line.deductionAmount ?? 0n).toString(), netAmount: line.netAmount.toString(), vatRate: line.vatRateSnapshot ?? null, vatAmount: (line.vatAmount ?? 0n).toString() })) } } });
  }
  private reportDate(value: unknown) {
    if (value == null || value === "") return new Date();
    if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || Number.isNaN(Date.parse(value))) throw validation("asOf", "Thời điểm chốt phải là ISO 8601 có múi giờ.");
    return new Date(value);
  }
  async report(identityId: string, schoolId: string, workspace: string, query: any) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    if (!["overview", "collection-runs", "outstanding", "cash-adjustments"].includes(workspace)) throw validation("workspace", "Không gian báo cáo không hợp lệ.");
    const asOf = this.reportDate(query?.asOf);
    const textFilter = (value: unknown, field: string) => value == null || typeof value === "string" && value.length <= 200 ? value ?? null : (() => { throw validation(field, "Bộ lọc không hợp lệ."); })();
    const scopedId = async (value: unknown, field: "schoolYearId" | "runId", model: "schoolYear" | "collectionRun") => { if (value == null || value === "") return null; if (typeof value !== "string" || !uuid.test(value)) throw validation(field, "ID bộ lọc không hợp lệ."); const found = await (this.prisma as any)[model].findFirst({ where: { id: value, schoolId }, select: { id: true } }); if (!found) throw new NotFoundException({ code: "REPORT_FILTER_NOT_FOUND", message: "Bộ lọc không thuộc Trường đang chọn." }); return value; };
    const billingMonth = query?.billingMonth == null || query?.billingMonth === "" ? null : typeof query.billingMonth === "string" && /^\d{4}-\d{2}$/.test(query.billingMonth) ? query.billingMonth : (() => { throw validation("billingMonth", "Kỳ thu phải có dạng YYYY-MM."); })();
    const filters = { schoolYearId: await scopedId(query?.schoolYearId, "schoolYearId", "schoolYear"), billingMonth, runId: await scopedId(query?.runId, "runId", "collectionRun"), className: textFilter(query?.className, "className"), groupName: textFilter(query?.groupName, "groupName"), status: textFilter(query?.status, "status") };
    const fetched = await this.prisma.financeLedgerEvent.findMany({ where: { schoolId, postedAt: { lte: asOf }, ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}), ...(filters.billingMonth ? { billingMonth: filters.billingMonth } : {}), ...(filters.runId ? { collectionRunId: filters.runId } : {}), ...(filters.className ? { className: filters.className } : {}), ...(filters.status ? { statusSnapshot: filters.status } : {}) }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] });
    // Decision 2026-10-02: a line's group is its Receivable's current fixed group; the snapshotted name is only the fallback (e.g. PRIOR_DEBT lines).
    const groupByReceivable = new Map<string, string>();
    if (filters.groupName) {
      const ids = [...new Set(fetched.flatMap((event: any) => ((event.provenance as any)?.lines ?? []).map((line: any) => line.receivableId).filter((id: unknown) => typeof id === "string" && uuid.test(id))))] as string[];
      if (ids.length) for (const receivable of await this.prisma.receivable.findMany({ where: { schoolId, id: { in: ids } }, select: { id: true, group: { select: { name: true } } } })) groupByReceivable.set(receivable.id, receivable.group.name);
    }
    const lineGroup = (line: any) => (line.receivableId ? groupByReceivable.get(line.receivableId) : undefined) ?? line.groupName;
    const events = fetched.filter((event: any) => !filters.groupName || ((event.provenance as any).lines ?? []).some((line: any) => lineGroup(line) === filters.groupName));
    const groupProjection = (item: any) => {
      if (!filters.groupName || item.type !== "INVOICE_ISSUED") return null;
      const lines = ((item.provenance as any).lines ?? []).filter((line: any) => lineGroup(line) === filters.groupName);
      const vat = lines.reduce((total: bigint, line: any) => total + BigInt(line.vatAmount ?? 0), 0n);
      // A group's obligation is its lines' net plus their VAT, like the whole-Invoice netAmount.
      return { grossAmount: lines.reduce((total: bigint, line: any) => total + BigInt(line.grossAmount ?? 0), 0n), discountAmount: lines.reduce((total: bigint, line: any) => total + BigInt(line.discountAmount ?? 0), 0n), deductionAmount: lines.reduce((total: bigint, line: any) => total + BigInt(line.deductionAmount ?? 0), 0n), netAmount: lines.reduce((total: bigint, line: any) => total + BigInt(line.netAmount ?? 0), 0n) + vat, vatAmount: vat };
    };
    // VAT included in the row amount: the Invoice VAT for an issue, the coverage VAT for coverage events, none for cash events.
    const eventVat = (item: any, projected: { vatAmount: bigint } | null) => item.type === "INVOICE_ISSUED" ? (projected?.vatAmount ?? BigInt(item.vatAmount ?? 0)).toString() : ["COVERAGE_ISSUED", "COVERAGE_REVERSAL_POSTED"].includes(item.type) ? String((item.provenance as any).vatAmount ?? "0") : "0";
    const row = (item: any) => { const projected = groupProjection(item); const unallocated = Boolean(filters.groupName && !projected); const provenance = unallocated ? { ...(item.provenance as object), groupAllocation: "UNALLOCATED_WHOLE_INVOICE_EVENT" } : item.provenance; return { id: item.id, type: item.type, postedAt: item.postedAt.toISOString(), billingMonth: item.billingMonth, className: item.className ?? null, groupName: item.groupName ?? null, status: item.statusSnapshot ?? null, amount: (item.type === "INVOICE_ISSUED" ? (projected?.netAmount ?? BigInt(item.netAmount ?? 0)) : BigInt(item.amount ?? 0)).toString(), grossAmount: (projected?.grossAmount ?? BigInt(item.grossAmount ?? 0)).toString(), discountAmount: (projected?.discountAmount ?? BigInt(item.discountAmount ?? 0)).toString(), deductionAmount: (item.type === "INVOICE_ISSUED" ? (projected?.deductionAmount ?? BigInt(item.deductionAmount ?? 0)) : 0n).toString(), netAmount: (projected?.netAmount ?? BigInt(item.netAmount ?? 0)).toString(), vatAmount: eventVat(item, projected), invoiceId: item.invoiceId, provenance, unallocated }; };
    const cancelled = new Set(events.filter((item: any) => item.type === "INVOICE_CANCELLED").map((item: any) => item.invoiceId));
    // A legacy cancellation has no trustworthy timestamp, so only those flagged source rows are excluded from effective obligations. Other backfilled issues remain reconcilable obligations.
    const issued = events.filter((item: any) => item.type === "INVOICE_ISSUED" && !cancelled.has(item.invoiceId) && !(item.provenance as any).legacyEffectiveUnknown);
    const issuedSum = () => issued.reduce((total: bigint, item: any) => total + (groupProjection(item)?.netAmount ?? BigInt(item.netAmount)), 0n).toString();
    const cashAdjustmentEvents = events.filter((item: any) => ["RECEIPT_POSTED", "SETTLEMENT_DIFFERENCE_POSTED", "SETTLEMENT_CARRY_POSTED", "SETTLEMENT_TRANSFER_POSTED", "DEBT_TRANSFER_POSTED", "COVERAGE_ISSUED", "COVERAGE_REVERSAL_POSTED", "PAYOUT_POSTED"].includes(item.type));
    const total = (items: any[], field = "amount") => items.reduce((value: bigint, item: any) => value + BigInt(item[field] ?? 0), 0n).toString();
    const receipts = events.filter((item: any) => item.type === "RECEIPT_POSTED"); const reversals = events.filter((item: any) => item.type === "COVERAGE_REVERSAL_POSTED"); const differences = events.filter((item: any) => item.type === "SETTLEMENT_DIFFERENCE_POSTED"); const carries = events.filter((item: any) => item.type === "SETTLEMENT_CARRY_POSTED"); const debts = events.filter((item: any) => item.type === "DEBT_TRANSFER_POSTED"); const coverage = events.filter((item: any) => item.type === "COVERAGE_ISSUED"); const payouts = events.filter((item: any) => item.type === "PAYOUT_POSTED");
    const billed = (field: "grossAmount" | "discountAmount" | "deductionAmount" | "netAmount" | "vatAmount") => issued.reduce((value: bigint, item: any) => value + (groupProjection(item)?.[field] ?? BigInt(item[field] ?? 0)), 0n).toString();
    const scopedEvents = (items: any[]) => filters.groupName ? [] : items;
    // Decision 2026-10-01: deductions lower the obligation; a payout is cash paid back on a negative Invoice.
    const summary = { gross: billed("grossAmount"), promotionDiscount: billed("discountAmount"), deduction: billed("deductionAmount"), payout: (-BigInt(total(scopedEvents(payouts)))).toString(), refundOwed: "0", vat: billed("vatAmount"), refund: (-BigInt(total(scopedEvents(reversals)))).toString(), refundVat: scopedEvents(reversals).reduce((value: bigint, item: any) => value + BigInt((item.provenance as any).vatAmount ?? 0), 0n).toString(), netBilled: issuedSum(), actualReceipt: total(scopedEvents(receipts)), settlementOutcome: { exact: total(scopedEvents(receipts.filter((item: any) => (item.provenance as any).outcome === "EXACT"))), shortfall: total(scopedEvents(receipts.filter((item: any) => (item.provenance as any).outcome === "SHORTFALL"))), overpayment: total(scopedEvents(receipts.filter((item: any) => (item.provenance as any).outcome === "OVERPAYMENT"))) }, openDifference: total(scopedEvents(differences)), carryAdjustment: total(scopedEvents(carries)), debtTransfer: total(scopedEvents(debts)), coverage: total(scopedEvents(coverage)), revisionCancellation: String(cancelled.size), outstanding: "0" };
    const currentInvoices = issued.map((issue: any) => { const invoiceEvents = events.filter((item: any) => item.invoiceId === issue.invoiceId); const paid = filters.groupName ? "0" : total(invoiceEvents.filter((item: any) => ["RECEIPT_POSTED", "SETTLEMENT_TRANSFER_POSTED", "PAYOUT_POSTED"].includes(item.type))); const transferred = filters.groupName ? "0" : total(invoiceEvents.filter((item: any) => item.type === "DEBT_TRANSFER_POSTED")); // A closed Invoice's shortfall or overpayment is owed through the next same-account Invoice, not here: it is reported as a pending or carried difference, never as debt or a refund.
 const differed = filters.groupName ? "0" : total(invoiceEvents.filter((item: any) => item.type === "SETTLEMENT_DIFFERENCE_POSTED")); const obligation = groupProjection(issue)?.netAmount ?? BigInt(issue.netAmount); const outstanding = obligation - BigInt(paid) - BigInt(transferred) - BigInt(differed); return { ...row(issue), actualReceipt: paid, outstanding: (outstanding > 0n ? outstanding : 0n).toString(), refundOwed: (outstanding < 0n ? -outstanding : 0n).toString(), formula: filters.groupName ? "issued matching-group obligation; whole-invoice settlement unallocated" : "issued obligation - Receipt - SettlementTransfer - DebtTransfer - SettlementDifference" }; });
    summary.outstanding = total(currentInvoices.map((item) => ({ amount: item.outstanding })));
    summary.refundOwed = total(currentInvoices.map((item) => ({ amount: item.refundOwed })));
    // Derived measures the visual report draws, computed here so the browser never adds money.
    const derived = { otherAdjustments: (BigInt(summary.netBilled) - (BigInt(summary.gross) - BigInt(summary.promotionDiscount) - BigInt(summary.deduction) + BigInt(summary.vat))).toString(), cashOut: (BigInt(summary.payout) - BigInt(summary.refund)).toString(), netCash: (BigInt(summary.actualReceipt) - BigInt(summary.payout) + BigInt(summary.refund)).toString() };
    Object.assign(summary, derived);
    const runRows = [...new Set(issued.map((item: any) => item.collectionRunId).filter(Boolean))].map((collectionRunId) => { const runEvents = events.filter((item: any) => item.collectionRunId === collectionRunId); const runIssued = issued.filter((item: any) => item.collectionRunId === collectionRunId); const runBilled = (field: "grossAmount" | "discountAmount" | "netAmount" | "vatAmount") => runIssued.reduce((sum: bigint, item: any) => sum + (groupProjection(item)?.[field] ?? BigInt(item[field] ?? 0)), 0n).toString(); return { id: collectionRunId, collectionRunId, billingMonth: runIssued[0]?.billingMonth ?? null, gross: runBilled("grossAmount"), promotionDiscount: runBilled("discountAmount"), vat: runBilled("vatAmount"), netBilled: runBilled("netAmount"), actualReceipt: filters.groupName ? "0" : total(runEvents.filter((item: any) => item.type === "RECEIPT_POSTED")), carryAdjustment: filters.groupName ? "0" : total(runEvents.filter((item: any) => item.type === "SETTLEMENT_CARRY_POSTED")), provenance: { eventIds: runEvents.map((item: any) => item.id), ...(filters.groupName ? { groupAllocation: "UNALLOCATED_WHOLE_INVOICE_EVENT" } : {}) } }; });
    const rows = workspace === "overview" ? issued.map(row) : workspace === "collection-runs" ? runRows : workspace === "outstanding" ? currentInvoices : cashAdjustmentEvents.map(row);
    const charts = await this.reportCharts(schoolId, asOf, filters, issued, events, currentInvoices, groupProjection);
    return { workspace, asOf: asOf.toISOString(), generatedAt: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh", filters, reportDefinitionVersion: "FINANCE_LEDGER_V5", sourceProvenance: "FinanceLedgerEvent immutable posting projection", summary, charts, rows };
  }
  // Server-computed series for the visual report (decision 2026-10-01): the browser only draws them.
  private async reportCharts(schoolId: string, asOf: Date, filters: any, issued: any[], events: any[], currentInvoices: any[], groupProjection: (item: any) => any) {
    const sum = (items: any[], value: (item: any) => bigint) => items.reduce((acc: bigint, item: any) => acc + value(item), 0n);
    const obligation = (item: any) => groupProjection(item)?.netAmount ?? BigInt(item.netAmount ?? 0);
    const cash = filters.groupName ? [] : events;
    const months = [...new Set<string>(issued.map((item: any) => item.billingMonth).filter(Boolean))].sort().slice(-6);
    const byMonth = months.map((month) => ({ billingMonth: month, netBilled: sum(issued.filter((item: any) => item.billingMonth === month), obligation).toString(), actualReceipt: sum(cash.filter((item: any) => item.type === "RECEIPT_POSTED" && item.billingMonth === month), (item: any) => BigInt(item.amount ?? 0)).toString() }));
    const classes = [...new Set<string>(currentInvoices.map((item: any) => classLabel(item.className)))].sort((a, b) => a.localeCompare(b, "vi"));
    const byClass = classes.map((className) => { const items = currentInvoices.filter((item: any) => classLabel(item.className) === className); return { className, netBilled: sum(items, (item: any) => BigInt(item.netAmount)).toString(), actualReceipt: sum(items, (item: any) => BigInt(item.actualReceipt)).toString(), outstanding: sum(items, (item: any) => BigInt(item.outstanding)).toString() }; });
    const outcomeOf = (invoiceId: string) => cash.find((item: any) => item.invoiceId === invoiceId && item.type === "RECEIPT_POSTED")?.provenance?.outcome ?? (cash.some((item: any) => item.invoiceId === invoiceId && item.type === "PAYOUT_POSTED") ? "REFUNDED" : null);
    const runIds = [...new Set<string>(issued.map((item: any) => item.collectionRunId).filter(Boolean))];
    const runStatus = runIds.map((collectionRunId) => {
      const runIssued = issued.filter((item: any) => item.collectionRunId === collectionRunId);
      const count = (outcome: string | null, refund = false) => runIssued.filter((item: any) => outcomeOf(item.invoiceId) === outcome && (outcome !== null || (obligation(item) < 0n) === refund)).length;
      return { collectionRunId, billingMonth: runIssued[0]?.billingMonth ?? null, issued: runIssued.length, exact: count("EXACT"), shortfall: count("SHORTFALL"), overpayment: count("OVERPAYMENT"), refunded: count("REFUNDED"), awaitingReceipt: count(null), awaitingPayout: count(null, true) };
    });
    // Aging uses each Invoice's due date against the report's asOf.
    const open = currentInvoices.filter((item: any) => BigInt(item.outstanding) > 0n);
    const invoices = open.length ? await this.prisma.invoice.findMany({ where: { schoolId, id: { in: open.map((item: any) => item.invoiceId) } }, select: { id: true, dueOn: true, studentId: true, studentCodeSnapshot: true, studentNameSnapshot: true, classNameSnapshot: true } }) : [];
    const byId = new Map(invoices.map((item: any) => [item.id, item]));
    const overdueDays = (invoiceId: string) => { const due = byId.get(invoiceId)?.dueOn; return due ? Math.floor((asOf.getTime() - due.getTime()) / 86_400_000) : 0; };
    const bucket = (from: number, to: number | null) => sum(open.filter((item: any) => { const days = overdueDays(item.invoiceId); return days >= from && (to === null || days <= to); }), (item: any) => BigInt(item.outstanding)).toString();
    const aging = [{ key: "NOT_DUE", amount: sum(open.filter((item: any) => overdueDays(item.invoiceId) <= 0), (item: any) => BigInt(item.outstanding)).toString() }, { key: "1_15", amount: bucket(1, 15) }, { key: "16_30", amount: bucket(16, 30) }, { key: "OVER_30", amount: bucket(31, null) }];
    const debtors = new Map<string, { studentId: string; studentCode: string; studentName: string; className: string; outstanding: bigint; invoices: number; maxOverdueDays: number }>();
    for (const item of open) { const invoice = byId.get(item.invoiceId); if (!invoice) continue; const current = debtors.get(invoice.studentId) ?? { studentId: invoice.studentId, studentCode: invoice.studentCodeSnapshot, studentName: invoice.studentNameSnapshot, className: classLabel(invoice.classNameSnapshot), outstanding: 0n, invoices: 0, maxOverdueDays: 0 }; current.outstanding += BigInt(item.outstanding); current.invoices += 1; current.maxOverdueDays = Math.max(current.maxOverdueDays, overdueDays(item.invoiceId)); debtors.set(invoice.studentId, current); }
    const topDebtors = [...debtors.values()].sort((a, b) => (b.outstanding > a.outstanding ? 1 : b.outstanding < a.outstanding ? -1 : a.studentCode.localeCompare(b.studentCode))).slice(0, 10).map((item) => ({ ...item, outstanding: item.outstanding.toString() }));
    // Cash moves by business week (Monday, Asia/Ho_Chi_Minh) of their posting time.
    const weekOf = (date: Date) => { const local = new Date(date.getTime() + 7 * 3_600_000); const day = (local.getUTCDay() + 6) % 7; return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day)).toISOString().slice(0, 10); };
    const weeks = new Map<string, { cashIn: bigint; cashOut: bigint }>();
    for (const item of cash) {
      const inflow = item.type === "RECEIPT_POSTED" ? BigInt(item.amount ?? 0) : 0n;
      const outflow = item.type === "PAYOUT_POSTED" || item.type === "COVERAGE_REVERSAL_POSTED" ? -BigInt(item.amount ?? 0) : 0n;
      if (!inflow && !outflow) continue;
      const key = weekOf(item.postedAt); const current = weeks.get(key) ?? { cashIn: 0n, cashOut: 0n }; current.cashIn += inflow; current.cashOut += outflow; weeks.set(key, current);
    }
    const cashByWeek = [...weeks].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([weekStart, value]) => ({ weekStart, cashIn: value.cashIn.toString(), cashOut: value.cashOut.toString() }));
    return { byMonth, byClass, runStatus, aging, topDebtors, cashByWeek };
  }
  async requestReportExport(identityId: string, schoolId: string, workspace: string, key: string, operationId: string, query: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); const result = await this.report(identityId, schoolId, workspace, query);
    const encode = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = Buffer.from([`# asOf=${result.asOf}; generatedAt=${result.generatedAt}; timezone=${result.timezone}; definition=${result.reportDefinitionVersion}; filters=${JSON.stringify(result.filters)}`, "postedAt,type,billingMonth,className,groupName,status,amount,grossAmount,discountAmount,deductionAmount,netAmount,vatAmount,invoiceId,provenance", ...result.rows.map((row: any) => [row.postedAt, row.type, row.billingMonth, row.className, row.groupName, row.status, row.amount, row.grossAmount, row.discountAmount, row.deductionAmount, row.netAmount, row.vatAmount ?? row.vat, row.invoiceId, JSON.stringify(row.provenance)].map(encode).join(","))].join("\n"));
    return this.mutate(actor, identityId, schoolId, routes.reportExport, key, operationId, { workspace, query }, async (tx, operation) => {
      const record = await tx.financeReportExport.create({ data: { schoolId, membershipId: actor.membershipId, operationId: operation, workspace, result: result as Prisma.InputJsonValue, csv, expiresAt: new Date(Date.now() + 10 * 60_000) } });
      const outcome = { exportId: record.id, expiresAt: record.expiresAt.toISOString(), workspace };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "FINANCE_REPORT_EXPORT_REQUESTED", operation, null, outcome);
      return outcome;
    });
  }
  async downloadReportExport(identityId: string, schoolId: string, exportId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(exportId, "exportId");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeReportExport.updateMany({ where: { id: exportId, schoolId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { downloadedAt: new Date() } });
      if (updated.count !== 1) throw new NotFoundException({ code: "REPORT_EXPORT_UNAVAILABLE", message: "Tệp báo cáo đã hết hạn hoặc không còn khả dụng." });
      const record = await tx.financeReportExport.findFirstOrThrow({ where: { id: exportId, schoolId } });
      await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: actor.membershipId, membershipId: actor.membershipId }, "FINANCE_REPORT_EXPORT_DOWNLOADED", { exportId: record.id, workspace: record.workspace, requestedByMembershipId: record.membershipId }) });
      return { csv: record.csv, workspace: record.workspace };
    });
  }
  private text(value: unknown, field: string, required = true, limit = 200) {
    const result = typeof value === "string" ? value.trim() : "";
    if ((required && !result) || result.length > limit)
      throw validation(
        field,
        required ? `Cần từ 1 đến ${limit} ký tự.` : `Không quá ${limit} ký tự.`,
      );
    return result || null;
  }
  // A unit is a word such as "tháng" or "buổi"; a number there is almost always a quantity typed into the wrong field.
  private unitLabel(value: unknown) {
    const result = this.text(value, "unitLabel", true, 50)!;
    if (!/\p{L}/u.test(result)) throw validation("unitLabel", "Đơn vị tính phải là chữ, ví dụ: tháng, ngày, buổi.");
    return result;
  }
  private taxCategory(value: unknown): TaxCategory {
    if (!isTaxCategory(value)) throw validation("taxCategory", "Mức thuế suất không hợp lệ.");
    return value;
  }
  private identifier(value: unknown, field: string) {
    if (typeof value !== "string" || !uuid.test(value))
      throw validation(field, "ID không hợp lệ.");
    return value;
  }
  private price(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^\d+$/.test(value) ||
      BigInt(value) <= 0n ||
      BigInt(value) > 9007199254740991n
    )
      throw validation(
        "defaultUnitPrice",
        "Đơn giá VND phải là số nguyên dương an toàn.",
      );
    return BigInt(value);
  }
  // Decision 2026-10-01 D1, amendment A1: the refund price may be 0 (not refunded) and never exceeds the charged price.
  private refundPrice(value: unknown, field = "refundUnitPrice") {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > 9007199254740991n)
      throw validation(field, "Giá hoàn trả VND phải là số nguyên không âm an toàn.");
    return BigInt(value);
  }
  private refundWithinPrice(refundUnitPrice: bigint, unitPrice: bigint, field = "refundUnitPrice") {
    if (refundUnitPrice > unitPrice) throw validation(field, `Giá hoàn trả không được vượt đơn giá thu (${unitPrice.toLocaleString("vi-VN")} đ).`);
  }
  private flag(value: unknown, field: string) {
    if (typeof value !== "boolean") throw validation(field, "Giá trị phải là có hoặc không.");
    return value;
  }
  private autoLeaveNeedsRefund(auto: boolean, refundUnitPrice: bigint) {
    if (auto && refundUnitPrice <= 0n) throw validation("autoLeaveDeduction", "Nhập giá hoàn trả lớn hơn 0 để tự động trừ theo ngày nghỉ có phép.");
  }
  private deductionQuantity(value: unknown) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > 2147483647n)
      throw validation("deductionQuantity", "Số lượng bớt phải là số nguyên không âm.");
    return Number(value);
  }
  private quantity(value: unknown) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 2147483647n)
      throw validation("quantity", "Số lượng phải là số nguyên dương.");
    return Number(value);
  }
  private linePrice(value: unknown) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9007199254740991n)
      throw validation("unitPrice", "Đơn giá VND phải là số nguyên dương an toàn.");
    return BigInt(value);
  }
  private actualAmount(value: unknown) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > 9007199254740991n)
      throw validation("actualAmount", "Số thực nhận phải là số nguyên VND an toàn không âm.");
    return BigInt(value);
  }
  private debtAmount(value: unknown) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9007199254740991n)
      throw validation("amount", "Số tiền chuyển phải là số nguyên VND dương an toàn.");
    return BigInt(value);
  }
  private safeIssuedTotal(total: bigint) {
    if (total > 9007199254740991n || total < -9007199254740991n)
      throw validation("invoiceId", "Tổng nghĩa vụ VND vượt giới hạn nhập thực nhận an toàn.");
  }
  private amount(unitPrice: bigint, quantity: number) {
    const amount = unitPrice * BigInt(quantity);
    if (amount > 9223372036854775807n)
      throw validation("quantity", "Số lượng và đơn giá vượt giới hạn VND.");
    return amount;
  }
  // Decision 2026-10-02: the three groups are typed and fixed; they have no lifecycle.
  private groupDto(value: any) {
    return {
      id: value.id,
      name: value.name,
      kind: value.kind,
      createdAt: value.createdAt.toISOString(),
    };
  }
  private receivableDto(value: any) {
    const status = value.lifecycleTransitions?.[0]?.status ?? null;
    return {
      id: value.id,
      groupId: value.groupId,
      kind: value.group?.kind ?? null,
      kindLocked: Boolean(value.kindLocked),
      extracurricularClassCount: value.extracurricularClassNames?.length ?? 0,
      extracurricularClassNames: value.extracurricularClassNames ?? [],
      code: value.code,
      displayName: value.displayName,
      unitLabel: value.unitLabel,
      defaultUnitPrice: value.defaultUnitPrice.toString(),
      refundUnitPrice: (value.refundUnitPrice ?? 0n).toString(),
      autoLeaveDeduction: Boolean(value.autoLeaveDeduction),
      taxCategory: value.taxCategory ?? "NOT_DECLARED",
      channel: taxChannel(value.taxCategory ?? "NOT_DECLARED"),
      status,
      available: status === "ACTIVE",
      createdAt: value.createdAt.toISOString(),
    };
  }
  async read(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const [groups, receivables, schoolYears, invoiceUse, templateUse, classUse] = await Promise.all([
      this.prisma.receivableGroup.findMany({ where: { schoolId }, orderBy: { kind: "asc" } }),
      this.prisma.receivable.findMany({
        where: { schoolId },
        include: {
          lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
          group: true,
        },
        orderBy: { displayName: "asc" },
      }),
      this.prisma.schoolYear?.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } }) ?? Promise.resolve([]),
      this.prisma.invoiceLine.groupBy({ by: ["receivableId"], where: { schoolId, receivableId: { not: null } } }),
      this.prisma.collectionRunTemplateLine.groupBy({ by: ["receivableId"], where: { schoolId } }),
      this.prisma.extracurricularClass.findMany({ where: { schoolId }, select: { receivableId: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    ]);
    // A Receivable used on an Invoice or collection template keeps its kind (decision 2026-10-02 §3.1).
    // Class names let the edit dialog say which extracurricular classes a price change reaches (decision 2026-10-06).
    const classNames = new Map<string, string[]>();
    for (const use of classUse) classNames.set(use.receivableId, [...(classNames.get(use.receivableId) ?? []), use.name]);
    const locked = new Set<string>([...invoiceUse, ...templateUse, ...classUse].map((use) => use.receivableId as string));
    return {
      groups: groups.map((item) => this.groupDto(item)),
      receivables: receivables.map((item) => this.receivableDto({ ...item, kindLocked: locked.has(item.id), extracurricularClassNames: classNames.get(item.id) ?? [] })),
      schoolYears: schoolYears.map((year) => ({ id: year.id, name: year.name, startsOn: year.startsOn.toISOString(), endsOn: year.endsOn.toISOString(), closedAt: year.closedAt?.toISOString() ?? null })),
    };
  }
  async operation(identityId: string, schoolId: string, operationId: string) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(operationId))
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    const operation = await this.prisma.operation.findFirst({
      where: {
        id: operationId,
        schoolId,
        membershipId: actor.membershipId,
        actorType: "SCHOOL_MEMBERSHIP",
      },
    });
    if (!operation)
      throw new NotFoundException({
        code: "OPERATION_NOT_FOUND",
        message: "Không tìm thấy thao tác.",
      });
    const generation = await this.prisma.collectionRunGeneration.findFirst({ where: { schoolId, operationId } });
    return {
      id: operation.id,
      status: operation.status,
      outcome: operation.outcome,
      progress: generation ? this.generationDto(generation) : null,
    };
  }
  private generationDto(generation: any) {
    return {
      generationId: generation.id, status: generation.status, total: generation.totalCount,
      processed: generation.processedCount, eligible: generation.eligibleCount,
      skipped: generation.skippedCount,
      percent: generation.totalCount ? Math.floor(generation.processedCount * 100 / generation.totalCount) : 100,
      resumable: generation.status === "PAUSED" || generation.status === "QUEUED" || generation.status === "RUNNING",
      lastError: generation.status === "FAILED" ? { code: generation.lastErrorCode, message: generation.lastErrorMessage } : null,
    };
  }
  private async transactionActor(tx: any, schoolId: string, identityId: string, membershipId: string) {
    const membership = await tx.schoolMembership.findFirst({
      where: {
        id: membershipId,
        schoolId,
        userIdentityId: identityId,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
        boundStaffProfile: {
          employmentStatus: "ACTIVE",
          primaryPosition: { status: "ACTIVE", grants: { some: { capability: "FINANCE_MANAGE" } } },
        },
      },
    });
    if (!membership) throw new NotFoundException({ code: "FINANCE_CONTEXT_DENIED", message: "Không thể truy cập catalog khoản thu." });
  }
  private async promotionLock(tx: any, schoolId: string) {
    // A per-School transaction lock closes the evaluator/mutation phantom window.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${schoolId}, 0))`;
  }
  private applicationDto(application: any) {
    return { policyId: application.policyId, versionId: application.versionId, targetId: application.targetId,
      assignmentId: application.assignmentId, assignmentReason: application.assignmentReason,
      versionInterval: application.versionInterval, assignmentInterval: application.assignmentInterval,
      discountType: application.discountType, discountValue: application.discountValue.toString(), priority: application.priority,
      stackingMode: application.stackingMode, appliedDiscount: application.appliedDiscount.toString(),
      grossAmount: application.grossAmount.toString(), discountAmount: application.discountAmount.toString(), netAmount: application.netAmount.toString() };
  }
  // Review badge: "Cố định" / "Linh hoạt · <scope>" / "Ngoại khóa · <lớp>" / "Sửa tay", plus the server-derived flags and a short detail for
  // extracurricular lines. Legacy lines carry none.
  private sourceDto(line: any) {
    if (!line.sourceKind) return null;
    const detail = line.sourceDetail ?? {};
    const day = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
    const dayYear = (value: string) => `${day(value)}/${value.slice(0, 4)}`;
    if (line.sourceKind === "EXTRACURRICULAR") {
      const classes = (detail.classes ?? []) as Array<{ name: string; effectiveFrom: string; effectiveTo: string | null }>;
      const flags = ((detail.flags ?? []) as string[]).map((code) => ({ code, label: code === "CLASS_CHANGE" ? "Chuyển lớp trong tháng" : "Vào/nghỉ giữa tháng" }));
      const text = classes.length > 1
        ? classes.map((item, index) => (index === 0 ? `${item.name} đến ${item.effectiveTo ? day(item.effectiveTo) : "hết tháng"}` : `${item.name} từ ${day(item.effectiveFrom)}`)).join(", ") + " · gộp một dòng, không thu trùng"
        : classes[0] ? [classes[0].effectiveFrom ? `vào lớp từ ${dayYear(classes[0].effectiveFrom)}` : "", classes[0].effectiveTo ? `nghỉ lớp sau ${dayYear(classes[0].effectiveTo)}` : ""].filter(Boolean).join(" · ") : "";
      return { kind: "EXTRACURRICULAR", label: `Ngoại khóa · ${classes.map((item) => item.name).join(" → ")}`, flags, detail: flags.length ? text : "" };
    }
    const scope = detail.scope;
    const label = line.sourceKind === "TEMPLATE_FIXED" ? "Cố định" : line.sourceKind === "TEMPLATE_FLEXIBLE" ? `Linh hoạt · ${scope?.label ?? "Toàn bộ"}` : "Sửa tay";
    return { kind: line.sourceKind, label, flags: [], detail: "" };
  }
  private lineDto(line: any, issued = false) {
    const promotionApplicationSnapshot = issued ? (line.promotionApplications ?? []).sort((a: any, b: any) => a.ordinal - b.ordinal).map((application: any) => this.applicationDto(application)) : null;
    return {
      id: line.id, kind: line.kind, sourceKind: line.sourceKind ?? null, sourceBadge: this.sourceDto(line), receivableId: line.receivableId, receivableCode: line.receivableCodeSnapshot,
      receivableName: line.receivableNameSnapshot, unitLabel: line.unitLabelSnapshot,
      defaultUnitPrice: line.defaultUnitPriceSnapshot.toString(), unitPrice: line.unitPrice.toString(),
      quantity: line.quantity.toString(), amount: line.amount.toString(),
      grossAmount: (line.grossAmount ?? line.amount).toString(),
      discountAmount: (line.discountAmount ?? 0n).toString(),
      netAmount: (line.netAmount ?? line.amount).toString(),
      taxCategory: line.taxCategorySnapshot ?? null,
      vatRate: line.vatRateSnapshot ?? null,
      vatAmount: (line.vatAmount ?? 0n).toString(),
      refundUnitPrice: (line.refundUnitPriceSnapshot ?? 0n).toString(),
      deductionQuantity: String(line.deductionQuantity ?? 0),
      proposedDeductionQuantity: String(line.proposedDeductionQuantity ?? 0),
      deductionAmount: (line.deductionAmount ?? 0n).toString(),
      deductionReason: line.deductionReason ?? null,
      deductionSource: line.deductionSource ?? null,
      promotionEvaluation: issued ? { version: "PROMOTION_EVALUATION_V1", applications: promotionApplicationSnapshot } : line.promotionEvaluationProvenance ?? null,
      promotionApplicationSnapshot,
      overrideReason: line.overrideReason,
      source: line.source, sourceReason: line.sourceReason,
      sourceRecordedAt: line.sourceRecordedAt?.toISOString() ?? null,
      sourceProvenance: line.sourceProvenance,
      sourceAudit: line.source ? { actorIdentityId: line.sourceActorIdentityId, membershipId: line.sourceMembershipId } : null,
    };
  }
  // Decision 2026-10-05 §3: a receiving account reads "<bank code> - <holder>" over its number; SCHOOL marks the school account.
  private accountDto(invoice: any) {
    if (!invoice.bankAccountIdSnapshot || !invoice.accountNumberSnapshot) return null;
    return { id: invoice.bankAccountIdSnapshot as string, kind: (invoice.channel ?? "PERSONAL") as "SCHOOL" | "PERSONAL", bankCode: vietQrBankCode(invoice.receivingBankBinSnapshot, invoice.receivingBankSnapshot), accountHolderName: invoice.accountHolderNameSnapshot as string, accountNumber: invoice.accountNumberSnapshot as string };
  }
  private invoiceDto(invoice: any) {
    const result: any = {
      id: invoice.id, status: invoice.status, total: invoice.total.toString(), billingMonth: invoice.billingMonth,
      channel: invoice.channel ?? "PERSONAL", kind: invoice.kind ?? "NORMAL", collectionRunId: invoice.collectionRunId,
      enrollmentEndedOn: invoice.enrollmentEndedOnSnapshot?.toISOString().slice(0, 10) ?? null,
      student: { code: invoice.studentCodeSnapshot, name: invoice.studentNameSnapshot, className: classLabel(invoice.classNameSnapshot) },
      lines: (invoice.lines ?? []).map((line: any) => this.lineDto(line, invoice.status !== "DRAFT")).sort(this.amountDescending),
      revisesInvoiceId: invoice.revisesInvoiceId ?? null,
      revisionReason: invoice.revisionReason ?? null,
      replacementInvoiceId: invoice.replacementInvoices?.[0]?.id ?? null,
      payout: invoice.payout ? { amount: invoice.payout.amount.toString(), paidOn: invoice.payout.paidOn.toISOString().slice(0, 10), method: invoice.payout.method, reference: invoice.payout.reference, postedAt: invoice.payout.postedAt.toISOString() } : null,
      receipt: invoice.receipt ? {
        actualAmount: invoice.receipt.actualAmount.toString(), outcome: invoice.receipt.outcome,
        postedAt: invoice.receipt.postedAt.toISOString(),
        difference: invoice.receipt.difference ? { signedAmount: invoice.receipt.difference.signedAmount.toString() } : null,
      } : null,
      sourceDebtTransfers: (invoice.debtTransfersFrom ?? []).map((transfer: any) => ({ targetInvoiceId: transfer.targetInvoiceId, amount: transfer.amount.toString(), reason: transfer.reason, postedAt: transfer.createdAt.toISOString() })),
      sourceOutstanding: invoice.debtTransfersFrom?.length ? (BigInt(invoice.obligationTotalSnapshot ?? invoice.total) - invoice.debtTransfersFrom.reduce((sum: bigint, transfer: any) => sum + BigInt(transfer.amount), 0n)).toString() : null,
      priorDebtTransfers: (invoice.debtTransfersTo ?? []).map((transfer: any) => ({ sourceInvoiceId: transfer.sourceInvoiceId, amount: transfer.amount.toString(), reason: transfer.reason, postedAt: transfer.createdAt.toISOString() })),
      settlementTransfer: invoice.settlementTransferTo ? {
        sourceInvoiceId: invoice.settlementTransferTo.sourceInvoiceId,
        sourceReceiptId: invoice.settlementTransferTo.sourceReceiptId,
        amount: invoice.settlementTransferTo.amount.toString(),
        postedAt: invoice.settlementTransferTo.sourceReceipt.postedAt.toISOString(),
      } : null,
      carries: (invoice.settlementCarries ?? []).map((carry: any) => ({ type: carry.type, amount: carry.amount.toString(), sourceDifferenceId: carry.settlementDifferenceId })),
      coverageFacts: (invoice.coverageFacts ?? []).map((fact: any) => ({ coverageId: fact.issuedCoverage?.id ?? null, receivableId: fact.receivableId, billingMonth: fact.billingMonth, policyId: fact.policyId, versionId: fact.versionId, originalPrice: fact.originalPrice.toString(), reduction: fact.reduction.toString(), netPrice: (BigInt(fact.originalPrice) - BigInt(fact.reduction)).toString(), serviceStart: fact.serviceStart.toISOString().slice(0, 10), serviceEnd: fact.serviceEnd.toISOString().slice(0, 10), calendarEffectiveFrom: fact.calendarEffectiveFrom.toISOString().slice(0, 10), timezone: fact.timezone, issuedAt: fact.issuedCoverage?.issuedAt?.toISOString() ?? null })),
    };
    if (["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status)) result.issue = {
      issuedAt: invoice.issuedAt.toISOString(), obligationCode: invoice.obligationCodeSnapshot ?? null, obligationTotal: invoice.obligationTotalSnapshot.toString(),
      obligationLines: invoice.obligationLinesSnapshot, dueOn: invoice.dueOn.toISOString().slice(0, 10),
      bankAccount: { id: invoice.bankAccountIdSnapshot, receivingBank: invoice.receivingBankSnapshot, bankBin: invoice.receivingBankBinSnapshot, accountNumber: invoice.accountNumberSnapshot, accountHolderName: invoice.accountHolderNameSnapshot },
      transferContent: invoice.transferContentSnapshot,
      policy: { effectiveFrom: invoice.financePolicyEffectiveFrom.toISOString().slice(0, 10), dueDaysAfterIssue: invoice.dueDaysAfterIssueSnapshot, taxTreatment: invoice.taxTreatmentSnapshot, debtScope: invoice.debtScopeSnapshot, reversalMode: invoice.reversalModeSnapshot },
    };
    result.paymentImageAvailable = this.paymentImageAvailable(invoice);
    return result;
  }
  // Finance may hand the Parent a payment image only while the full issued obligation is still owed,
  // or, for a negative Invoice, while the refund has not been paid out yet.
  private paymentImageAvailable(invoice: any) {
    return invoice.status === "ISSUED" && !invoice.receipt && !invoice.payout && !invoice.settlementTransferTo && !(invoice.debtTransfersFrom?.length)
      && Boolean(invoice.receivingBankBinSnapshot) && BigInt(invoice.obligationTotalSnapshot ?? 0) !== 0n;
  }
  // The image covers the whole payment notice: one section per unsettled channel Invoice of the Student in the run.
  async paymentImage(identityId: string, schoolId: string, invoiceId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const invoice: any = await this.prisma.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { ...this.invoiceInclude, school: { select: { name: true } } } });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    if (!this.paymentImageAvailable(invoice)) throw new ConflictException({ code: "PAYMENT_IMAGE_UNAVAILABLE", message: "Chỉ tải ảnh cho hóa đơn đã phát hành và chưa thu tiền." });
    const siblings: any[] = await this.prisma.invoice.findMany({ where: { schoolId, studentId: invoice.studentId, collectionRunId: invoice.collectionRunId, status: "ISSUED", id: { not: invoice.id } }, include: this.invoiceInclude });
    const parts = [invoice, ...siblings.filter((item) => this.paymentImageAvailable(item))].sort((a, b) => (a.channel === b.channel ? 0 : a.channel === "SCHOOL" ? -1 : 1));
    const issuedDay = invoice.issuedAt.toISOString().slice(0, 10);
    const profile = await this.prisma.schoolProfileVersion.findFirst({ where: { schoolId, effectiveFrom: { lte: new Date(`${issuedDay}T00:00:00.000Z`) } }, orderBy: { effectiveFrom: "desc" } });
    const png = await renderPaymentImage({
      schoolName: profile?.schoolName ?? invoice.school.name, billingMonth: invoice.billingMonth,
      studentCode: invoice.studentCodeSnapshot, studentName: invoice.studentNameSnapshot, className: classLabel(invoice.classNameSnapshot),
      dueOn: parts.map((part) => part.dueOn.toISOString().slice(0, 10)).sort()[0]!,
      parts: parts.map((part) => this.paymentImagePart(part)),
    });
    const primaryPart = parts[0]!;
    await this.prisma.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: actor.membershipId, membershipId: actor.membershipId }, "INVOICE_PAYMENT_IMAGE_DOWNLOADED", { invoiceId: invoice.id, obligationCode: primaryPart.obligationCodeSnapshot, amount: parts.reduce((sum, part) => sum + BigInt(part.obligationTotalSnapshot), 0n).toString(), parts: parts.map((part) => ({ invoiceId: part.id, obligationCode: part.obligationCodeSnapshot, amount: BigInt(part.obligationTotalSnapshot).toString() })) }) });
    return { png, fileName: `${primaryPart.obligationCodeSnapshot}-${invoice.studentCodeSnapshot}.png`.replace(/[^A-Za-z0-9._-]/g, "_") };
  }
  private paymentImagePart(invoice: any) {
    const total = BigInt(invoice.obligationTotalSnapshot);
    const rows: { label: string; amount: bigint }[] = [];
    const vatByRate = new Map<number, bigint>();
    const price = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value));
    for (const line of (invoice.obligationLinesSnapshot ?? []) as any[]) {
      const quantity = line.quantity && line.quantity !== "1" ? ` · ${line.quantity} ${line.unitLabel ?? ""}`.trimEnd() : "";
      if (BigInt(line.grossAmount ?? line.amount) !== 0n || BigInt(line.deductionAmount ?? "0") === 0n) rows.push({ label: `${line.receivableName}${quantity}`, amount: BigInt(line.grossAmount ?? line.amount) });
      if (BigInt(line.discountAmount ?? "0") > 0n) rows.push({ label: `Ưu đãi · ${line.receivableName}`, amount: -BigInt(line.discountAmount) });
      if (BigInt(line.deductionAmount ?? "0") > 0n) rows.push({ label: `${this.deductionLabel(line.receivableName, line.deductionSource)} · ${line.deductionQuantity} ${line.unitLabel ?? ""} x ${price(line.refundUnitPrice)}`.replace(/ {2,}/g, " "), amount: -BigInt(line.deductionAmount) });
      if (line.vatRate != null && BigInt(line.vatAmount ?? "0") > 0n) vatByRate.set(line.vatRate, (vatByRate.get(line.vatRate) ?? 0n) + BigInt(line.vatAmount));
    }
    for (const [rate, amount] of [...vatByRate].sort((a, b) => a[0] - b[0])) rows.push({ label: `Thuế GTGT ${rate}%`, amount });
    for (const carry of invoice.settlementCarries ?? []) rows.push(carry.type === "SHORTFALL_CARRY" ? { label: "Khoản thu thiếu kỳ trước", amount: BigInt(carry.amount) } : { label: "Khoản thu thừa kỳ trước được khấu trừ", amount: -BigInt(carry.amount) });
    return {
      channel: invoice.channel, obligationCode: invoice.obligationCodeSnapshot, rows, total,
      bankName: invoice.receivingBankSnapshot, accountNumber: invoice.accountNumberSnapshot, accountHolderName: invoice.accountHolderNameSnapshot,
      transferContent: invoice.transferContentSnapshot,
      // A refund part has no VietQR: the School pays the parent back.
      qrPayload: total > 0n ? vietQrPayload({ bin: invoice.receivingBankBinSnapshot, accountNumber: invoice.accountNumberSnapshot, amount: total, content: invoice.transferContentSnapshot }) : null,
    };
  }
  // "Bớt Tiền ăn nghỉ có phép 09/2026" names the source month of a leave-day deduction.
  private deductionLabel(receivableName: string, source: any) {
    const month = typeof source?.month === "string" ? ` nghỉ có phép ${source.month.slice(5, 7)}/${source.month.slice(0, 4)}` : "";
    return `Bớt ${receivableName}${month}`;
  }
  private amountDescending = (a: { amount: string; id: string }, b: { amount: string; id: string }) =>
    BigInt(b.amount) > BigInt(a.amount) ? 1 : BigInt(b.amount) < BigInt(a.amount) ? -1 : a.id.localeCompare(b.id);
  private localIssueDate(now: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    return new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))));
  }
  private transferContent(studentName: string, className: string | null) {
    return transferContent(studentName, className ?? "");
  }
  private async obligationCode(tx: any, schoolId: string, issuedAt: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(issuedAt);
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    const prefix = `OBL-${value("year")}${value("month")}-`;
    await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`;
    const count = await tx.invoice.count({ where: { schoolId, obligationCodeSnapshot: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(6, "0")}`;
  }
  private parentObligationDto(invoice: any, outstanding: bigint, effectiveAt: Date) {
    return { id: invoice.id, studentId: invoice.studentId, channel: invoice.channel ?? "PERSONAL", obligationCode: invoice.obligationCodeSnapshot, period: invoice.billingMonth, issuedTotal: BigInt(invoice.obligationTotalSnapshot).toString(), vatTotal: (invoice.lines ?? []).reduce((total: bigint, line: any) => total + BigInt(line.vatAmount ?? 0), 0n).toString(), deductionTotal: (invoice.lines ?? []).reduce((total: bigint, line: any) => total + BigInt(line.deductionAmount ?? 0), 0n).toString(), carriedCredit: invoice.kind !== "SETTLEMENT" && BigInt(invoice.obligationTotalSnapshot) < 0n ? (-BigInt(invoice.obligationTotalSnapshot)).toString() : "0", actualReceipt: invoice.receipt ? BigInt(invoice.receipt.actualAmount).toString() : invoice.settlementTransferTo ? BigInt(invoice.settlementTransferTo.amount).toString() : "0", outcome: invoice.receipt?.outcome ?? (invoice.settlementTransferTo ? "EXACT" : null), outstanding: outstanding.toString(), state: invoice.status, effectiveAt: effectiveAt.toISOString(), paymentInstruction: { receivingBank: invoice.receivingBankSnapshot, accountNumber: invoice.accountNumberSnapshot, accountHolderName: invoice.accountHolderNameSnapshot, transferContent: invoice.transferContentSnapshot } };
  }
  async parentObligations(schoolId: string, studentIds: string[], invoiceId?: string) {
    schoolId = this.school(schoolId);
    if (!studentIds.length) return invoiceId ? null : [];
    const invoices = await this.prisma.invoice.findMany({
      where: { schoolId, studentId: { in: studentIds }, status: { in: ["ISSUED", "CLOSED", "CANCELLED"] } },
      include: {
        receipt: true,
        settlementTransferTo: true,
        debtTransfersFrom: { select: { amount: true, createdAt: true } },
        settlementDifference: { select: { signedAmount: true, carries: { select: { amount: true } } } },
        coverageFacts: { select: { issuedCoverage: { select: { reversalRequests: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } } } } } },
        lines: { select: { vatAmount: true, deductionAmount: true } },
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    });
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const issuedSuccessors = new Set(invoices.filter((invoice) => ["ISSUED", "CLOSED"].includes(invoice.status) && invoice.revisesInvoiceId).map((invoice) => invoice.revisesInvoiceId!));
    const result: ReturnType<FinanceService["parentObligationDto"]>[] = [];
    for (const invoice of invoices) {
      // A revision DRAFT is not effective; its issued source remains the Parent record until replacement issue.
      if (invoice.status === "CANCELLED" || issuedSuccessors.has(invoice.id) || (invoiceId && invoice.id !== invoiceId)) continue;
      const transferred = invoice.debtTransfersFrom.reduce((sum: bigint, item: any) => sum + BigInt(item.amount), 0n);
      const outstanding = invoice.status === "ISSUED" ? BigInt(invoice.obligationTotalSnapshot ?? 0n) - transferred : 0n;
       const effectiveAt = [invoice.issuedAt, invoice.receipt?.postedAt, invoice.settlementTransferTo?.createdAt, ...invoice.debtTransfersFrom.map((item: any) => item.createdAt)]
         .filter((item): item is Date => item instanceof Date)
         .reduce((latest, item) => item > latest ? item : latest);
      let lineage: any = invoice;
      let unresolvedCoverage = false;
      let unresolvedNormalSettlement = false;
      while (lineage) {
        unresolvedCoverage ||= lineage.coverageFacts.some((fact: any) => fact.issuedCoverage?.reversalRequests.length);
        const difference = lineage.settlementDifference;
        if (difference) {
          const carried = difference.carries.reduce((total: bigint, carry: any) => total + BigInt(carry.amount), 0n);
          unresolvedNormalSettlement ||= (BigInt(difference.signedAmount) < 0n ? -BigInt(difference.signedAmount) : BigInt(difference.signedAmount)) > carried;
        }
        lineage = lineage.revisesInvoiceId ? byId.get(lineage.revisesInvoiceId) : undefined;
      }
      let visible = invoice.status === "ISSUED" && outstanding !== 0n;
      if (invoice.status === "CLOSED") {
        const policy = await this.prisma.parentAccessPolicyVersion.findFirst({ where: { schoolId, effectiveFrom: { lte: effectiveAt } }, orderBy: { effectiveFrom: "desc" } });
        const expiresAt = new Date(effectiveAt);
        expiresAt.setUTCMonth(expiresAt.getUTCMonth() + (policy?.closedRetentionMonths ?? 12));
        visible = unresolvedCoverage || unresolvedNormalSettlement || new Date() < expiresAt;
      }
      if (visible) result.push(this.parentObligationDto(invoice, invoice.status === "ISSUED" ? outstanding : 0n, effectiveAt));
    }
    return invoiceId ? result[0] ?? null : result;
  }
  async bankAccounts(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const accounts = await this.prisma.bankAccount.findMany({ where: { schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } });
    return { accounts: accounts.filter((account) => account.lifecycleTransitions[0]?.status === "ACTIVE").map((account) => ({ id: account.id, kind: account.kind, receivingBank: account.receivingBank, accountNumber: account.accountNumber, accountHolderName: account.accountHolderName })) };
  }
  async invoice(identityId: string, schoolId: string, invoiceId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: this.invoiceInclude });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    return this.invoiceWithNotice(this.prisma, invoice);
  }
  // A payment notice is every Invoice of the Student in the run; each part keeps its own settlement.
  private async invoiceWithNotice(client: any, invoice: any) {
    const parts = await client.invoice.findMany({ where: { schoolId: invoice.schoolId, studentId: invoice.studentId, collectionRunId: invoice.collectionRunId, status: { not: "CANCELLED" } }, include: this.invoiceInclude, orderBy: [{ channel: "asc" }, { createdAt: "asc" }] });
    const classroom = invoice.classIdSnapshot ? await client.class?.findFirst({ where: { id: invoice.classIdSnapshot, schoolId: invoice.schoolId }, select: { defaultBankAccountId: true, defaultSchoolBankAccountId: true } }) : null;
    // Server-owned totals of the notice (the browser never adds money): every live part, and the issued, still-unsettled parts the Parent is asked to pay.
    const live = (parts.length ? parts : [invoice]).filter((part: any) => part.id !== invoice.revisesInvoiceId && !(part.revisesInvoiceId && part.status === "DRAFT" && part.id !== invoice.id));
    const noticeTotal = live.reduce((total: bigint, part: any) => total + BigInt(part.total), 0n).toString();
    const paymentTotal = live.filter((part: any) => this.paymentImageAvailable(part) && part.issuedAt).reduce((total: bigint, part: any) => total + BigInt(part.obligationTotalSnapshot ?? 0), 0n).toString();
    return { ...this.invoiceDto(invoice), paymentTotal, noticeTotal, notice: { classDefaultBankAccountId: classroom?.defaultBankAccountId ?? null, classDefaultSchoolBankAccountId: classroom?.defaultSchoolBankAccountId ?? null, invoices: parts.map((part: any) => this.invoiceDto(part)) } };
  }
  private currentBillingMonth(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(now);
    return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
  }
  // No month asked for: the latest month that still has issued Invoices, else the current month. "ALL" lists every month.
  private async receiptQueueFilters(schoolId: string, query: any) {
    const schoolYearId = query?.schoolYearId ? this.identifier(query.schoolYearId, "schoolYearId") : null;
    const billingMonth = query?.billingMonth === "ALL" ? "ALL" : query?.billingMonth == null || query.billingMonth === "" ? (await this.receiptQueueMonths(schoolId, schoolYearId))[0] ?? this.currentBillingMonth() : this.month(query.billingMonth);
    const classIdSnapshot = query?.classIdSnapshot ? officialClassFilter(query.classIdSnapshot) ?? this.identifier(query.classIdSnapshot, "classIdSnapshot") : null;
    const student = query?.student == null || query.student === "" ? null : this.text(query.student, "student", false, 100);
    const direction = query?.direction == null || query.direction === "" ? null : query.direction === "COLLECT" || query.direction === "REFUND" ? query.direction as "COLLECT" | "REFUND" : (() => { throw validation("direction", "Loại không hợp lệ."); })();
    const bankAccountId = query?.bankAccountId ? this.identifier(query.bankAccountId, "bankAccountId") : null;
    return { schoolYearId, billingMonth, classIdSnapshot, student, direction, bankAccountId };
  }
  private async receiptQueueMonths(schoolId: string, schoolYearId: string | null) {
    const months = await this.prisma.invoice.findMany({ where: { schoolId, status: "ISSUED", debtTransfersFrom: { none: {} }, ...(schoolYearId ? { schoolYearId } : {}) }, distinct: ["billingMonth"], select: { billingMonth: true }, orderBy: { billingMonth: "desc" } });
    return months.map((item) => item.billingMonth);
  }
  private receiptQueueCursor(value: unknown, filters: Awaited<ReturnType<FinanceService["receiptQueueFilters"]>>) {
    if (value == null || value === "") return null;
    try {
      const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
      if (!uuid.test(parsed?.id) || JSON.stringify(parsed.filters) !== JSON.stringify(filters)) throw new Error();
      return { id: parsed.id as string };
    } catch { throw validation("cursor", "Con trỏ không hợp lệ."); }
  }
  private receiptQueueDto(invoice: any, transferred = 0n) {
    return { id: invoice.id, channel: invoice.channel ?? "PERSONAL", obligationCode: invoice.obligationCodeSnapshot, account: this.accountDto(invoice), collectionRunId: invoice.collectionRunId, student: { id: invoice.studentId, code: invoice.studentCodeSnapshot, name: invoice.studentNameSnapshot }, class: { id: invoice.classIdSnapshot ?? EXTRACURRICULAR_ONLY, name: classLabel(invoice.classNameSnapshot) }, schoolYearId: invoice.schoolYearId, billingMonth: invoice.billingMonth, issuedAt: invoice.issuedAt.toISOString(), outstanding: (BigInt(invoice.obligationTotalSnapshot) - transferred).toString(), direction: BigInt(invoice.obligationTotalSnapshot) < 0n ? "REFUND" as const : "COLLECT" as const, status: "ISSUED" as const };
  }
  // The two parts of one Student's monthly notice stay adjacent, school account first: Student code, Student, month, channel, id.
  private static receiptQueueOrder = [{ studentCodeSnapshot: "asc" as const }, { studentId: "asc" as const }, { billingMonth: "asc" as const }, { channel: "asc" as const }, { id: "asc" as const }];
  private receiptQueueAfter(row: { id: string; studentId: string; studentCodeSnapshot: string; billingMonth: string; channel: string }) {
    const student = { studentCodeSnapshot: row.studentCodeSnapshot, studentId: row.studentId, billingMonth: row.billingMonth };
    return { OR: [
      { studentCodeSnapshot: { gt: row.studentCodeSnapshot } },
      { studentCodeSnapshot: row.studentCodeSnapshot, studentId: { gt: row.studentId } },
      { studentCodeSnapshot: row.studentCodeSnapshot, studentId: row.studentId, billingMonth: { gt: row.billingMonth } },
      ...(row.channel === "SCHOOL" ? [{ ...student, channel: "PERSONAL" as const }] : []),
      { ...student, channel: row.channel, id: { gt: row.id } },
    ] };
  }
  async receiptQueue(identityId: string, schoolId: string, query: any = {}) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const filters = await this.receiptQueueFilters(schoolId, query);
    if (filters.schoolYearId && !await this.prisma.schoolYear.findFirst({ where: { id: filters.schoolYearId, schoolId }, select: { id: true } })) throw validation("schoolYearId", "Năm học không thuộc Trường đang chọn.");
    if (filters.bankAccountId && !await this.prisma.bankAccount.findFirst({ where: { id: filters.bankAccountId, schoolId }, select: { id: true } })) throw validation("bankAccountId", "Tài khoản nhận không thuộc Trường đang chọn.");
    const limit = query?.limit == null ? 25 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw validation("limit", "Giới hạn phải từ 1 đến 100.");
    const cursor = this.receiptQueueCursor(query?.cursor, filters);
    const baseWhere: any = { schoolId, status: "ISSUED", debtTransfersFrom: { none: {} }, ...(filters.billingMonth === "ALL" ? {} : { billingMonth: filters.billingMonth }), ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}), ...(filters.classIdSnapshot ? { classIdSnapshot: filters.classIdSnapshot === EXTRACURRICULAR_ONLY ? null : filters.classIdSnapshot } : {}), ...(filters.bankAccountId ? { bankAccountIdSnapshot: filters.bankAccountId } : {}), ...(filters.student ? { OR: [{ studentCodeSnapshot: { contains: filters.student, mode: "insensitive" } }, { studentNameSnapshot: { contains: filters.student, mode: "insensitive" } }] } : {}), ...(filters.direction ? { obligationTotalSnapshot: filters.direction === "REFUND" ? { lt: 0n } : { gte: 0n } } : {}) };
    const after = cursor ? await this.prisma.invoice.findFirst({ where: { ...baseWhere, id: cursor.id }, select: { id: true, studentId: true, studentCodeSnapshot: true, billingMonth: true, channel: true } }) : null;
    if (cursor && !after) throw validation("cursor", "Con trỏ không thuộc kết quả hiện tại.");
    const where = { ...baseWhere, ...(after ? { AND: [this.receiptQueueAfter(after)] } : {}) };
    const invoices = await this.prisma.invoice.findMany({ where, select: { id: true, studentId: true, collectionRunId: true, channel: true, studentCodeSnapshot: true, studentNameSnapshot: true, classIdSnapshot: true, classNameSnapshot: true, schoolYearId: true, billingMonth: true, issuedAt: true, obligationTotalSnapshot: true, obligationCodeSnapshot: true, bankAccountIdSnapshot: true, receivingBankSnapshot: true, receivingBankBinSnapshot: true, accountNumberSnapshot: true, accountHolderNameSnapshot: true }, orderBy: FinanceService.receiptQueueOrder, take: limit + 1 });
    const page = invoices.slice(0, limit), last = page.at(-1);
    const transfers = page.length ? await this.prisma.debtTransfer.groupBy({ by: ["sourceInvoiceId"], where: { schoolId, sourceInvoiceId: { in: page.map((invoice) => invoice.id) } }, _sum: { amount: true } }) : [];
    const transferred = new Map(transfers.map((item) => [item.sourceInvoiceId, BigInt(item._sum.amount ?? 0)]));
    return { invoices: page.map((invoice) => this.receiptQueueDto(invoice, transferred.get(invoice.id))), filters, meta: { limit, nextCursor: invoices.length > limit && last ? Buffer.from(JSON.stringify({ id: last.id, filters })).toString("base64url") : null } };
  }
  async receiptQueueDetail(identityId: string, schoolId: string, invoiceId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, schoolId, status: "ISSUED", debtTransfersFrom: { none: {} } }, select: { id: true, channel: true, studentCodeSnapshot: true, studentNameSnapshot: true, obligationTotalSnapshot: true, obligationCodeSnapshot: true, bankAccountIdSnapshot: true, receivingBankSnapshot: true, receivingBankBinSnapshot: true, accountNumberSnapshot: true, accountHolderNameSnapshot: true } });
    if (!invoice) throw new NotFoundException({ code: "RECEIPT_QUEUE_INVOICE_UNAVAILABLE", message: "Hóa đơn không còn có thể thu tiền." });
    const transferred = await this.prisma.debtTransfer.aggregate({ where: { schoolId, sourceInvoiceId: invoice.id }, _sum: { amount: true } });
    return { id: invoice.id, channel: invoice.channel, obligationCode: invoice.obligationCodeSnapshot, account: this.accountDto(invoice), student: { code: invoice.studentCodeSnapshot, name: invoice.studentNameSnapshot }, outstanding: (BigInt(invoice.obligationTotalSnapshot ?? 0) - BigInt(transferred._sum.amount ?? 0)).toString(), direction: BigInt(invoice.obligationTotalSnapshot ?? 0) < 0n ? "REFUND" as const : "COLLECT" as const, status: "ISSUED" as const };
  }
  async receiptQueueClasses(identityId: string, schoolId: string, query: any = {}) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const filters = await this.receiptQueueFilters(schoolId, query);
    const scope = { schoolId, status: "ISSUED" as const, debtTransfersFrom: { none: {} }, ...(filters.billingMonth === "ALL" ? {} : { billingMonth: filters.billingMonth }), ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}) };
    const values = await this.prisma.invoice.findMany({ where: scope, distinct: ["classIdSnapshot", "classNameSnapshot"], select: { classIdSnapshot: true, classNameSnapshot: true }, orderBy: { classNameSnapshot: "asc" } });
    // Receiving-account filter options: each account snapshotted on the queue's Invoices, named by its latest snapshot.
    const accounts = await this.prisma.invoice.findMany({ where: { ...scope, bankAccountIdSnapshot: { not: null } }, distinct: ["bankAccountIdSnapshot"], select: { bankAccountIdSnapshot: true, channel: true, receivingBankSnapshot: true, receivingBankBinSnapshot: true, accountNumberSnapshot: true, accountHolderNameSnapshot: true }, orderBy: [{ bankAccountIdSnapshot: "asc" }, { issuedAt: "desc" }] });
    return {
      classes: values.map((item) => ({ id: item.classIdSnapshot ?? EXTRACURRICULAR_ONLY, name: classLabel(item.classNameSnapshot) })),
      months: await this.receiptQueueMonths(schoolId, filters.schoolYearId),
      accounts: accounts.map((item) => this.accountDto(item)).filter((item) => item !== null).sort((a, b) => (a.kind === b.kind ? `${a.bankCode} ${a.accountHolderName}`.localeCompare(`${b.bankCode} ${b.accountHolderName}`, "vi") : a.kind === "SCHOOL" ? -1 : 1)),
      filters: { schoolYearId: filters.schoolYearId, billingMonth: filters.billingMonth },
    };
  }
  private invoiceInclude: any = { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }], include: { promotionApplications: { orderBy: { ordinal: "asc" } } } }, replacementInvoices: { select: { id: true }, take: 1 }, receipt: { include: { difference: true } }, payout: true, settlementTransferTo: { include: { sourceReceipt: { select: { postedAt: true } } } }, settlementCarries: { orderBy: { createdAt: "asc" } }, debtTransfersFrom: { select: { targetInvoiceId: true, amount: true, reason: true, createdAt: true } }, debtTransfersTo: { orderBy: { createdAt: "asc" } }, coverageFacts: { include: { issuedCoverage: true }, orderBy: [{ billingMonth: "asc" }, { receivableId: "asc" }] } };
  async transferDebt(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId);
    const sourceInvoiceId = this.identifier(body?.sourceInvoiceId, "sourceInvoiceId"); const targetInvoiceId = this.identifier(body?.targetInvoiceId, "targetInvoiceId");
    if (sourceInvoiceId === targetInvoiceId) throw validation("targetInvoiceId", "Hóa đơn đích phải khác hóa đơn nguồn.");
    const amount = this.debtAmount(body?.amount); const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.debtTransfer, key, operationId, { sourceInvoiceId, targetInvoiceId, amount: amount.toString(), reason }, async (tx, operation) => {
      for (const id of [sourceInvoiceId, targetInvoiceId].sort()) await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${id}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const [source, target] = await Promise.all([tx.invoice.findFirst({ where: { id: sourceInvoiceId, schoolId } }), tx.invoice.findFirst({ where: { id: targetInvoiceId, schoolId } })]);
      if (!source || !target) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn nguồn hoặc đích." });
      if (source.status !== "ISSUED" || target.status !== "DRAFT" || source.studentId !== target.studentId || source.schoolYearId !== target.schoolYearId)
        throw new ConflictException({ code: "DEBT_TRANSFER_GRAPH_CONFLICT", message: "Nguồn phải đang mở và đích nháp cùng học sinh, năm học." });
      if (source.channel !== target.channel) throw new ConflictException({ code: "DEBT_TRANSFER_CHANNEL_MISMATCH", message: "Chỉ chuyển công nợ sang hóa đơn thu vào cùng loại tài khoản." });
      const [targetRun, targetYear] = await Promise.all([this.lockRun(tx, schoolId, target.collectionRunId), this.lockYear(tx, schoolId, target.schoolYearId)]);
      if (targetRun.status === "CLOSED" || targetYear.closedAt) throw new ConflictException({ code: "DEBT_TRANSFER_TARGET_CLOSED", message: "Đợt thu hoặc năm học của hóa đơn đích đã đóng." });
      return this.postDebtTransfer(tx, schoolId, identityId, actor, operation, source, target, amount, reason);
    });
  }
  // Shared by the single transfer and the run-level manual transfer: validates the source's coverage and outstanding, then writes line, DebtTransfer, ledger and audit.
  private async postDebtTransfer(tx: any, schoolId: string, identityId: string, actor: any, operation: string, source: any, target: any, amount: bigint | null, reason: string) {
    if (await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId: source.id } })) throw new ConflictException({ code: "DEBT_TRANSFER_COVERAGE_SOURCE_FORBIDDEN", message: "Hóa đơn nguồn có gói nộp trước nên không thể chuyển công nợ." });
    const prior = await tx.debtTransfer.aggregate({ where: { schoolId, sourceInvoiceId: source.id }, _sum: { amount: true } });
    const outstanding = BigInt(source.obligationTotalSnapshot) - BigInt(prior._sum.amount ?? 0);
    amount ??= outstanding;
    if (amount <= 0n || amount > outstanding) throw new ConflictException({ code: "DEBT_TRANSFER_EXCEEDS_OUTSTANDING", message: "Số tiền chuyển vượt công nợ còn lại." });
    const line = await tx.invoiceLine.create({ data: { schoolId, invoiceId: target.id, kind: "PRIOR_DEBT", receivableNameSnapshot: "Công nợ kỳ trước", unitLabelSnapshot: "khoản", defaultUnitPriceSnapshot: amount, unitPrice: amount, quantity: 1, amount, grossAmount: amount, netAmount: amount, source: { type: "PRIOR_DEBT", sourceInvoiceId: source.id }, sourceReason: reason, sourceActorIdentityId: identityId, sourceMembershipId: actor.membershipId, sourceRecordedAt: new Date(), sourceProvenance: { sourceInvoiceId: source.id, amount: amount.toString(), operationId: operation } } });
    const transfer = await tx.debtTransfer.create({ data: { schoolId, studentId: source.studentId, schoolYearId: source.schoolYearId, sourceInvoiceId: source.id, targetInvoiceId: target.id, targetLineId: line.id, amount, reason, actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation } });
    await this.ledger(tx, source, "DEBT_TRANSFER_POSTED", amount, { debtTransferId: transfer.id, targetInvoiceId: target.id, targetLineId: line.id, reason }, transfer.createdAt);
    const outcome = { id: transfer.id, sourceInvoiceId: source.id, targetInvoiceId: target.id, amount: amount.toString(), sourceOutstanding: (outstanding - amount).toString(), targetLineId: line.id };
    await this.audit(tx, schoolId, identityId, actor.membershipId, "PRIOR_DEBT_TRANSFERRED", operation, { sourceInvoiceId: source.id, outstanding: outstanding.toString() }, outcome, reason);
    return outcome;
  }
  // Unpaid ISSUED notices of earlier CLOSED MONTHLY runs (same School and SchoolYear) whose Student has a live normal Invoice in this run.
  private async priorDebtSources(db: any, schoolId: string, run: any, onlyIds?: string[]) {
    if (run.status !== "GENERATED" || run.type !== "MONTHLY") return [];
    const mine = await db.invoice.findMany({ where: { schoolId, collectionRunId: run.id, revisesInvoiceId: null, status: { not: "CANCELLED" } }, select: { studentId: true } });
    const students = new Set<string>(mine.map((item: any) => item.studentId));
    if (!students.size) return [];
    const sources = await db.invoice.findMany({ where: { schoolId, schoolYearId: run.schoolYearId, status: "ISSUED", receipt: null, payout: null, settlementTransferTo: null, coverageFacts: { none: {} }, studentId: { in: [...students] }, ...(onlyIds ? { id: { in: onlyIds } } : {}), collectionRun: { type: "MONTHLY", status: "CLOSED", billingMonth: { lt: run.billingMonth } } }, include: { debtTransfersFrom: { select: { amount: true } } }, orderBy: FinanceService.receiptQueueOrder });
    return sources.map((source: any) => ({ source, outstanding: BigInt(source.obligationTotalSnapshot ?? 0) - source.debtTransfersFrom.reduce((sum: bigint, item: any) => sum + BigInt(item.amount), 0n) })).filter((item: any) => item.outstanding > 0n);
  }
  async priorDebts(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({ where: { id: runId, schoolId } });
    if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
    const rows = await this.priorDebtSources(this.prisma, schoolId, run);
    // The total is server-owned so the confirmation never adds money in the browser.
    return { total: rows.reduce((sum: bigint, row: any) => sum + BigInt(row.outstanding), 0n).toString(), debts: rows.map(({ source, outstanding }: any) => ({ sourceInvoiceId: source.id, student: { id: source.studentId, code: source.studentCodeSnapshot, name: source.studentNameSnapshot }, className: classLabel(source.classNameSnapshot), billingMonth: source.billingMonth, channel: source.channel ?? "PERSONAL", account: this.accountDto(source), outstanding: outstanding.toString(), obligationCode: source.obligationCodeSnapshot })) };
  }
  // Accountant-initiated, all or nothing: each source's whole outstanding becomes a PRIOR_DEBT line on the same-channel DRAFT part of the Student's notice in this run.
  async transferPriorDebts(identityId: string, schoolId: string, runId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    if (!Array.isArray(body?.sourceInvoiceIds) || body.sourceInvoiceIds.length < 1 || body.sourceInvoiceIds.length > 500) throw validation("sourceInvoiceIds", "Chọn từ 1 đến 500 hóa đơn.");
    const ids = [...new Set<string>(body.sourceInvoiceIds.map((id: unknown) => this.identifier(id, "sourceInvoiceIds")))].sort();
    return this.mutate(actor, identityId, schoolId, routes.priorDebtTransfer, key, operationId, { runId, sourceInvoiceIds: ids }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId); const year = await this.lockYear(tx, schoolId, run.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      if (run.status !== "GENERATED") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ chuyển công nợ khi đợt thu đã tạo hóa đơn." });
      for (const id of ids) await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${id}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const found = new Map<string, bigint>((await this.priorDebtSources(tx, schoolId, run, ids)).map(({ source, outstanding }: any) => [source.id, outstanding] as [string, bigint]));
      const sources = await tx.invoice.findMany({ where: { schoolId, id: { in: ids } }, orderBy: { id: "asc" } });
      if (sources.length !== ids.length) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn nguồn." });
      const transferred: { sourceInvoiceId: string; targetInvoiceId: string; amount: string }[] = []; let total = 0n;
      for (const source of sources) {
        const amount = found.get(source.id);
        if (amount === undefined) throw new ConflictException({ code: "PRIOR_DEBT_NOT_TRANSFERABLE", message: "Hóa đơn không còn đủ điều kiện chuyển công nợ vào đợt này." });
        const live = await tx.invoice.findFirst({ where: { schoolId, collectionRunId: run.id, studentId: source.studentId, revisesInvoiceId: null, status: { not: "CANCELLED" } }, orderBy: [{ channel: "asc" }, { createdAt: "asc" }] });
        const target = await this.channelDraft(tx, schoolId, live, source.channel);
        if (target.status !== "DRAFT") throw new ConflictException({ code: "INVOICE_CHANNEL_PART_NOT_DRAFT", message: `Phần thu vào ${source.channel === "SCHOOL" ? "tài khoản trường" : "tài khoản cá nhân"} đã phát hành; không thể chuyển công nợ vào.` });
        const [yyyy, mm] = source.billingMonth.split("-");
        const outcome = await this.postDebtTransfer(tx, schoolId, identityId, actor, operation, source, target, amount, `Chuyển công nợ tháng ${mm}/${yyyy}`);
        transferred.push({ sourceInvoiceId: source.id, targetInvoiceId: target.id, amount: outcome.amount }); total += amount;
      }
      return { transferred, total: total.toString() };
    });
  }
  async closeInvoice(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const actualAmount = this.actualAmount(body?.actualAmount);
    return this.mutate(actor, identityId, schoolId, routes.closeInvoice, key, operationId, { invoiceId, actualAmount: actualAmount.toString() }, async (tx, operation) => {
      // Lock order is School (mutate), Invoice, then any source Difference rows.
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (invoice.status !== "ISSUED") throw new ConflictException({ code: "INVOICE_NOT_ISSUED", message: "Chỉ hóa đơn đã phát hành mới được ghi thực nhận." });
      if (BigInt(invoice.obligationTotalSnapshot) < 0n) throw new ConflictException({ code: "INVOICE_REFUND_REQUIRES_PAYOUT", message: "Phiếu hoàn tiền được đóng bằng ghi nhận đã chi, không ghi thực nhận." });
      await this.postReceipt(tx, schoolId, invoice, actualAmount);
      const closed = await tx.invoice.findFirstOrThrow({ where: { id: invoice.id, schoolId }, include: this.invoiceInclude });
      const result = this.invoiceDto(closed);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_RECEIPT_POSTED", operation, { id: invoice.id, status: "ISSUED" }, result);
      return result;
    });
  }
  // Posts the Receipt of one locked ISSUED Invoice, its settlement difference and any promotional coverage.
  private async postReceipt(tx: any, schoolId: string, invoice: any, actualAmount: bigint) {
    const invoiceId = invoice.id;
      const transferred = await tx.debtTransfer.aggregate({ where: { schoolId, sourceInvoiceId: invoice.id }, _sum: { amount: true } });
      const issuedAmount = BigInt(invoice.obligationTotalSnapshot) - BigInt(transferred._sum.amount ?? 0);
      // Canonical difference: unpaid obligation is positive; excess receipt is negative.
      const signedAmount = issuedAmount - actualAmount;
      const facts = await tx.invoicePromotionCoverageFact.findMany({ where: { schoolId, invoiceId }, orderBy: { id: "asc" } });
      if (facts.length && signedAmount !== 0n) throw new ConflictException({ code: "COVERAGE_EXACT_AMOUNT_REQUIRED", message: "Hóa đơn có gói nộp trước chỉ được ghi thực nhận đúng bằng số phải thu." });
      if (facts.length) {
        await this.verifyInvoiceCoverageFacts(tx, schoolId, invoice, facts);
      }
      const outcome = signedAmount === 0n ? "EXACT" : signedAmount > 0n ? "SHORTFALL" : "OVERPAYMENT";
       const receipt = await tx.receipt.create({ data: { schoolId, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, invoiceId: invoice.id, actualAmount, outcome } });
       await this.ledger(tx, invoice, "RECEIPT_POSTED", actualAmount, { receiptId: receipt.id, outcome });
       if (signedAmount !== 0n) {
         const difference = await tx.settlementDifference.create({ data: { schoolId, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, invoiceId: invoice.id, receiptId: receipt.id, signedAmount } });
         await this.ledger(tx, invoice, "SETTLEMENT_DIFFERENCE_POSTED", signedAmount, { settlementDifferenceId: difference.id, receiptId: receipt.id, outcome }, difference.createdAt);
       }
       await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CLOSED" } });
       for (const fact of facts) {
         // Coverage carries the VAT rate billed on its receivable's source line, so a refund can return the refunded VAT.
         const sourceLine = await tx.invoiceLine.findFirst({ where: { schoolId, invoiceId: invoice.id, receivableId: fact.receivableId, kind: "NORMAL" }, orderBy: { id: "asc" }, select: { vatRateSnapshot: true } });
         const rate = sourceLine ? sourceLine.vatRateSnapshot : vatRate((await tx.receivable.findFirstOrThrow({ where: { id: fact.receivableId, schoolId }, select: { taxCategory: true } })).taxCategory);
         const paidNet = BigInt(fact.originalPrice) - BigInt(fact.reduction); const coverageVat = vatAmount(paidNet, rate);
         const coverage = await tx.$queryRaw<Array<{ id: string; issuedAt: Date }>>`INSERT INTO "StudentPromotionalCoverage" ("schoolId", "studentId", "schoolYearId", "receivableId", "billingMonth", "sourceFactId", "sourceInvoiceId", "sourceReceiptId", "policyId", "versionId", "originalPrice", "reduction", "vatRateSnapshot", "vatAmount", "serviceStart", "serviceEnd", "calendarEffectiveFrom", "timezone") VALUES (${schoolId}::uuid, ${fact.studentId}::uuid, ${fact.schoolYearId}::uuid, ${fact.receivableId}::uuid, ${fact.billingMonth}, ${fact.id}::uuid, ${invoice.id}::uuid, ${receipt.id}::uuid, ${fact.policyId}::uuid, ${fact.versionId}::uuid, ${fact.originalPrice}, ${fact.reduction}, ${rate}::integer, ${coverageVat}, ${fact.serviceStart}::date, ${fact.serviceEnd}::date, ${fact.calendarEffectiveFrom}::date, ${fact.timezone}) RETURNING "id", "issuedAt"`;
         await this.ledger(tx, invoice, "COVERAGE_ISSUED", paidNet + coverageVat, { coverageId: coverage[0]!.id, sourceFactId: fact.id, receiptId: receipt.id, receivableId: fact.receivableId, coveredBillingMonth: fact.billingMonth, vatRate: rate, vatAmount: coverageVat.toString() }, coverage[0]!.issuedAt);
       }
  }
  // Decision 2026-10-01 D8: the School pays back the whole refund of a negative Invoice in one recorded payout.
  async recordPayout(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const paidOn = this.date(body?.paidOn, "paidOn")!;
    const method = body?.method; if (method !== "BANK_TRANSFER" && method !== "CASH") throw validation("method", "Hình thức chi không hợp lệ.");
    const reference = this.text(body?.reference, "reference", true, 200)!;
    return this.mutate(actor, identityId, schoolId, routes.invoicePayout, key, operationId, { invoiceId, paidOn: paidOn.toISOString(), method, reference }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (invoice.status !== "ISSUED") throw new ConflictException({ code: "INVOICE_NOT_ISSUED", message: "Chỉ phiếu hoàn tiền đã phát hành mới được ghi nhận đã chi." });
      const obligation = BigInt(invoice.obligationTotalSnapshot);
      if (obligation >= 0n || invoice.kind !== "SETTLEMENT") throw new ConflictException({ code: "INVOICE_NOT_REFUND", message: "Chỉ phiếu hoàn tiền quyết toán mới được ghi nhận đã chi." });
      const payout = await tx.invoicePayout.create({ data: { schoolId, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, invoiceId: invoice.id, amount: -obligation, paidOn, method, reference, actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation } });
      await this.ledger(tx, invoice, "PAYOUT_POSTED", obligation, { payoutId: payout.id, paidOn: paidOn.toISOString().slice(0, 10), method, reference }, payout.postedAt);
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CLOSED" } });
      const closed = await tx.invoice.findFirstOrThrow({ where: { id: invoice.id, schoolId }, include: this.invoiceInclude });
      const result = this.invoiceDto(closed);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_PAYOUT_POSTED", operation, { id: invoice.id, status: "ISSUED" }, result, reference);
      return result;
    });
  }
  // Issue works on the payment notice: every DRAFT part of the Student in the run is issued in this Operation,
  // each part into the chosen or Class default account of its channel.
  async issueInvoice(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const requested = body?.personalBankAccountId ?? body?.bankAccountId;
    const personalBankAccountId = requested == null || requested === "" ? null : this.identifier(requested, "personalBankAccountId");
    const schoolBankAccountId = this.requestedSchoolBankAccountId(body);
    const requestedIds: Record<PaymentChannel, string | null> = { SCHOOL: schoolBankAccountId, PERSONAL: personalBankAccountId };
    return this.mutate(actor, identityId, schoolId, routes.issueInvoice, key, operationId, { invoiceId, personalBankAccountId, ...(schoolBankAccountId ? { schoolBankAccountId } : {}) }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, select: { id: true, studentId: true, collectionRunId: true } });
      if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "schoolId" = ${schoolId}::uuid AND "studentId" = ${invoice.studentId}::uuid AND "collectionRunId" = ${invoice.collectionRunId}::uuid ORDER BY "id" FOR UPDATE`;
      const primary = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (primary.status !== "DRAFT") throw new ConflictException({ code: "INVOICE_NOT_DRAFT", message: "Hóa đơn đã được phát hành hoặc không thể phát hành." });
      if (primary.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_REVISION_ISSUE_REQUIRED", message: "Bản điều chỉnh phải được phát hành qua luồng thay thế." });
      const run = await this.lockRun(tx, schoolId, primary.collectionRunId);
      const year = await this.lockYear(tx, schoolId, primary.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      // Run lock (decision 2026-10-08): an earlier MONTHLY run of the School must be closed before this one issues.
      const previousOpen = await this.previousOpenRun(tx, schoolId, run);
      if (previousOpen) throw new ConflictException({ code: "PREVIOUS_RUN_NOT_CLOSED", message: `Cần đóng đợt thu tháng ${monthLabel(previousOpen.billingMonth)} trước khi phát hành hóa đơn của đợt này.` });
      // Decision 2026-10-01 D7, amendment A4: a settlement part may be negative (refund notice); a negative monthly part carries its credit.
      // A settlement part may hold only a carried credit or debt, without lines.
      const issuable = (part: any) => part.lines.length > 0 || (part.kind === "SETTLEMENT" && BigInt(part.total) !== 0n);
      if (!issuable(primary)) throw validation("invoiceId", "Hóa đơn cần ít nhất một dòng để phát hành.");
      // An empty sibling part (all lines removed) is left as an empty DRAFT, like any other empty DRAFT.
      const siblings = await tx.invoice.findMany({ where: { schoolId, studentId: primary.studentId, collectionRunId: primary.collectionRunId, revisesInvoiceId: null, status: "DRAFT", id: { not: primary.id } }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      const parts = [primary, ...siblings.filter(issuable)].sort((a: any, b: any) => (a.channel === b.channel ? 0 : a.channel === "SCHOOL" ? -1 : 1));
      for (const part of parts) this.safeIssuedTotal(part.total);
      const banks = new Map<PaymentChannel, any>();
      for (const part of parts) banks.set(part.channel, await this.issueBankAccount(tx, schoolId, part.channel, requestedIds[part.channel as PaymentChannel], part.classIdSnapshot));
      const now = new Date();
      const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const issuedParts: any[] = [];
      for (const part of parts) {
        const existingFacts = await tx.invoicePromotionCoverageFact.findMany({ where: { schoolId, invoiceId: part.id }, orderBy: [{ billingMonth: "asc" }, { receivableId: "asc" }] });
        if (existingFacts.length) await this.verifyInvoiceCoverageFacts(tx, schoolId, part, existingFacts);
        const applications = await this.recheckPromotion(tx, schoolId, part, run.billingMonth);
        const bank = banks.get(part.channel)!;
        await tx.invoice.update({ where: { id: part.id }, data: { status: "ISSUED", issuedAt: now, obligationCodeSnapshot: await this.obligationCode(tx, schoolId, now), ...this.bankSnapshot(bank), transferContentSnapshot: this.transferContent(part.studentNameSnapshot, part.classNameSnapshot), obligationLinesSnapshot: part.lines.map((line: any) => this.lineDto(line)), obligationTotalSnapshot: part.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn } });
        await this.createIssuedPromotionApplications(tx, schoolId, part.id, applications);
        const issued = await tx.invoice.findFirstOrThrow({ where: { id: part.id, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }], include: { promotionApplications: { orderBy: { ordinal: "asc" } } } } } });
        await this.ledger(tx, issued, "INVOICE_ISSUED", 0n, { issuedAt: now.toISOString() });
        issuedParts.push(issued);
      }
      for (const issued of issuedParts) await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_ISSUED", operation, { id: issued.id, status: "DRAFT" }, this.invoiceDto(issued));
      // Nothing is owed either way: a zero part closes at issue with an exact zero Receipt.
      for (const issued of issuedParts.filter((item: any) => BigInt(item.total) === 0n)) {
        await this.postReceipt(tx, schoolId, issued, 0n);
        await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_CLOSED_AT_ISSUE", operation, { id: issued.id, status: "ISSUED" }, { id: issued.id, status: "CLOSED", total: "0" });
      }
      // Amendment A4: a negative monthly part is not paid back; a zero Receipt closes it and its overpayment
      // difference is carried into the Student's next monthly DRAFT of the same channel and SchoolYear.
      for (const issued of issuedParts.filter((item: any) => item.kind !== "SETTLEMENT" && BigInt(item.total) < 0n)) {
        await this.postReceipt(tx, schoolId, issued, 0n);
        await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_CREDIT_CARRIED_AT_ISSUE", operation, { id: issued.id, status: "ISSUED" }, { id: issued.id, status: "CLOSED", total: issued.total.toString(), carriedCredit: (-BigInt(issued.total)).toString() });
      }
      return this.refreshInvoice(tx, schoolId, primary.id);
    });
  }
  private requestedSchoolBankAccountId(body: any) {
    const requested = body?.schoolBankAccountId;
    return requested == null || requested === "" ? null : this.identifier(requested, "schoolBankAccountId");
  }
  private bankSnapshot(bank: any) {
    return { bankAccountIdSnapshot: bank.id, receivingBankSnapshot: bank.receivingBank, receivingBankBinSnapshot: bank.bankBin, accountNumberSnapshot: bank.accountNumber, accountHolderNameSnapshot: bank.accountHolderName };
  }
  // Each part uses the requested account of its channel or the Class default of that channel; a SCHOOL part may also
  // fall back to the School's only active School account. Every account is re-checked in this School and locked.
  private async issueBankAccount(tx: any, schoolId: string, channel: PaymentChannel, requestedId: string | null, classId: string | null) {
    const active = async (where: any) => (await tx.bankAccount.findMany({ where: { schoolId, kind: channel, ...where }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } })).filter((account: any) => account.lifecycleTransitions[0]?.status === "ACTIVE");
    const school = channel === "SCHOOL";
    const label = school ? "tài khoản trường" : "tài khoản cá nhân";
    // A Student without an official class has no class default; Finance chooses the account at issue.
    const classroom = classId ? await tx.class.findFirst({ where: { id: classId, schoolId }, select: { defaultBankAccountId: true, defaultSchoolBankAccountId: true } }) : null;
    const id = requestedId ?? (school ? classroom?.defaultSchoolBankAccountId : classroom?.defaultBankAccountId) ?? null;
    let bank: any;
    if (id) {
      await tx.$queryRaw`SELECT 1 FROM "BankAccount" WHERE "id" = ${id}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      [bank] = await active({ id });
      if (!bank && requestedId) throw new NotFoundException({ code: "BANK_ACCOUNT_NOT_FOUND", message: `Không tìm thấy ${label} đang hoạt động.` });
    }
    if (!bank && school) {
      await tx.$queryRaw`SELECT 1 FROM "BankAccount" WHERE "schoolId" = ${schoolId}::uuid AND "kind" = 'SCHOOL' ORDER BY "id" FOR UPDATE`;
      const accounts = await active({});
      if (accounts.length === 1) [bank] = accounts;
      else if (!accounts.length) throw new ConflictException({ code: "SCHOOL_BANK_ACCOUNT_REQUIRED", message: "Chưa cấu hình tài khoản trường để thu khoản có thuế." });
      else throw new ConflictException({ code: "SCHOOL_BANK_ACCOUNT_CHOICE_REQUIRED", message: "Chọn tài khoản trường để thu khoản có thuế hoặc đặt tài khoản trường mặc định cho lớp." });
    }
    if (!bank) throw new ConflictException({ code: "PERSONAL_BANK_ACCOUNT_REQUIRED", message: "Chọn tài khoản cá nhân để thu khoản không kê khai hoặc đặt tài khoản mặc định cho lớp." });
    if (bank.transferTemplate !== "{{studentName}} {{className}}") throw new ConflictException({ code: "BANK_ACCOUNT_TEMPLATE_INVALID", message: "Mẫu nội dung chuyển khoản không hợp lệ." });
    return bank;
  }
  async prepareRevision(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.prepareRevision, key, operationId, { invoiceId, reason }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const source = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
       if (!source) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
       if (await tx.debtTransfer.count({ where: { schoolId, OR: [{ sourceInvoiceId: source.id }, { targetInvoiceId: source.id }] } })) throw new ConflictException({ code: "DEBT_TRANSFER_REVISION_FORBIDDEN", message: "Hóa đơn có chuyển công nợ không thể điều chỉnh." });
       if (!["ISSUED", "CLOSED"].includes(source.status) || source.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_NOT_REVISION_SOURCE", message: "Chỉ hóa đơn gốc đã phát hành hoặc đã đóng mới có thể được điều chỉnh." });
       if (source.status === "ISSUED" && await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId: source.id } })) throw new ConflictException({ code: "COVERAGE_REVISION_FORBIDDEN", message: "Hóa đơn có gói nộp trước chưa thu tiền không thể điều chỉnh." });
      const run = await this.lockRun(tx, schoolId, source.collectionRunId);
      const year = await this.lockYear(tx, schoolId, source.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      const existing = await tx.invoice.findFirst({ where: { schoolId, revisesInvoiceId: source.id }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (existing) {
        if (existing.revisionReason !== reason)
          throw new ConflictException({ code: "INVOICE_REVISION_EXISTS", message: "Bản điều chỉnh đã tồn tại với lý do khác." });
        throw new ConflictException({ code: "INVOICE_REVISION_EXISTS", message: "Bản điều chỉnh đã tồn tại. Hãy đối soát Operation trước khi thử lại." });
      }
      const replacement = await tx.invoice.create({ data: {
        schoolId, studentId: source.studentId, collectionRunId: source.collectionRunId, schoolYearId: source.schoolYearId, billingMonth: source.billingMonth,
        rosterAsOf: source.rosterAsOf, studentCodeSnapshot: source.studentCodeSnapshot, studentNameSnapshot: source.studentNameSnapshot,
        enrollmentIdSnapshot: source.enrollmentIdSnapshot, enrollmentLifecycleSnapshot: source.enrollmentLifecycleSnapshot,
        enrollmentEffectiveFromSnapshot: source.enrollmentEffectiveFromSnapshot, enrollmentEndedOnSnapshot: source.enrollmentEndedOnSnapshot,
        classAssignmentIdSnapshot: source.classAssignmentIdSnapshot, classAssignmentEffectiveFromSnapshot: source.classAssignmentEffectiveFromSnapshot,
        classAssignmentEffectiveToSnapshot: source.classAssignmentEffectiveToSnapshot, classIdSnapshot: source.classIdSnapshot, classNameSnapshot: source.classNameSnapshot,
        selectionProvenance: source.selectionProvenance, revisesInvoiceId: source.id, revisionReason: reason, channel: source.channel,
      } });
      // The replacement starts as a copy of the source lines, so Finance edits only what changes. Debt-transfer lines
      // never reach here (an Invoice with a debt transfer cannot be revised); nulls are left out for Prisma Json columns.
      const copied = source.lines.filter((line: any) => line.kind === "NORMAL").map(({ id: _id, invoiceId: _invoiceId, createdAt: _createdAt, updatedAt: _updatedAt, ...line }: any) => Object.fromEntries(Object.entries({ ...line, invoiceId: replacement.id }).filter(([, value]) => value !== null)));
      if (copied.length) await tx.invoiceLine.createMany({ data: copied });
      const outcome = this.invoiceDto(await tx.invoice.findFirstOrThrow({ where: { id: replacement.id, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } }));
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_REVISION_PREPARED", operation, { id: source.id, status: source.status }, outcome, reason);
      return outcome;
    });
  }
  // Decision 2026-10-08: a revision DRAFT never issued has no ledger and left its source untouched, so it is deleted.
  async discardRevision(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.discardRevision, key, operationId, { invoiceId, reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const revision = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { select: { kind: true } } } });
      if (!revision) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (revision.status !== "DRAFT" || !revision.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_NOT_REVISION_DRAFT", message: "Chỉ hủy được bản điều chỉnh chưa phát hành." });
      if (revision.lines.some((line: any) => line.kind === "PRIOR_DEBT")) throw new ConflictException({ code: "REVISION_HAS_PRIOR_DEBT", message: "Bản điều chỉnh đang nhận công nợ chuyển sang nên không hủy được." });
      const run = await this.lockRun(tx, schoolId, revision.collectionRunId);
      if (run.status === "CLOSED") throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      await tx.invoicePromotionCoverageFact.deleteMany({ where: { schoolId, invoiceId } });
      await tx.invoiceLine.deleteMany({ where: { schoolId, invoiceId } });
      await tx.invoice.delete({ where: { id: invoiceId } });
      const outcome = { id: invoiceId, revisesInvoiceId: revision.revisesInvoiceId, discarded: true };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_REVISION_DISCARDED", operation, { id: invoiceId, status: "DRAFT", revisesInvoiceId: revision.revisesInvoiceId, total: revision.total.toString() }, outcome, reason);
      return outcome;
    });
  }
  async issueRevision(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const requested = body?.personalBankAccountId ?? body?.bankAccountId;
    const bankAccountId = requested == null || requested === "" ? null : this.identifier(requested, "personalBankAccountId");
    const schoolBankAccountId = this.requestedSchoolBankAccountId(body);
    return this.mutate(actor, identityId, schoolId, routes.issueRevision, key, operationId, { invoiceId, bankAccountId, ...(schoolBankAccountId ? { schoolBankAccountId } : {}) }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const replacement = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (!replacement) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (replacement.status !== "DRAFT" || !replacement.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_NOT_REVISION_DRAFT", message: "Chỉ bản điều chỉnh nháp mới có thể phát hành thay thế." });
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${replacement.revisesInvoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
       const source = await tx.invoice.findFirst({ where: { id: replacement.revisesInvoiceId, schoolId } });
       if (await tx.debtTransfer.count({ where: { schoolId, OR: [{ sourceInvoiceId: replacement.id }, { targetInvoiceId: replacement.id }, { sourceInvoiceId: replacement.revisesInvoiceId }, { targetInvoiceId: replacement.revisesInvoiceId }] } })) throw new ConflictException({ code: "DEBT_TRANSFER_REVISION_FORBIDDEN", message: "Hóa đơn có chuyển công nợ không thể điều chỉnh." });
       if (!source || !["ISSUED", "CLOSED"].includes(source.status) || source.studentId !== replacement.studentId || source.collectionRunId !== replacement.collectionRunId || source.schoolYearId !== replacement.schoolYearId) throw new ConflictException({ code: "INVOICE_REVISION_GRAPH_CONFLICT", message: "Hóa đơn nguồn không còn hợp lệ để thay thế." });
      const run = await this.lockRun(tx, schoolId, replacement.collectionRunId);
      const year = await this.lockYear(tx, schoolId, replacement.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      if (!replacement.lines.length || replacement.total <= 0n) throw validation("invoiceId", "Hóa đơn cần ít nhất một dòng và tổng VND dương để phát hành.");
      const sourceReceipt = source.status === "CLOSED" ? await tx.receipt.findFirst({ where: { schoolId, invoiceId: source.id } }) : null;
      if (source.status === "CLOSED" && (!sourceReceipt || sourceReceipt.actualAmount !== replacement.total || sourceReceipt.outcome !== "EXACT")) throw new ConflictException({ code: "SETTLEMENT_TRANSFER_AMOUNT_MISMATCH", message: "Bản thay thế phải có nghĩa vụ đúng bằng Receipt nguồn đã xác nhận." });
      this.safeIssuedTotal(replacement.total);
      const bank = await this.issueBankAccount(tx, schoolId, replacement.channel, replacement.channel === "SCHOOL" ? schoolBankAccountId : bankAccountId, replacement.classIdSnapshot);
      const now = new Date(); const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const applications = await this.recheckPromotion(tx, schoolId, replacement, run.billingMonth);
      await tx.invoice.update({ where: { id: replacement.id }, data: { status: "ISSUED", issuedAt: now, obligationCodeSnapshot: await this.obligationCode(tx, schoolId, now), ...this.bankSnapshot(bank), transferContentSnapshot: this.transferContent(replacement.studentNameSnapshot, replacement.classNameSnapshot), obligationLinesSnapshot: replacement.lines.map((line: any) => this.lineDto(line)), obligationTotalSnapshot: replacement.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn } });
       await this.createIssuedPromotionApplications(tx, schoolId, replacement.id, applications);
        if (source.status === "CLOSED") {
           const transfer = await tx.settlementTransfer.create({ data: { schoolId, studentId: source.studentId, schoolYearId: source.schoolYearId, sourceInvoiceId: source.id, sourceReceiptId: sourceReceipt!.id, replacementInvoiceId: replacement.id, amount: sourceReceipt!.actualAmount } });
           await this.ledger(tx, replacement, "SETTLEMENT_TRANSFER_POSTED", sourceReceipt!.actualAmount, { settlementTransferId: transfer.id, sourceInvoiceId: source.id, sourceReceiptId: sourceReceipt!.id, replacementInvoiceId: replacement.id, statusSnapshot: "CLOSED" }, transfer.createdAt);
          await tx.invoice.update({ where: { id: replacement.id }, data: { status: "CLOSED" } });
       }
        await tx.invoice.update({ where: { id: source.id }, data: { status: "CANCELLED" } });
        await this.ledger(tx, source, "INVOICE_CANCELLED", 0n, { replacementInvoiceId: replacement.id, statusSnapshot: "CANCELLED" }, now);
       const issued = await tx.invoice.findFirstOrThrow({ where: { id: replacement.id, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }], include: { promotionApplications: { orderBy: { ordinal: "asc" } } } } } });
       await this.ledger(tx, issued, "INVOICE_ISSUED", 0n, { issuedAt: now.toISOString(), revisesInvoiceId: source.id }, now);
      const outcome = this.invoiceDto(issued);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_REVISION_ISSUED", operation, { sourceInvoiceId: source.id, sourceStatus: source.status }, outcome, replacement.revisionReason ?? undefined);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_CANCELLED_FOR_REVISION", operation, { id: source.id, status: source.status }, { id: source.id, status: "CANCELLED", replacementInvoiceId: replacement.id }, replacement.revisionReason ?? undefined);
      return outcome;
    });
  }
  private async source(tx: any, body: any, invoice: any, identityId: string, membershipId: string) {
    const raw = body?.source;
    if (raw == null) return null;
    if (typeof raw !== "object" || Array.isArray(raw)) throw validation("source", "Nguồn giải thích không hợp lệ.");
    const serviceDate = raw.serviceDate == null ? null : this.text(raw.serviceDate, "source.serviceDate", true, 10);
    if (serviceDate && !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw validation("source.serviceDate", "Ngày dịch vụ không hợp lệ.");
    const attendanceState = raw.attendanceState == null ? null : raw.attendanceState;
    if (attendanceState && !["PRESENT", "ABSENT"].includes(attendanceState)) throw validation("source.attendanceState", "Trạng thái điểm danh không hợp lệ.");
    const pickedUpAt = raw.pickedUpAt == null ? null : this.text(raw.pickedUpAt, "source.pickedUpAt", true, 40);
    if (pickedUpAt && (!/^\d{2}:\d{2}$/.test(pickedUpAt) || Number(pickedUpAt.slice(0, 2)) > 23 || Number(pickedUpAt.slice(3)) > 59)) throw validation("source.pickedUpAt", "Giờ đón phải có dạng HH:MM hợp lệ.");
    const lateCareMinutes = raw.lateCareMinutes == null ? null : raw.lateCareMinutes;
    if (lateCareMinutes != null && (!Number.isInteger(lateCareMinutes) || lateCareMinutes < 0 || lateCareMinutes > 1440)) throw validation("source.lateCareMinutes", "Số phút phải là số nguyên từ 0 đến 1440.");
    if (attendanceState === "ABSENT" && (pickedUpAt || lateCareMinutes != null)) throw validation("source", "Học sinh vắng mặt không thể có giờ đón hoặc trông muộn.");
    if (!serviceDate && !attendanceState && !pickedUpAt && lateCareMinutes == null) throw validation("source", "Cần ít nhất một fact giải thích.");
    const reason = this.text(body?.sourceReason, "sourceReason", true, 500)!;
    const enrollment = await tx.studentEnrollment.findFirst({ where: { id: invoice.enrollmentIdSnapshot, schoolId: invoice.schoolId, studentId: invoice.studentId } });
    if (!enrollment) throw validation("source", "Nguồn không thuộc enrollment của học sinh.");
    if (serviceDate) {
      const businessDate = new Date(`${serviceDate}T00:00:00.000Z`);
      if (Number.isNaN(businessDate.getTime()) || businessDate.toISOString().slice(0, 10) !== serviceDate || businessDate < enrollment.effectiveFrom || (enrollment.endedOn && businessDate >= enrollment.endedOn)) throw validation("source.serviceDate", "Ngày dịch vụ không thuộc thời gian nhập học hiệu lực.");
      const calendar = await tx.schoolCalendarVersion.findFirst({ where: { schoolId: invoice.schoolId, effectiveFrom: { lte: businessDate } }, include: { holidays: true }, orderBy: { effectiveFrom: "desc" } });
      if (!calendar) throw new ConflictException({ code: "SCHOOL_CALENDAR_NOT_CONFIGURED", message: "Trường chưa cấu hình lịch vận hành." });
      if (businessDate.getUTCDay() === 0 || calendar.holidays.some((holiday: any) => holiday.startsOn <= businessDate && holiday.endsOn >= businessDate)) throw validation("source.serviceDate", "Ngày dịch vụ không phải ngày vận hành.");
    }
    return { source: { serviceDate, attendanceState, pickedUpAt, lateCareMinutes }, sourceReason: reason, sourceActorIdentityId: identityId, sourceMembershipId: membershipId, sourceRecordedAt: new Date(), sourceProvenance: { type: "MANUAL_FINANCE_EXPLANATORY_V1", invoiceStudentId: invoice.studentId, enrollmentId: enrollment.id } };
  }
  private async draftInvoice(tx: any, schoolId: string, invoiceId: string) {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    if (invoice.status !== "DRAFT") throw new ConflictException({ code: "INVOICE_NOT_DRAFT", message: "Chỉ được sửa dòng khi hóa đơn ở trạng thái nháp." });
    if (await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId } })) throw new ConflictException({ code: "COVERAGE_FACTS_IMMUTABLE", message: "Hóa đơn đang có gói nộp trước; xóa gói nộp trước trước khi sửa dòng." });
    return invoice;
  }
  private async channelDraft(tx: any, schoolId: string, invoice: any, channel: PaymentChannel) {
    if (invoice.channel === channel) return invoice;
    if (invoice.revisesInvoiceId) throw validation("receivableId", "Bản điều chỉnh chỉ nhận khoản thu cùng kênh thanh toán.");
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "schoolId" = ${schoolId}::uuid AND "studentId" = ${invoice.studentId}::uuid AND "collectionRunId" = ${invoice.collectionRunId}::uuid FOR UPDATE`;
    const sibling = await tx.invoice.findFirst({ where: { schoolId, studentId: invoice.studentId, collectionRunId: invoice.collectionRunId, channel, revisesInvoiceId: null }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
    if (sibling) {
      if (sibling.status !== "DRAFT") throw new ConflictException({ code: "INVOICE_CHANNEL_PART_NOT_DRAFT", message: `Phần thu vào ${channel === "SCHOOL" ? "tài khoản trường" : "tài khoản cá nhân"} đã phát hành; hãy dùng bản điều chỉnh.` });
      if (await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId: sibling.id } })) throw new ConflictException({ code: "COVERAGE_FACTS_IMMUTABLE", message: "Hóa đơn đang có gói nộp trước; xóa gói nộp trước trước khi sửa dòng." });
      return sibling;
    }
    const { id, status, total, channel: _channel, createdAt, lines, issuedAt, revisesInvoiceId, revisionReason, obligationCodeSnapshot, bankAccountIdSnapshot, receivingBankSnapshot, receivingBankBinSnapshot, accountNumberSnapshot, accountHolderNameSnapshot, transferContentSnapshot, obligationLinesSnapshot, obligationTotalSnapshot, financePolicyEffectiveFrom, dueDaysAfterIssueSnapshot, taxTreatmentSnapshot, debtScopeSnapshot, reversalModeSnapshot, dueOn, ...roster } = invoice;
    const created = await tx.invoice.create({ data: { ...roster, selectionProvenance: roster.selectionProvenance ?? Prisma.DbNull, channel } });
    await this.materializeCarries(tx, schoolId, created.id, created.studentId, created.schoolYearId, created.billingMonth, channel);
    return tx.invoice.findFirstOrThrow({ where: { id: created.id, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
  }
  private async refreshInvoice(tx: any, schoolId: string, invoiceId: string) {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: this.invoiceInclude });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    return this.invoiceWithNotice(tx, invoice);
  }
  async addInvoiceLine(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const input = { receivableId: this.identifier(body?.receivableId, "receivableId"), quantity: this.quantity(body?.quantity), unitPrice: body?.unitPrice == null ? null : this.linePrice(body.unitPrice), overrideReason: body?.unitPrice == null ? null : this.text(body?.overrideReason, "overrideReason", true, 500)! };
    return this.mutate(actor, identityId, schoolId, routes.addInvoiceLine, key, operationId, { invoiceId, ...input, unitPrice: input.unitPrice?.toString() ?? null, source: body?.source ?? null, sourceReason: body?.sourceReason ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId);
      await this.lockReceivablesShared(tx, schoolId, [input.receivableId]);
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true } });
      if (!receivable) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
      if (receivable.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu đã ngừng áp dụng.");
      const unitPrice = input.unitPrice ?? receivable.defaultUnitPrice; const amount = this.amount(unitPrice, input.quantity); const source = await this.source(tx, body, invoice, identityId, actor.membershipId);
      // A line is written to the notice part of its receivable's payment channel, created on demand.
      const target = await this.channelDraft(tx, schoolId, invoice, taxChannel(receivable.taxCategory));
      const evaluated = await this.evaluateDraftPromotion(tx, schoolId, target, { receivableId: receivable.id, receivableName: receivable.displayName, amount });
      const deduction = await this.lineProposal(tx, schoolId, target, receivable, unitPrice);
      const netAmount = BigInt(evaluated.netAmount) - deduction.deductionAmount;
      const tax = taxedLine(netAmount, receivable.taxCategory);
      const line = await tx.invoiceLine.create({ data: { schoolId, invoiceId: target.id, sourceKind: "MANUAL", sourceDetail: { addedByMembershipId: actor.membershipId }, receivableId: receivable.id, receivableCodeSnapshot: receivable.code, receivableNameSnapshot: receivable.displayName, unitLabelSnapshot: receivable.unitLabel, defaultUnitPriceSnapshot: receivable.defaultUnitPrice, unitPrice, quantity: input.quantity, grossAmount: BigInt(evaluated.grossAmount), discountAmount: BigInt(evaluated.discountAmount), ...this.deductionData(deduction), netAmount, ...tax, promotionEvaluationProvenance: evaluated.promotionEvaluation, overrideReason: input.overrideReason, ...source } });
      const outcome = await this.refreshInvoice(tx, schoolId, target.id); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_ADDED", operation, null, { line: this.lineDto(line), invoice: outcome }); return outcome;
    });
  }
  async editInvoiceLine(identityId: string, schoolId: string, invoiceId: string, lineId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId"); this.identifier(lineId, "lineId");
    const input = { quantity: this.quantity(body?.quantity), unitPrice: body?.unitPrice == null ? null : this.linePrice(body.unitPrice), overrideReason: body?.unitPrice == null ? null : this.text(body?.overrideReason, "overrideReason", true, 500)! };
    return this.mutate(actor, identityId, schoolId, routes.editInvoiceLine, key, operationId, { invoiceId, lineId, ...input, unitPrice: input.unitPrice?.toString() ?? null, source: body?.source ?? null, sourceReason: body?.sourceReason ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId); const existing = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId, schoolId } });
       if (!existing) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
       if (existing.kind === "PRIOR_DEBT") throw new ConflictException({ code: "PRIOR_DEBT_IMMUTABLE", message: "Dòng công nợ kỳ trước không thể sửa." });
      const unitPrice = input.unitPrice ?? existing.unitPrice;
      if ((existing.deductionSource as any)?.type !== "PREPAID_PACKAGE_V1" && BigInt(existing.refundUnitPriceSnapshot ?? 0) > BigInt(unitPrice)) throw validation("unitPrice", "Đơn giá thu không được thấp hơn giá hoàn trả của phần bớt; hãy sửa phần bớt trước.");
      const overrideReason = input.unitPrice == null ? existing.overrideReason : input.overrideReason;
      const source = body?.source === undefined ? { source: existing.source ?? Prisma.DbNull, sourceReason: existing.sourceReason, sourceActorIdentityId: existing.sourceActorIdentityId, sourceMembershipId: existing.sourceMembershipId, sourceRecordedAt: existing.sourceRecordedAt, sourceProvenance: existing.sourceProvenance ?? Prisma.DbNull } : body.source === null ? { source: Prisma.DbNull, sourceReason: null, sourceActorIdentityId: null, sourceMembershipId: null, sourceRecordedAt: null, sourceProvenance: Prisma.DbNull } : await this.source(tx, body, invoice, identityId, actor.membershipId);
      const amount = this.amount(unitPrice, input.quantity);
      const evaluated = await this.evaluateDraftPromotion(tx, schoolId, invoice, { receivableId: existing.receivableId, receivableName: existing.receivableNameSnapshot, amount });
      const netAmount = BigInt(evaluated.netAmount) - BigInt(existing.deductionAmount ?? 0);
      const line = await tx.invoiceLine.update({ where: { id: lineId }, data: { quantity: input.quantity, unitPrice, grossAmount: BigInt(evaluated.grossAmount), discountAmount: BigInt(evaluated.discountAmount), netAmount, ...taxedLine(netAmount, existing.taxCategorySnapshot ?? "NOT_DECLARED"), promotionEvaluationProvenance: evaluated.promotionEvaluation, overrideReason, ...source } });
      const outcome = await this.refreshInvoice(tx, schoolId, invoiceId); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_EDITED", operation, this.lineDto(existing), { line: this.lineDto(line), invoice: outcome }); return outcome;
    });
  }
  async removeInvoiceLine(identityId: string, schoolId: string, invoiceId: string, lineId: string, key: string, operationId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId"); this.identifier(lineId, "lineId");
    return this.mutate(actor, identityId, schoolId, routes.removeInvoiceLine, key, operationId, { invoiceId, lineId }, async (tx, operation) => {
       await this.draftInvoice(tx, schoolId, invoiceId); const existing = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId, schoolId } }); if (!existing) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
       if (existing.kind === "PRIOR_DEBT") throw new ConflictException({ code: "PRIOR_DEBT_IMMUTABLE", message: "Dòng công nợ kỳ trước không thể xóa." });
      await tx.invoiceLine.delete({ where: { id: lineId } }); const outcome = await this.refreshInvoice(tx, schoolId, invoiceId); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_REMOVED", operation, this.lineDto(existing), outcome); return outcome;
    });
  }
  // Decision 2026-10-01 D5: Finance overwrites the proposed "Bớt" with a reason, or resets it to a fresh proposal.
  async editLineDeduction(identityId: string, schoolId: string, invoiceId: string, lineId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId"); this.identifier(lineId, "lineId");
    const reset = body?.reset === true;
    const input = reset ? null : { deductionQuantity: this.deductionQuantity(body?.deductionQuantity), refundUnitPrice: this.refundPrice(body?.refundUnitPrice), reason: this.text(body?.reason, "reason", false, 500) };
    return this.mutate(actor, identityId, schoolId, routes.lineDeduction, key, operationId, { invoiceId, lineId, reset, deductionQuantity: input?.deductionQuantity ?? null, refundUnitPrice: input?.refundUnitPrice.toString() ?? null, reason: input?.reason ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId);
      const existing = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId, schoolId } });
      if (!existing) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
      if (existing.kind !== "NORMAL") throw new ConflictException({ code: "PRIOR_DEBT_IMMUTABLE", message: "Dòng công nợ kỳ trước không có phần bớt." });
      let fields: any;
      const packageSource = (existing.deductionSource as any)?.type === "PREPAID_PACKAGE_V1" ? existing.deductionSource as any : null;
      if (!input && packageSource) {
        const refund = (await this.packageRefunds(tx, schoolId, invoice.studentId, invoice.enrollmentEndedOnSnapshot ?? new Date(), invoice.id)).find((item: any) => item.source.packageKey === packageSource.packageKey);
        fields = refund ? { refundUnitPriceSnapshot: refund.refundNet, deductionQuantity: 1, proposedDeductionQuantity: 1, deductionAmount: refund.refundNet, deductionSource: refund.source, deductionReason: null } : { refundUnitPriceSnapshot: 0n, deductionQuantity: 0, proposedDeductionQuantity: 0, deductionAmount: 0n, deductionReason: null };
      } else if (!input) {
        const receivable = await tx.receivable.findFirstOrThrow({ where: { id: existing.receivableId, schoolId } });
        fields = { ...this.deductionData(await this.lineProposal(tx, schoolId, invoice, receivable, BigInt(existing.unitPrice))), deductionReason: null };
      } else {
        const proposedUnitPrice = BigInt((existing.deductionSource as any)?.proposedUnitPrice ?? 0);
        const differs = input.deductionQuantity !== existing.proposedDeductionQuantity || input.refundUnitPrice !== proposedUnitPrice;
        if (differs && !input.reason) throw validation("reason", "Nhập lý do khi phần bớt khác số hệ thống đề xuất.");
        if (!packageSource) this.refundWithinPrice(input.refundUnitPrice, BigInt(existing.unitPrice));
        fields = { refundUnitPriceSnapshot: input.refundUnitPrice, deductionQuantity: input.deductionQuantity, deductionAmount: this.amount(input.refundUnitPrice, input.deductionQuantity), deductionReason: differs ? input.reason : null };
        if (packageSource && fields.deductionAmount > BigInt(packageSource.maxRefundNet)) throw new ConflictException({ code: "SETTLEMENT_REFUND_EXCEEDS_PAID", message: "Số hoàn vượt phần học phí nộp trước còn lại chưa hoàn." });
      }
      const netAmount = BigInt(existing.grossAmount) - BigInt(existing.discountAmount) - BigInt(fields.deductionAmount);
      const line = await tx.invoiceLine.update({ where: { id: lineId }, data: { ...fields, netAmount, ...taxedLine(netAmount, existing.taxCategorySnapshot ?? "NOT_DECLARED") } });
      const outcome = await this.refreshInvoice(tx, schoolId, invoiceId);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_DEDUCTION_EDITED", operation, this.lineDto(existing), { line: this.lineDto(line), invoice: outcome }, fields.deductionReason ?? undefined);
      return outcome;
    });
  }
  // Decision 2026-10-07: the review page edits the lines of a notice inline. One command saves every changed line
  // of the notice's DRAFT parts all or nothing; the preview runs the very same work in a transaction that rolls back.
  async editInvoiceLines(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const edits = this.lineEdits(body);
    return this.mutate(actor, identityId, schoolId, routes.editInvoiceLines, key, operationId, { invoiceId, lines: edits.map((edit) => ({ ...edit, unitPrice: edit.unitPrice?.toString() ?? null, deduction: edit.deduction && { ...edit.deduction, refundUnitPrice: edit.deduction.refundUnitPrice.toString() } })) }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      return this.applyLineEdits(tx, schoolId, invoiceId, edits, { identityId, membershipId: actor.membershipId, operation });
    });
  }
  async previewInvoiceLines(identityId: string, schoolId: string, invoiceId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    // Reasons never change an amount, so the preview computes without them; the save requires them.
    const edits = this.lineEdits(body, false);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.transactionActor(tx, schoolId, identityId, actor.membershipId);
        throw new PreviewRollback(await this.applyLineEdits(tx, schoolId, invoiceId, edits, null));
      });
    } catch (error) {
      if (error instanceof PreviewRollback) return error.outcome;
      throw error;
    }
    throw new Error("Preview transaction did not roll back.");
  }
  private async lineErrors<T>(lineId: string, work: () => T | Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw lineFieldErrors(lineId, error);
    }
  }
  private lineEdits(body: any, requireReasons = true): LineEdit[] {
    const items = body?.lines;
    if (!Array.isArray(items) || !items.length || items.length > 200) throw validation("lines", "Cần từ 1 đến 200 dòng thay đổi.");
    const seen = new Set<string>();
    return items.map((item: any) => {
      const lineId = this.identifier(item?.lineId, "lines");
      if (seen.has(lineId)) throw validation("lines", "Mỗi dòng chỉ được gửi một lần.");
      seen.add(lineId);
      try {
        const hasPrice = item.unitPrice != null;
        const hasDeduction = item.deductionQuantity != null || item.refundUnitPrice != null;
        return {
          lineId,
          quantity: item.quantity == null ? null : this.quantity(item.quantity),
          unitPrice: hasPrice ? this.linePrice(item.unitPrice) : null,
          overrideReason: hasPrice ? this.text(item.overrideReason, "overrideReason", requireReasons, 500) : null,
          deduction: hasDeduction ? { deductionQuantity: this.deductionQuantity(item.deductionQuantity), refundUnitPrice: this.refundPrice(item.refundUnitPrice), reason: this.text(item.deductionReason, "deductionReason", false, 500) } : null,
        };
      } catch (error) {
        throw lineFieldErrors(lineId, error);
      }
    });
  }
  // Same rules as editInvoiceLine and editLineDeduction, applied together: the refund price is checked against the final line price.
  private async applyLineEdits(tx: any, schoolId: string, invoiceId: string, edits: LineEdit[], audit: { identityId: string; membershipId: string; operation: string } | null) {
    const opened = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId } });
    if (!opened) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    for (const edit of edits) {
      await this.lineErrors(edit.lineId, async () => {
        const found = await tx.invoiceLine.findFirst({ where: { id: edit.lineId, schoolId }, select: { invoiceId: true } });
        // A line belongs to one part of the same notice: same Student and collection run.
        const part = found && await tx.invoice.findFirst({ where: { id: found.invoiceId, schoolId, studentId: opened.studentId, collectionRunId: opened.collectionRunId }, select: { id: true } });
        if (!part) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
        const invoice = await this.draftInvoice(tx, schoolId, part.id);
        const existing = await tx.invoiceLine.findFirstOrThrow({ where: { id: edit.lineId, schoolId } });
        if (existing.kind !== "NORMAL") throw new ConflictException({ code: "PRIOR_DEBT_IMMUTABLE", message: "Dòng công nợ kỳ trước không thể sửa." });
        const quantity = edit.quantity ?? existing.quantity;
        const unitPrice = edit.unitPrice ?? BigInt(existing.unitPrice);
        const chargeChanged = quantity !== existing.quantity || (edit.unitPrice != null && edit.unitPrice !== BigInt(existing.unitPrice));
        const packageSource = (existing.deductionSource as any)?.type === "PREPAID_PACKAGE_V1" ? existing.deductionSource as any : null;
        let deduction: any = null;
        if (edit.deduction) {
          const proposedUnitPrice = BigInt((existing.deductionSource as any)?.proposedUnitPrice ?? 0);
          const differs = edit.deduction.deductionQuantity !== existing.proposedDeductionQuantity || edit.deduction.refundUnitPrice !== proposedUnitPrice;
          if (differs && !edit.deduction.reason && audit) throw validation("deductionReason", "Nhập lý do khi phần bớt khác số hệ thống đề xuất.");
          deduction = { refundUnitPriceSnapshot: edit.deduction.refundUnitPrice, deductionQuantity: edit.deduction.deductionQuantity, deductionAmount: this.amount(edit.deduction.refundUnitPrice, edit.deduction.deductionQuantity), deductionReason: differs ? edit.deduction.reason : null };
          if (packageSource && deduction.deductionAmount > BigInt(packageSource.maxRefundNet)) throw new ConflictException({ code: "SETTLEMENT_REFUND_EXCEEDS_PAID", message: "Số hoàn vượt phần học phí nộp trước còn lại chưa hoàn." });
          if (deduction.refundUnitPriceSnapshot === BigInt(existing.refundUnitPriceSnapshot ?? 0) && deduction.deductionQuantity === existing.deductionQuantity && deduction.deductionReason === existing.deductionReason) deduction = null;
        }
        if (!chargeChanged && !deduction) return;
        const refund = BigInt(deduction?.refundUnitPriceSnapshot ?? existing.refundUnitPriceSnapshot ?? 0);
        if (!packageSource && refund > unitPrice) {
          if (deduction) this.refundWithinPrice(refund, unitPrice);
          throw validation("unitPrice", "Đơn giá thu không được thấp hơn giá hoàn trả của phần bớt; hãy sửa phần bớt trước.");
        }
        const evaluated = chargeChanged ? await this.evaluateDraftPromotion(tx, schoolId, invoice, { receivableId: existing.receivableId, receivableName: existing.receivableNameSnapshot, amount: this.amount(unitPrice, quantity) }) : null;
        const charged = evaluated ? BigInt(evaluated.netAmount) : BigInt(existing.grossAmount) - BigInt(existing.discountAmount);
        const netAmount = charged - BigInt(deduction?.deductionAmount ?? existing.deductionAmount ?? 0);
        const line = await tx.invoiceLine.update({ where: { id: existing.id }, data: {
          ...(evaluated ? { quantity, unitPrice, grossAmount: BigInt(evaluated.grossAmount), discountAmount: BigInt(evaluated.discountAmount), promotionEvaluationProvenance: evaluated.promotionEvaluation, overrideReason: edit.unitPrice == null ? existing.overrideReason : edit.overrideReason } : {}),
          ...(deduction ?? {}), netAmount, ...taxedLine(netAmount, existing.taxCategorySnapshot ?? "NOT_DECLARED"),
        } });
        if (!audit) return;
        if (evaluated) await this.audit(tx, schoolId, audit.identityId, audit.membershipId, "INVOICE_LINE_EDITED", audit.operation, this.lineDto(existing), { line: this.lineDto(line), invoiceId: part.id });
        if (deduction) await this.audit(tx, schoolId, audit.identityId, audit.membershipId, "INVOICE_LINE_DEDUCTION_EDITED", audit.operation, this.lineDto(existing), { line: this.lineDto(line), invoiceId: part.id }, deduction.deductionReason ?? undefined);
      });
    }
    return this.refreshInvoice(tx, schoolId, invoiceId);
  }
  // Decision 2026-10-01 D4: the run of month N refunds the approved leave days of month N-1.
  private previousMonth(billingMonth: string) {
    const [year, month] = billingMonth.split("-").map(Number);
    const start = new Date(Date.UTC(year!, month! - 2, 1));
    return { start, end: new Date(Date.UTC(year!, month! - 1, 1)), billingMonth: start.toISOString().slice(0, 7) };
  }
  // Approved leave days of the previous month that attendance has not contradicted with a confirmed PRESENT.
  // Leave days are issued only on operating days; decision 2026-10-08 also drops those outside the school weekdays.
  private async leaveDeductionDays(client: any, schoolId: string, studentIds: string[], billingMonth: string) {
    const result = new Map<string, Array<{ date: string; leaveDaySourceId: string }>>();
    if (!studentIds.length) return result;
    const { start, end } = this.previousMonth(billingMonth);
    const sources = await client.leaveDaySource.findMany({ where: { schoolId, studentId: { in: studentIds }, operatingOn: { gte: start, lt: end }, leaveStatus: { in: ["AUTO_APPROVED", "APPROVED"] }, exclusions: { none: {} } }, select: { id: true, studentId: true, operatingOn: true }, orderBy: [{ studentId: "asc" }, { operatingOn: "asc" }] });
    const schoolDays = new Set(await this.schoolDays(client, schoolId, start, end));
    for (const source of sources) {
      const date = source.operatingOn.toISOString().slice(0, 10);
      if (schoolDays.has(date)) result.set(source.studentId, [...(result.get(source.studentId) ?? []), { date, leaveDaySourceId: source.id }]);
    }
    return result;
  }
  // Decision 2026-10-08: the school days of [start, end) are the weekdays of the finance policy effective that day
  // (Monday–Saturday without a policy) minus the holidays of the calendar effective that day.
  private async schoolDays(client: any, schoolId: string, start: Date, end: Date) {
    const [calendars, policies] = await Promise.all([
      client.schoolCalendarVersion.findMany({ where: { schoolId, effectiveFrom: { lt: end } }, include: { holidays: true }, orderBy: { effectiveFrom: "desc" } }),
      client.financePolicy.findMany({ where: { schoolId, effectiveFrom: { lt: end } }, select: { effectiveFrom: true, schoolWeekdays: true }, orderBy: { effectiveFrom: "desc" } }),
    ]);
    const days: string[] = [];
    for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const weekdays: number[] = policies.find((item: any) => item.effectiveFrom <= cursor)?.schoolWeekdays ?? [1, 2, 3, 4, 5, 6];
      const calendar = calendars.find((item: any) => item.effectiveFrom <= cursor);
      if (!weekdays.includes(cursor.getUTCDay())) continue;
      if (calendar?.holidays.some((holiday: any) => holiday.startsOn <= cursor && holiday.endsOn >= cursor)) continue;
      days.push(cursor.toISOString().slice(0, 10));
    }
    return days;
  }
  // A line of a receivable with a refund price always records its proposal, even with no leave days.
  // Decision 2026-10-07: only a Receivable with autoLeaveDeduction proposes Bớt from leave days; otherwise Bớt starts at 0 and
  // Finance may still type it, with the Receivable's refund price kept as the line's refund price.
  private deductionProposal(refundUnitPrice: bigint, billingMonth: string, days: Array<{ date: string; leaveDaySourceId?: string }>, afterEndDays: string[] = [], auto = true) {
    if (!auto) return { refundUnitPriceSnapshot: refundUnitPrice, deductionQuantity: 0, proposedDeductionQuantity: 0, deductionAmount: 0n, deductionSource: null };
    const quantity = refundUnitPrice > 0n ? days.length : 0;
    return {
      refundUnitPriceSnapshot: refundUnitPrice, deductionQuantity: quantity, proposedDeductionQuantity: quantity, deductionAmount: refundUnitPrice * BigInt(quantity),
      deductionSource: refundUnitPrice > 0n ? { type: "LEAVE_DAYS_V1", month: this.previousMonth(billingMonth).billingMonth, days: days.map((day) => day.date), leaveDaySourceIds: days.flatMap((day) => day.leaveDaySourceId ? [day.leaveDaySourceId] : []), ...(afterEndDays.length ? { afterEndDays } : {}), proposedQuantity: quantity, proposedUnitPrice: refundUnitPrice.toString() } : null,
    };
  }
  private deductionData(proposal: ReturnType<FinanceService["deductionProposal"]>) {
    return { ...proposal, deductionSource: proposal.deductionSource ?? Prisma.DbNull };
  }
  // A1: a line charged below the catalog price proposes its refund at most at the line unit price.
  private async lineProposal(tx: any, schoolId: string, invoice: any, receivable: any, unitPrice: bigint) {
    const refund = BigInt(receivable.refundUnitPrice ?? 0) < unitPrice ? BigInt(receivable.refundUnitPrice ?? 0) : unitPrice;
    if (refund <= 0n) return this.deductionProposal(0n, invoice.billingMonth, []);
    if (!receivable.autoLeaveDeduction) return this.deductionProposal(refund, invoice.billingMonth, [], [], false);
    if (invoice.kind === "SETTLEMENT" && invoice.enrollmentEndedOnSnapshot) {
      const days = await this.settlementDays(tx, schoolId, invoice.studentId, invoice.billingMonth, invoice.enrollmentEndedOnSnapshot);
      return this.deductionProposal(refund, invoice.billingMonth, days.days, days.afterEndDays);
    }
    const days = (await this.leaveDeductionDays(tx, schoolId, [invoice.studentId], invoice.billingMonth)).get(invoice.studentId) ?? [];
    return this.deductionProposal(refund, invoice.billingMonth, days);
  }
  // D9: a settlement refunds the approved leave days of the previous month plus every school day of
  // that month from the first day without enrollment (meals paid in advance but not eaten).
  private async settlementDays(tx: any, schoolId: string, studentId: string, billingMonth: string, endedOn: Date) {
    const { start, end } = this.previousMonth(billingMonth);
    const leave = (await this.leaveDeductionDays(tx, schoolId, [studentId], billingMonth)).get(studentId) ?? [];
    const afterEndDays: string[] = [];
    if (endedOn < end) afterEndDays.push(...await this.schoolDays(tx, schoolId, endedOn > start ? endedOn : start, end));
    const byDate = new Map<string, { date: string; leaveDaySourceId?: string }>(afterEndDays.map((date) => [date, { date }]));
    for (const day of leave) byDate.set(day.date, day);
    return { days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), afterEndDays: afterEndDays.filter((date) => !leave.some((day) => day.date === date)) };
  }
  // D10: a prepaid package refunds what was paid minus the list price of every started month (a month counts whole)
  // minus what was already refunded; the refund carries the VAT of the package's source line.
  private async packageRefunds(tx: any, schoolId: string, studentId: string, endedOn: Date, excludeInvoiceId?: string) {
    const coverages = await tx.studentPromotionalCoverage.findMany({ where: { schoolId, studentId }, include: { reversals: true, receivable: true }, orderBy: [{ serviceStart: "asc" }, { id: "asc" }] });
    const packages = new Map<string, any[]>();
    for (const coverage of coverages) { const key = `${coverage.sourceInvoiceId}:${coverage.versionId}:${coverage.receivableId}`; packages.set(key, [...(packages.get(key) ?? []), coverage]); }
    const refunds: any[] = [];
    for (const [packageKey, months] of packages) {
      const used = months.filter((month: any) => month.serviceStart < endedOn);
      const paidNet = months.reduce((sum: bigint, month: any) => sum + BigInt(month.originalPrice) - BigInt(month.reduction), 0n);
      const listPriceUsed = used.reduce((sum: bigint, month: any) => sum + BigInt(month.originalPrice), 0n);
      const reversedNet = months.flatMap((month: any) => month.reversals).reduce((sum: bigint, reversal: any) => sum + BigInt(reversal.amount) - BigInt(reversal.vatAmount), 0n);
      const settled = await tx.invoiceLine.aggregate({ where: { schoolId, kind: "NORMAL", deductionSource: { path: ["packageKey"], equals: packageKey }, invoice: { status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) } }, _sum: { deductionAmount: true } });
      const priorRefundNet = reversedNet + BigInt(settled._sum.deductionAmount ?? 0);
      const maxRefundNet = paidNet - priorRefundNet;
      const refundNet = paidNet - listPriceUsed - priorRefundNet;
      if (refundNet <= 0n) continue;
      const first = months[0];
      const sourceLine = await tx.invoiceLine.findFirst({ where: { schoolId, invoiceId: first.sourceInvoiceId, receivableId: first.receivableId, kind: "NORMAL" }, orderBy: { id: "asc" }, select: { taxCategorySnapshot: true } });
      refunds.push({ receivable: first.receivable, taxCategory: (sourceLine?.taxCategorySnapshot ?? first.receivable.taxCategory) as TaxCategory, refundNet, source: {
        type: "PREPAID_PACKAGE_V1", packageKey, sourceInvoiceId: first.sourceInvoiceId, versionId: first.versionId, receivableId: first.receivableId,
        firstMonth: months[0].billingMonth, lastMonth: months.at(-1).billingMonth, months: months.length, usedMonths: used.length,
        paidNet: paidNet.toString(), listPriceUsed: listPriceUsed.toString(), priorRefundNet: priorRefundNet.toString(), maxRefundNet: maxRefundNet.toString(),
        coverageIds: months.map((month: any) => month.id), proposedQuantity: 1, proposedUnitPrice: refundNet.toString(),
      } });
    }
    return refunds;
  }
  private packageLine(schoolId: string, invoiceId: string, refund: any) {
    const tax = taxedLine(-BigInt(refund.refundNet), refund.taxCategory);
    return { schoolId, invoiceId, receivableId: refund.receivable.id, receivableCodeSnapshot: refund.receivable.code, receivableNameSnapshot: refund.receivable.displayName, unitLabelSnapshot: "gói", defaultUnitPriceSnapshot: refund.receivable.defaultUnitPrice, unitPrice: refund.receivable.defaultUnitPrice, quantity: 0, grossAmount: 0n, discountAmount: 0n, refundUnitPriceSnapshot: refund.refundNet, deductionQuantity: 1, proposedDeductionQuantity: 1, deductionAmount: refund.refundNet, deductionSource: refund.source, netAmount: -refund.refundNet, ...tax, promotionEvaluationProvenance: { version: "PROMOTION_EVALUATION_V1", applications: [] } };
  }
  // Generation context: leave days, receivables refunded on the previous month's issued Invoices, and live refund prices.
  private async deductionContext(client: any, schoolId: string, billingMonth: string, studentIds: string[], receivableIds: string[]) {
    const days = await this.leaveDeductionDays(client, schoolId, studentIds, billingMonth);
    const previous = new Map<string, Set<string>>();
    if (studentIds.length) {
      const lines = await client.invoiceLine.findMany({ where: { schoolId, kind: "NORMAL", invoice: { studentId: { in: studentIds }, billingMonth: this.previousMonth(billingMonth).billingMonth, status: { in: ["ISSUED", "CLOSED"] } }, receivable: { autoLeaveDeduction: true } }, select: { receivableId: true, invoice: { select: { studentId: true } } } });
      for (const line of lines) previous.set(line.invoice.studentId, new Set([...(previous.get(line.invoice.studentId) ?? []), line.receivableId]));
    }
    const ids = [...new Set([...receivableIds, ...[...previous.values()].flatMap((set) => [...set])])];
    const receivables = ids.length ? await client.receivable.findMany({ where: { schoolId, id: { in: ids } } }) : [];
    return { billingMonth, days, previous, receivables: new Map<string, any>(receivables.map((item: any) => [item.id, item])) };
  }
  // Decision 2026-10-02: the Receivable picks one of the three fixed kinds; the server resolves that School's group.
  private async resolveGroup(tx: any, schoolId: string, input: { kind: string | null; groupId: string | null }) {
    const group = await tx.receivableGroup.findFirst({ where: input.kind ? { schoolId, kind: input.kind } : { schoolId, id: input.groupId } });
    if (!group)
      throw new NotFoundException({
        code: "RECEIVABLE_GROUP_NOT_FOUND",
        message: "Không tìm thấy nhóm khoản thu.",
      });
    if (input.kind && input.groupId && group.id !== input.groupId) throw validation("groupId", "Nhóm khoản thu không khớp loại đã chọn.");
    return group;
  }
  private groupKind(value: unknown, required: boolean) {
    if (value == null || value === "") {
      if (required) throw validation("kind", "Chọn một trong ba nhóm khoản thu.");
      return null;
    }
    if (typeof value !== "string" || !receivableGroupKinds.includes(value as any)) throw validation("kind", "Nhóm khoản thu phải là cố định, linh hoạt hoặc ngoại khóa.");
    return value;
  }
  async createReceivable(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    const kind = this.groupKind(body?.kind, !body?.groupId);
    const groupId = body?.groupId == null || body.groupId === "" ? null : this.identifier(body.groupId, "groupId");
    const input = {
      code: this.text(body?.code, "code", false, 50),
      displayName: this.text(body?.displayName, "displayName")!,
      unitLabel: this.unitLabel(body?.unitLabel),
      defaultUnitPrice: this.price(body?.defaultUnitPrice),
      refundUnitPrice: this.refundPrice(body?.refundUnitPrice ?? "0"),
      autoLeaveDeduction: this.flag(body?.autoLeaveDeduction ?? false, "autoLeaveDeduction"),
      taxCategory: this.taxCategory(body?.taxCategory ?? "NOT_DECLARED"),
    };
    this.refundWithinPrice(input.refundUnitPrice, input.defaultUnitPrice);
    this.autoLeaveNeedsRefund(input.autoLeaveDeduction, input.refundUnitPrice);
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.receivable,
      key,
      operationId,
      { kind, groupId, ...input, defaultUnitPrice: input.defaultUnitPrice.toString(), refundUnitPrice: input.refundUnitPrice.toString() },
      async (tx, operation) => {
        const group = await this.resolveGroup(tx, schoolId, { kind, groupId });
        try {
          const item = await tx.receivable.create({
            data: { schoolId, groupId: group.id, ...input },
          });
          const transition = await tx.receivableLifecycleTransition.create({
            data: {
              schoolId,
              receivableId: item.id,
              status: "ACTIVE",
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
              operationId: operation,
              sequence: 1,
            },
          });
          const outcome = this.receivableDto({
            ...item,
            lifecycleTransitions: [transition],
            group,
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "RECEIVABLE_CREATED",
            operation,
            null,
            outcome,
          );
          return outcome;
        } catch (error) {
          if ((error as any)?.code === "P2002")
            throw validation("code", "Mã khoản thu đã tồn tại trong trường.");
          throw error;
        }
      },
    );
  }
  async transitionReceivable(
    identityId: string,
    schoolId: string,
    id: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(id, "receivableId");
    const status = body?.status;
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (!["ACTIVE", "INACTIVE"].includes(status))
      throw validation("status", "Trạng thái không hợp lệ.");
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.receivableLifecycle,
      key,
      operationId,
      { id, status, reason },
      async (tx, operation) => {
        // FOR UPDATE: class creation / line paths hold FOR SHARE, so a lifecycle change waits for them (and they see it once committed).
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${id}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
        const item = await tx.receivable.findFirst({
          where: { id, schoolId },
          include: {
            lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
            group: true,
          },
        });
        if (!item)
          throw new NotFoundException({
            code: "RECEIVABLE_NOT_FOUND",
            message: "Không tìm thấy catalog khoản thu.",
          });
        const prior = item.lifecycleTransitions[0];
        if (!prior || prior.status === status)
          throw validation("status", "Bản ghi đã ở trạng thái này.");
        const transition = await tx.receivableLifecycleTransition.create({
          data: {
            schoolId,
            receivableId: id,
            previousStatus: prior.status,
            status,
            reason,
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
            operationId: operation,
            sequence: prior.sequence + 1,
          },
        });
        const outcome = this.receivableDto({ ...item, lifecycleTransitions: [transition] });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "RECEIVABLE_LIFECYCLE_CHANGED",
          operation,
          this.receivableDto(item),
          outcome,
        );
        return outcome;
      },
    );
  }
  // Decision 2026-10-02 §3.5, amended 2026-10-06: one edit command for name, unit, default price, kind, tax category and refund
  // price. Omitted fields keep their value; the reason is always required and one audit records before/after. InvoiceLines keep
  // their snapshots; DRAFT previews go stale because the template snapshot is part of the preview fingerprint.
  async updateReceivable(identityId: string, schoolId: string, receivableId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(receivableId, "receivableId");
    const given = (field: string) => body?.[field] !== undefined;
    const input = {
      displayName: given("displayName") ? this.text(body.displayName, "displayName")! : undefined,
      unitLabel: given("unitLabel") ? this.unitLabel(body.unitLabel) : undefined,
      defaultUnitPrice: given("defaultUnitPrice") ? this.price(body.defaultUnitPrice) : undefined,
      kind: given("kind") ? this.groupKind(body.kind, true)! : undefined,
      taxCategory: given("taxCategory") ? this.taxCategory(body.taxCategory) : undefined,
      refundUnitPrice: given("refundUnitPrice") ? this.refundPrice(body.refundUnitPrice) : undefined,
      autoLeaveDeduction: given("autoLeaveDeduction") ? this.flag(body.autoLeaveDeduction, "autoLeaveDeduction") : undefined,
      reason: this.text(body?.reason, "reason", true, 500)!,
    };
    const payload = { receivableId, ...input, defaultUnitPrice: input.defaultUnitPrice?.toString(), refundUnitPrice: input.refundUnitPrice?.toString() };
    return this.mutate(actor, identityId, schoolId, routes.receivableEdit, key, operationId, payload, async (tx, operation) => {
      const include = { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true };
      await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${receivableId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const item = await tx.receivable.findFirst({ where: { id: receivableId, schoolId }, include });
      if (!item) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
      const next = {
        displayName: input.displayName ?? item.displayName,
        unitLabel: input.unitLabel ?? item.unitLabel,
        defaultUnitPrice: input.defaultUnitPrice ?? item.defaultUnitPrice,
        taxCategory: input.taxCategory ?? item.taxCategory,
        refundUnitPrice: input.refundUnitPrice ?? item.refundUnitPrice,
        autoLeaveDeduction: input.autoLeaveDeduction ?? item.autoLeaveDeduction,
      };
      const kindChanged = input.kind !== undefined && input.kind !== item.group.kind;
      const detailsChanged = (Object.keys(next) as Array<keyof typeof next>).some((field) => next[field] !== item[field]);
      if (!detailsChanged && !kindChanged) throw validation("displayName", "Không có thay đổi để lưu.");
      // Decision 2026-10-02 §3.1: a Receivable keeps its kind once an InvoiceLine, collection template line or class uses it.
      if (kindChanged) {
        const [invoiceLines, templateLines, classes] = await Promise.all([
          tx.invoiceLine.count({ where: { schoolId, receivableId: item.id } }),
          tx.collectionRunTemplateLine.count({ where: { schoolId, receivableId: item.id } }),
          tx.extracurricularClass.count({ where: { schoolId, receivableId: item.id } }),
        ]);
        if (invoiceLines + templateLines + classes > 0) throw new ConflictException({ code: "RECEIVABLE_KIND_LOCKED", message: "Không đổi được nhóm: khoản thu đã dùng trên hóa đơn, đợt thu hoặc lớp ngoại khóa." });
      }
      // Amendment A1 2026-10-01: the refund price never exceeds the charged price; name the field the user actually changed.
      if (next.refundUnitPrice > next.defaultUnitPrice) {
        if (next.refundUnitPrice !== item.refundUnitPrice) this.refundWithinPrice(next.refundUnitPrice, next.defaultUnitPrice);
        throw validation("defaultUnitPrice", `Đơn giá thu không được thấp hơn giá hoàn trả (${next.refundUnitPrice.toLocaleString("vi-VN")} đ).`);
      }
      this.autoLeaveNeedsRefund(next.autoLeaveDeduction, next.refundUnitPrice);
      const groupId = kindChanged ? (await this.resolveGroup(tx, schoolId, { kind: input.kind!, groupId: null })).id : item.groupId;
      const updated = await tx.receivable.update({ where: { id: item.id }, data: { ...next, groupId }, include }).catch((error: unknown) => this.catalogConstraintError(error));
      const outcome = this.receivableDto(updated);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "RECEIVABLE_EDITED", operation, this.receivableDto(item), outcome, input.reason);
      return outcome;
    });
  }
  // Every path that creates a line referencing a Receivable locks it FOR SHARE (ids sorted, so lock order is consistent) before
  // validating or snapshotting it. Kind/price/refund edits take FOR UPDATE, so a concurrent edit either waits for the committed
  // usage and is refused, or the line sees the new catalog values. The DB trigger stays as defense in depth.
  private async lockReceivablesShared(tx: any, schoolId: string, receivableIds: Array<string | null | undefined>) {
    const ids = [...new Set(receivableIds.filter((id): id is string => typeof id === "string" && uuid.test(id)))].sort();
    if (!ids.length) return;
    await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "schoolId" = ${schoolId}::uuid AND "id" = ANY(${ids}::uuid[]) ORDER BY "id" FOR SHARE`;
  }
  // The kind-lock trigger and the refund<=price CHECK are the last line of defense; surface them as normal 4xx responses.
  private catalogConstraintError(error: any): never {
    const text = `${error?.message ?? ""} ${error?.meta?.message ?? ""} ${error?.meta?.constraint ?? ""}`;
    if (/Receivable kind cannot change/i.test(text)) throw new ConflictException({ code: "RECEIVABLE_KIND_LOCKED", message: "Không đổi được nhóm: khoản thu đã dùng trên hóa đơn, đợt thu hoặc lớp ngoại khóa." });
    if (/Receivable_refundUnitPrice_within_price|refundUnitPrice.*defaultUnitPrice/i.test(text)) throw validation("defaultUnitPrice", "Đơn giá thu không được thấp hơn giá hoàn trả.");
    throw error;
  }
  // A Class may name one active PERSONAL account and one active SCHOOL account that issue pre-selects for its notice parts.
  // `schoolBankAccountId` left out of the body keeps the current School default.
  async setClassDefaultBankAccount(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(classId, "classId");
    const bankAccountId = body?.bankAccountId == null || body.bankAccountId === "" ? null : this.identifier(body.bankAccountId, "bankAccountId");
    const setSchool = body != null && typeof body === "object" && "schoolBankAccountId" in body;
    const schoolBankAccountId = setSchool ? this.requestedSchoolBankAccountId(body) : undefined;
    return this.mutate(actor, identityId, schoolId, routes.classDefaultBankAccount, key, operationId, { classId, bankAccountId, ...(setSchool ? { schoolBankAccountId } : {}) }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "Class" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const classroom = await tx.class.findFirst({ where: { id: classId, schoolId } });
      if (!classroom) throw new NotFoundException({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp." });
      const activeAccount = async (id: string, kind: PaymentChannel) => {
        const account = await tx.bankAccount.findFirst({ where: { id, schoolId, kind }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
        return account?.lifecycleTransitions[0]?.status === "ACTIVE";
      };
      if (bankAccountId && !await activeAccount(bankAccountId, "PERSONAL")) throw validation("bankAccountId", "Chỉ chọn tài khoản cá nhân đang hoạt động của trường.");
      if (schoolBankAccountId && !await activeAccount(schoolBankAccountId, "SCHOOL")) throw validation("schoolBankAccountId", "Chỉ chọn tài khoản trường đang hoạt động.");
      const updated = await tx.class.update({ where: { id: classroom.id }, data: { defaultBankAccountId: bankAccountId, ...(setSchool ? { defaultSchoolBankAccountId: schoolBankAccountId } : {}) } });
      const outcome = { classId: updated.id, defaultBankAccountId: updated.defaultBankAccountId, defaultSchoolBankAccountId: updated.defaultSchoolBankAccountId };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "CLASS_DEFAULT_BANK_ACCOUNT_SET", operation, { classId, defaultBankAccountId: classroom.defaultBankAccountId, defaultSchoolBankAccountId: classroom.defaultSchoolBankAccountId }, outcome);
      return outcome;
    });
  }

  // ---- Extracurricular classes (Story 5.34, decision 2026-10-02 §3.3) --------------------------------------------------------
  // Finance owns these aggregates. Enrollment rows are only a picker/identity source; Class, EnrollmentClassAssignment and
  // staff authorization are never read for authorization nor changed here.
  private classStatus(item: any) {
    return item.lifecycleTransitions?.[0]?.status ?? null;
  }
  // `Điểm danh riêng` (decision 2026-10-08) is stored and shown only.
  private separateAttendance(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") throw validation("separateAttendance", "Điểm danh riêng phải là có hoặc không.");
    return value;
  }
  private extracurricularClassDto(item: any, extra: Record<string, unknown> = {}) {
    return { id: item.id, schoolYearId: item.schoolYearId, name: item.name, receivableId: item.receivableId, separateAttendance: Boolean(item.separateAttendance), status: this.classStatus(item), ...extra };
  }
  private monthFilter(value: unknown) {
    if (value == null || value === "") {
      const today = this.localIssueDate(new Date());
      return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw validation("month", "Tháng phải có dạng YYYY-MM.");
    return value;
  }
  private classNotFound() {
    return new NotFoundException({ code: "EXTRACURRICULAR_CLASS_NOT_FOUND", message: "Không tìm thấy lớp ngoại khóa." });
  }
  private async extracurricularClassFor(client: any, schoolId: string, classId: string) {
    this.identifier(classId, "classId");
    const found = await client.extracurricularClass.findFirst({
      where: { id: classId, schoolId },
      include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } }, schoolYear: true, lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } },
    });
    if (!found) throw this.classNotFound();
    return found;
  }
  async extracurricularClasses(identityId: string, schoolId: string, query: any) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const schoolYearId = query?.schoolYearId ? this.identifier(query.schoolYearId, "schoolYearId") : null;
    const status = query?.status === "ACTIVE" || query?.status === "INACTIVE" ? query.status : null;
    const receivableId = query?.receivableId ? this.identifier(query.receivableId, "receivableId") : null;
    const search = typeof query?.q === "string" ? query.q.trim().toLocaleLowerCase("vi").slice(0, 100) : "";
    const today = this.localIssueDate(new Date());
    const all = await this.prisma.extracurricularClass.findMany({
      where: { schoolId, ...(schoolYearId ? { schoolYearId } : {}) },
      include: { receivable: { select: { displayName: true, unitLabel: true, defaultUnitPrice: true } }, lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const counts = all.length
      ? await this.prisma.extracurricularMembership.groupBy({ by: ["extracurricularClassId"], where: { schoolId, extracurricularClassId: { in: all.map((item) => item.id) }, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] }, _count: { _all: true } })
      : [];
    const currentCount = new Map(counts.map((row) => [row.extracurricularClassId, row._count._all]));
    const sharedWith = (item: any) => all.filter((other) => other.receivableId === item.receivableId && other.schoolYearId === item.schoolYearId && other.id !== item.id).map((other) => other.name);
    const classes = all
      .filter((item) => (!status || this.classStatus(item) === status) && (!receivableId || item.receivableId === receivableId) && (!search || item.name.toLocaleLowerCase("vi").includes(search)))
      .map((item) => this.extracurricularClassDto(item, { receivableName: item.receivable.displayName, unitLabel: item.receivable.unitLabel, defaultUnitPrice: item.receivable.defaultUnitPrice.toString(), sharedWith: sharedWith(item), currentMembers: currentCount.get(item.id) ?? 0 }));
    const receivables = await this.prisma.receivable.findMany({
      where: { schoolId, group: { kind: "EXTRACURRICULAR" } },
      include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } },
      orderBy: { displayName: "asc" },
    });
    const schoolYears = await this.prisma.schoolYear.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } });
    return {
      schoolYears: schoolYears.map((year) => ({ id: year.id, name: year.name, startsOn: year.startsOn.toISOString().slice(0, 10), endsOn: year.endsOn.toISOString().slice(0, 10), closedAt: year.closedAt?.toISOString() ?? null })),
      classes,
      receivables: receivables.map((item) => ({ id: item.id, displayName: item.displayName, unitLabel: item.unitLabel, defaultUnitPrice: item.defaultUnitPrice.toString(), status: item.lifecycleTransitions[0]?.status ?? null, sharedWith: all.filter((other) => other.receivableId === item.id && (!schoolYearId || other.schoolYearId === schoolYearId)).map((other) => other.name) })),
    };
  }
  async extracurricularClass(identityId: string, schoolId: string, classId: string, query: any) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const month = this.monthFilter(query?.month);
    const statusFilter = ["COUNTED", "CURRENT", "ENDED", "ALL"].includes(query?.status) ? query.status : "COUNTED";
    const officialClassId = query?.officialClassId ? officialClassFilter(query.officialClassId) ?? this.identifier(query.officialClassId, "officialClassId") : null;
    const search = typeof query?.q === "string" ? query.q.trim().toLocaleLowerCase("vi").slice(0, 100) : "";
    const found = await this.extracurricularClassFor(this.prisma, schoolId, classId);
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthNumber, 1));
    const today = this.localIssueDate(new Date());
    const memberships = await this.prisma.extracurricularMembership.findMany({
      where: { schoolId, extracurricularClassId: found.id },
      include: { enrollment: { select: { id: true, classId: true, className: true, lifecycle: true, student: { select: { studentCode: true, fullName: true } } } } },
      orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
    });
    const sibling = await this.prisma.extracurricularMembership.findMany({
      where: { schoolId, enrollmentId: { in: memberships.map((item) => item.enrollmentId) }, extracurricularClassId: { not: found.id }, extracurricularClass: { receivableId: found.receivableId } },
      include: { extracurricularClass: { select: { name: true } } },
    });
    const sharedClasses = await this.prisma.extracurricularClass.findMany({ where: { schoolId, schoolYearId: found.schoolYearId, receivableId: found.receivableId, id: { not: found.id } }, select: { name: true }, orderBy: { name: "asc" } });
    const isCurrent = (item: any) => item.effectiveFrom <= today && (!item.effectiveTo || item.effectiveTo > today);
    const isCounted = (item: any) => item.effectiveFrom < monthEnd && (!item.effectiveTo || item.effectiveTo > monthStart);
    const flags = (item: any) => (isCounted(item) ? [...(item.effectiveFrom > monthStart ? ["JOINED_IN_MONTH"] : []), ...(item.effectiveTo && item.effectiveTo < monthEnd ? ["LEFT_IN_MONTH"] : [])] : []);
    const dayLabel = (value: Date) => `${String(value.getUTCDate()).padStart(2, "0")}/${String(value.getUTCMonth() + 1).padStart(2, "0")}/${value.getUTCFullYear()}`;
    const rowsAll = memberships.map((item) => {
      const next = item.effectiveTo ? sibling.find((other) => other.enrollmentId === item.enrollmentId && other.effectiveFrom.getTime() === item.effectiveTo!.getTime()) : undefined;
      return {
        id: item.id,
        enrollmentId: item.enrollmentId,
        studentCode: item.enrollment.student.studentCode,
        fullName: item.enrollment.student.fullName,
        officialClassId: item.enrollment.classId ?? (item.enrollment.lifecycle === EXTRACURRICULAR_ONLY ? EXTRACURRICULAR_ONLY : null),
        officialClassName: item.enrollment.className ?? (item.enrollment.lifecycle === EXTRACURRICULAR_ONLY ? extracurricularOnlyLabel : null),
        effectiveFrom: item.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: this.inclusiveDate(item.effectiveTo),
        open: !item.effectiveTo,
        state: item.effectiveTo && item.effectiveTo <= today && !isCounted(item) ? "ENDED" : isCurrent(item) ? "ACTIVE" : item.effectiveFrom > today ? "UPCOMING" : "ENDED",
        flags: flags(item),
        counted: isCounted(item),
        current: isCurrent(item),
        transferNote: next ? `Chuyển sang ${next.extracurricularClass.name} từ ${dayLabel(next.effectiveFrom)}` : null,
      };
    });
    const matching = rowsAll.filter((row) => {
      if (officialClassId && row.officialClassId !== officialClassId) return false;
      if (search && !`${row.studentCode} ${row.fullName}`.toLocaleLowerCase("vi").includes(search)) return false;
      if (statusFilter === "COUNTED") return row.counted;
      if (statusFilter === "CURRENT") return row.current;
      if (statusFilter === "ENDED") return row.effectiveTo !== null && memberships.find((item) => item.id === row.id)!.effectiveTo! <= today;
      return true;
    });
    const officialClasses = [...new Map(rowsAll.filter((row) => row.officialClassId).map((row) => [row.officialClassId!, row.officialClassName ?? ""])).entries()].map(([id, name]) => ({ id, name }));
    return {
      class: this.extracurricularClassDto(found, { receivableName: found.receivable.displayName, unitLabel: found.receivable.unitLabel, defaultUnitPrice: found.receivable.defaultUnitPrice.toString(), schoolYearName: found.schoolYear.name, sharedWith: sharedClasses.map((other) => other.name) }),
      month: { month, current: rowsAll.filter((row) => row.current).length, counted: rowsAll.filter((row) => row.counted).length, midMonth: rowsAll.filter((row) => row.flags.length > 0).length },
      officialClasses,
      total: matching.length,
      members: matching.slice(0, 500).map(({ counted, current, ...row }) => row),
    };
  }
  // Picker aid: ENROLLED / SCHEDULED_TO_START Students of the class's SchoolYear, optionally narrowed by their official class.
  async extracurricularCandidates(identityId: string, schoolId: string, classId: string, query: any) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const found = await this.extracurricularClassFor(this.prisma, schoolId, classId);
    const officialClassId = query?.officialClassId ? officialClassFilter(query.officialClassId) ?? this.identifier(query.officialClassId, "officialClassId") : null;
    const search = typeof query?.q === "string" ? query.q.trim().slice(0, 100) : "";
    const today = this.localIssueDate(new Date());
    const base = { schoolId, schoolYearId: found.schoolYearId, lifecycle: { in: [...membershipLifecycles] } };
    const [officialClasses, enrollments] = await Promise.all([
      this.prisma.studentEnrollment.findMany({ where: { ...base, classId: { not: null } }, distinct: ["classId"], select: { classId: true, className: true }, orderBy: { className: "asc" } }),
      this.prisma.studentEnrollment.findMany({
        where: { ...base, ...this.officialClassWhere(officialClassId), ...(search ? { student: { OR: [{ studentCode: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }] } } : {}) },
        include: { student: { select: { studentCode: true, fullName: true } } },
        orderBy: [{ student: { studentCode: "asc" } }],
        take: 200,
      }),
    ]);
    const members = await this.prisma.extracurricularMembership.findMany({ where: { schoolId, extracurricularClassId: found.id, enrollmentId: { in: enrollments.map((item) => item.id) }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] }, select: { enrollmentId: true } });
    const memberIds = new Set(members.map((item) => item.enrollmentId));
    return {
      officialClasses: [...officialClasses.map((item) => ({ id: item.classId, name: item.className ?? "" })), ...(await this.prisma.studentEnrollment.count({ where: { ...base, lifecycle: EXTRACURRICULAR_ONLY } }) ? [{ id: EXTRACURRICULAR_ONLY, name: extracurricularOnlyLabel }] : [])],
      candidates: enrollments.map((item) => ({ enrollmentId: item.id, studentCode: item.student.studentCode, fullName: item.student.fullName, officialClassName: item.className ?? (item.lifecycle === EXTRACURRICULAR_ONLY ? extracurricularOnlyLabel : null), member: memberIds.has(item.id) })),
    };
  }
  async createExtracurricularClass(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    const input = { name: this.text(body?.name, "name")!, schoolYearId: this.identifier(body?.schoolYearId, "schoolYearId"), receivableId: this.identifier(body?.receivableId, "receivableId"), separateAttendance: this.separateAttendance(body?.separateAttendance) ?? false };
    return this.mutate(actor, identityId, schoolId, routes.extracurricularClass, key, operationId, input, async (tx, operation) => {
      const year = await tx.schoolYear.findFirst({ where: { id: input.schoolYearId, schoolId } });
      if (!year) throw new NotFoundException({ code: "SCHOOL_YEAR_NOT_FOUND", message: "Không tìm thấy năm học." });
      if (year.closedAt) throw validation("schoolYearId", "Năm học đã đóng.");
      await this.lockReceivablesShared(tx, schoolId, [input.receivableId]);
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { group: true, lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!receivable) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
      if (receivable.group.kind !== "EXTRACURRICULAR") throw validation("receivableId", "Chỉ chọn khoản thu thuộc nhóm Ngoại khóa.");
      if (receivable.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu đã ngừng áp dụng.");
      try {
        const created = await tx.extracurricularClass.create({ data: { schoolId, schoolYearId: year.id, name: input.name, receivableId: receivable.id, separateAttendance: input.separateAttendance } });
        const transition = await tx.extracurricularClassLifecycleTransition.create({ data: { schoolId, extracurricularClassId: created.id, status: "ACTIVE", actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation, sequence: 1 } });
        const outcome = this.extracurricularClassDto({ ...created, lifecycleTransitions: [transition] });
        await this.audit(tx, schoolId, identityId, actor.membershipId, "EXTRACURRICULAR_CLASS_CREATED", operation, null, outcome);
        return outcome;
      } catch (error) {
        if ((error as any)?.code === "P2002") throw validation("name", "Tên lớp ngoại khóa đã tồn tại trong năm học.");
        throw error;
      }
    });
  }
  async transitionExtracurricularClass(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(classId, "classId");
    const status = body?.status;
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw validation("status", "Trạng thái không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.extracurricularLifecycle, key, operationId, { classId, status, reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const found = await this.extracurricularClassFor(tx, schoolId, classId);
      const prior = found.lifecycleTransitions[0];
      if (!prior || prior.status === status) throw validation("status", "Lớp đã ở trạng thái này.");
      if (status === "ACTIVE" && found.receivable.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("status", "Không thể kích hoạt lớp khi khoản thu đã ngừng áp dụng.");
      const transition = await tx.extracurricularClassLifecycleTransition.create({ data: { schoolId, extracurricularClassId: found.id, previousStatus: prior.status, status, reason, actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation, sequence: prior.sequence + 1 } });
      const outcome = this.extracurricularClassDto({ ...found, lifecycleTransitions: [transition] });
      await this.audit(tx, schoolId, identityId, actor.membershipId, "EXTRACURRICULAR_CLASS_LIFECYCLE_CHANGED", operation, this.extracurricularClassDto(found), outcome, reason);
      return outcome;
    });
  }
  // Business owner 2026-10-02 / decision 2026-10-06: one edit command for the name and the Receivable, with reason and audit, for ACTIVE and
  // INACTIVE classes alike. Memberships are untouched and there is no effective date: generated lines keep their snapshot and DRAFT previews
  // go stale because the class Receivable is part of the preview fingerprint.
  async editExtracurricularClass(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(classId, "classId");
    const name = body?.name === undefined ? undefined : this.text(body.name, "name")!;
    const receivableId = body?.receivableId === undefined ? undefined : this.identifier(body.receivableId, "receivableId");
    const separateAttendance = this.separateAttendance(body?.separateAttendance);
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (name === undefined && receivableId === undefined && separateAttendance === undefined) throw validation("name", "Không có thay đổi để lưu.");
    return this.mutate(actor, identityId, schoolId, routes.extracurricularEdit, key, operationId, { classId, name, receivableId, separateAttendance, reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const found = await this.extracurricularClassFor(tx, schoolId, classId);
      const nameChanged = name !== undefined && name !== found.name;
      const receivableChanged = receivableId !== undefined && receivableId !== found.receivableId;
      const attendanceChanged = separateAttendance !== undefined && separateAttendance !== found.separateAttendance;
      if (!nameChanged && !receivableChanged && !attendanceChanged) throw validation(receivableId !== undefined ? "receivableId" : "name", "Không có thay đổi để lưu.");
      let receivable = found.receivable;
      if (receivableChanged) {
        await this.lockReceivablesShared(tx, schoolId, [receivableId]);
        receivable = await tx.receivable.findFirst({ where: { id: receivableId, schoolId }, include: { group: true, lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
        if (!receivable) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
        if (receivable.group.kind !== "EXTRACURRICULAR") throw validation("receivableId", "Chỉ chọn khoản thu thuộc nhóm Ngoại khóa.");
        if (receivable.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu đã ngừng áp dụng.");
      }
      const fact = (item: any, rec: any) => ({ ...this.extracurricularClassDto(item), receivableName: rec.displayName, defaultUnitPrice: rec.defaultUnitPrice.toString(), unitLabel: rec.unitLabel });
      try {
        const updated = await tx.extracurricularClass.update({ where: { id: found.id }, data: { ...(nameChanged ? { name } : {}), ...(receivableChanged ? { receivableId } : {}), ...(attendanceChanged ? { separateAttendance } : {}) } });
        const outcome = this.extracurricularClassDto({ ...found, name: updated.name, receivableId: updated.receivableId, separateAttendance: updated.separateAttendance });
        await this.audit(tx, schoolId, identityId, actor.membershipId, "EXTRACURRICULAR_CLASS_EDITED", operation, fact(found, found.receivable), fact({ ...found, ...updated }, receivable), reason);
        return outcome;
      } catch (error) {
        if ((error as any)?.code === "P2002") throw validation("name", "Tên lớp ngoại khóa đã tồn tại trong năm học.");
        throw error;
      }
    });
  }
  private uuidList(value: unknown, field: string, limit = 200) {
    if (!Array.isArray(value) || value.length < 1 || value.length > limit || new Set(value).size !== value.length) throw validation(field, `Chọn từ 1 đến ${limit} mục, không trùng nhau.`);
    return value.map((item) => this.identifier(item, field));
  }
  private isOverlapError(error: any) {
    return /ExtracurricularMembership_no_overlap|23P01|conflicting key value violates exclusion/i.test(`${error?.code ?? ""} ${error?.meta?.code ?? ""} ${error?.message ?? ""}`);
  }
  private membershipDto(item: any) {
    return { id: item.id, enrollmentId: item.enrollmentId, effectiveFrom: item.effectiveFrom.toISOString().slice(0, 10), effectiveTo: this.inclusiveDate(item.effectiveTo) };
  }
  // Single and bulk add share one reason and one Operation; one audit record per membership; all-or-nothing.
  async addExtracurricularMemberships(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(classId, "classId");
    const enrollmentIds = this.uuidList(body?.enrollmentIds, "enrollmentIds");
    const effectiveFrom = this.date(body?.effectiveFrom, "effectiveFrom")!;
    const effectiveTo = body?.effectiveTo == null || body.effectiveTo === "" ? null : this.inclusiveEnd(body.effectiveTo, "effectiveTo");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw validation("effectiveTo", "Ngày kết thúc phải từ ngày hiệu lực trở đi.");
    return this.mutate(actor, identityId, schoolId, routes.extracurricularMembershipAdd, key, operationId, { classId, enrollmentIds: [...enrollmentIds].sort(), effectiveFrom: effectiveFrom.toISOString(), effectiveTo: effectiveTo?.toISOString() ?? null, reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const found = await this.extracurricularClassFor(tx, schoolId, classId);
      if (this.classStatus(found) !== "ACTIVE") throw new ConflictException({ code: "EXTRACURRICULAR_CLASS_INACTIVE", message: "Lớp ngoại khóa đã ngừng hoạt động." });
      if (effectiveFrom < found.schoolYear.startsOn || effectiveFrom >= found.schoolYear.endsOn || (effectiveTo && effectiveTo > found.schoolYear.endsOn)) throw validation("effectiveFrom", "Thời gian tham gia phải nằm trong năm học của lớp.");
      const enrollments = await tx.studentEnrollment.findMany({ where: { id: { in: enrollmentIds }, schoolId }, include: { student: { select: { studentCode: true, fullName: true } } } });
      if (enrollments.length !== enrollmentIds.length) throw new NotFoundException({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy học sinh trong năm học của lớp." });
      const invalid = enrollments.filter((item: any) => item.schoolYearId !== found.schoolYearId || !membershipLifecycles.includes(item.lifecycle));
      if (invalid.length) throw validation("enrollmentIds", `Học sinh phải đang học hoặc đã đăng ký trước trong năm học của lớp: ${invalid.map((item: any) => item.student.studentCode).join(", ")}.`);
      const outside = enrollments.filter((item: any) => effectiveFrom < item.effectiveFrom || (item.endedOn && (!effectiveTo || effectiveTo > item.endedOn)));
      if (outside.length) throw validation("effectiveFrom", `Thời gian tham gia phải nằm trong thời gian học của học sinh: ${outside.map((item: any) => item.student.studentCode).join(", ")}.`);
      const overlapping = await tx.extracurricularMembership.findMany({ where: { schoolId, extracurricularClassId: found.id, enrollmentId: { in: enrollmentIds }, ...(effectiveTo ? { effectiveFrom: { lt: effectiveTo } } : {}), OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }] }, select: { enrollmentId: true } });
      if (overlapping.length) {
        const codes = enrollments.filter((item: any) => overlapping.some((row: any) => row.enrollmentId === item.id)).map((item: any) => item.student.studentCode);
        throw new ConflictException({ code: "EXTRACURRICULAR_MEMBERSHIP_OVERLAP", message: `Học sinh đã có thời gian tham gia trùng trong lớp này: ${codes.join(", ")}.` });
      }
      const created: any[] = [];
      try {
        for (const enrollment of enrollments.sort((a: any, b: any) => a.student.studentCode.localeCompare(b.student.studentCode))) {
          const row = await tx.extracurricularMembership.create({ data: { schoolId, schoolYearId: found.schoolYearId, extracurricularClassId: found.id, enrollmentId: enrollment.id, effectiveFrom, effectiveTo, reason, actorIdentityId: identityId, createdByMembershipId: actor.membershipId, createOperationId: operation } });
          created.push(row);
          await this.audit(tx, schoolId, identityId, actor.membershipId, "EXTRACURRICULAR_MEMBERSHIP_ADDED", operation, null, { ...this.membershipDto(row), classId: found.id }, reason);
        }
      } catch (error) {
        if (this.isOverlapError(error)) throw new ConflictException({ code: "EXTRACURRICULAR_MEMBERSHIP_OVERLAP", message: "Học sinh đã có thời gian tham gia trùng trong lớp này." });
        throw error;
      }
      return { classId: found.id, memberships: created.map((row) => this.membershipDto(row)) };
    });
  }
  async endExtracurricularMemberships(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(classId, "classId");
    const membershipIds = this.uuidList(body?.membershipIds, "membershipIds");
    const effectiveTo = this.inclusiveEnd(body?.effectiveTo, "effectiveTo", true)!;
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.extracurricularMembershipEnd, key, operationId, { classId, membershipIds: [...membershipIds].sort(), effectiveTo: effectiveTo.toISOString(), reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const found = await this.extracurricularClassFor(tx, schoolId, classId);
      if (this.classStatus(found) !== "ACTIVE") throw new ConflictException({ code: "EXTRACURRICULAR_CLASS_INACTIVE", message: "Lớp ngoại khóa đã ngừng hoạt động." });
      const rows = await tx.extracurricularMembership.findMany({ where: { id: { in: membershipIds }, schoolId, extracurricularClassId: found.id }, include: { enrollment: { select: { endedOn: true, student: { select: { studentCode: true } } } } } });
      if (rows.length !== membershipIds.length) throw new NotFoundException({ code: "EXTRACURRICULAR_MEMBERSHIP_NOT_FOUND", message: "Không tìm thấy thành viên của lớp." });
      const notOpen = rows.filter((row: any) => row.effectiveTo);
      if (notOpen.length) throw new ConflictException({ code: "EXTRACURRICULAR_MEMBERSHIP_NOT_OPEN", message: `Thành viên đã có ngày kết thúc: ${notOpen.map((row: any) => row.enrollment.student.studentCode).join(", ")}.` });
      const tooEarly = rows.filter((row: any) => effectiveTo <= row.effectiveFrom);
      if (tooEarly.length) throw validation("effectiveTo", `Ngày kết thúc phải từ ngày bắt đầu tham gia trở đi: ${tooEarly.map((row: any) => row.enrollment.student.studentCode).join(", ")}.`);
      const beyond = rows.filter((row: any) => row.enrollment.endedOn && effectiveTo > row.enrollment.endedOn);
      if (beyond.length) throw validation("effectiveTo", `Ngày kết thúc không được sau thời gian học của học sinh: ${beyond.map((row: any) => row.enrollment.student.studentCode).join(", ")}.`);
      const ended: any[] = [];
      for (const row of rows.sort((a: any, b: any) => a.enrollment.student.studentCode.localeCompare(b.enrollment.student.studentCode))) {
        const updated = await tx.extracurricularMembership.update({ where: { id: row.id }, data: { effectiveTo, endReason: reason, endedByMembershipId: actor.membershipId, endOperationId: operation, endedAt: new Date() } });
        ended.push(updated);
        await this.audit(tx, schoolId, identityId, actor.membershipId, "EXTRACURRICULAR_MEMBERSHIP_ENDED", operation, { ...this.membershipDto(row), classId: found.id }, { ...this.membershipDto(updated), classId: found.id }, reason);
      }
      return { classId: found.id, memberships: ended.map((row) => this.membershipDto(row)) };
    });
  }
  private month(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
      throw validation("billingMonth", "Tháng thu phải có dạng YYYY-MM.");
    return value;
  }
  private date(value: unknown, field: string, required = true) {
    if (value == null && !required) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw validation(field, "Ngày phải có dạng YYYY-MM-DD.");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw validation(field, "Ngày không hợp lệ.");
    return date;
  }
  // UI dates are inclusive; persisted intervals use the contract's half-open form.
  private inclusiveEnd(value: unknown, field: string, required = false) {
    const date = this.date(value, field, required);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + 1);
    return date;
  }
  private inclusiveDate(value: Date | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  // Decision 2026-10-07: a prepaid package may carry no discount (0); a plain discount must be positive.
  private promotionValue(value: unknown, type: unknown, prepaid = false) {
    if (type !== "FIXED_VND" && type !== "PERCENTAGE") throw validation("discountType", "Loại giảm không hợp lệ.");
    if (prepaid && value === "0") return 0n;
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9007199254740991n || (type === "PERCENTAGE" && BigInt(value) > 100n)) throw validation("discountValue", type === "PERCENTAGE" ? "Phần trăm phải từ 1 đến 100." : "Mức giảm VND phải là số nguyên dương an toàn.");
    return BigInt(value);
  }
  private promotionDto(value: any) {
    return { id: value.id, name: value.name, versions: (value.versions ?? []).map((version: any) => ({
      id: version.id, version: version.version, status: version.status, discountType: version.discountType, discountValue: version.discountValue.toString(), priority: version.priority, stackingMode: version.stackingMode, fulfillmentMode: version.fulfillmentMode,
      prepaidTermMonths: version.prepaidTermMonths ?? null,
      effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10), effectiveTo: this.inclusiveDate(version.effectiveTo),
      targets: (version.targets ?? []).map((target: any) => ({ id: target.id, receivableId: target.receivableId, receivableName: target.receivable.displayName })),
      assignments: (version.assignments ?? []).map((assignment: any) => ({ id: assignment.id, studentId: assignment.studentId, studentName: assignment.student.fullName, studentCode: assignment.student.studentCode, effectiveFrom: assignment.effectiveFrom.toISOString().slice(0, 10), effectiveTo: this.inclusiveDate(assignment.effectiveTo), isCurrent: assignment.effectiveFrom <= this.localIssueDate(new Date()) && (!assignment.effectiveTo || assignment.effectiveTo > this.localIssueDate(new Date())), reason: assignment.reason, endReason: assignment.endReason ?? null })),
    })) };
  }
  private promotionInclude: any = { versions: { include: { targets: { include: { receivable: true }, orderBy: { receivable: { displayName: "asc" } } }, assignments: { include: { student: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] } }, orderBy: { version: "desc" } } };
  async promotionPolicies(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const policies = await this.prisma.promotionPolicy.findMany({ where: { schoolId }, include: this.promotionInclude, orderBy: { name: "asc" } });
    return { policies: policies.map((policy) => this.promotionDto(policy)) };
  }
  // Decision 2026-10-06: the assignment picker lists Students enrolled in the School year of the assignment start (official class,
  // search) and flags those whose assignment of the same policy already overlaps; the assign command still re-checks everything.
  async promotionStudents(identityId: string, schoolId: string, query: any) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const versionId = this.identifier(query?.versionId, "versionId");
    const officialClassId = query?.officialClassId ? officialClassFilter(query.officialClassId) ?? this.identifier(query.officialClassId, "officialClassId") : null;
    const search = typeof query?.q === "string" ? query.q.trim().slice(0, 100) : "";
    const version = await this.prisma.promotionPolicyVersion.findFirst({ where: { id: versionId, schoolId } });
    if (!version) throw new NotFoundException({ code: "PROMOTION_POLICY_VERSION_NOT_FOUND", message: "Không tìm thấy phiên bản ưu đãi." });
    const today = this.localIssueDate(new Date());
    const from = this.date(query?.effectiveFrom || null, "effectiveFrom", false) ?? (version.effectiveFrom > today ? version.effectiveFrom : today);
    const to = this.inclusiveEnd(query?.effectiveTo || null, "effectiveTo");
    const year =
      (await this.prisma.schoolYear.findFirst({ where: { schoolId, startsOn: { lte: from }, endsOn: { gte: from } }, orderBy: { startsOn: "desc" } })) ??
      (await this.prisma.schoolYear.findFirst({ where: { schoolId, startsOn: { lte: from } }, orderBy: { startsOn: "desc" } })) ??
      (await this.prisma.schoolYear.findFirst({ where: { schoolId }, orderBy: { startsOn: "asc" } }));
    if (!year) return { schoolYear: null, officialClasses: [], students: [] };
    const base = { schoolId, schoolYearId: year.id, lifecycle: { in: [...membershipLifecycles] } };
    const [officialClasses, enrollments] = await Promise.all([
      this.prisma.studentEnrollment.findMany({ where: { ...base, classId: { not: null } }, distinct: ["classId"], select: { classId: true, className: true } }),
      this.prisma.studentEnrollment.findMany({
        where: { ...base, ...this.officialClassWhere(officialClassId), ...(search ? { student: { OR: [{ studentCode: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }] } } : {}) },
        include: { student: { select: { id: true, studentCode: true, fullName: true } } },
      }),
    ]);
    const assigned = await this.prisma.studentPromotionAssignment.findMany({ where: { schoolId, policyId: version.policyId, studentId: { in: enrollments.map((item) => item.studentId) }, effectiveFrom: { lt: to ?? new Date("9999-12-31T00:00:00.000Z") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] }, select: { studentId: true } });
    const assignedIds = new Set(assigned.map((item) => item.studentId));
    const natural = (left: string | null, right: string | null) => (left ?? "\uffff").localeCompare(right ?? "\uffff", "vi", { numeric: true, sensitivity: "base" });
    return {
      schoolYear: { id: year.id, name: year.name },
      officialClasses: officialClasses.map((item) => ({ id: item.classId, name: item.className ?? "" })).sort((left, right) => natural(left.name, right.name)),
      students: enrollments
        .map((item) => ({ id: item.student.id, studentCode: item.student.studentCode, fullName: item.student.fullName, officialClassName: item.className, assigned: assignedIds.has(item.studentId) }))
        .sort((left, right) => natural(left.officialClassName, right.officialClassName) || natural(left.studentCode, right.studentCode)),
    };
  }
  async createPromotionPolicy(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId);
    const targetIds = Array.isArray(body?.receivableIds) ? body.receivableIds.map((id: unknown) => this.identifier(id, "receivableIds")) : [];
    if (!targetIds.length || new Set(targetIds).size !== targetIds.length) throw validation("receivableIds", "Chọn ít nhất một khoản thu không trùng lặp.");
    const prepaidTermMonths = body?.prepaidTermMonths === undefined || body?.prepaidTermMonths === null || body?.prepaidTermMonths === "" ? null : Number(body.prepaidTermMonths);
    const input = { policyId: body?.policyId == null ? null : this.identifier(body.policyId, "policyId"), name: this.text(body?.name, "name")!, receivableIds: targetIds, discountType: body?.discountType, discountValue: this.promotionValue(body?.discountValue, body?.discountType, body?.fulfillmentMode === "PREPAID_COVERAGE"), priority: Number(body?.priority), stackingMode: body?.stackingMode, fulfillmentMode: body?.fulfillmentMode ?? "DISCOUNT", prepaidTermMonths, effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom")!, effectiveTo: this.inclusiveEnd(body?.effectiveTo, "effectiveTo") };
    if (!Number.isInteger(input.priority) || input.priority < 1) throw validation("priority", "Ưu tiên phải là số nguyên dương.");
    if (input.stackingMode !== "STACKABLE" && input.stackingMode !== "EXCLUSIVE") throw validation("stackingMode", "Quy tắc kết hợp không hợp lệ.");
    if (!["DISCOUNT", "PREPAID_COVERAGE"].includes(input.fulfillmentMode)) throw validation("fulfillmentMode", "Cách thực hiện ưu đãi không hợp lệ.");
    if (input.fulfillmentMode === "PREPAID_COVERAGE") {
      if (!Number.isInteger(input.prepaidTermMonths) || input.prepaidTermMonths! < 1) throw validation("prepaidTermMonths", "Thời hạn nộp trước phải là số nguyên dương.");
    } else {
      if (input.prepaidTermMonths !== null) throw validation("prepaidTermMonths", "Chính sách giảm giá không áp dụng thời hạn nộp trước.");
    }
    if (input.effectiveTo && input.effectiveFrom >= input.effectiveTo) throw validation("effectiveTo", "Ngày kết thúc phải sau ngày bắt đầu.");
    return this.mutate(actor, identityId, schoolId, routes.promotionPolicy, key, operationId, { ...input, discountValue: input.discountValue.toString(), effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const receivables = await tx.receivable.findMany({ where: { schoolId, id: { in: input.receivableIds } }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true } });
      if (receivables.length !== input.receivableIds.length || receivables.some((receivable: any) => receivable.lifecycleTransitions[0]?.status !== "ACTIVE")) throw validation("receivableIds", "Khoản thu phải đang áp dụng.");
      const policy = input.policyId ? await tx.promotionPolicy.findFirst({ where: { id: input.policyId, schoolId } }) : await tx.promotionPolicy.create({ data: { schoolId, name: input.name } });
      if (!policy) throw new NotFoundException({ code: "PROMOTION_POLICY_NOT_FOUND", message: "Không tìm thấy chính sách ưu đãi." });
      if (input.policyId && policy.name !== input.name) throw validation("name", "Tên chính sách không thể đổi khi tạo phiên bản mới.");
      const previous = await tx.promotionPolicyVersion.findFirst({ where: { schoolId, policyId: policy.id }, orderBy: { version: "desc" } });
      const version = await tx.promotionPolicyVersion.create({ data: { schoolId, policyId: policy.id, version: (previous?.version ?? 0) + 1, status: "DRAFT", discountType: input.discountType, discountValue: input.discountValue, priority: input.priority, stackingMode: input.stackingMode, fulfillmentMode: input.fulfillmentMode, prepaidTermMonths: input.prepaidTermMonths, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo } });
      await tx.promotionPolicyTarget.createMany({ data: input.receivableIds.map((receivableId: string) => ({ schoolId, versionId: version.id, receivableId })) });
      const result = await tx.promotionPolicy.findFirst({ where: { id: policy.id, schoolId }, include: this.promotionInclude }); const outcome = this.promotionDto(result);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "PROMOTION_POLICY_VERSION_CREATED", operation, null, outcome); return outcome;
    });
  }
  async activatePromotionVersion(identityId: string, schoolId: string, versionId: string, key: string, operationId: string) { return this.promotionTransition(identityId, schoolId, versionId, "ACTIVE", key, operationId); }
  async retirePromotionVersion(identityId: string, schoolId: string, versionId: string, key: string, operationId: string) { return this.promotionTransition(identityId, schoolId, versionId, "RETIRED", key, operationId); }
  private async promotionTransition(identityId: string, schoolId: string, versionId: string, status: "ACTIVE" | "RETIRED", key: string, operationId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(versionId, "versionId"); const route = status === "ACTIVE" ? routes.promotionActivate : routes.promotionRetire;
    return this.mutate(actor, identityId, schoolId, route, key, operationId, { versionId, status }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const version = await tx.promotionPolicyVersion.findFirst({ where: { id: versionId, schoolId }, include: { targets: true } }); if (!version) throw new NotFoundException({ code: "PROMOTION_POLICY_VERSION_NOT_FOUND", message: "Không tìm thấy phiên bản ưu đãi." });
      if (status === "ACTIVE" && (version.status !== "DRAFT" || !version.targets.length || (version.fulfillmentMode === "PREPAID_COVERAGE" && (!version.prepaidTermMonths || version.prepaidTermMonths < 1)))) throw new ConflictException({ code: "PROMOTION_POLICY_VERSION_NOT_ACTIVATABLE", message: "Chỉ phiên bản nháp có khoản thu và thời hạn hợp lệ mới được kích hoạt." });
      if (status === "RETIRED" && version.status !== "ACTIVE") throw new ConflictException({ code: "PROMOTION_POLICY_VERSION_NOT_RETIRABLE", message: "Chỉ phiên bản đang áp dụng mới được ngừng." });
      const updated = await tx.promotionPolicyVersion.update({ where: { id: version.id }, data: { status } }); const outcome = { id: updated.id, status: updated.status };
      await this.audit(tx, schoolId, identityId, actor.membershipId, status === "ACTIVE" ? "PROMOTION_POLICY_VERSION_ACTIVATED" : "PROMOTION_POLICY_VERSION_RETIRED", operation, { id: version.id, status: version.status }, outcome); return outcome;
    });
  }
  async assignPromotionStudents(identityId: string, schoolId: string, versionId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(versionId, "versionId"); const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.map((id: unknown) => this.identifier(id, "studentIds")) : [];
    if (!studentIds.length || new Set(studentIds).size !== studentIds.length) throw validation("studentIds", "Chọn ít nhất một học sinh không trùng lặp."); const effectiveFrom = this.date(body?.effectiveFrom, "effectiveFrom")!; const effectiveTo = this.inclusiveEnd(body?.effectiveTo, "effectiveTo"); const reason = this.text(body?.reason, "reason", true, 500)!;
    if (effectiveTo && effectiveFrom >= effectiveTo) throw validation("effectiveTo", "Ngày kết thúc phải sau ngày bắt đầu.");
    return this.mutate(actor, identityId, schoolId, routes.promotionAssignments, key, operationId, { versionId, studentIds, effectiveFrom: effectiveFrom.toISOString(), effectiveTo: effectiveTo?.toISOString() ?? null, reason }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const version = await tx.promotionPolicyVersion.findFirst({ where: { id: versionId, schoolId } }); if (!version || version.status !== "ACTIVE") throw new ConflictException({ code: "PROMOTION_POLICY_VERSION_NOT_ACTIVE", message: "Chỉ được gán vào phiên bản đang áp dụng." });
      if (effectiveFrom < version.effectiveFrom || (version.effectiveTo && (!effectiveTo || effectiveTo > version.effectiveTo))) throw validation("effectiveFrom", "Khoảng gán phải nằm trong hiệu lực phiên bản.");
      const students = await tx.student.findMany({ where: { schoolId, id: { in: studentIds } }, select: { id: true } }); if (students.length !== studentIds.length) throw validation("studentIds", "Có học sinh không thuộc Trường.");
      const conflicts = await tx.studentPromotionAssignment.findMany({ where: { schoolId, policyId: version.policyId, studentId: { in: studentIds }, effectiveFrom: { lt: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }] }, select: { studentId: true } });
      if (conflicts.length) throw validation("studentIds", "Một hoặc nhiều học sinh đã có ưu đãi chồng lấp.");
      await tx.studentPromotionAssignment.createMany({ data: studentIds.map((studentId: string) => ({ schoolId, studentId, policyId: version.policyId, versionId, effectiveFrom, effectiveTo, reason })) });
      const assignments = await tx.studentPromotionAssignment.findMany({ where: { schoolId, versionId, studentId: { in: studentIds }, effectiveFrom }, include: { student: true } }); const outcome = { versionId, assignments: assignments.map((item: any) => ({ id: item.id, studentId: item.studentId, studentCode: item.student.studentCode, studentName: item.student.fullName })) };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "STUDENT_PROMOTION_ASSIGNMENTS_CREATED", operation, null, outcome, reason); return outcome;
    });
  }
  async endPromotionAssignment(identityId: string, schoolId: string, assignmentId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(assignmentId, "assignmentId"); const effectiveTo = this.inclusiveEnd(body?.effectiveTo, "effectiveTo", true)!; const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.promotionAssignmentEnd, key, operationId, { assignmentId, effectiveTo: effectiveTo.toISOString(), reason }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const assignment = await tx.studentPromotionAssignment.findFirst({ where: { id: assignmentId, schoolId }, include: { version: true } }); if (!assignment) throw new NotFoundException({ code: "PROMOTION_ASSIGNMENT_NOT_FOUND", message: "Không tìm thấy gán ưu đãi." });
      if (assignment.effectiveTo || effectiveTo <= assignment.effectiveFrom || (assignment.version.effectiveTo && effectiveTo > assignment.version.effectiveTo)) throw validation("effectiveTo", "Ngày kết thúc không thuộc khoảng gán hợp lệ.");
      const updated = await tx.studentPromotionAssignment.update({ where: { id: assignment.id }, data: { effectiveTo, endReason: reason, endedAt: new Date() } }); const outcome = { id: updated.id, effectiveTo: this.inclusiveDate(updated.effectiveTo), endReason: updated.endReason };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "STUDENT_PROMOTION_ASSIGNMENT_ENDED", operation, { id: assignment.id, effectiveTo: null }, outcome, reason); return outcome;
    });
  }
  private asOf(billingMonth: string) {
    const [year, month] = billingMonth.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1, 1));
  }
  private runInclude: any = {
    coverageSelections: { select: { studentId: true, versionId: true, billingMonth: true }, orderBy: [{ studentId: "asc" }, { billingMonth: "asc" }, { versionId: "asc" }] },
    templateLines: { include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true } }, scopeClasses: { include: { classroom: { select: { name: true } } } }, scopeStudents: { include: { student: { select: { studentCode: true, fullName: true } } } } }, orderBy: { id: "asc" } },
    invoices: {
      select: { id: true, studentId: true, studentCodeSnapshot: true, studentNameSnapshot: true, classNameSnapshot: true, status: true, total: true, channel: true, kind: true, revisesInvoiceId: true, bankAccountIdSnapshot: true, receivingBankSnapshot: true, receivingBankBinSnapshot: true, accountNumberSnapshot: true, accountHolderNameSnapshot: true },
      orderBy: [{ studentCodeSnapshot: "asc" }, { channel: "asc" }, { id: "asc" }],
    },
    lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
  };
  private async previousOpenRun(db: any, schoolId: string, run: { type: string; billingMonth: string }): Promise<{ id: string; billingMonth: string } | null> {
    if (run.type !== "MONTHLY") return null;
    return db.collectionRun.findFirst({ where: { schoolId, type: "MONTHLY", billingMonth: { lt: run.billingMonth }, status: { not: "CLOSED" } }, orderBy: { billingMonth: "asc" }, select: { id: true, billingMonth: true } });
  }
  private runDto(run: any) {
    const status = run.lifecycleTransitions?.[0]?.status ?? run.status;
    return {
      id: run.id,
      schoolYearId: run.schoolYearId,
      billingMonth: run.billingMonth,
      type: run.type,
      status,
      version: run.version,
      coverageSelections: (run.coverageSelections ?? []).map((item: any) => ({ studentId: item.studentId, versionId: item.versionId, billingMonth: item.billingMonth })),
      templateLines: (run.templateLines ?? []).map((line: any) => this.templateLineDto(line)).sort(this.amountDescending),
      invoices: (run.invoices ?? []).map((invoice: any) => ({
        id: invoice.id, studentId: invoice.studentId, studentCode: invoice.studentCodeSnapshot,
        studentName: invoice.studentNameSnapshot, className: classLabel(invoice.classNameSnapshot),
        status: invoice.status, total: invoice.total.toString(), channel: invoice.channel ?? "PERSONAL", kind: invoice.kind ?? "NORMAL",
      })),
      notices: this.runNotices(run.invoices ?? []),
      ...(Array.isArray(run.invoices) && ["GENERATED", "CLOSED"].includes(status) ? { summary: this.invoiceSummary(run.invoices) } : {}),
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
  // Overview totals are summed here from BIGINT columns so Finance clients never add money themselves.
  private invoiceSummary(invoices: any[]) {
    const effective = invoices.filter((invoice) => invoice.status !== "CANCELLED");
    const notices = this.runNotices(invoices).filter((notice) => notice.status !== "CANCELLED");
    return {
      invoiceCount: effective.length,
      issuedCount: effective.filter((invoice) => ["ISSUED", "CLOSED"].includes(invoice.status)).length,
      invoiceTotal: effective.reduce((total: bigint, invoice) => total + BigInt(invoice.total), 0n).toString(),
      noticeCount: notices.length,
      issuedNoticeCount: notices.filter((notice) => notice.status !== "DRAFT").length,
    };
  }
  // Decision 2026-10-05: the run list shows one payment notice per Student (all their Invoices in the run).
  // Totals and the combined status are derived here; each channel Invoice still settles on its own.
  private runNotices(invoices: any[]) {
    const byStudent = new Map<string, any[]>();
    for (const invoice of invoices) byStudent.set(invoice.studentId, [...(byStudent.get(invoice.studentId) ?? []), invoice]);
    return [...byStudent.values()].map((all) => {
      // A revision DRAFT is not effective until issued; a cancelled source has been replaced.
      const live = all.filter((part) => part.status !== "CANCELLED" && !(part.revisesInvoiceId && part.status === "DRAFT"));
      const shown = live.length ? live : all;
      // An empty zero DRAFT part is never issued, so it does not hold the notice in Nháp.
      const counted = shown.filter((part) => !(part.status === "DRAFT" && BigInt(part.total) === 0n));
      const basis = counted.length ? counted : shown;
      const settledParts = basis.filter((part) => part.status === "CLOSED").length;
      const status = !live.length ? "CANCELLED" as const
        : basis.some((part) => part.status === "DRAFT") ? "DRAFT" as const
          : settledParts === basis.length ? "COMPLETED" as const
            : settledParts ? "PARTLY_SETTLED" as const : "ISSUED" as const;
      const first = shown[0]!;
      return {
        invoiceId: first.id, studentId: first.studentId, studentCode: first.studentCodeSnapshot, studentName: first.studentNameSnapshot, className: classLabel(first.classNameSnapshot),
        kind: shown.some((part) => (part.kind ?? "NORMAL") === "SETTLEMENT") ? "SETTLEMENT" as const : "NORMAL" as const,
        status, settledParts, partCount: basis.length,
        total: live.reduce((total: bigint, part) => total + BigInt(part.total), 0n).toString(),
        parts: [...shown].sort((a, b) => (a.channel === b.channel ? 0 : a.channel === "SCHOOL" ? -1 : 1)).map((part) => ({
          id: part.id, channel: part.channel ?? "PERSONAL", status: part.status, total: part.total.toString(),
          account: part.status === "DRAFT" ? null : this.accountDto(part),
        })),
      };
    });
  }
  // The "Lớp ngoại khóa trong đợt" section: ACTIVE classes of the run's SchoolYear with their members effective in the billing month.
  async runExtracurricularClasses(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({ where: { id: runId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
    if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
    const resolution = await this.runResolution(this.prisma, schoolId, run);
    return {
      billingMonth: run.billingMonth,
      classes: resolution.classes.map((item: any) => {
        const students = new Set<string>(item.members.map((member: any) => member.enrollmentId));
        // A Student also in an earlier-starting class of the same receivable is billed once, through that class.
        const transferred = [...students].filter((enrollmentId) => {
          const own = item.members.filter((member: any) => member.enrollmentId === enrollmentId).map((member: any) => member.from).sort()[0]!;
          return resolution.classes.some((other: any) => other.id !== item.id && other.receivableId === item.receivableId && this.extracurricularBillable(other) && other.members.some((member: any) => member.enrollmentId === enrollmentId && (member.from < own || (member.from === own && other.name.localeCompare(item.name, "vi") < 0))));
        }).length;
        return { id: item.id, name: item.name, receivableId: item.receivableId, receivableName: item.receivable.name, unitLabel: item.receivable.unitLabel, defaultUnitPrice: item.receivable.defaultUnitPrice, memberCount: students.size, transferredCount: transferred, excluded: item.excluded, receivableActive: item.receivableActive };
      }),
    };
  }
  async setRunExtracurricularExclusion(identityId: string, schoolId: string, runId: string, classId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(runId, "runId"); this.identifier(classId, "classId");
    if (typeof body?.excluded !== "boolean") throw validation("excluded", "Cần chọn loại khỏi đợt hoặc khôi phục.");
    const reason = this.text(body?.reason, "reason", false, 500);
    const expectedVersion = Number(body?.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw validation("expectedVersion", "Phiên bản đợt thu không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.runExtracurricularExclusion, key, operationId, { runId, classId, excluded: body.excluded, reason, expectedVersion }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId);
      if (run.status !== "DRAFT") throw new ConflictException({ code: "COLLECTION_RUN_NOT_DRAFT", message: "Chỉ được loại hoặc khôi phục lớp ngoại khóa khi đợt thu ở trạng thái nháp." });
      if (run.version !== expectedVersion) throw new ConflictException({ code: "COLLECTION_RUN_VERSION_CONFLICT", message: "Đợt thu đã thay đổi. Hãy tải lại trước khi thay đổi lớp ngoại khóa." });
      await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${classId}::uuid AND "schoolId" = ${schoolId}::uuid FOR SHARE`;
      const found = await tx.extracurricularClass.findFirst({ where: { id: classId, schoolId, schoolYearId: run.schoolYearId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!found || found.lifecycleTransitions[0]?.status !== "ACTIVE") throw this.classNotFound();
      const existing = await tx.collectionRunExtracurricularExclusion.findFirst({ where: { schoolId, collectionRunId: run.id, extracurricularClassId: classId } });
      if (body.excluded && existing) throw validation("excluded", "Lớp đã được loại khỏi đợt này.");
      if (!body.excluded && !existing) throw validation("excluded", "Lớp đang được tính trong đợt này.");
      if (body.excluded) await tx.collectionRunExtracurricularExclusion.create({ data: { schoolId, collectionRunId: run.id, extracurricularClassId: classId, reason, actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation } });
      else await tx.collectionRunExtracurricularExclusion.delete({ where: { id: existing!.id } });
      const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { version: { increment: 1 } }, include: this.runInclude });
      const outcome = this.runDto(updated);
      await this.audit(tx, schoolId, identityId, actor.membershipId, body.excluded ? "COLLECTION_RUN_EXTRACURRICULAR_CLASS_EXCLUDED" : "COLLECTION_RUN_EXTRACURRICULAR_CLASS_RESTORED", operation, { classId, excluded: !body.excluded }, { classId, className: found.name, excluded: body.excluded, run: outcome }, reason ?? undefined);
      return outcome;
    });
  }
  // Picker aid for template scopes: the run's ACTIVE official Classes and a bounded Student search among ENROLLED Students of its SchoolYear.
  // Decision 2026-10-06: the template scope picker lists every enrolled Student of the run's School year (official class, search),
  // ordered by class then natural Student code; saving the template line still re-checks the Students.
  async runScopeOptions(identityId: string, schoolId: string, runId: string, query: any) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({ where: { id: runId, schoolId }, select: { schoolYearId: true } });
    if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
    const search = typeof query?.q === "string" ? query.q.trim().slice(0, 100) : "";
    const officialClassId = query?.officialClassId ? officialClassFilter(query.officialClassId) ?? this.identifier(query.officialClassId, "officialClassId") : null;
    const natural = (left: string | null, right: string | null) => (left ?? "\uffff").localeCompare(right ?? "\uffff", "vi", { numeric: true, sensitivity: "base" });
    const [classes, enrollments] = await Promise.all([
      this.prisma.class.findMany({ where: { schoolId, schoolYearId: run.schoolYearId, status: "ACTIVE" }, select: { id: true, name: true } }),
      this.prisma.studentEnrollment.findMany({ where: { schoolId, schoolYearId: run.schoolYearId, lifecycle: { in: ["ENROLLED", EXTRACURRICULAR_ONLY] }, ...this.officialClassWhere(officialClassId), ...(search ? { student: { OR: [{ studentCode: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }] } } : {}) }, include: { student: { select: { id: true, studentCode: true, fullName: true } } } }),
    ]);
    return {
      classes: classes.sort((left, right) => natural(left.name, right.name)),
      students: enrollments
        .map((item) => ({ id: item.student.id, studentCode: item.student.studentCode, fullName: item.student.fullName, className: item.lifecycle === EXTRACURRICULAR_ONLY ? extracurricularOnlyLabel : item.className }))
        .sort((left, right) => natural(left.className, right.className) || natural(left.studentCode, right.studentCode)),
    };
  }
  // Preview rows for extracurricular receivables: one merged row per receivable listing its billable classes.
  private previewExtracurricularSummaries(resolution: { classes: any[] }, eligible: any[]) {
    const byReceivable = new Map<string, any>();
    for (const item of resolution.classes) if (this.extracurricularBillable(item)) byReceivable.set(item.receivableId, { receivable: item.receivable, receivableId: item.receivableId, classes: [...(byReceivable.get(item.receivableId)?.classes ?? []), item.name] });
    return [...byReceivable.values()].sort((a, b) => a.receivable.name.localeCompare(b.receivable.name, "vi")).map((entry) => {
      const lines = eligible.map((row) => (row.lines ?? []).find((line: any) => line.kind === "EXTRACURRICULAR" && line.receivableId === entry.receivableId)).filter(Boolean);
      const changed = lines.filter((line: any) => line.extracurricular.flags.includes("CLASS_CHANGE")).length;
      const totals = this.previewTotals(lines);
      return { templateLineId: null, receivableId: entry.receivableId, receivableName: entry.receivable.name, kind: "EXTRACURRICULAR", scope: { type: "CLASSES", label: entry.classes.sort((a: string, b: string) => a.localeCompare(b, "vi")).join(", ") }, studentCount: lines.length, subtotal: totals.grossAmount, discountAmount: totals.discountAmount, deductionAmount: totals.deductionAmount, vatAmount: totals.vatAmount, totalAmount: totals.amount, ...(changed ? { note: `${changed} HS chuyển lớp tính một lần` } : {}) };
    });
  }
  // Per class: members effective in the month are counted by the list; here, the eligible Students billed through the class and the server subtotal.
  private previewExtracurricularClasses(resolution: { classes: any[] }, eligible: any[]) {
    return resolution.classes.map((item) => {
      const price = BigInt(item.receivable.defaultUnitPrice);
      // A Student merged across classes of one receivable is attributed to the class that started first.
      const billed = eligible.flatMap((row) => (row.lines ?? []).filter((line: any) => line.kind === "EXTRACURRICULAR" && line.receivableId === item.receivableId && line.extracurricular.classes[0]?.id === item.id).map(() => 1));
      return { id: item.id, billedStudents: billed.length, subtotal: this.extracurricularBillable(item) ? (price * BigInt(billed.length)).toString() : "0" };
    });
  }
  // Per template line: kind, scope label, how many eligible Students receive it and the server-derived subtotal (before discounts, deductions and VAT).
  private previewLineSummaries(templateLines: any[], eligible: any[]) {
    return templateLines.map((line) => {
      const rows = eligible.map((row) => (row.lines ?? []).find((candidate: any) => candidate.templateLineId === line.templateLineId)).filter(Boolean);
      const totals = this.previewTotals(rows);
      return { templateLineId: line.templateLineId, receivableId: line.receivableId, receivableName: line.receivableName, kind: line.kind, scope: { type: line.scope.type, label: line.scope.label }, studentCount: rows.length, subtotal: totals.grossAmount, discountAmount: totals.discountAmount, deductionAmount: totals.deductionAmount, vatAmount: totals.vatAmount, totalAmount: totals.amount };
    });
  }
  private previewTotals(lines: any[]) {
    return lines.reduce((totals: { grossAmount: string; discountAmount: string; deductionAmount: string; vatAmount: string; amount: string }, line: any) => ({
      grossAmount: (BigInt(totals.grossAmount) + BigInt(line.grossAmount ?? line.amount ?? 0)).toString(),
      discountAmount: (BigInt(totals.discountAmount) + BigInt(line.discountAmount ?? 0)).toString(),
      deductionAmount: (BigInt(totals.deductionAmount) + BigInt(line.deductionAmount ?? 0)).toString(),
      vatAmount: (BigInt(totals.vatAmount) + BigInt(line.vatAmount ?? 0)).toString(),
      amount: (BigInt(totals.amount) + BigInt(line.amount ?? line.netAmount ?? 0)).toString(),
    }), { grossAmount: "0", discountAmount: "0", deductionAmount: "0", vatAmount: "0", amount: "0" });
  }
  private previewSummary(preview: { eligible: any[]; skips: any[] }) {
    const totals = this.previewTotals(preview.eligible.flatMap((row) => row.lines ?? []));
    return {
      eligibleCount: preview.eligible.length,
      skippedCount: preview.skips.length,
      expectedTotal: totals.amount,
      grossAmount: totals.grossAmount,
      discountAmount: totals.discountAmount,
      deductionAmount: totals.deductionAmount,
      vatAmount: totals.vatAmount,
      netAmount: (BigInt(totals.grossAmount) - BigInt(totals.discountAmount) - BigInt(totals.deductionAmount)).toString(),
    };
  }
  // Scope facts are canonical (sorted by id) so they can sit inside the preview fingerprint and the generation snapshot.
  private scopeFacts(line: any) {
    const type: "ALL" | "CLASSES" | "STUDENTS" = line.scopeType ?? line.scope?.type ?? "ALL";
    const classes = [...(line.scopeClasses ?? line.scope?.classes?.map((item: any) => ({ classId: item.id, classroom: { name: item.name } })) ?? [])].map((item: any) => ({ id: item.classId, name: item.classroom?.name ?? "" })).sort((a, b) => a.id.localeCompare(b.id));
    const students = [...(line.scopeStudents ?? line.scope?.students?.map((item: any) => ({ studentId: item.id, student: { studentCode: item.studentCode, fullName: item.fullName } })) ?? [])].map((item: any) => ({ id: item.studentId, studentCode: item.student?.studentCode ?? "", fullName: item.student?.fullName ?? "" })).sort((a, b) => a.id.localeCompare(b.id));
    const names = (type === "CLASSES" ? classes.map((item) => item.name) : students.map((item) => `${item.studentCode} · ${item.fullName}`)).sort((a, b) => a.localeCompare(b, "vi"));
    const label = type === "ALL" ? "Toàn bộ" : type === "CLASSES" ? `Lớp chính thức: ${names.join(", ")}` : `Học sinh cụ thể: ${names.length > 3 ? `${names.slice(0, 3).join(", ")} và ${names.length - 3} học sinh khác` : names.join(", ")}`;
    return { type, label, classes: type === "CLASSES" ? classes : [], students: type === "STUDENTS" ? students : [] };
  }
  // Picker filter on the official class; EXTRACURRICULAR_ONLY selects the Students without one.
  private officialClassWhere(officialClassId: string | null) {
    return officialClassId === EXTRACURRICULAR_ONLY ? { lifecycle: "EXTRACURRICULAR_ONLY" as const } : officialClassId ? { classId: officialClassId } : {};
  }
  // A Student receives a template line when it is ALL, or the Student's class effective on the first day of the month is named, or the Student is named.
  // Decision 2026-10-08: an extracurricular-only Student receives only lines that name them.
  private inScope(line: any, item: { studentId: string; classId?: string | null; extracurricularOnly?: boolean }) {
    const scope = line.scope;
    if (item.extracurricularOnly) return scope?.type === "STUDENTS" && scope.students.some((target: any) => target.id === item.studentId);
    if (!scope || scope.type === "ALL") return true;
    return scope.type === "CLASSES" ? scope.classes.some((target: any) => target.id === item.classId) : scope.students.some((target: any) => target.id === item.studentId);
  }
  private templateLineDto(line: any) {
    const receivable = line.receivable;
    const price = receivable.defaultUnitPrice;
    return { id: line.id, receivableId: line.receivableId, receivableName: receivable.displayName, unitLabel: receivable.unitLabel, defaultUnitPrice: price.toString(), quantity: line.quantity.toString(), amount: this.amount(price, line.quantity).toString(), taxCategory: receivable.taxCategory ?? "NOT_DECLARED", kind: receivable.group?.kind ?? null, scope: this.scopeFacts(line) };
  }
  private async templateSnapshot(tx: any, schoolId: string, run: any, validateActive = true, includeLifecycleFacts = false) {
    await tx.$queryRaw`SELECT 1 FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT 1 FROM "Receivable" AS r JOIN "ReceivableGroup" AS g ON g."id" = r."groupId" AND g."schoolId" = r."schoolId" WHERE r."schoolId" = ${schoolId}::uuid AND r."id" IN (SELECT "receivableId" FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid) FOR UPDATE OF r, g`;
    await tx.$queryRaw`SELECT 1 FROM "ReceivableLifecycleTransition" WHERE "schoolId" = ${schoolId}::uuid AND "receivableId" IN (SELECT "receivableId" FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid) FOR UPDATE`;
    const lines = await tx.collectionRunTemplateLine.findMany({
      where: { schoolId, collectionRunId: run.id },
      include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true } }, scopeClasses: { include: { classroom: { select: { name: true } } } }, scopeStudents: { include: { student: { select: { studentCode: true, fullName: true } } } } },
      orderBy: { id: "asc" },
    });
    return lines.map((line: any) => {
      const receivable = line.receivable;
      if (validateActive && (receivable.lifecycleTransitions[0]?.status !== "ACTIVE")) throw validation("receivableId", "Khoản thu mẫu đã ngừng áp dụng.");
      const amount = this.amount(receivable.defaultUnitPrice, line.quantity);
      return {
        templateLineId: line.id,
        receivableId: receivable.id,
        receivableCode: receivable.code,
        receivableName: receivable.displayName,
        unitLabel: receivable.unitLabel,
        defaultUnitPrice: receivable.defaultUnitPrice.toString(),
        quantity: line.quantity,
        amount: amount.toString(),
        taxCategory: receivable.taxCategory,
        kind: receivable.group?.kind ?? null,
        scope: this.scopeFacts(line),
        ...(includeLifecycleFacts ? { receivableStatus: receivable.lifecycleTransitions[0]?.status ?? null } : {}),
      };
    }).sort((a: any, b: any) => this.amountDescending({ ...a, id: a.templateLineId }, { ...b, id: b.templateLineId }));
  }
  // Decision 2026-10-02 §3.2: the optional `scope` is { type: ALL|CLASSES|STUDENTS, classIds?, studentIds? }. A missing scope keeps an existing
  // line's scope (ALL for a new line); FIXED lines are always ALL; EXTRACURRICULAR receivables are never template lines.
  private scopeInput(value: unknown) {
    if (value == null) return null;
    const type = (value as any)?.type;
    if (!["ALL", "CLASSES", "STUDENTS"].includes(type)) throw validation("scope", "Phạm vi phải là toàn bộ, lớp chính thức hoặc học sinh cụ thể.");
    const ids = (field: "classIds" | "studentIds", limit: number) => {
      const list = (value as any)?.[field];
      if (!Array.isArray(list) || list.length < 1 || list.length > limit || new Set(list).size !== list.length || list.some((item: unknown) => typeof item !== "string" || !uuid.test(item))) throw validation("scope", type === "CLASSES" ? "Chọn ít nhất một lớp chính thức." : "Chọn ít nhất một học sinh.");
      return [...list].sort() as string[];
    };
    return { type: type as "ALL" | "CLASSES" | "STUDENTS", classIds: type === "CLASSES" ? ids("classIds", 100) : [], studentIds: type === "STUDENTS" ? ids("studentIds", 500) : [] };
  }
  async saveTemplateLine(identityId: string, schoolId: string, runId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const input = { receivableId: this.identifier(body?.receivableId, "receivableId"), quantity: this.quantity(body?.quantity), expectedVersion: Number(body?.expectedVersion), scope: this.scopeInput(body?.scope) };
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw validation("expectedVersion", "Phiên bản đợt thu không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.template, key, operationId, { runId, ...input }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId);
      if (run.status !== "DRAFT") throw new ConflictException({ code: "COLLECTION_RUN_NOT_DRAFT", message: "Chỉ được sửa khoản thu mẫu khi đợt thu ở trạng thái nháp." });
      if (run.version !== input.expectedVersion) throw new ConflictException({ code: "COLLECTION_RUN_VERSION_CONFLICT", message: "Đợt thu đã thay đổi. Hãy tải lại trước khi sửa khoản thu mẫu." });
      await this.lockReceivablesShared(tx, schoolId, [input.receivableId]);
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: true } });
      if (!receivable || receivable.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu không còn áp dụng.");
      if (receivable.group.kind === "EXTRACURRICULAR") throw validation("receivableId", "Khoản Ngoại khóa thu theo lớp ngoại khóa, không thêm trực tiếp vào đợt thu.");
      const existing = await tx.collectionRunTemplateLine.findFirst({ where: { schoolId, collectionRunId: run.id, receivableId: receivable.id }, include: { scopeClasses: true, scopeStudents: true } });
      const scope = input.scope ?? (existing ? { type: existing.scopeType as "ALL" | "CLASSES" | "STUDENTS", classIds: existing.scopeClasses.map((item: any) => item.classId).sort(), studentIds: existing.scopeStudents.map((item: any) => item.studentId).sort() } : { type: "ALL" as const, classIds: [], studentIds: [] });
      if (receivable.group.kind === "FIXED" && scope.type !== "ALL") throw validation("scope", "Khoản thu cố định luôn áp dụng cho toàn bộ học sinh.");
      // Foreign, other-year and missing targets are indistinguishable to the caller.
      if (scope.type === "CLASSES") {
        const classes = await tx.class.count({ where: { schoolId, schoolYearId: run.schoolYearId, id: { in: scope.classIds } } });
        if (classes !== scope.classIds.length) throw validation("scope", "Lớp chính thức phải thuộc năm học của đợt thu.");
      }
      if (scope.type === "STUDENTS") {
        const students = await tx.studentEnrollment.findMany({ where: { schoolId, schoolYearId: run.schoolYearId, studentId: { in: scope.studentIds } }, select: { studentId: true } });
        if (new Set(students.map((item: any) => item.studentId)).size !== scope.studentIds.length) throw validation("scope", "Học sinh phải thuộc năm học của đợt thu.");
      }
      // Targets are replaced as a whole: clear them before the scope type changes (a trigger enforces that order).
      if (existing) {
        await tx.collectionRunTemplateScopeClass.deleteMany({ where: { schoolId, templateLineId: existing.id } });
        await tx.collectionRunTemplateScopeStudent.deleteMany({ where: { schoolId, templateLineId: existing.id } });
      }
      const saved = existing
        ? await tx.collectionRunTemplateLine.update({ where: { id: existing.id }, data: { quantity: input.quantity, scopeType: scope.type } })
        : await tx.collectionRunTemplateLine.create({ data: { schoolId, collectionRunId: run.id, receivableId: receivable.id, quantity: input.quantity, scopeType: scope.type } });
      if (scope.type === "CLASSES") await tx.collectionRunTemplateScopeClass.createMany({ data: scope.classIds.map((classId: string) => ({ schoolId, schoolYearId: run.schoolYearId, templateLineId: saved.id, classId })) });
      if (scope.type === "STUDENTS") await tx.collectionRunTemplateScopeStudent.createMany({ data: scope.studentIds.map((studentId: string) => ({ schoolId, templateLineId: saved.id, studentId })) });
      const line = await tx.collectionRunTemplateLine.findFirstOrThrow({ where: { id: saved.id }, include: { receivable: { include: { group: true } }, scopeClasses: { include: { classroom: { select: { name: true } } } }, scopeStudents: { include: { student: { select: { studentCode: true, fullName: true } } } } } });
      const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { version: { increment: 1 } }, include: this.runInclude });
      const outcome = this.runDto(updated); await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_TEMPLATE_SAVED", operation, existing ? { quantity: existing.quantity, scope: existing.scopeType } : null, { line: this.templateLineDto(line), run: outcome }); return outcome;
    });
  }
  async removeTemplateLine(identityId: string, schoolId: string, runId: string, lineId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId"); this.identifier(lineId, "lineId");
    const expectedVersion = Number(body?.expectedVersion); if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw validation("expectedVersion", "Phiên bản đợt thu không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.removeTemplate, key, operationId, { runId, lineId, expectedVersion }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId); if (run.status !== "DRAFT") throw new ConflictException({ code: "COLLECTION_RUN_NOT_DRAFT", message: "Chỉ được sửa khoản thu mẫu khi đợt thu ở trạng thái nháp." });
      if (run.version !== expectedVersion) throw new ConflictException({ code: "COLLECTION_RUN_VERSION_CONFLICT", message: "Đợt thu đã thay đổi. Hãy tải lại trước khi sửa khoản thu mẫu." });
      const line = await tx.collectionRunTemplateLine.findFirst({ where: { id: lineId, schoolId, collectionRunId: run.id }, include: { receivable: true } }); if (!line) throw new NotFoundException({ code: "COLLECTION_RUN_TEMPLATE_LINE_NOT_FOUND", message: "Không tìm thấy khoản thu mẫu." });
      await tx.collectionRunTemplateScopeClass.deleteMany({ where: { schoolId, templateLineId: line.id } }); await tx.collectionRunTemplateScopeStudent.deleteMany({ where: { schoolId, templateLineId: line.id } });
      await tx.collectionRunTemplateLine.delete({ where: { id: line.id } }); const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { version: { increment: 1 } }, include: this.runInclude }); const outcome = this.runDto(updated); await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_TEMPLATE_REMOVED", operation, this.templateLineDto(line), outcome); return outcome;
    });
  }
  private runCursor(value: unknown) {
    if (typeof value !== "string" || !value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
      if (typeof parsed?.billingMonth !== "string" || !/^\d{4}-\d{2}$/.test(parsed.billingMonth) || typeof parsed?.id !== "string" || !uuid.test(parsed.id)) throw new Error();
      return parsed as { billingMonth: string; id: string };
    } catch {
      throw validation("cursor", "Con trỏ không hợp lệ.");
    }
  }
  async runs(identityId: string, schoolId: string, query: { schoolYearId?: string; status?: string; limit?: string; cursor?: string } = {}) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const schoolYearId = query.schoolYearId;
    if (schoolYearId) this.identifier(schoolYearId, "schoolYearId");
    if (query.status && !["DRAFT", "READY", "GENERATED", "CLOSED"].includes(query.status)) throw validation("status", "Trạng thái không hợp lệ.");
    const limit = query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw validation("limit", "Giới hạn phải từ 1 đến 100.");
    const cursor = this.runCursor(query.cursor);
    if (cursor) {
      const cursorRun = await this.prisma.collectionRun.findFirst({ where: { id: cursor.id, schoolId, billingMonth: cursor.billingMonth, ...(schoolYearId ? { schoolYearId } : {}), ...(query.status ? { status: query.status as any } : {}) }, select: { id: true } });
      if (!cursorRun) throw validation("cursor", "Con trỏ không thuộc kết quả hiện tại.");
    }
    const runs = await this.prisma.collectionRun.findMany({
      where: { schoolId, ...(schoolYearId ? { schoolYearId } : {}), ...(query.status ? { status: query.status as any } : {}), ...(cursor ? { OR: [{ billingMonth: { lt: cursor.billingMonth } }, { billingMonth: cursor.billingMonth, id: { lt: cursor.id } }] } : {}) },
      include: this.runInclude,
      orderBy: [{ billingMonth: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = runs.slice(0, limit);
    const last = page.at(-1);
    return { runs: page.map((run) => this.runDto(run)), meta: { limit, nextCursor: runs.length > limit && last ? Buffer.from(JSON.stringify({ billingMonth: last.billingMonth, id: last.id })).toString("base64url") : null } };
  }
  async run(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({
      where: { id: runId, schoolId },
      include: { ...this.runInclude, schoolYear: true },
    });
    if (!run)
      throw new NotFoundException({
        code: "COLLECTION_RUN_NOT_FOUND",
        message: "Không tìm thấy đợt thu.",
      });
    const dto = { ...this.runDto(run), previousOpenRun: await this.previousOpenRun(this.prisma, schoolId, run) };
    if (dto.status !== "READY") return dto;
    // READY keeps no stored preview; re-derive it read-only exactly as generation will re-evaluate the roster.
    const templateLines = await this.templateSnapshot(this.prisma, schoolId, run, false, true);
    const extracurricular = await this.runResolution(this.prisma, schoolId, run);
    const preview = await this.previewDeductions(this.prisma, schoolId, run, await this.selectionPreview(this.prisma, schoolId, run, undefined, templateLines, extracurricular));
    return { ...dto, summary: this.previewSummary(preview) };
  }
  async addableStudents(identityId: string, schoolId: string, runId: string, query: { limit?: string; cursor?: string } = {}) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const limit = query.limit === undefined ? 100 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw validation("limit", "Giới hạn phải từ 1 đến 100.");
    const cursor = query.cursor ? this.identifier(query.cursor, "cursor") : null;
    const run = await this.prisma.collectionRun.findFirst({ where: { id: runId, schoolId }, include: { ...this.runInclude, schoolYear: true } });
    if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
    if (run.status !== "GENERATED") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ có thể xem học sinh để thêm khi đợt thu đã được tạo." });
    const templateLines = run.templateSnapshot as any[] | null;
    if (!Array.isArray(templateLines)) throw new ConflictException({ code: "COLLECTION_RUN_TEMPLATE_SNAPSHOT_MISSING", message: "Không tìm thấy snapshot khoản thu của đợt đã tạo." });
    const roster = await this.selectionPreview(this.prisma, schoolId, run, undefined, templateLines, await this.runResolution(this.prisma, schoolId, run));
    const existing = new Set((run.invoices ?? []).map((invoice: any) => invoice.studentId));
    const candidates = roster.eligible.filter((student: any) => !existing.has(student.studentId));
    if (cursor && !candidates.some((student: any) => student.studentId === cursor)) throw validation("cursor", "Con trỏ không thuộc kết quả hiện tại.");
    const start = cursor ? candidates.findIndex((student: any) => student.studentId === cursor) + 1 : 0;
    const page = candidates.slice(start, start + limit);
    return { students: page.map((student: any) => ({ id: student.studentId, studentCode: student.studentCode, fullName: student.fullName })), meta: { limit, nextCursor: candidates[start + limit]?.studentId ?? null } };
  }
  async openRun(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    const input = {
      schoolYearId: this.identifier(body?.schoolYearId, "schoolYearId"),
      billingMonth: this.month(body?.billingMonth),
    };
    const work = async (tx: any, operation: string) => {
      const year = await this.lockYear(tx, schoolId, input.schoolYearId);
      if (year.closedAt)
        throw new ConflictException({
          code: "SCHOOL_YEAR_CLOSED",
          message: "Năm học đã đóng chỉ có thể xem.",
        });
      const asOf = this.asOf(input.billingMonth);
      if (asOf < year.startsOn || asOf >= year.endsOn)
        throw validation(
          "billingMonth",
          "Tháng thu phải thuộc năm học đã chọn.",
        );
      const existing = await tx.collectionRun.findFirst({
        where: {
          schoolId,
          schoolYearId: input.schoolYearId,
          billingMonth: input.billingMonth,
        },
        include: this.runInclude,
      });
      if (existing) return this.runDto(existing);
      const run = await tx.collectionRun.create({
        data: {
          schoolId,
          schoolYearId: input.schoolYearId,
          billingMonth: input.billingMonth,
        },
      });
      const transition = await tx.collectionRunLifecycleTransition.create({
        data: {
          schoolId,
          collectionRunId: run.id,
          status: "DRAFT",
          actorIdentityId: identityId,
          membershipId: actor.membershipId,
          operationId: operation,
          sequence: 1,
        },
      });
      // Decision 2026-10-02 §3.2: a new run starts with every ACTIVE FIXED receivable, quantity 1, for everyone.
      // `mutate` already holds the per-School FOR UPDATE, which serializes this seeding with transitionReceivable and every other mutate command, so the
      // lifecycle read below cannot interleave with a deactivation. The FOR SHARE lock on the seeded receivables is the extra line of defense that the line paths use.
      const fixed = (await tx.receivable.findMany({ where: { schoolId, group: { kind: "FIXED" } }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } }, orderBy: { id: "asc" } })).filter((item: any) => item.lifecycleTransitions[0]?.status === "ACTIVE");
      await this.lockReceivablesShared(tx, schoolId, fixed.map((item: any) => item.id));
      // Decision 2026-10-08: a per-day receivable (autoLeaveDeduction) starts at the month's school days instead of 1.
      const [runYear, runMonth] = input.billingMonth.split("-").map(Number);
      const schoolDays = (await this.schoolDays(tx, schoolId, new Date(Date.UTC(runYear!, runMonth! - 1, 1)), new Date(Date.UTC(runYear!, runMonth!, 1)))).length || 1;
      if (fixed.length) await tx.collectionRunTemplateLine.createMany({ data: fixed.map((item: any) => ({ schoolId, collectionRunId: run.id, receivableId: item.id, quantity: item.autoLeaveDeduction ? schoolDays : 1, scopeType: "ALL" as const })) });
      const seeded = await tx.collectionRun.findFirstOrThrow({ where: { id: run.id, schoolId }, include: this.runInclude });
      const outcome = this.runDto({ ...seeded, lifecycleTransitions: [transition] });
      await this.audit(
        tx,
        schoolId,
        identityId,
        actor.membershipId,
        "COLLECTION_RUN_OPENED",
        operation,
        null,
        { ...outcome, seededFixedReceivableIds: fixed.map((item: any) => item.id) },
      );
      return outcome;
    };
    try {
      return await this.mutate(
        actor,
        identityId,
        schoolId,
        routes.openRun,
        key,
        operationId,
        input,
        work,
      );
    } catch (error) {
      if ((error as any)?.code !== "P2002") throw error;
      const existing = await this.prisma.collectionRun.findFirst({
        where: {
          schoolId,
          schoolYearId: input.schoolYearId,
          billingMonth: input.billingMonth,
        },
        include: this.runInclude,
      });
      if (!existing) throw error;
      return {
        id: operationId,
        status: "COMPLETED",
        outcome: this.runDto(existing),
      };
    }
  }
  // ---- Extracurricular resolution (Story 5.36, decision 2026-10-02 §3.2/§3.3) -------------------------------------------------
  // The run's extracurricular facts: ACTIVE classes of the SchoolYear with their receivable facts, the per-run exclusions and the
  // memberships effective at least one day in the billing month. READY/generate/preview read it live; a GENERATED run keeps the class and
  // receivable facts in `extracurricularSnapshot` and reads memberships at the time a Student is added.
  private monthBounds(billingMonth: string) {
    const [year, month] = billingMonth.split("-").map(Number) as [number, number];
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)), startIso: iso(new Date(Date.UTC(year, month - 1, 1))), endIso: iso(new Date(Date.UTC(year, month, 1))) };
  }
  private async memberFacts(client: any, schoolId: string, classIds: string[], billingMonth: string) {
    if (!classIds.length) return [];
    const { start, end } = this.monthBounds(billingMonth);
    const rows = await client.extracurricularMembership.findMany({
      where: { schoolId, extracurricularClassId: { in: classIds }, effectiveFrom: { lt: end }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }] },
      select: { extracurricularClassId: true, enrollmentId: true, effectiveFrom: true, effectiveTo: true, enrollment: { select: { studentId: true } } },
      orderBy: [{ extracurricularClassId: "asc" }, { enrollmentId: "asc" }, { effectiveFrom: "asc" }],
    });
    return rows.map((row: any) => ({ classId: row.extracurricularClassId, enrollmentId: row.enrollmentId, studentId: row.enrollment.studentId, from: row.effectiveFrom.toISOString().slice(0, 10), to: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null }));
  }
  private receivableFacts(receivable: any) {
    return { name: receivable.displayName, code: receivable.code ?? null, unitLabel: receivable.unitLabel, defaultUnitPrice: receivable.defaultUnitPrice.toString(), taxCategory: receivable.taxCategory ?? "NOT_DECLARED" };
  }
  private async extracurricularResolution(client: any, schoolId: string, run: any, lock = false) {
    const classes = await client.extracurricularClass.findMany({
      where: { schoolId, schoolYearId: run.schoolYearId },
      include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } }, lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } },
      orderBy: { id: "asc" },
    });
    const active = classes.filter((item: any) => item.lifecycleTransitions[0]?.status === "ACTIVE");
    // Membership mutations take the class FOR UPDATE; sharing it here gives READY/generate one stable view of the class members.
    if (lock && active.length) await client.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "schoolId" = ${schoolId}::uuid AND "id" = ANY(${active.map((item: any) => item.id)}::uuid[]) ORDER BY "id" FOR SHARE`;
    const excluded = new Set((await client.collectionRunExtracurricularExclusion.findMany({ where: { schoolId, collectionRunId: run.id }, select: { extracurricularClassId: true } })).map((item: any) => item.extracurricularClassId));
    const members = await this.memberFacts(client, schoolId, active.map((item: any) => item.id), run.billingMonth);
    return {
      classes: active.map((item: any) => ({ id: item.id, name: item.name, receivableId: item.receivableId, excluded: excluded.has(item.id), receivableActive: item.receivable.lifecycleTransitions[0]?.status === "ACTIVE", receivable: this.receivableFacts(item.receivable), members: members.filter((member: any) => member.classId === item.id) })),
    };
  }
  private async snapshotResolution(client: any, schoolId: string, run: any) {
    const stored = ((run.extracurricularSnapshot as any)?.classes ?? []) as any[];
    const members = await this.memberFacts(client, schoolId, stored.map((item) => item.id), run.billingMonth);
    return { classes: stored.map((item) => ({ ...item, members: members.filter((member: any) => member.classId === item.id) })) };
  }
  // The resolution a run uses: live while DRAFT/READY, snapshot-based once generated.
  private async runResolution(client: any, schoolId: string, run: any, lock = false) {
    const status = run.lifecycleTransitions?.[0]?.status ?? run.status;
    return ["GENERATED", "CLOSED"].includes(status) && run.extracurricularSnapshot ? this.snapshotResolution(client, schoolId, run) : this.extracurricularResolution(client, schoolId, run, lock);
  }
  private snapshotOfResolution(resolution: { classes: any[] }) {
    return { classes: resolution.classes.map(({ members, ...item }: any) => item) };
  }
  // Fingerprint facts: the class set with exclusions and receivable facts, and the member intervals of billable classes only.
  private resolutionFacts(resolution: { classes: any[] }) {
    return resolution.classes.map((item: any) => ({ id: item.id, name: item.name, receivableId: item.receivableId, excluded: item.excluded, receivableActive: item.receivableActive, receivable: item.receivable, members: item.excluded || !item.receivableActive ? [] : item.members.map((member: any) => [member.enrollmentId, member.from, member.to]) }));
  }
  private extracurricularBillable(item: any) {
    return !item.excluded && item.receivableActive;
  }
  // One merged line per extracurricular Receivable for an enrollment: default price, quantity 1, no proration.
  private extracurricularLines(resolution: { classes: any[] }, enrollmentId: string, billingMonth: string) {
    const { startIso, endIso } = this.monthBounds(billingMonth);
    const byReceivable = new Map<string, any>();
    for (const item of resolution.classes) {
      if (!this.extracurricularBillable(item)) continue;
      for (const member of item.members) {
        if (member.enrollmentId !== enrollmentId) continue;
        const entry = byReceivable.get(item.receivableId) ?? { receivable: item.receivable, receivableId: item.receivableId, intervals: [] };
        entry.intervals.push({ classId: item.id, className: item.name, from: member.from, to: member.to });
        byReceivable.set(item.receivableId, entry);
      }
    }
    return [...byReceivable.values()].sort((a, b) => a.receivableId.localeCompare(b.receivableId)).map((entry) => {
      const classes: Array<{ id: string; name: string; effectiveFrom: string; effectiveTo: string | null }> = [];
      for (const interval of [...entry.intervals].sort((a: any, b: any) => a.from.localeCompare(b.from) || a.className.localeCompare(b.className))) {
        const known = classes.find((item) => item.id === interval.classId);
        const last = interval.to ? new Date(`${interval.to}T00:00:00.000Z`) : null;
        last?.setUTCDate(last.getUTCDate() - 1);
        const inclusive = last ? last.toISOString().slice(0, 10) : null;
        if (known) known.effectiveTo = known.effectiveTo === null || inclusive === null ? null : (inclusive > known.effectiveTo ? inclusive : known.effectiveTo);
        else classes.push({ id: interval.classId, name: interval.className, effectiveFrom: interval.from, effectiveTo: inclusive });
      }
      const flags: string[] = [];
      if (classes.length > 1) flags.push("CLASS_CHANGE");
      else {
        const only = entry.intervals as Array<{ from: string; to: string | null }>;
        const first = only.reduce((min, item) => (item.from < min ? item.from : min), only[0]!.from);
        const open = only.some((item) => item.to === null);
        const lastEnd = open ? null : only.reduce((max, item) => (item.to! > max ? item.to! : max), only[0]!.to!);
        if (first > startIso || (lastEnd !== null && lastEnd < endIso)) flags.push("MID_MONTH");
      }
      const price = entry.receivable.defaultUnitPrice as string;
      return { templateLineId: null, kind: "EXTRACURRICULAR", receivableId: entry.receivableId, receivableCode: entry.receivable.code, receivableName: entry.receivable.name, unitLabel: entry.receivable.unitLabel, defaultUnitPrice: price, quantity: 1, amount: price, taxCategory: entry.receivable.taxCategory, scope: null, extracurricular: { classes, flags } };
    });
  }
  private async selectionPreview(
    client: any,
    schoolId: string,
    run: any,
    studentIds?: string[],
    templateLines: any[] = [],
    extracurricular: { classes: any[] } = { classes: [] },
  ) {
    const asOf = this.asOf(run.billingMonth);
    const requestedStudentIds = studentIds ? [...new Set(studentIds)].sort() : null;
    const enrollments = await client.studentEnrollment.findMany({
      where: {
        schoolId,
        schoolYearId: run.schoolYearId,
        ...(requestedStudentIds ? { studentId: { in: requestedStudentIds } } : {}),
      },
      include: {
        student: true,
      },
      orderBy: [{ studentId: "asc" }, { effectiveFrom: "desc" }, { id: "asc" }],
    });
    const rosterStudentIds: string[] = requestedStudentIds ?? [...new Set<string>(enrollments.map((item: any) => item.studentId as string))].sort();
    const byStudent = new Map<string, any>();
    for (const enrollment of enrollments as any[]) if (!byStudent.has(enrollment.studentId as string)) byStudent.set(enrollment.studentId as string, enrollment);
    const assignments = await client.enrollmentClassAssignment.findMany({
      where: { schoolId, enrollmentId: { in: [...byStudent.values()].map((enrollment) => enrollment.id) } },
      include: { classroom: true },
      orderBy: [{ enrollmentId: "asc" }, { effectiveFrom: "desc" }, { id: "asc" }],
    });
    const assignmentByEnrollment = new Map<string, any>();
    for (const assignment of assignments) {
      if (assignment.effectiveFrom > asOf || (assignment.effectiveTo && assignment.effectiveTo <= asOf)) continue;
      if (!assignmentByEnrollment.has(assignment.enrollmentId)) assignmentByEnrollment.set(assignment.enrollmentId, assignment);
    }
    const eligible: any[] = [];
    const skips: any[] = [];
    const sources: any[] = [];
    for (const studentId of rosterStudentIds) {
      const enrollment: any = byStudent.get(studentId);
      const assignment = enrollment ? assignmentByEnrollment.get(enrollment.id) : undefined;
      const skipped = (reason: string) =>
        skips.push({
          studentId,
          ...(enrollment
            ? {
                studentCode: enrollment.student.studentCode,
                fullName: enrollment.student.fullName,
              }
            : {}),
          reason,
        });
      if (!enrollment) skipped("NO_ENROLLMENT");
      else if (
        enrollment.effectiveFrom > asOf ||
        (enrollment.endedOn && enrollment.endedOn <= asOf)
      )
        skipped("ENROLLMENT_NOT_EFFECTIVE");
      // Decision 2026-10-08: an extracurricular-only Student is eligible without a class, for the lines that apply to them only.
      else if (enrollment.lifecycle === EXTRACURRICULAR_ONLY)
        eligible.push({
          studentId: enrollment.studentId,
          studentCode: enrollment.student.studentCode,
          fullName: enrollment.student.fullName,
          classId: null,
          className: extracurricularOnlyLabel,
          extracurricularOnly: true,
          enrollment,
          assignment: null,
        });
      else if (enrollment.lifecycle !== "ENROLLED") skipped("NOT_ENROLLED");
      else if (!assignment) skipped("NO_CLASS_ASSIGNMENT");
      else if (assignment.classroom.status !== "ACTIVE") skipped("CLASS_INACTIVE");
      else
        eligible.push({
          studentId: enrollment.studentId,
          studentCode: enrollment.student.studentCode,
          fullName: enrollment.student.fullName,
          classId: assignment.classId,
          className: assignment.classroom.name,
          enrollment,
          assignment,
        });
      if (enrollment)
        sources.push({
          studentId,
          enrollmentId: enrollment.id,
          lifecycle: enrollment.lifecycle,
          enrollmentInterval: [
            enrollment.effectiveFrom.toISOString(),
            enrollment.endedOn?.toISOString() ?? null,
          ],
          assignmentId: assignment?.id ?? null,
            assignmentInterval: assignment
              ? [
                assignment.effectiveFrom.toISOString(),
                assignment.effectiveTo?.toISOString() ?? null,
              ]
            : null,
        });
    }
    const promotionFacts = (await this.promotionFacts(client, schoolId, asOf, rosterStudentIds, [...templateLines.map((line) => line.receivableId), ...extracurricular.classes.filter((item) => this.extracurricularBillable(item)).map((item) => item.receivableId)])).sort((a: any, b: any) => a.studentId.localeCompare(b.studentId) || a.receivableId.localeCompare(b.receivableId) || a.policyId.localeCompare(b.policyId) || a.assignmentId.localeCompare(b.assignmentId));
    // D11: coverage issued in an earlier SchoolYear still covers this month.
    const covered = await client.studentPromotionalCoverage.findMany({ where: { schoolId, studentId: { in: rosterStudentIds }, billingMonth: run.billingMonth }, select: { studentId: true, receivableId: true } });
    const coveredKeys = new Set(covered.map((item: any) => `${item.studentId}:${item.receivableId}`));
    // Decision 2026-10-02 §3.4: an eligible Student with no applicable template line (after scope) is skipped, never billed an empty Invoice.
    const applicable: any[] = [];
    const extraByStudent = new Map<string, any[]>();
    for (const item of eligible) extraByStudent.set(item.studentId, this.extracurricularLines(extracurricular, item.enrollment.id, run.billingMonth));
    for (const item of eligible) {
      if (templateLines.some((line) => this.inScope(line, item)) || extraByStudent.get(item.studentId)!.length) applicable.push(item);
      else skips.push({ studentId: item.studentId, studentCode: item.studentCode, fullName: item.fullName, reason: "NO_APPLICABLE_LINES" });
    }
    const eligibleRows = applicable.sort((a, b) => a.studentId.localeCompare(b.studentId)).map(({ enrollment, assignment, ...item }) => ({
      ...item,
      lines: [...templateLines.filter((line) => this.inScope(line, item)), ...(extraByStudent.get(item.studentId) ?? [])].filter((line) => !coveredKeys.has(`${item.studentId}:${line.receivableId}`)).map((line) => ({ ...this.withTax(this.evaluatePromotionLine(item.studentId, line, promotionFacts), line.taxCategory), templateLineId: line.templateLineId, ...(line.kind === "EXTRACURRICULAR" ? { kind: "EXTRACURRICULAR", extracurricular: line.extracurricular } : {}) })),
    }));
    const facts = {
      runId: run.id,
      billingMonth: run.billingMonth,
      schoolYear: {
        id: run.schoolYear.id,
        startsOn: run.schoolYear.startsOn.toISOString(),
        endsOn: run.schoolYear.endsOn.toISOString(),
        closedAt: run.schoolYear.closedAt?.toISOString() ?? null,
      },
      rosterStudentIds,
      templateLines: [...templateLines].sort((a: any, b: any) => a.receivableId.localeCompare(b.receivableId) || a.templateLineId.localeCompare(b.templateLineId)),
      extracurricular: this.resolutionFacts(extracurricular),
       promotionFacts: promotionFacts.map((fact: any) => ({
        assignmentId: fact.assignmentId, studentId: fact.studentId, policyId: fact.policyId,
        versionId: fact.versionId, targetId: fact.targetId, receivableId: fact.receivableId,
        discountType: fact.discountType, discountValue: fact.discountValue.toString(), priority: fact.priority,
        stackingMode: fact.stackingMode, versionInterval: fact.versionInterval,
        assignmentInterval: fact.assignmentInterval, assignmentReason: fact.assignmentReason,
       })),
      coverageSelections: [],
      futureCoverageFacts: [],
      sources: sources.sort((a: any, b: any) => a.studentId.localeCompare(b.studentId)),
      eligible: eligibleRows,
        skips: skips.sort((a: any, b: any) => a.studentId.localeCompare(b.studentId) || a.reason.localeCompare(b.reason)), covered: [...coveredKeys].sort(),
    };
    return {
      run: this.runDto(run),
      eligible: eligibleRows,
      skips: facts.skips,
      coverageSelections: [],
      futureCoverageFacts: [],
      fingerprint: requestFingerprint(facts),
      // This is the sole roster result used to create invoice snapshots below.
      snapshots: applicable.map((item) => ({
        ...item,
         calculatedLines: eligibleRows.find((row) => row.studentId === item.studentId)!.lines,
         extracurricularLines: extraByStudent.get(item.studentId) ?? [],
      })),
    };
  }
  private async deriveInvoiceCoverageFacts(
    tx: any,
    schoolId: string,
    invoice: any,
    versionId: string,
  ) {
    const version = await tx.promotionPolicyVersion.findFirst({
      where: { id: versionId, schoolId },
      include: {
        targets: {
          include: { receivable: true },
          orderBy: { receivable: { displayName: "asc" } },
        },
      },
    });
    if (
      !version ||
      version.status !== "ACTIVE" ||
      version.fulfillmentMode !== "PREPAID_COVERAGE" ||
      !version.targets.length ||
      !version.prepaidTermMonths ||
      version.prepaidTermMonths < 1
    ) {
      throw validation(
        "versionId",
        "Gói nộp trước không hợp lệ hoặc không còn áp dụng.",
      );
    }
    for (const target of version.targets) {
      if (
        target.schoolId !== schoolId ||
        target.receivable.schoolId !== schoolId
      ) {
        throw validation("versionId", "Khoản thu mục tiêu không thuộc Trường.");
      }
      // Coverage is settled by this Invoice's Receipt, so its receivables must be paid into the same account.
      if (taxChannel(target.receivable.taxCategory) !== invoice.channel) {
        throw validation("versionId", "Khoản thu của ưu đãi nộp trước phải cùng loại tài khoản nhận với phần hóa đơn này.");
      }
    }

    const run = await this.lockRun(tx, schoolId, invoice.collectionRunId);
    if (run.status === "CLOSED" || run.type !== "MONTHLY") {
      throw new ConflictException({
        code: "COLLECTION_RUN_STATE_CONFLICT",
        message: "Chỉ áp dụng gói nộp trước cho đợt thu tháng chưa đóng.",
      });
    }

    const year = await this.lockYear(tx, schoolId, invoice.schoolYearId);
    if (year.closedAt) {
      throw new ConflictException({
        code: "SCHOOL_YEAR_CLOSED",
        message: "Năm học đã đóng.",
      });
    }

    const [runYear, runMonth] = run.billingMonth.split("-").map(Number);
    const periods: Array<{
      billingMonth: string;
      serviceStart: Date;
      serviceEnd: Date;
    }> = [];
    for (let i = 0; i < version.prepaidTermMonths; i++) {
      const totalMonth = runMonth - 1 + i;
      const pYear = runYear + Math.floor(totalMonth / 12);
      const pMonth = (totalMonth % 12) + 1;
      const billingMonth = `${pYear}-${String(pMonth).padStart(2, "0")}`;
      const serviceStart = new Date(Date.UTC(pYear, pMonth - 1, 1));
      const serviceEnd = new Date(Date.UTC(pYear, pMonth, 1));
      periods.push({ billingMonth, serviceStart, serviceEnd });
    }

    const facts: any[] = [];
    for (const period of periods) {
      // D11: a package covers consecutive calendar months and may continue into the next SchoolYear.
      if (period.serviceStart < year.startsOn) {
        throw new ConflictException({
          code: "COVERAGE_PERIOD_OUT_OF_BOUNDS",
          message: "Các tháng của gói nộp trước vượt quá giới hạn năm học.",
        });
      }

      if (
        version.effectiveFrom > period.serviceStart ||
        (version.effectiveTo && version.effectiveTo < period.serviceEnd)
      ) {
        throw new ConflictException({
          code: "COVERAGE_VERSION_NOT_EFFECTIVE",
          message:
            "Gói nộp trước không còn hiệu lực trong toàn bộ thời hạn.",
        });
      }

      const calendar = await tx.schoolCalendarVersion.findFirst({
        where: { schoolId, effectiveFrom: { lte: period.serviceStart } },
        include: { holidays: true },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!calendar) {
        throw new ConflictException({
          code: "COVERAGE_CALENDAR_NOT_CONFIGURED",
          message: "Chưa cấu hình lịch hoạt động cho kỳ nộp trước.",
        });
      }

      let operatingDays = 0;
      for (
        let cursor = new Date(period.serviceStart);
        cursor < period.serviceEnd;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        if (
          cursor.getUTCDay() !== 0 &&
          !calendar.holidays.some(
            (h: any) => h.startsOn <= cursor && h.endsOn >= cursor,
          )
        ) {
          operatingDays++;
        }
      }
      if (operatingDays <= 0) {
        throw new ConflictException({
          code: "COVERAGE_NO_OPERATING_DAYS",
          message: "Một tháng của gói nộp trước không có ngày học hợp lệ.",
        });
      }

      // Months of a later SchoolYear have no enrollment yet; the current enrollment must cover the rest.
      const enrollment = period.serviceStart >= year.endsOn ? true : await tx.studentEnrollment.findFirst({
        where: {
          schoolId,
          studentId: invoice.studentId,
          schoolYearId: invoice.schoolYearId,
          lifecycle: "ENROLLED",
          effectiveFrom: { lte: period.serviceStart },
          OR: [
            { endedOn: null },
            { endedOn: { gte: period.serviceEnd } },
          ],
        },
      });
      if (!enrollment) {
        throw new ConflictException({
          code: "COVERAGE_ENROLLMENT_INVALID",
          message:
            "Học sinh không có ghi danh hợp lệ bao phủ trọn vẹn kỳ nộp trước.",
        });
      }

      for (const target of version.targets) {
        const issued = await tx.studentPromotionalCoverage.findFirst({
          where: {
            schoolId,
            studentId: invoice.studentId,
            receivableId: target.receivableId,
            billingMonth: period.billingMonth,
          },
          select: { id: true },
        });
        if (issued) {
          throw new ConflictException({
            code: "COVERAGE_ALREADY_ISSUED",
            message: `Khoản thu ${target.receivable.displayName} kỳ ${period.billingMonth} đã có coverage được phát hành.`,
          });
        }

        const reserved = await tx.invoicePromotionCoverageFact.findFirst({
          where: {
            schoolId,
            studentId: invoice.studentId,
            receivableId: target.receivableId,
            billingMonth: period.billingMonth,
            invoiceId: { not: invoice.id },
            invoice: { status: { in: ["DRAFT", "ISSUED"] } },
          },
          select: { id: true },
        });
        if (reserved) {
          throw new ConflictException({
            code: "COVERAGE_ALREADY_RESERVED",
            message: `Khoản thu ${target.receivable.displayName} kỳ ${period.billingMonth} đang được giữ bởi hóa đơn khác.`,
          });
        }

        const otherPromotion = await tx.issuedPromotionApplication.findFirst({
          where: {
            schoolId,
            invoice: {
              studentId: invoice.studentId,
              billingMonth: period.billingMonth,
              id: { not: invoice.id },
              status: { in: ["ISSUED", "CLOSED"] },
            },
            invoiceLine: { receivableId: target.receivableId },
          },
          select: { id: true },
        });
        if (otherPromotion) {
          throw new ConflictException({
            code: "PROMOTION_POLICY_CONFLICT",
            message: `Khoản thu ${target.receivable.displayName} kỳ ${period.billingMonth} đã có ưu đãi trên hóa đơn khác.`,
          });
        }

        const originalPrice = target.receivable.defaultUnitPrice;
        const discountValue = BigInt(version.discountValue);
        const requestedReduction =
          version.discountType === "FIXED_VND"
            ? discountValue
            : (originalPrice * discountValue) / 100n;
        const reduction =
          requestedReduction > originalPrice ? originalPrice : requestedReduction;

        facts.push({
          schoolId,
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          schoolYearId: invoice.schoolYearId,
          receivableId: target.receivableId,
          billingMonth: period.billingMonth,
          policyId: version.policyId,
          versionId: version.id,
          targetId: target.id,
          assignmentId: null,
          originalPrice,
          reduction,
          serviceStart: period.serviceStart,
          serviceEnd: period.serviceEnd,
          calendarEffectiveFrom: calendar.effectiveFrom,
          timezone: "Asia/Ho_Chi_Minh",
        });
      }
    }
    return facts;
  }

  private async verifyInvoiceCoverageFacts(
    tx: any,
    schoolId: string,
    invoice: any,
    facts: any[],
  ) {
    if (!facts.length) return;
    const versionId = facts[0].versionId;
    const derived = await this.deriveInvoiceCoverageFacts(
      tx,
      schoolId,
      invoice,
      versionId,
    );
    if (derived.length !== facts.length) {
      throw new ConflictException({
        code: "COVERAGE_FACTS_STALE",
        message: "Gói nộp trước đã thay đổi so với máy chủ. Hãy tải lại hóa đơn.",
      });
    }
    for (const d of derived) {
      const match = facts.find(
        (f: any) =>
          f.receivableId === d.receivableId && f.billingMonth === d.billingMonth,
      );
      if (
        !match ||
        BigInt(match.originalPrice) !== BigInt(d.originalPrice) ||
        BigInt(match.reduction) !== BigInt(d.reduction) ||
        new Date(match.serviceStart).toISOString().slice(0, 10) !==
          d.serviceStart.toISOString().slice(0, 10) ||
        new Date(match.serviceEnd).toISOString().slice(0, 10) !==
          d.serviceEnd.toISOString().slice(0, 10) ||
        new Date(match.calendarEffectiveFrom).toISOString().slice(0, 10) !==
          d.calendarEffectiveFrom.toISOString().slice(0, 10)
      ) {
        throw new ConflictException({
          code: "COVERAGE_FACTS_STALE",
          message: "Gói nộp trước đã thay đổi so với máy chủ. Hãy tải lại hóa đơn.",
        });
      }
    }
  }

  private async syncInvoiceLinesCoverageSuppression(
    tx: any,
    schoolId: string,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, schoolId },
      include: {
        lines: true,
        coverageFacts: true,
      },
    });
    if (!invoice || invoice.status !== "DRAFT") return;

    const coveredReceivableIds = new Set(
      (invoice.coverageFacts ?? [])
        .filter((f: any) => f.billingMonth === invoice.billingMonth)
        .map((f: any) => f.receivableId),
    );

    for (const line of invoice.lines) {
      if (line.kind === "PRIOR_DEBT" || !line.receivableId) continue;
      if (coveredReceivableIds.has(line.receivableId)) {
        // The package is paid on this line: one month per coverage fact at its original price, less the package
        // reduction. Every later run skips the covered months, so the line must collect all of them now.
        const months = invoice.coverageFacts.filter((fact: any) => fact.receivableId === line.receivableId);
        const unitPrice = BigInt(months[0].originalPrice);
        let gross = 0n;
        let reduction = 0n;
        for (const fact of months) { gross += BigInt(fact.originalPrice); reduction += BigInt(fact.reduction); }
        const discount = reduction > gross ? gross : reduction;
        const net = gross - discount - BigInt(line.deductionAmount);
        await tx.invoiceLine.update({
          where: { id: line.id },
          data: {
            quantity: months.length,
            unitPrice,
            grossAmount: gross,
            discountAmount: discount,
            netAmount: net,
            ...taxedLine(net, line.taxCategorySnapshot ?? "NOT_DECLARED"),
            promotionEvaluationProvenance: Prisma.DbNull,
          },
        });
      } else {
        const evaluated = await this.evaluateDraftPromotion(
          tx,
          schoolId,
          invoice,
          {
            receivableId: line.receivableId,
            receivableName: line.receivableNameSnapshot,
            amount: line.grossAmount,
          },
        );
        await tx.invoiceLine.update({
          where: { id: line.id },
          data: {
            discountAmount: BigInt(evaluated.discountAmount),
            netAmount: BigInt(evaluated.netAmount) - BigInt(line.deductionAmount),
            ...taxedLine(BigInt(evaluated.netAmount) - BigInt(line.deductionAmount), line.taxCategorySnapshot ?? "NOT_DECLARED"),
            promotionEvaluationProvenance: evaluated.promotionEvaluation,
          },
        });
      }
    }
  }

  async applyInvoiceCoverage(
    identityId: string,
    schoolId: string,
    invoiceId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(invoiceId, "invoiceId");

    if (body && typeof body === "object") {
      const allowed = new Set(["versionId"]);
      for (const k of Object.keys(body)) {
        if (!allowed.has(k)) {
          throw validation(
            "versionId",
            `Không được chỉ định trường ${k} trong payload coverage.`,
          );
        }
      }
    }

    const rawVersion = body?.versionId;
    const versionId =
      rawVersion === null || rawVersion === undefined || rawVersion === ""
        ? null
        : this.identifier(rawVersion, "versionId");

    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.invoiceCoverage,
      key,
      operationId,
      { invoiceId, versionId },
      async (tx, operation) => {
        await this.promotionLock(tx, schoolId);
        await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;

        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, schoolId },
          include: { lines: true, coverageFacts: true },
        });
        if (!invoice) {
          throw new NotFoundException({
            code: "INVOICE_NOT_FOUND",
            message: "Không tìm thấy hóa đơn.",
          });
        }
        if (invoice.status !== "DRAFT") {
          throw new ConflictException({
            code: "INVOICE_NOT_DRAFT",
            message: "Chỉ được thay đổi gói nộp trước trên hóa đơn nháp.",
          });
        }

        const run = await this.lockRun(tx, schoolId, invoice.collectionRunId);
        if (run.status === "CLOSED" || run.type !== "MONTHLY") {
          throw new ConflictException({
            code: "COLLECTION_RUN_STATE_CONFLICT",
            message: "Chỉ áp dụng gói nộp trước cho đợt thu tháng chưa đóng.",
          });
        }
        const year = await this.lockYear(tx, schoolId, invoice.schoolYearId);
        if (year.closedAt) {
          throw new ConflictException({
            code: "SCHOOL_YEAR_CLOSED",
            message: "Năm học đã đóng.",
          });
        }

        // A payment notice has one part per receiving account; coverage belongs to the part its receivables are paid into,
        // whichever part the review page has open.
        await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "schoolId" = ${schoolId}::uuid AND "studentId" = ${invoice.studentId}::uuid AND "collectionRunId" = ${invoice.collectionRunId}::uuid FOR UPDATE`;
        const draftParts = await tx.invoice.findMany({
          where: { schoolId, studentId: invoice.studentId, collectionRunId: invoice.collectionRunId, status: "DRAFT", revisesInvoiceId: invoice.revisesInvoiceId },
          include: { lines: true, coverageFacts: true },
        });
        const clearParts = async () => {
          for (const part of draftParts) {
            if (!part.coverageFacts.length) continue;
            // A covered line returns to one month at its price before the normal promotion evaluation below.
            const coveredIds = new Set(part.coverageFacts.map((fact: any) => fact.receivableId));
            for (const line of part.lines.filter((item: any) => item.kind === "NORMAL" && coveredIds.has(item.receivableId))) {
              const net = BigInt(line.unitPrice) - BigInt(line.deductionAmount);
              await tx.invoiceLine.update({ where: { id: line.id }, data: { quantity: 1, grossAmount: BigInt(line.unitPrice), discountAmount: 0n, netAmount: net, ...taxedLine(net, line.taxCategorySnapshot ?? "NOT_DECLARED") } });
            }
            await tx.invoicePromotionCoverageFact.deleteMany({ where: { schoolId, invoiceId: part.id } });
            await this.syncInvoiceLinesCoverageSuppression(tx, schoolId, part.id);
          }
        };

        if (versionId === null) {
          await clearParts();
          const outcome = await this.refreshInvoice(tx, schoolId, invoiceId);
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "INVOICE_COVERAGE_REMOVED",
            operation,
            { invoiceId },
            outcome,
          );
          return outcome;
        }

        const targets = await tx.promotionPolicyTarget.findMany({ where: { schoolId, versionId }, include: { receivable: { select: { taxCategory: true } } } });
        const channels = new Set(targets.map((target: any) => taxChannel(target.receivable.taxCategory)));
        if (channels.size > 1) throw validation("versionId", "Các khoản thu của ưu đãi nộp trước phải thu vào cùng một loại tài khoản (cùng tài khoản trường hoặc cùng tài khoản cá nhân).");
        const [channel] = [...channels];
        const target = channel ? draftParts.find((part: any) => part.channel === channel) ?? (invoice.channel === channel ? invoice : undefined) : invoice;
        if (!target) throw validation("versionId", channel === "SCHOOL" ? "Hóa đơn chưa có phần thu vào tài khoản trường để áp dụng ưu đãi nộp trước này." : "Hóa đơn chưa có phần thu vào tài khoản cá nhân để áp dụng ưu đãi nộp trước này.");

        const derivedFacts = await this.deriveInvoiceCoverageFacts(
          tx,
          schoolId,
          target,
          versionId,
        );

        await clearParts();
        await tx.invoicePromotionCoverageFact.deleteMany({
          where: { schoolId, invoiceId: target.id },
        });

        for (const fact of derivedFacts) {
          await tx.invoicePromotionCoverageFact.create({ data: fact });
        }

        await this.syncInvoiceLinesCoverageSuppression(tx, schoolId, target.id);
        const outcome = await this.refreshInvoice(tx, schoolId, target.id);
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "INVOICE_COVERAGE_APPLIED",
          operation,
          { invoiceId: target.id, versionId },
          outcome,
        );
        return outcome;
      },
    );
  }

  private async promotionFacts(client: any, schoolId: string, asOf: Date, studentIds: string[], receivableIds: string[]) {
    if (!studentIds.length || !receivableIds.length) return [];
    // READY and generate call this within their transaction; these locks prevent a policy fact
    // changing between the fingerprint recheck and the staged calculation snapshot.
    if (client.$queryRaw) {
      await client.$queryRaw`SELECT 1 FROM "PromotionPolicyVersion" WHERE "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      await client.$queryRaw`SELECT 1 FROM "PromotionPolicyTarget" WHERE "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      await client.$queryRaw`SELECT 1 FROM "StudentPromotionAssignment" WHERE "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    }
    const assignments = await client.studentPromotionAssignment.findMany({
      where: {
        schoolId, studentId: { in: studentIds }, effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        version: { status: "ACTIVE", fulfillmentMode: "DISCOUNT", effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }], targets: { some: { receivableId: { in: receivableIds } } } },
      },
      include: { version: { include: { targets: { where: { schoolId, receivableId: { in: receivableIds } } } } } },
    });
    return assignments.flatMap((assignment: any) => assignment.version.targets.map((target: any) => ({
      assignmentId: assignment.id, studentId: assignment.studentId, policyId: assignment.policyId,
      versionId: assignment.versionId, targetId: target.id, receivableId: target.receivableId,
      discountType: assignment.version.discountType, discountValue: assignment.version.discountValue,
      priority: assignment.version.priority, stackingMode: assignment.version.stackingMode,
      versionInterval: [assignment.version.effectiveFrom.toISOString(), assignment.version.effectiveTo?.toISOString() ?? null],
      assignmentInterval: [assignment.effectiveFrom.toISOString(), assignment.effectiveTo?.toISOString() ?? null],
      assignmentReason: assignment.reason,
    })));
  }
  private evaluatePromotionLine(studentId: string, line: any, facts: any[]) {
    const gross = BigInt(line.amount);
    let discount = 0n;
    const applications: any[] = [];
    const ordered = facts.filter((fact) => fact.studentId === studentId && fact.receivableId === line.receivableId)
      .sort((a, b) => (a.discountType === b.discountType ? b.priority - a.priority || a.policyId.localeCompare(b.policyId) : a.discountType === "FIXED_VND" ? -1 : 1));
    // An exclusive policy owns this receivable for the month, including against policies
    // that would otherwise sort before it by discount type or priority.
    const exclusive = ordered.find((fact) => fact.stackingMode === "EXCLUSIVE");
    // Fixed reductions can stack; percentage reduction is singular and deterministic.
    const candidates = exclusive ? [exclusive] : [...ordered.filter((fact) => fact.discountType === "FIXED_VND"), ...ordered.filter((fact) => fact.discountType === "PERCENTAGE").slice(0, 1)];
    for (const fact of candidates) {
      const remaining = gross - discount;
      if (remaining <= 0n) break;
      const requested = fact.discountType === "FIXED_VND" ? fact.discountValue : remaining * fact.discountValue / 100n;
      const applied = requested > remaining ? remaining : requested;
      applications.push({ policyId: fact.policyId, versionId: fact.versionId, targetId: fact.targetId, assignmentId: fact.assignmentId, assignmentReason: fact.assignmentReason, versionInterval: fact.versionInterval, assignmentInterval: fact.assignmentInterval, discountType: fact.discountType, discountValue: fact.discountValue.toString(), priority: fact.priority, stackingMode: fact.stackingMode, appliedDiscount: applied.toString() });
      discount += applied;
      if (fact.stackingMode === "EXCLUSIVE") break;
    }
    return {
      receivableId: line.receivableId, receivableName: line.receivableName, grossAmount: gross.toString(), discountAmount: discount.toString(), netAmount: (gross - discount).toString(),
      promotionEvaluation: { version: "PROMOTION_EVALUATION_V1", applications },
    };
  }
  // Template snapshots written before the tax decision have no category and stay untaxed.
  private withTax(evaluated: ReturnType<FinanceService["evaluatePromotionLine"]>, category: TaxCategory = "NOT_DECLARED") {
    const tax = taxedLine(BigInt(evaluated.netAmount), category);
    return { ...evaluated, taxCategory: category, channel: taxChannel(category), vatRate: tax.vatRateSnapshot, vatAmount: tax.vatAmount.toString(), amount: tax.amount.toString() };
  }
  private samePromotionEvaluation(draft: any, rechecked: any) {
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
    return JSON.stringify(canonical(draft)) === JSON.stringify(canonical(rechecked));
  }
  private async recheckPromotion(tx: any, schoolId: string, invoice: any, billingMonth: string) {
    const calculatedLines = invoice.lines.filter((line: any) => line.kind !== "PRIOR_DEBT" && line.promotionEvaluationProvenance);
    if (!calculatedLines.length) return [];
    const facts = await this.promotionFacts(tx, schoolId, this.asOf(billingMonth), [invoice.studentId], calculatedLines.map((line: any) => line.receivableId));
    const applications: any[] = [];
    for (const line of calculatedLines) {
      const rechecked = this.evaluatePromotionLine(invoice.studentId, { ...line, amount: line.grossAmount, receivableName: line.receivableNameSnapshot }, facts);
      const draft = { receivableId: line.receivableId, receivableName: line.receivableNameSnapshot, grossAmount: line.grossAmount.toString(), discountAmount: line.discountAmount.toString(), netAmount: (BigInt(line.netAmount) + BigInt(line.deductionAmount ?? 0)).toString(), promotionEvaluation: line.promotionEvaluationProvenance };
      if (!this.samePromotionEvaluation(draft, rechecked))
        throw new ConflictException({ code: "PROMOTION_REVIEW_REQUIRED", message: "Kết quả ưu đãi đã thay đổi. Hãy rà soát lại hóa đơn trước khi phát hành." });
      applications.push(...rechecked.promotionEvaluation.applications.map((application: any, ordinal: number) => ({ ...application, invoiceLineId: line.id, ordinal })));
    }
    return applications;
  }
  private async evaluateDraftPromotion(tx: any, schoolId: string, invoice: any, line: any) {
    const facts = await this.promotionFacts(tx, schoolId, this.asOf(invoice.billingMonth), [invoice.studentId], [line.receivableId]);
    return this.evaluatePromotionLine(invoice.studentId, line, facts);
  }
  private async createIssuedPromotionApplications(tx: any, schoolId: string, invoiceId: string, applications: any[]) {
    if (!applications.length) return;
    const lines = await tx.invoiceLine.findMany({ where: { schoolId, invoiceId }, select: { id: true, grossAmount: true, discountAmount: true, netAmount: true } });
    const amounts = new Map<string, { id: string; grossAmount: bigint; discountAmount: bigint; netAmount: bigint }>(lines.map((line: any) => [line.id, line]));
    await tx.issuedPromotionApplication.createMany({ data: applications.map((application: any) => ({
      schoolId, invoiceId, invoiceLineId: application.invoiceLineId, ordinal: application.ordinal,
      policyId: application.policyId, versionId: application.versionId, targetId: application.targetId, assignmentId: application.assignmentId,
      discountType: application.discountType, discountValue: BigInt(application.discountValue), priority: application.priority,
      stackingMode: application.stackingMode, appliedDiscount: BigInt(application.appliedDiscount),
      grossAmount: amounts.get(application.invoiceLineId)!.grossAmount, discountAmount: amounts.get(application.invoiceLineId)!.discountAmount, netAmount: amounts.get(application.invoiceLineId)!.grossAmount - amounts.get(application.invoiceLineId)!.discountAmount,
      versionInterval: application.versionInterval, assignmentInterval: application.assignmentInterval, assignmentReason: application.assignmentReason,
    })) });
  }
  async preview(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({
      where: { id: runId, schoolId },
      include: { ...this.runInclude, schoolYear: true },
    });
    if (!run)
      throw new NotFoundException({
        code: "COLLECTION_RUN_NOT_FOUND",
        message: "Không tìm thấy đợt thu.",
      });
    if (this.runDto(run).status !== "DRAFT")
      throw new ConflictException({
        code: "COLLECTION_RUN_NOT_DRAFT",
        message: "Chỉ có thể xem trước đợt thu nháp.",
      });
    const templateLines = await this.templateSnapshot(this.prisma, schoolId, run, true, true);
    const extracurricular = await this.runResolution(this.prisma, schoolId, run);
    const preview = await this.previewDeductions(this.prisma, schoolId, run, await this.selectionPreview(this.prisma, schoolId, run, undefined, templateLines, extracurricular));
    const lineSummaries = [...this.previewLineSummaries(templateLines, preview.eligible), ...this.previewExtracurricularSummaries(extracurricular, preview.eligible)];
    // Per-Student totals let the admin preview show one row per Student without summing VND in the browser.
    const eligible = preview.eligible.map((row: any) => ({ ...row, totals: this.previewTotals(row.lines ?? []) }));
    return { ...preview, eligible, summary: this.previewSummary(preview), lineSummaries, extracurricularClasses: this.previewExtracurricularClasses(extracurricular, preview.eligible), lineTotal: lineSummaries.reduce((total: bigint, line: any) => total + BigInt(line.subtotal), 0n).toString() };
  }
  // The preview shows the leave-day deduction proposed from current facts; it is not part of the READY
  // fingerprint because generation re-reads leave days and refund prices at generation time.
  private async previewDeductions<T extends { eligible: any[] }>(client: any, schoolId: string, run: any, preview: T) {
    const context = await this.deductionContext(client, schoolId, run.billingMonth, preview.eligible.map((row) => row.studentId), [...new Set<string>(preview.eligible.flatMap((row) => row.lines.map((line: any) => line.receivableId)))]);
    return { ...preview, eligible: preview.eligible.map((row) => ({ ...row, lines: row.lines.map((line: any) => {
      const receivable = context.receivables.get(line.receivableId);
      const proposal = this.deductionProposal(BigInt(receivable?.refundUnitPrice ?? 0), run.billingMonth, context.days.get(row.studentId) ?? [], [], Boolean(receivable?.autoLeaveDeduction));
      if (!proposal.deductionAmount) return { ...line, deductionQuantity: "0", deductionAmount: "0" };
      const netAmount = BigInt(line.netAmount) - proposal.deductionAmount;
      const tax = taxedLine(netAmount, line.taxCategory ?? "NOT_DECLARED");
      return { ...line, deductionQuantity: String(proposal.deductionQuantity), refundUnitPrice: proposal.refundUnitPriceSnapshot.toString(), deductionAmount: proposal.deductionAmount.toString(), netAmount: netAmount.toString(), vatAmount: tax.vatAmount.toString(), amount: tax.amount.toString() };
    }) })) };
  }
  async readyRun(
    identityId: string,
    schoolId: string,
    runId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const previewFingerprint = this.text(
      body?.previewFingerprint,
      "previewFingerprint",
      true,
      200,
    )!;
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.ready,
      key,
      operationId,
      { runId, previewFingerprint },
      async (tx, operation) => {
        await this.promotionLock(tx, schoolId);
        const locked = await this.lockRun(tx, schoolId, runId);
        const year = await this.lockYear(tx, schoolId, locked.schoolYearId);
        if (year.closedAt)
          throw new ConflictException({
            code: "SCHOOL_YEAR_CLOSED",
            message: "Năm học đã đóng chỉ có thể xem.",
          });
        const run = await tx.collectionRun.findFirst({
          where: { id: runId, schoolId },
          include: { ...this.runInclude, schoolYear: true },
        });
        if (!run)
          throw new NotFoundException({
            code: "COLLECTION_RUN_NOT_FOUND",
            message: "Không tìm thấy đợt thu.",
          });
        if (this.runDto(run).status !== "DRAFT")
          throw new ConflictException({
            code: "COLLECTION_RUN_STATE_CONFLICT",
            message: "Trạng thái đợt thu đã thay đổi.",
          });
        const templateLines = await this.templateSnapshot(tx, schoolId, run, false, true);
        const preview = await this.selectionPreview(tx, schoolId, run, undefined, templateLines, await this.runResolution(tx, schoolId, run, true));
        if (preview.fingerprint !== previewFingerprint)
          throw new ConflictException({
            code: "PREVIEW_STALE",
            message: "Bản xem trước đã cũ. Hãy tải lại trước khi tiếp tục.",
          });
        await this.templateSnapshot(tx, schoolId, run);
        const updated = await tx.collectionRun.update({
          where: { id: run.id },
          data: {
            status: "READY",
            version: { increment: 1 },
            readyPreviewFingerprint: preview.fingerprint,
          },
        });
        const transition = await tx.collectionRunLifecycleTransition.create({
          data: {
            schoolId,
            collectionRunId: run.id,
            previousStatus: "DRAFT",
            status: "READY",
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
            operationId: operation,
            sequence: 2,
          },
        });
        const outcome = this.runDto({
          ...updated,
          lifecycleTransitions: [transition],
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "COLLECTION_RUN_READY",
          operation,
          { fingerprint: previewFingerprint },
          outcome,
        );
        return outcome;
      },
    );
  }
  async generateRun(
    identityId: string,
    schoolId: string,
    runId: string,
    key: string,
    operationId: string,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    if (!uuid.test(key) || !uuid.test(operationId)) throw new UnauthorizedException({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "Cần Idempotency-Key và X-Operation-Id UUID." });
    const fingerprint = requestFingerprint({ runId });
    const existing = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: "SCHOOL_MEMBERSHIP", route: routes.generate, idempotencyKey: key } });
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Idempotency-Key đã dùng cho yêu cầu khác." });
      const generation = await this.prisma.collectionRunGeneration.findFirst({ where: { schoolId, operationId: existing.id } });
      return { id: existing.id, status: existing.status, outcome: existing.outcome, progress: generation ? this.generationDto(generation) : null };
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`;
      await this.transactionActor(tx, schoolId, identityId, actor.membershipId);
      await this.promotionLock(tx, schoolId);
      const operation = await tx.operation.create({ data: { id: operationId, schoolId, membershipId: actor.membershipId, actorIdentityId: identityId, actorType: "SCHOOL_MEMBERSHIP", actorReference: actor.membershipId, route: routes.generate, idempotencyKey: key, fingerprint } });
        const locked = await this.lockRun(tx, schoolId, runId);
        const year = await this.lockYear(tx, schoolId, locked.schoolYearId);
        if (year.closedAt)
          throw new ConflictException({
            code: "SCHOOL_YEAR_CLOSED",
            message: "Năm học đã đóng chỉ có thể xem.",
          });
        const run = await tx.collectionRun.findFirst({
          where: { id: runId, schoolId },
          include: { ...this.runInclude, schoolYear: true },
        });
        if (!run)
          throw new NotFoundException({
            code: "COLLECTION_RUN_NOT_FOUND",
            message: "Không tìm thấy đợt thu.",
          });
        if (run.status !== "READY")
          throw new ConflictException({
            code: "COLLECTION_RUN_STATE_CONFLICT",
            message: "Chỉ có thể tạo hóa đơn khi đợt thu đã sẵn sàng.",
          });
        // Recheck every live fact confirmed by READY before any generation writes.
        const currentTemplate = await this.templateSnapshot(tx, schoolId, run, false, true);
        const extracurricular = await this.runResolution(tx, schoolId, run, true);
        const roster = await this.selectionPreview(tx, schoolId, run, undefined, currentTemplate, extracurricular);
        if (!run.readyPreviewFingerprint || roster.fingerprint !== run.readyPreviewFingerprint)
          throw new ConflictException({
            code: "PREVIEW_STALE",
            message: "Bản xem trước đã cũ. Hãy tải lại trước khi tiếp tục.",
          });
        // One authoritative roster read supplies both eligibility and immutable snapshots.
        const templateLines = currentTemplate.map(({ receivableStatus, ...line }: any) => line);
        const snapshots = roster.snapshots as any[];
        // An empty template is allowed; generation is refused only when no Student would get any line.
        if (!snapshots.length && roster.skips.some((item: any) => item.reason === "NO_APPLICABLE_LINES")) throw new ConflictException({ code: "COLLECTION_RUN_NO_APPLICABLE_LINES", message: "Không học sinh nào có khoản thu áp dụng. Hãy thêm khoản thu hoặc kiểm tra phạm vi trước khi tạo hóa đơn." });
        await tx.collectionRun.update({ where: { id: run.id }, data: { templateSnapshot: templateLines, extracurricularSnapshot: this.snapshotOfResolution(extracurricular) as any } });
        const deductions = await this.deductionContext(tx, schoolId, run.billingMonth, snapshots.map((item: any) => item.studentId), templateLines.map((line: any) => line.receivableId));
        const generation = await tx.collectionRunGeneration.create({ data: { schoolId, collectionRunId: run.id, operationId: operation.id, actorIdentityId: identityId, membershipId: actor.membershipId, totalCount: snapshots.length + roster.skips.length, processedCount: roster.skips.length, eligibleCount: 0, skippedCount: roster.skips.length } });
        await tx.collectionRunGenerationItem.createMany({ data: [
          ...snapshots.map((item: any, ordinal: number) => ({ schoolId, generationId: generation.id, studentId: item.studentId, ordinal, snapshot: this.invoiceData(schoolId, run, item, templateLines, deductions) })),
          ...roster.skips.map((item: any, index: number) => ({ schoolId, generationId: generation.id, studentId: item.studentId, ordinal: snapshots.length + index, status: "SKIPPED" as const, skip: item })),
        ] });
        return { id: operation.id, status: operation.status, outcome: null, progress: this.generationDto(generation) };
    }).catch(async (error) => {
      if ((error as any)?.code === "P2002") {
        const replay = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: "SCHOOL_MEMBERSHIP", route: routes.generate, idempotencyKey: key } });
        if (replay?.fingerprint === fingerprint) {
          const generation = await this.prisma.collectionRunGeneration.findFirst({ where: { schoolId, operationId: replay.id } });
          return { id: replay.id, status: replay.status, outcome: replay.outcome, progress: generation ? this.generationDto(generation) : null };
        }
        const generation = await this.prisma.collectionRunGeneration.findFirst({ where: { schoolId, collectionRunId: runId } });
        if (generation) throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Đợt thu đang được tạo hóa đơn hoặc đã thay đổi trạng thái." });
      }
      throw error;
    });
  }
  async pauseGeneration(identityId: string, schoolId: string, runId: string, key: string, operationId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    return this.mutate(actor, identityId, schoolId, `${routes.generate}/pause`, key, operationId, { runId }, async (tx, operation) => {
      const generation = await tx.collectionRunGeneration.findFirst({ where: { schoolId, collectionRunId: runId } });
      if (!generation || !["QUEUED", "RUNNING"].includes(generation.status)) throw new ConflictException({ code: "GENERATION_NOT_PAUSABLE", message: "Không thể dừng lượt tạo hiện tại." });
      const updated = await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { status: "PAUSED", leaseExpiresAt: null } });
      const outcome = { runId, progress: this.generationDto(updated) };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_GENERATION_PAUSED", operation, { generationId: generation.id }, outcome);
      return outcome;
    });
  }
  async resumeGeneration(identityId: string, schoolId: string, runId: string, key: string, operationId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    return this.mutate(actor, identityId, schoolId, `${routes.generate}/resume`, key, operationId, { runId }, async (tx, operation) => {
      const generation = await tx.collectionRunGeneration.findFirst({ where: { schoolId, collectionRunId: runId } });
      if (!generation || generation.status !== "PAUSED") throw new ConflictException({ code: "GENERATION_NOT_RESUMABLE", message: "Không thể tiếp tục lượt tạo hiện tại." });
      const updated = await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { status: "QUEUED", leaseExpiresAt: null } });
      const outcome = { runId, progress: this.generationDto(updated) };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_GENERATION_RESUMED", operation, { generationId: generation.id }, outcome);
      return outcome;
    });
  }
  async processNextGeneration() {
    const claimed = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<any[]>(Prisma.sql`WITH candidate AS (SELECT "id" FROM "CollectionRunGeneration" WHERE "status" = 'QUEUED' OR ("status" = 'RUNNING' AND "leaseExpiresAt" < CURRENT_TIMESTAMP) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE "CollectionRunGeneration" AS job SET "status" = 'RUNNING', "leaseExpiresAt" = CURRENT_TIMESTAMP + interval '30 seconds', "updatedAt" = CURRENT_TIMESTAMP FROM candidate WHERE job."id" = candidate."id" RETURNING job.*`);
      return rows[0] ?? null;
    });
    if (!claimed) return false;
    try {
      const batch = await this.prisma.$transaction(async (tx) => {
        const generation = await tx.collectionRunGeneration.findUnique({ where: { id: claimed.id } });
        if (!generation || generation.status !== "RUNNING") return [];
        const items = await tx.collectionRunGenerationItem.findMany({ where: { schoolId: generation.schoolId, generationId: generation.id, status: "PENDING" }, orderBy: { ordinal: "asc" }, take: 50 });
        if (items.length) {
          await tx.collectionRunGenerationItem.updateMany({ where: { id: { in: items.map((item) => item.id) }, status: "PENDING" }, data: { status: "STAGED" } });
          // The lease only guards this batch: it ends with the batch so the next claim continues without waiting 30 seconds.
          await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { processedCount: { increment: items.length }, eligibleCount: { increment: items.length }, leaseExpiresAt: new Date() } });
        }
        return items;
      });
      if (batch.length) return true;
      await this.publishGeneration(claimed.id);
      return true;
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        const generation = await tx.collectionRunGeneration.findUnique({ where: { id: claimed.id } });
        if (!generation || generation.status !== "RUNNING") return;
        const message = error instanceof Error ? error.message : "Không thể tạo hóa đơn.";
        await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { status: "FAILED", leaseExpiresAt: null, lastErrorCode: "GENERATION_FAILED", lastErrorMessage: message } });
        const outcome = { code: "GENERATION_FAILED", message };
        await tx.operation.update({ where: { id: generation.operationId }, data: { status: "FAILED", outcome } });
        await this.audit(tx, generation.schoolId, generation.actorIdentityId, generation.membershipId, "COLLECTION_RUN_GENERATION_FAILED", generation.operationId, { generationId: generation.id }, outcome);
      });
      return true;
    }
  }
  private async publishGeneration(generationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const generation = await tx.collectionRunGeneration.findUnique({ where: { id: generationId } });
      if (!generation || generation.status !== "RUNNING") return;
      const pending = await tx.collectionRunGenerationItem.count({ where: { schoolId: generation.schoolId, generationId, status: "PENDING" } });
      if (pending) return;
      const run = await this.lockRun(tx, generation.schoolId, generation.collectionRunId);
      const year = await this.lockYear(tx, generation.schoolId, run.schoolYearId);
      await this.transactionActor(tx, generation.schoolId, generation.actorIdentityId, generation.membershipId);
      if (year.closedAt || run.status !== "READY") throw new ConflictException({ code: "GENERATION_PUBLISH_CONFLICT", message: "Đợt thu không còn sẵn sàng để phát hành hóa đơn." });
      const items = await tx.collectionRunGenerationItem.findMany({ where: { schoolId: generation.schoolId, generationId, status: "STAGED" }, orderBy: { ordinal: "asc" } });
      const insertedStudentIds = await this.insertInvoices(tx, items.map((item) => item.snapshot));
      const createdStudentIds = items.filter((item) => insertedStudentIds.has(item.studentId)).map((item) => item.studentId);
      const createdInvoiceIds = this.noticeInvoiceIds(await tx.invoice.findMany({ where: { schoolId: generation.schoolId, collectionRunId: run.id, studentId: { in: createdStudentIds }, revisesInvoiceId: null }, select: { id: true, studentId: true, channel: true } }));
      const generationItemDto = (item: any) => ({ studentId: item.studentId, studentCode: item.snapshot.studentCodeSnapshot, fullName: item.snapshot.studentNameSnapshot, className: classLabel(item.snapshot.classNameSnapshot) });
      const created = items.filter((item) => insertedStudentIds.has(item.studentId)).map((item) => ({ ...generationItemDto(item), invoiceId: createdInvoiceIds.get(item.studentId)?.[0], invoiceIds: createdInvoiceIds.get(item.studentId) ?? [] }));
      const existing = items.filter((item) => !insertedStudentIds.has(item.studentId)).map((item) => ({ ...generationItemDto(item), reason: "INVOICE_EXISTS" }));
      const skipped = await tx.collectionRunGenerationItem.findMany({ where: { schoolId: generation.schoolId, generationId, status: "SKIPPED" }, orderBy: { ordinal: "asc" } });
      const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { status: "GENERATED", version: { increment: 1 } } });
      const transition = await tx.collectionRunLifecycleTransition.create({ data: { schoolId: generation.schoolId, collectionRunId: run.id, previousStatus: "READY", status: "GENERATED", actorIdentityId: generation.actorIdentityId, membershipId: generation.membershipId, operationId: generation.operationId, sequence: 3 } });
      const outcome = { run: this.runDto({ ...updated, invoices: [], lifecycleTransitions: [transition] }), created, skipped: [...skipped.map((item) => item.skip), ...existing] };
      await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { status: "COMPLETED", leaseExpiresAt: null } });
      await tx.operation.update({ where: { id: generation.operationId }, data: { status: "COMPLETED", outcome } });
      await this.audit(tx, generation.schoolId, generation.actorIdentityId, generation.membershipId, "COLLECTION_RUN_GENERATED", generation.operationId, { runId: run.id }, outcome);
    });
  }
  async addGeneratedStudent(
    identityId: string,
    schoolId: string,
    runId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const studentId = this.identifier(body?.studentId, "studentId");
    return this.mutate(actor, identityId, schoolId, routes.addGeneratedStudent, key, operationId, { runId, studentId }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const locked = await this.lockRun(tx, schoolId, runId);
      const year = await this.lockYear(tx, schoolId, locked.schoolYearId);
      if (year.closedAt) throw new ConflictException({ code: "SCHOOL_YEAR_CLOSED", message: "Năm học đã đóng chỉ có thể xem." });
      const run = await tx.collectionRun.findFirst({ where: { id: runId, schoolId }, include: { ...this.runInclude, schoolYear: true } });
      if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
      if (run.status !== "GENERATED") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ có thể thêm học sinh khi đợt thu đã được tạo." });
      const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
      if (!student) throw new NotFoundException({ code: "STUDENT_NOT_FOUND", message: "Không tìm thấy học sinh." });
        const templateLines = run.templateSnapshot as any[] | null;
        if (!Array.isArray(templateLines)) throw new ConflictException({ code: "COLLECTION_RUN_TEMPLATE_SNAPSHOT_MISSING", message: "Không tìm thấy snapshot khoản thu của đợt đã tạo." });
        const roster = await this.selectionPreview(tx, schoolId, run, [studentId], templateLines, await this.runResolution(tx, schoolId, run, true));
        const candidate = roster.snapshots[0] as any;
        const skipped = [...roster.skips];
        const insertedStudentIds = candidate
          ? await this.insertInvoices(tx, [this.invoiceData(schoolId, run, candidate, templateLines, await this.deductionContext(tx, schoolId, run.billingMonth, [studentId], templateLines.map((line: any) => line.receivableId)))])
         : new Set<string>();
       const createdIds = candidate && insertedStudentIds.has(studentId) ? this.noticeInvoiceIds(await tx.invoice.findMany({ where: { schoolId, collectionRunId: run.id, studentId, revisesInvoiceId: null }, select: { id: true, studentId: true, channel: true } })).get(studentId) ?? [] : [];
       const created = candidate && insertedStudentIds.has(studentId) ? [{ ...candidate, invoiceId: createdIds[0], invoiceIds: createdIds }] : [];
       if (candidate && !insertedStudentIds.has(studentId))
         skipped.push({ studentId, studentCode: student.studentCode, fullName: student.fullName, reason: "INVOICE_EXISTS" });
      const outcome = { run: this.runDto(run), created: created.map(({ enrollment, assignment, ...item }: any) => item), skipped };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_GENERATED_STUDENT_ADDED", operation, { runId, studentId }, outcome);
      return outcome;
    });
  }
  // D9: Students whose enrollment ended during the month before the run. endedOn is the first day without
  // enrollment, so the last attended day (endedOn - 1) falls in the previous month.
  private async settlementCandidates(client: any, schoolId: string, run: any) {
    const { start, end } = this.previousMonth(run.billingMonth);
    const enrollments = await client.studentEnrollment.findMany({ where: { schoolId, lifecycle: { in: ["WITHDRAWN", "GRADUATED"] }, endedOn: { gt: start, lte: end } }, include: { student: true, classAssignments: { include: { classroom: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] } }, orderBy: [{ studentId: "asc" }, { endedOn: "desc" }] });
    const invoices = enrollments.length ? await client.invoice.findMany({ where: { schoolId, collectionRunId: run.id, studentId: { in: enrollments.map((item: any) => item.studentId) }, revisesInvoiceId: null }, select: { id: true, studentId: true, channel: true, status: true, total: true, kind: true }, orderBy: [{ channel: "asc" }] }) : [];
    const seen = new Set<string>();
    return enrollments.filter((enrollment: any) => !seen.has(enrollment.studentId) && seen.add(enrollment.studentId))
      // A Student still billed normally in this run (re-enrolled) is not settled.
      .filter((enrollment: any) => !invoices.some((invoice: any) => invoice.studentId === enrollment.studentId && invoice.kind === "NORMAL"))
      .map((enrollment: any) => ({ enrollment, assignment: enrollment.classAssignments[0] ?? null, invoices: invoices.filter((invoice: any) => invoice.studentId === enrollment.studentId) }));
  }
  async settlements(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({ where: { id: runId, schoolId } });
    if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
    const candidates = await this.settlementCandidates(this.prisma, schoolId, run);
    return { students: candidates.map(({ enrollment, assignment, invoices }: any) => ({ studentId: enrollment.studentId, studentCode: enrollment.student.studentCode, fullName: enrollment.student.fullName, className: assignment?.classroom?.name ?? enrollment.className ?? null, lifecycle: enrollment.lifecycle, endedOn: enrollment.endedOn.toISOString().slice(0, 10), invoiceTotal: invoices.reduce((total: bigint, invoice: any) => total + BigInt(invoice.total), 0n).toString(), invoices: invoices.map((invoice: any) => ({ id: invoice.id, channel: invoice.channel, status: invoice.status, total: invoice.total.toString() })) })) };
  }
  // D9: one settlement DRAFT per channel holding only refunds; carries of the same channel are applied as usual.
  async createSettlement(identityId: string, schoolId: string, runId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const studentId = this.identifier(body?.studentId, "studentId");
    return this.mutate(actor, identityId, schoolId, routes.settlement, key, operationId, { runId, studentId }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const run = await this.lockRun(tx, schoolId, runId);
      const year = await this.lockYear(tx, schoolId, run.schoolYearId);
      if (year.closedAt) throw new ConflictException({ code: "SCHOOL_YEAR_CLOSED", message: "Năm học đã đóng chỉ có thể xem." });
      if (run.status !== "GENERATED" || run.type !== "MONTHLY") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ tạo hóa đơn quyết toán khi đợt thu đã tạo hóa đơn." });
      const candidate = (await this.settlementCandidates(tx, schoolId, run)).find((item: any) => item.enrollment.studentId === studentId);
      if (!candidate) throw new NotFoundException({ code: "SETTLEMENT_STUDENT_NOT_ELIGIBLE", message: "Học sinh không nghỉ học trong tháng trước đợt thu này." });
      if (candidate.invoices.length) throw new ConflictException({ code: "SETTLEMENT_EXISTS", message: "Học sinh đã có hóa đơn quyết toán trong đợt thu này." });
      const { enrollment, assignment } = candidate;
      const days = await this.settlementDays(tx, schoolId, studentId, run.billingMonth, enrollment.endedOn);
      const context = await this.deductionContext(tx, schoolId, run.billingMonth, [studentId], []);
      const mealLines = [...(context.previous.get(studentId) ?? [])].map((receivableId) => context.receivables.get(receivableId)).filter(Boolean).map((receivable: any) => {
        const proposal = this.deductionProposal(BigInt(receivable.refundUnitPrice), run.billingMonth, days.days, days.afterEndDays, receivable.autoLeaveDeduction);
        const tax = taxedLine(-proposal.deductionAmount, receivable.taxCategory);
        return { channel: taxChannel(receivable.taxCategory), data: { schoolId, receivableId: receivable.id, receivableCodeSnapshot: receivable.code, receivableNameSnapshot: receivable.displayName, unitLabelSnapshot: receivable.unitLabel, defaultUnitPriceSnapshot: receivable.defaultUnitPrice, unitPrice: receivable.defaultUnitPrice, quantity: 0, grossAmount: 0n, discountAmount: 0n, ...this.deductionData(proposal), netAmount: -proposal.deductionAmount, ...tax, promotionEvaluationProvenance: { version: "PROMOTION_EVALUATION_V1", applications: [] } } };
      }).filter((line) => line.data.deductionQuantity > 0);
      const packageLines = (await this.packageRefunds(tx, schoolId, studentId, enrollment.endedOn)).map((refund: any) => ({ channel: taxChannel(refund.taxCategory), refund }));
      await this.lockReceivablesShared(tx, schoolId, [...mealLines.map((line: any) => line.data.receivableId), ...packageLines.map((line: any) => line.refund.receivable?.id)]);
      const channels = [...new Set<PaymentChannel>([...mealLines, ...packageLines].map((line) => line.channel).concat(await this.pendingCarryChannels(tx, schoolId, studentId, run.schoolYearId, run.billingMonth)))].sort((a, b) => (a === b ? 0 : a === "SCHOOL" ? -1 : 1));
      if (!channels.length) throw new ConflictException({ code: "SETTLEMENT_NOTHING_TO_SETTLE", message: "Không có tiền ăn chưa dùng, học phí nộp trước hay số dư chuyển kỳ cần quyết toán cho học sinh này." });
      const asOf = this.asOf(run.billingMonth);
      const created: string[] = [];
      for (const channel of channels) {
        const invoice = await tx.invoice.create({ data: {
          schoolId, studentId, collectionRunId: run.id, schoolYearId: run.schoolYearId, billingMonth: run.billingMonth, rosterAsOf: asOf, kind: "SETTLEMENT", channel,
          studentCodeSnapshot: enrollment.student.studentCode, studentNameSnapshot: enrollment.student.fullName,
          enrollmentIdSnapshot: enrollment.id, enrollmentLifecycleSnapshot: enrollment.lifecycle, enrollmentEffectiveFromSnapshot: enrollment.effectiveFrom, enrollmentEndedOnSnapshot: enrollment.endedOn,
          classAssignmentIdSnapshot: assignment?.id ?? null, classAssignmentEffectiveFromSnapshot: assignment?.effectiveFrom ?? null, classAssignmentEffectiveToSnapshot: assignment?.effectiveTo ?? null,
          classIdSnapshot: assignment?.classId ?? enrollment.classId ?? null, classNameSnapshot: assignment?.classroom?.name ?? enrollment.className ?? null,
          selectionProvenance: { policy: "SETTLEMENT_AFTER_ENROLLMENT_END_V1", runId: run.id, billingMonth: run.billingMonth, enrollmentId: enrollment.id, lifecycle: enrollment.lifecycle, endedOn: enrollment.endedOn.toISOString().slice(0, 10) },
        } });
        for (const line of mealLines.filter((item) => item.channel === channel)) await tx.invoiceLine.create({ data: { ...line.data, invoiceId: invoice.id } });
        for (const line of packageLines.filter((item) => item.channel === channel)) await tx.invoiceLine.create({ data: this.packageLine(schoolId, invoice.id, line.refund) });
        await this.materializeCarries(tx, schoolId, invoice.id, studentId, run.schoolYearId, run.billingMonth, channel);
        created.push(invoice.id);
      }
      const outcome = await this.refreshInvoice(tx, schoolId, created[0]!);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "SETTLEMENT_INVOICE_CREATED", operation, { runId, studentId, enrollmentId: enrollment.id }, outcome);
      return outcome;
    });
  }
  async closeRun(
    identityId: string,
    schoolId: string,
    runId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.closeRun, key, operationId, { runId, reason }, async (tx, operation) => {
      const locked = await this.lockRun(tx, schoolId, runId);
      if (locked.status !== "GENERATED")
        throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ có thể đóng đợt thu đã tạo hóa đơn." });
      const invoices = await tx.invoice.findMany({ where: { schoolId, collectionRunId: runId }, select: { status: true, total: true } });
      if (invoices.some((invoice: { status: string; total: bigint }) => !["CLOSED", "CANCELLED"].includes(invoice.status) && !(invoice.status === "DRAFT" && invoice.total === 0n)))
        throw new ConflictException({ code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL", message: "Chỉ có thể đóng khi mọi hóa đơn đã phát hành hoặc đã kết thúc." });
      const updated = await tx.collectionRun.update({ where: { id: locked.id }, data: { status: "CLOSED", version: { increment: 1 } } });
      await tx.collectionRunLifecycleTransition.create({
        data: { schoolId, collectionRunId: locked.id, previousStatus: "GENERATED", status: "CLOSED", actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation, sequence: 4 },
      });
      const closed = await tx.collectionRun.findFirst({ where: { id: updated.id, schoolId }, include: this.runInclude });
      if (!closed) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
      const outcome = this.runDto(closed);
       await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_CLOSED", operation, this.runDto({ ...locked, invoices: [], lifecycleTransitions: [{ status: "GENERATED" }] }), outcome, reason);
      return outcome;
    });
  }
  // The School-account part is listed first in a payment notice.
  private noticeInvoiceIds(invoices: Array<{ id: string; studentId: string; channel: PaymentChannel }>) {
    const result = new Map<string, string[]>();
    for (const invoice of [...invoices].sort((a, b) => (a.channel === b.channel ? 0 : a.channel === "SCHOOL" ? -1 : 1))) result.set(invoice.studentId, [...(result.get(invoice.studentId) ?? []), invoice.id]);
    return result;
  }
  private invoiceData(schoolId: string, run: any, item: any, templateLines: any[], context?: Awaited<ReturnType<FinanceService["deductionContext"]>>) {
    const { enrollment, assignment } = item;
    const days = context?.days.get(item.studentId) ?? [];
    // Snapshots are JSON: BigInt values are stored as strings and a missing source is omitted.
    const deduction = (receivableId: string) => {
      const receivable = context?.receivables.get(receivableId);
      const proposal = this.deductionProposal(BigInt(receivable?.refundUnitPrice ?? 0), run.billingMonth, days, [], Boolean(receivable?.autoLeaveDeduction));
      return { refundUnitPriceSnapshot: proposal.refundUnitPriceSnapshot.toString(), deductionQuantity: proposal.deductionQuantity, proposedDeductionQuantity: proposal.proposedDeductionQuantity, deductionAmount: proposal.deductionAmount.toString(), ...(proposal.deductionSource ? { deductionSource: proposal.deductionSource } : {}) };
    };
    const templateIds = new Set([...templateLines.map((line: any) => line.receivableId), ...(item.extracurricularLines ?? []).map((line: any) => line.receivableId)]);
    // D4: a receivable refunded on last month's Invoice but not charged this month still gets its "Bớt" on a "Thu 0" line.
    const refundOnly = days.length ? [...(context?.previous.get(item.studentId) ?? [])].filter((id) => !templateIds.has(id) && context?.receivables.get(id)).map((id) => {
      const receivable = context!.receivables.get(id);
      const category: TaxCategory = receivable.taxCategory ?? "NOT_DECLARED";
      const extra = deduction(id);
      const tax = taxedLine(-BigInt(extra.deductionAmount), category);
      return { channel: taxChannel(category), schoolId, receivableId: id, receivableCodeSnapshot: receivable.code, receivableNameSnapshot: receivable.displayName, unitLabelSnapshot: receivable.unitLabel, defaultUnitPriceSnapshot: receivable.defaultUnitPrice.toString(), unitPrice: receivable.defaultUnitPrice.toString(), quantity: 0, amount: tax.amount.toString(), grossAmount: "0", discountAmount: "0", netAmount: (-BigInt(extra.deductionAmount)).toString(), ...extra, taxCategorySnapshot: category, vatRateSnapshot: tax.vatRateSnapshot, vatAmount: tax.vatAmount.toString(), promotionEvaluationProvenance: { version: "PROMOTION_EVALUATION_V1", applications: [] } };
    }).filter((line) => line.deductionQuantity > 0) : [];
    return {
      schoolId, studentId: item.studentId, collectionRunId: run.id, schoolYearId: run.schoolYearId,
      billingMonth: run.billingMonth, rosterAsOf: this.asOf(run.billingMonth),
      studentCodeSnapshot: enrollment.student.studentCode, studentNameSnapshot: enrollment.student.fullName,
      enrollmentIdSnapshot: enrollment.id, enrollmentLifecycleSnapshot: enrollment.lifecycle,
      enrollmentEffectiveFromSnapshot: enrollment.effectiveFrom, enrollmentEndedOnSnapshot: enrollment.endedOn,
      classAssignmentIdSnapshot: assignment?.id ?? null, classAssignmentEffectiveFromSnapshot: assignment?.effectiveFrom ?? null,
      classAssignmentEffectiveToSnapshot: assignment?.effectiveTo ?? null, classIdSnapshot: assignment?.classId ?? null,
      classNameSnapshot: assignment?.classroom.name ?? null,
       selectionProvenance: { policy: "COLLECTION_RUN_DEFAULT_ROSTER_V1", runId: run.id, billingMonth: run.billingMonth,
        rosterAsOf: this.asOf(run.billingMonth).toISOString(), enrollmentId: enrollment.id,
        enrollmentInterval: [enrollment.effectiveFrom.toISOString(), enrollment.endedOn?.toISOString() ?? null],
        assignmentId: assignment?.id ?? null, assignmentInterval: assignment ? [assignment.effectiveFrom.toISOString(), assignment.effectiveTo?.toISOString() ?? null] : null },
      lines: [...templateLines, ...(item.extracurricularLines ?? [])].filter((line: any) => !item.calculatedLines || item.calculatedLines.some((candidate: any) => candidate.receivableId === line.receivableId)).map((line: any) => {
        const calculated = item.calculatedLines?.find((candidate: any) => candidate.receivableId === line.receivableId) ?? this.evaluatePromotionLine(item.studentId, line, []);
        const category: TaxCategory = line.taxCategory ?? "NOT_DECLARED";
        const lineDeduction = deduction(line.receivableId);
        const netAmount = BigInt(calculated.netAmount) - BigInt(lineDeduction.deductionAmount);
        const tax = taxedLine(netAmount, category);
        // Provenance snapshot: the template line and its scope as they were when the Invoice was generated.
        const source = line.kind === "EXTRACURRICULAR"
          ? { sourceKind: "EXTRACURRICULAR", sourceDetail: { receivableId: line.receivableId, classes: line.extracurricular.classes, flags: line.extracurricular.flags } }
          : { sourceKind: line.kind === "FIXED" ? "TEMPLATE_FIXED" : "TEMPLATE_FLEXIBLE", sourceDetail: { templateLineId: line.templateLineId, scope: line.scope ?? { type: "ALL", label: "Toàn bộ", classes: [], students: [] } } };
        return { ...source, channel: taxChannel(category), schoolId, receivableId: line.receivableId, receivableCodeSnapshot: line.receivableCode, receivableNameSnapshot: line.receivableName, unitLabelSnapshot: line.unitLabel, defaultUnitPriceSnapshot: line.defaultUnitPrice, unitPrice: line.defaultUnitPrice, quantity: line.quantity, amount: tax.amount.toString(), grossAmount: calculated.grossAmount, discountAmount: calculated.discountAmount, netAmount: netAmount.toString(), ...lineDeduction, taxCategorySnapshot: category, vatRateSnapshot: tax.vatRateSnapshot, vatAmount: tax.vatAmount.toString(), promotionEvaluationProvenance: calculated.promotionEvaluation };
      }).concat(refundOnly as any),
    };
  }
  // One generated Student becomes one Invoice per payment channel that has lines; a Student without
  // lines keeps a single empty PERSONAL Invoice as before.
  private async insertInvoices(tx: any, invoices: any[]) {
    if (!invoices.length) return new Set<string>();
    await this.lockReceivablesShared(tx, invoices[0].schoolId, invoices.flatMap((invoice) => (invoice.lines ?? []).map((line: any) => line.receivableId)));
    const parts = invoices.flatMap(({ lines, ...invoice }) => {
      const channels = [...new Set<PaymentChannel>((lines as any[]).map((line) => line.channel ?? "PERSONAL"))].sort();
      return (channels.length ? channels : ["PERSONAL" as PaymentChannel]).map((channel) => ({ ...invoice, channel, lines: (lines as any[]).filter((line) => (line.channel ?? "PERSONAL") === channel).map(({ channel: _channel, ...line }) => ({ taxCategorySnapshot: "NOT_DECLARED", ...line })) }));
    });
    const rows = JSON.stringify(parts.map(({ lines, ...invoice }) => invoice));
    const inserted = (await tx.$queryRaw(Prisma.sql`
      INSERT INTO "Invoice" (
        "schoolId", "studentId", "collectionRunId", "schoolYearId", "billingMonth", "rosterAsOf",
        "studentCodeSnapshot", "studentNameSnapshot", "enrollmentIdSnapshot", "enrollmentLifecycleSnapshot",
        "enrollmentEffectiveFromSnapshot", "enrollmentEndedOnSnapshot", "classAssignmentIdSnapshot",
        "classAssignmentEffectiveFromSnapshot", "classAssignmentEffectiveToSnapshot", "classIdSnapshot",
        "classNameSnapshot", "selectionProvenance", "channel"
      )
      SELECT
        "schoolId"::uuid, "studentId"::uuid, "collectionRunId"::uuid, "schoolYearId"::uuid, "billingMonth",
        "rosterAsOf"::date, "studentCodeSnapshot", "studentNameSnapshot", "enrollmentIdSnapshot"::uuid,
        "enrollmentLifecycleSnapshot"::"StudentEnrollmentLifecycle", "enrollmentEffectiveFromSnapshot"::date,
        "enrollmentEndedOnSnapshot"::date, "classAssignmentIdSnapshot"::uuid,
        "classAssignmentEffectiveFromSnapshot"::date, "classAssignmentEffectiveToSnapshot"::date,
        "classIdSnapshot"::uuid, "classNameSnapshot", "selectionProvenance"::jsonb, "channel"::"PaymentChannel"
      FROM jsonb_to_recordset(${rows}::jsonb) AS input(
        "schoolId" text, "studentId" text, "collectionRunId" text, "schoolYearId" text, "billingMonth" text,
        "rosterAsOf" text, "studentCodeSnapshot" text, "studentNameSnapshot" text, "enrollmentIdSnapshot" text,
        "enrollmentLifecycleSnapshot" text, "enrollmentEffectiveFromSnapshot" text, "enrollmentEndedOnSnapshot" text,
        "classAssignmentIdSnapshot" text, "classAssignmentEffectiveFromSnapshot" text,
        "classAssignmentEffectiveToSnapshot" text, "classIdSnapshot" text, "classNameSnapshot" text,
        "selectionProvenance" jsonb, "channel" text
      )
       ON CONFLICT ("schoolId", "studentId", "collectionRunId", "channel") WHERE "revisesInvoiceId" IS NULL DO NOTHING
       RETURNING "id", "studentId", "channel"
    `)) as { id: string; studentId: string; channel: PaymentChannel }[];
    const invoiceIds = new Map(inserted.map((invoice) => [`${invoice.studentId}:${invoice.channel}`, invoice.id]));
    const lines = parts.flatMap((invoice) => { const invoiceId = invoiceIds.get(`${invoice.studentId}:${invoice.channel}`); return invoiceId ? invoice.lines.map((line: any) => ({ ...line, invoiceId })) : []; });
    if (lines.length) await tx.invoiceLine.createMany({ data: lines });
    for (const invoice of inserted) {
      const target = parts.find((candidate) => candidate.studentId === invoice.studentId && candidate.channel === invoice.channel)!;
      await this.materializeCarries(tx, target.schoolId, invoice.id, target.studentId, target.schoolYearId, target.billingMonth, invoice.channel);
    }
    return new Set(inserted.map((invoice: { studentId: string }) => invoice.studentId));
  }
  // A difference is money owed to or held in one account, so it only carries within its payment channel.
  // Channels where a monthly difference of the Student still has an amount not carried yet.
  private async pendingCarryChannels(tx: any, schoolId: string, studentId: string, schoolYearId: string, billingMonth: string) {
    const differences = await tx.settlementDifference.findMany({ where: { schoolId, studentId, schoolYearId, invoice: { collectionRun: { type: "MONTHLY", billingMonth: { lt: billingMonth } } } }, include: { carries: { select: { amount: true } }, invoice: { select: { channel: true } } } });
    return differences.filter((difference: any) => (difference.signedAmount < 0n ? -difference.signedAmount : difference.signedAmount) > difference.carries.reduce((sum: bigint, carry: any) => sum + BigInt(carry.amount), 0n)).map((difference: any) => difference.invoice.channel as PaymentChannel);
  }
  private async materializeCarries(tx: any, schoolId: string, invoiceId: string, studentId: string, schoolYearId: string, billingMonth: string, channel: PaymentChannel) {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const differences = await tx.settlementDifference.findMany({
      where: { schoolId, studentId, schoolYearId, invoice: { channel, collectionRun: { type: "MONTHLY", billingMonth: { lt: billingMonth } } } },
      include: { carries: true, invoice: { select: { billingMonth: true } } }, orderBy: { createdAt: "asc" },
    });
    if (!differences.length) return;
    let target = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, schoolId } });
    for (const difference of differences) {
      const eligible = await tx.invoice.findFirst({
        where: {
          schoolId,
          studentId,
          schoolYearId,
          channel,
          status: "DRAFT",
          collectionRun: { type: "MONTHLY", billingMonth: { gt: difference.invoice.billingMonth } },
        },
        orderBy: { billingMonth: "asc" },
        select: { id: true },
      });
      if (eligible?.id !== invoiceId) continue;
      await tx.$queryRaw`SELECT 1 FROM "SettlementDifference" WHERE "id" = ${difference.id}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const appliedRows = await tx.$queryRaw<Array<{ amount: bigint }>>`
        SELECT COALESCE(SUM("amount"), 0)::bigint AS "amount"
        FROM "SettlementCarry"
        WHERE "schoolId" = ${schoolId}::uuid AND "settlementDifferenceId" = ${difference.id}::uuid
      `;
      const applied = appliedRows[0]!.amount;
       const remaining = (difference.signedAmount < 0n ? -difference.signedAmount : difference.signedAmount) - applied;
      if (remaining <= 0n) continue;
       const isShortfall = difference.signedAmount > 0n;
      // A settlement Invoice refunds a pending credit in full, even below zero.
      const amount = isShortfall || target.kind === "SETTLEMENT" ? remaining : (remaining > target.total ? target.total : remaining);
      if (amount <= 0n) continue;
       const carry = await tx.settlementCarry.create({ data: { schoolId, studentId, schoolYearId, settlementDifferenceId: difference.id, invoiceId, type: isShortfall ? "SHORTFALL_CARRY" : "OVERPAYMENT_CARRY", amount } });
         await this.ledger(tx, target, "SETTLEMENT_CARRY_POSTED", amount, { settlementDifferenceId: difference.id, settlementCarryId: carry.id, type: isShortfall ? "SHORTFALL_CARRY" : "OVERPAYMENT_CARRY", statusSnapshot: "DRAFT" });
      target = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, schoolId } });
    }
  }
  private async lockYear(tx: any, schoolId: string, schoolYearId: string) {
    await tx.$queryRaw`SELECT 1 FROM "SchoolYear" WHERE "id" = ${schoolYearId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const year = await tx.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException({
        code: "SCHOOL_YEAR_NOT_FOUND",
        message: "Không tìm thấy năm học.",
      });
    return year;
  }
  private async lockRun(tx: any, schoolId: string, runId: string) {
    await tx.$queryRaw`SELECT 1 FROM "CollectionRun" WHERE "id" = ${runId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const run = await tx.collectionRun.findFirst({
      where: { id: runId, schoolId },
    });
    if (!run)
      throw new NotFoundException({
        code: "COLLECTION_RUN_NOT_FOUND",
        message: "Không tìm thấy đợt thu.",
      });
    return run;
  }
  private async audit(
    tx: any,
    schoolId: string,
    identityId: string,
    membershipId: string,
    action: string,
    operationId: string,
    oldValue: object | null,
    newValue: object,
    reason?: string,
  ) {
    await tx.auditRecord.create({
      data: auditData(
        schoolId,
        {
          identityId,
          type: "SCHOOL_MEMBERSHIP",
          reference: membershipId,
          membershipId,
        },
        action,
        { operationId, oldValue, newValue },
        reason,
      ),
    });
  }
  private async mutate(
    actor: { membershipId: string },
    identityId: string,
    schoolId: string,
    route: string,
    key: string,
    operationId: string,
    body: unknown,
    work: (tx: any, operation: string) => Promise<unknown>,
  ) {
    if (!uuid.test(key) || !uuid.test(operationId))
      throw new UnauthorizedException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Cần Idempotency-Key và X-Operation-Id UUID.",
      });
    const fingerprint = requestFingerprint(body);
    const replay = async () =>
      this.prisma.operation.findFirst({
        where: {
          schoolId,
          actorReference: actor.membershipId,
          actorType: "SCHOOL_MEMBERSHIP",
          route,
          idempotencyKey: key,
        },
      });
    const operationById = async () =>
      this.prisma.operation.findFirst({
        where: {
          id: operationId,
          schoolId,
          membershipId: actor.membershipId,
          actorType: "SCHOOL_MEMBERSHIP",
        },
      });
    const existing = await replay();
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency-Key đã dùng cho yêu cầu khác.",
        });
      await this.actor(identityId, schoolId);
      return {
        id: existing.id,
        status: existing.status,
        outcome: existing.outcome,
      };
    }
    const collision = await operationById();
    if (collision)
      throw new ConflictException({
        code: "OPERATION_ID_CONFLICT",
        message:
          "X-Operation-Id đã được dùng. Hãy đối soát Operation trước khi thử lại.",
        operationId,
      });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`;
        await this.transactionActor(tx, schoolId, identityId, actor.membershipId);
        const operation = await tx.operation.create({
          data: {
            id: operationId,
            schoolId,
            membershipId: actor.membershipId,
            actorIdentityId: identityId,
            actorType: "SCHOOL_MEMBERSHIP",
            actorReference: actor.membershipId,
            route,
            idempotencyKey: key,
            fingerprint,
          },
        });
        const outcome = await work(tx, operation.id);
        const completed = await tx.operation.update({
          where: { id: operation.id },
          data: { status: "COMPLETED", outcome: outcome as any },
        });
        return {
          id: completed.id,
          status: completed.status,
          outcome: completed.outcome,
        };
      });
    } catch (error) {
      if (isOperationIdempotencyCollision(error)) {
        const current = await replay();
        if (current?.fingerprint === fingerprint) {
          await this.actor(identityId, schoolId);
          return {
            id: current.id,
            status: current.status,
            outcome: current.outcome,
          };
        }
      }
      if ((error as any)?.code === "P2002") {
        const current = await operationById();
        if (current)
          throw new ConflictException({
            code: "OPERATION_ID_CONFLICT",
            message:
              "X-Operation-Id đã được dùng. Hãy đối soát Operation trước khi thử lại.",
            operationId,
          });
      }
      if (route === routes.promotionPolicy && promotionPolicyNameCollision(error))
        throw new ConflictException({
          code: "PROMOTION_POLICY_NAME_EXISTS",
          message: "Tên chính sách ưu đãi đã được dùng trong Trường này.",
        });
      throw error;
    }
  }
}
