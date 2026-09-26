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

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routes = {
  group: "POST /api/app/schools/:schoolId/finance/receivable-groups",
  receivable: "POST /api/app/schools/:schoolId/finance/receivables",
  groupLifecycle:
    "POST /api/app/schools/:schoolId/finance/receivable-groups/:groupId/lifecycle",
  receivableLifecycle:
    "POST /api/app/schools/:schoolId/finance/receivables/:receivableId/lifecycle",
  openRun: "POST /api/app/schools/:schoolId/finance/collection-runs",
  selection:
    "PUT /api/app/schools/:schoolId/finance/collection-runs/:runId/selection",
  coverageSelection:
    "PUT /api/app/schools/:schoolId/finance/collection-runs/:runId/coverage-selection",
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
  addInvoiceLine: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines",
  editInvoiceLine: "PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/:lineId",
  removeInvoiceLine: "DELETE /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/:lineId",
  issueInvoice: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/issue",
  prepareRevision: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/revisions",
  issueRevision: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/issue-revision",
  closeInvoice: "POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/receipt",
  debtTransfer: "POST /api/app/schools/:schoolId/finance/debt-transfers",
  coverageReversalPreview: "POST /api/app/schools/:schoolId/finance/coverage-reversals/preview",
  coverageReversal: "POST /api/app/schools/:schoolId/finance/coverage-reversals",
  coverageReversalDecision: "POST /api/app/schools/:schoolId/finance/coverage-reversal-requests/:requestId/decision",
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
    const sourceKey = String(provenance.receiptId ?? provenance.settlementDifferenceId ?? provenance.settlementCarryId ?? provenance.settlementTransferId ?? provenance.debtTransferId ?? provenance.coverageReversalId ?? provenance.coverageId ?? `${invoice.id}:${type}`);
    const statusSnapshot = typeof provenance.statusSnapshot === "string" ? provenance.statusSnapshot : invoice.status;
    await tx.financeLedgerEvent.create({ data: { schoolId: invoice.schoolId, type, sourceKey, postedAt, invoiceId: invoice.id, collectionRunId: invoice.collectionRunId, schoolYearId: invoice.schoolYearId, studentId: invoice.studentId, billingMonth: invoice.billingMonth, className: invoice.classNameSnapshot, groupName: lines.map((line: any) => line.receivable?.group?.name).filter(Boolean).sort().join(" | ") || null, statusSnapshot, amount, grossAmount, discountAmount, netAmount: invoice.obligationTotalSnapshot ?? invoice.total, provenance: { ...provenance, invoiceId: invoice.id, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, collectionRunId: invoice.collectionRunId, billingMonth: invoice.billingMonth, className: invoice.classNameSnapshot, status: statusSnapshot, lines: lines.map((line: any) => ({ id: line.id, kind: line.kind, receivableId: line.receivableId, receivableName: line.receivableNameSnapshot, groupName: line.receivable?.group?.name ?? null, grossAmount: line.grossAmount.toString(), discountAmount: line.discountAmount.toString(), netAmount: line.netAmount.toString() })) } } });
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
    const events = (await this.prisma.financeLedgerEvent.findMany({ where: { schoolId, postedAt: { lte: asOf }, ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}), ...(filters.billingMonth ? { billingMonth: filters.billingMonth } : {}), ...(filters.runId ? { collectionRunId: filters.runId } : {}), ...(filters.className ? { className: filters.className } : {}), ...(filters.status ? { statusSnapshot: filters.status } : {}) }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] })).filter((event: any) => !filters.groupName || ((event.provenance as any).lines ?? []).some((line: any) => line.groupName === filters.groupName));
    const row = (item: any) => ({ id: item.id, type: item.type, postedAt: item.postedAt.toISOString(), billingMonth: item.billingMonth, className: item.className ?? null, groupName: item.groupName ?? null, status: item.statusSnapshot ?? null, amount: (item.type === "INVOICE_ISSUED" ? BigInt(item.netAmount ?? 0) : BigInt(item.amount ?? 0)).toString(), grossAmount: BigInt(item.grossAmount ?? 0).toString(), discountAmount: BigInt(item.discountAmount ?? 0).toString(), netAmount: BigInt(item.netAmount ?? 0).toString(), invoiceId: item.invoiceId, provenance: item.provenance });
    const cancelled = new Set(events.filter((item: any) => item.type === "INVOICE_CANCELLED").map((item: any) => item.invoiceId));
    // A legacy cancellation has no trustworthy timestamp, so only those flagged source rows are excluded from effective obligations. Other backfilled issues remain reconcilable obligations.
    const issued = events.filter((item: any) => item.type === "INVOICE_ISSUED" && !cancelled.has(item.invoiceId) && !(item.provenance as any).legacyEffectiveUnknown);
    const issuedSum = () => issued.reduce((total: bigint, item: any) => total + BigInt(item.netAmount), 0n).toString();
    const cashAdjustmentEvents = events.filter((item: any) => ["RECEIPT_POSTED", "SETTLEMENT_DIFFERENCE_POSTED", "SETTLEMENT_CARRY_POSTED", "SETTLEMENT_TRANSFER_POSTED", "DEBT_TRANSFER_POSTED", "COVERAGE_REVERSAL_POSTED"].includes(item.type));
    const total = (items: any[], field = "amount") => items.reduce((value: bigint, item: any) => value + BigInt(item[field] ?? 0), 0n).toString();
    const receipts = events.filter((item: any) => item.type === "RECEIPT_POSTED"); const reversals = events.filter((item: any) => item.type === "COVERAGE_REVERSAL_POSTED"); const differences = events.filter((item: any) => item.type === "SETTLEMENT_DIFFERENCE_POSTED"); const carries = events.filter((item: any) => item.type === "SETTLEMENT_CARRY_POSTED"); const debts = events.filter((item: any) => item.type === "DEBT_TRANSFER_POSTED"); const coverage = events.filter((item: any) => item.type === "COVERAGE_ISSUED");
    const summary = { gross: total(issued, "grossAmount"), promotionDiscount: total(issued, "discountAmount"), refund: (-BigInt(total(reversals))).toString(), netBilled: issuedSum(), actualReceipt: total(receipts), settlementOutcome: { exact: total(receipts.filter((item: any) => (item.provenance as any).outcome === "EXACT")), shortfall: total(receipts.filter((item: any) => (item.provenance as any).outcome === "SHORTFALL")), overpayment: total(receipts.filter((item: any) => (item.provenance as any).outcome === "OVERPAYMENT")) }, openDifference: total(differences), carryAdjustment: total(carries), debtTransfer: total(debts), coverage: total(coverage), revisionCancellation: String(cancelled.size), outstanding: "0" };
    const currentInvoices = issued.map((issue: any) => { const invoiceEvents = events.filter((item: any) => item.invoiceId === issue.invoiceId); const paid = total(invoiceEvents.filter((item: any) => ["RECEIPT_POSTED", "SETTLEMENT_TRANSFER_POSTED"].includes(item.type))); const outstanding = BigInt(issue.netAmount) - BigInt(paid); return { ...row(issue), actualReceipt: paid, outstanding: (outstanding > 0n ? outstanding : 0n).toString(), formula: "issued obligation - Receipt - SettlementTransfer" }; });
    summary.outstanding = total(currentInvoices.map((item) => ({ amount: item.outstanding })));
    const runRows = [...new Set(issued.map((item: any) => item.collectionRunId).filter(Boolean))].map((collectionRunId) => { const runEvents = events.filter((item: any) => item.collectionRunId === collectionRunId); const runIssued = issued.filter((item: any) => item.collectionRunId === collectionRunId); return { id: collectionRunId, collectionRunId, billingMonth: runIssued[0]?.billingMonth ?? null, gross: total(runIssued, "grossAmount"), promotionDiscount: total(runIssued, "discountAmount"), netBilled: total(runIssued, "netAmount"), actualReceipt: total(runEvents.filter((item: any) => item.type === "RECEIPT_POSTED")), carryAdjustment: total(runEvents.filter((item: any) => item.type === "SETTLEMENT_CARRY_POSTED")), provenance: { eventIds: runEvents.map((item: any) => item.id) } }; });
    const rows = workspace === "overview" ? issued.map(row) : workspace === "collection-runs" ? runRows : workspace === "outstanding" ? currentInvoices : cashAdjustmentEvents.map(row);
    return { workspace, asOf: asOf.toISOString(), generatedAt: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh", filters, reportDefinitionVersion: "FINANCE_LEDGER_V3", sourceProvenance: "FinanceLedgerEvent immutable posting projection", summary, rows };
  }
  async requestReportExport(identityId: string, schoolId: string, workspace: string, query: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); const result = await this.report(identityId, schoolId, workspace, query);
    const encode = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = Buffer.from([`# asOf=${result.asOf}; generatedAt=${result.generatedAt}; timezone=${result.timezone}; definition=${result.reportDefinitionVersion}; filters=${JSON.stringify(result.filters)}`, "postedAt,type,billingMonth,className,groupName,status,amount,grossAmount,discountAmount,netAmount,invoiceId,provenance", ...result.rows.map((row: any) => [row.postedAt, row.type, row.billingMonth, row.className, row.groupName, row.status, row.amount, row.grossAmount, row.discountAmount, row.netAmount, row.invoiceId, JSON.stringify(row.provenance)].map(encode).join(","))].join("\n"));
    const record = await this.prisma.financeReportExport.create({ data: { schoolId, membershipId: actor.membershipId, workspace, result: result as Prisma.InputJsonValue, csv, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.prisma.auditRecord.create({ data: auditData(schoolId, { identityId, type: "SCHOOL_MEMBERSHIP", reference: actor.membershipId, membershipId: actor.membershipId }, "FINANCE_REPORT_EXPORT_REQUESTED", { exportId: record.id, workspace }) });
    return { exportId: record.id, expiresAt: record.expiresAt.toISOString(), workspace };
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
  private reversalAmount(value: unknown, field = "amount") {
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) > 9007199254740991n)
      throw validation(field, "Số tiền VND phải là số nguyên an toàn không âm.");
    return BigInt(value);
  }
  private safeIssuedTotal(total: bigint) {
    if (total > 9007199254740991n)
      throw validation("invoiceId", "Tổng nghĩa vụ VND vượt giới hạn nhập thực nhận an toàn.");
  }
  private amount(unitPrice: bigint, quantity: number) {
    const amount = unitPrice * BigInt(quantity);
    if (amount > 9223372036854775807n)
      throw validation("quantity", "Số lượng và đơn giá vượt giới hạn VND.");
    return amount;
  }
  private groupDto(value: any) {
    const status = value.lifecycleTransitions?.[0]?.status ?? null;
    return {
      id: value.id,
      name: value.name,
      status,
      createdAt: value.createdAt.toISOString(),
    };
  }
  private receivableDto(value: any) {
    const status = value.lifecycleTransitions?.[0]?.status ?? null;
    const groupStatus =
      value.group?.lifecycleTransitions?.[0]?.status ?? "ACTIVE";
    return {
      id: value.id,
      groupId: value.groupId,
      code: value.code,
      displayName: value.displayName,
      unitLabel: value.unitLabel,
      defaultUnitPrice: value.defaultUnitPrice.toString(),
      status,
      available: status === "ACTIVE" && groupStatus === "ACTIVE",
      createdAt: value.createdAt.toISOString(),
    };
  }
  async read(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    const [groups, receivables] = await Promise.all([
      this.prisma.receivableGroup.findMany({
        where: { schoolId },
        include: {
          lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.receivable.findMany({
        where: { schoolId },
        include: {
          lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
          group: {
            include: {
              lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
            },
          },
        },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return {
      groups: groups.map((item) => this.groupDto(item)),
      receivables: receivables.map((item) => this.receivableDto(item)),
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
  private lineDto(line: any, issued = false) {
    const promotionApplicationSnapshot = issued ? (line.promotionApplications ?? []).sort((a: any, b: any) => a.ordinal - b.ordinal).map((application: any) => this.applicationDto(application)) : null;
    return {
      id: line.id, kind: line.kind, receivableId: line.receivableId, receivableCode: line.receivableCodeSnapshot,
      receivableName: line.receivableNameSnapshot, unitLabel: line.unitLabelSnapshot,
      defaultUnitPrice: line.defaultUnitPriceSnapshot.toString(), unitPrice: line.unitPrice.toString(),
      quantity: line.quantity.toString(), amount: line.amount.toString(),
      grossAmount: (line.grossAmount ?? line.amount).toString(),
      discountAmount: (line.discountAmount ?? 0n).toString(),
      netAmount: (line.netAmount ?? line.amount).toString(),
      promotionEvaluation: issued ? { version: "PROMOTION_EVALUATION_V1", applications: promotionApplicationSnapshot } : line.promotionEvaluationProvenance ?? null,
      promotionApplicationSnapshot,
      overrideReason: line.overrideReason,
      source: line.source, sourceReason: line.sourceReason,
      sourceRecordedAt: line.sourceRecordedAt?.toISOString() ?? null,
      sourceProvenance: line.sourceProvenance,
      sourceAudit: line.source ? { actorIdentityId: line.sourceActorIdentityId, membershipId: line.sourceMembershipId } : null,
    };
  }
  private invoiceDto(invoice: any) {
    const result: any = {
      id: invoice.id, status: invoice.status, total: invoice.total.toString(), billingMonth: invoice.billingMonth,
      student: { code: invoice.studentCodeSnapshot, name: invoice.studentNameSnapshot, className: invoice.classNameSnapshot },
      lines: (invoice.lines ?? []).map((line: any) => this.lineDto(line, invoice.status !== "DRAFT")).sort(this.amountDescending),
      revisesInvoiceId: invoice.revisesInvoiceId ?? null,
      revisionReason: invoice.revisionReason ?? null,
      replacementInvoiceId: invoice.replacementInvoices?.[0]?.id ?? null,
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
      coverageFacts: (invoice.coverageFacts ?? []).map((fact: any) => ({ coverageId: fact.issuedCoverage?.id ?? null, receivableId: fact.receivableId, billingMonth: fact.billingMonth, policyId: fact.policyId, versionId: fact.versionId, originalPrice: fact.originalPrice.toString(), reduction: fact.reduction.toString(), serviceStart: fact.serviceStart.toISOString().slice(0, 10), serviceEnd: fact.serviceEnd.toISOString().slice(0, 10), calendarEffectiveFrom: fact.calendarEffectiveFrom.toISOString().slice(0, 10), timezone: fact.timezone, issuedAt: fact.issuedCoverage?.issuedAt?.toISOString() ?? null })),
    };
    if (["ISSUED", "CLOSED", "CANCELLED"].includes(invoice.status)) result.issue = {
      issuedAt: invoice.issuedAt.toISOString(), obligationTotal: invoice.obligationTotalSnapshot.toString(),
      obligationLines: invoice.obligationLinesSnapshot, dueOn: invoice.dueOn.toISOString().slice(0, 10),
      bankAccount: { id: invoice.bankAccountIdSnapshot, receivingBank: invoice.receivingBankSnapshot, accountNumber: invoice.accountNumberSnapshot, accountHolderName: invoice.accountHolderNameSnapshot },
      transferContent: invoice.transferContentSnapshot,
      policy: { effectiveFrom: invoice.financePolicyEffectiveFrom.toISOString().slice(0, 10), dueDaysAfterIssue: invoice.dueDaysAfterIssueSnapshot, taxTreatment: invoice.taxTreatmentSnapshot, debtScope: invoice.debtScopeSnapshot, reversalMode: invoice.reversalModeSnapshot },
    };
    return result;
  }
  private amountDescending = (a: { amount: string; id: string }, b: { amount: string; id: string }) =>
    BigInt(b.amount) > BigInt(a.amount) ? 1 : BigInt(b.amount) < BigInt(a.amount) ? -1 : a.id.localeCompare(b.id);
  private localIssueDate(now: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)!.value;
    return new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))));
  }
  private transferContent(studentName: string, className: string) {
    return `${studentName} ${className}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/\s+/g, " ").trim();
  }
  async bankAccounts(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const accounts = await this.prisma.bankAccount.findMany({ where: { schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } });
    return { accounts: accounts.filter((account) => account.lifecycleTransitions[0]?.status === "ACTIVE").map((account) => ({ id: account.id, receivingBank: account.receivingBank, accountNumber: account.accountNumber, accountHolderName: account.accountHolderName })) };
  }
  async invoice(identityId: string, schoolId: string, invoiceId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: this.invoiceInclude });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    return this.invoiceDto(invoice);
  }
  private invoiceInclude: any = { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }], include: { promotionApplications: { orderBy: { ordinal: "asc" } } } }, replacementInvoices: { select: { id: true }, take: 1 }, receipt: { include: { difference: true } }, settlementTransferTo: { include: { sourceReceipt: { select: { postedAt: true } } } }, settlementCarries: { orderBy: { createdAt: "asc" } }, debtTransfersFrom: { select: { targetInvoiceId: true, amount: true, reason: true, createdAt: true } }, debtTransfersTo: { orderBy: { createdAt: "asc" } }, coverageFacts: { include: { issuedCoverage: true }, orderBy: [{ billingMonth: "asc" }, { receivableId: "asc" }] } };
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
      const [targetRun, targetYear, coverageFacts] = await Promise.all([this.lockRun(tx, schoolId, target.collectionRunId), this.lockYear(tx, schoolId, target.schoolYearId), tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId: source.id } })]);
      if (targetRun.status === "CLOSED" || targetYear.closedAt) throw new ConflictException({ code: "DEBT_TRANSFER_TARGET_CLOSED", message: "Đợt thu hoặc năm học của hóa đơn đích đã đóng." });
      if (coverageFacts) throw new ConflictException({ code: "DEBT_TRANSFER_COVERAGE_SOURCE_FORBIDDEN", message: "Hóa đơn nguồn có coverage không thể chuyển công nợ." });
      const prior = await tx.debtTransfer.aggregate({ where: { schoolId, sourceInvoiceId }, _sum: { amount: true } });
      const outstanding = BigInt(source.obligationTotalSnapshot) - BigInt(prior._sum.amount ?? 0);
      if (amount > outstanding) throw new ConflictException({ code: "DEBT_TRANSFER_EXCEEDS_OUTSTANDING", message: "Số tiền chuyển vượt công nợ còn lại." });
      const line = await tx.invoiceLine.create({ data: { schoolId, invoiceId: target.id, kind: "PRIOR_DEBT", receivableNameSnapshot: "Công nợ kỳ trước", unitLabelSnapshot: "khoản", defaultUnitPriceSnapshot: amount, unitPrice: amount, quantity: 1, amount, grossAmount: amount, netAmount: amount, source: { type: "PRIOR_DEBT", sourceInvoiceId: source.id }, sourceReason: reason, sourceActorIdentityId: identityId, sourceMembershipId: actor.membershipId, sourceRecordedAt: new Date(), sourceProvenance: { sourceInvoiceId: source.id, amount: amount.toString(), operationId: operation } } });
       const transfer = await tx.debtTransfer.create({ data: { schoolId, studentId: source.studentId, schoolYearId: source.schoolYearId, sourceInvoiceId: source.id, targetInvoiceId: target.id, targetLineId: line.id, amount, reason, actorIdentityId: identityId, membershipId: actor.membershipId, operationId: operation } });
       await this.ledger(tx, source, "DEBT_TRANSFER_POSTED", amount, { debtTransferId: transfer.id, targetInvoiceId: target.id, targetLineId: line.id, reason }, transfer.createdAt);
      const outcome = { id: transfer.id, sourceInvoiceId: source.id, targetInvoiceId: target.id, amount: amount.toString(), sourceOutstanding: (outstanding - amount).toString(), targetLineId: line.id };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "PRIOR_DEBT_TRANSFERRED", operation, { sourceInvoiceId: source.id, outstanding: outstanding.toString() }, outcome, reason);
      return outcome;
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
      const transferred = await tx.debtTransfer.aggregate({ where: { schoolId, sourceInvoiceId: invoice.id }, _sum: { amount: true } });
      const issuedAmount = BigInt(invoice.obligationTotalSnapshot) - BigInt(transferred._sum.amount ?? 0);
      const signedAmount = actualAmount - issuedAmount;
      const facts = await tx.invoicePromotionCoverageFact.findMany({ where: { schoolId, invoiceId }, orderBy: { id: "asc" } });
      if (facts.length && signedAmount !== 0n) throw new ConflictException({ code: "COVERAGE_EXACT_AMOUNT_REQUIRED", message: "Hóa đơn có coverage chỉ được đóng khi thực nhận đúng bằng nghĩa vụ." });
      const outcome = signedAmount === 0n ? "EXACT" : signedAmount < 0n ? "SHORTFALL" : "OVERPAYMENT";
       const receipt = await tx.receipt.create({ data: { schoolId, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, invoiceId: invoice.id, actualAmount, outcome } });
       await this.ledger(tx, invoice, "RECEIPT_POSTED", actualAmount, { receiptId: receipt.id, outcome });
       if (signedAmount !== 0n) {
         const difference = await tx.settlementDifference.create({ data: { schoolId, studentId: invoice.studentId, schoolYearId: invoice.schoolYearId, invoiceId: invoice.id, receiptId: receipt.id, signedAmount } });
         await this.ledger(tx, invoice, "SETTLEMENT_DIFFERENCE_POSTED", signedAmount, { settlementDifferenceId: difference.id, receiptId: receipt.id, outcome }, difference.createdAt);
       }
       await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CLOSED" } });
       for (const fact of facts) {
         const coverage = await tx.$queryRaw<Array<{ id: string; issuedAt: Date }>>`INSERT INTO "StudentPromotionalCoverage" ("schoolId", "studentId", "schoolYearId", "receivableId", "billingMonth", "sourceFactId", "sourceInvoiceId", "sourceReceiptId", "policyId", "versionId", "originalPrice", "reduction", "serviceStart", "serviceEnd", "calendarEffectiveFrom", "timezone") VALUES (${schoolId}::uuid, ${fact.studentId}::uuid, ${fact.schoolYearId}::uuid, ${fact.receivableId}::uuid, ${fact.billingMonth}, ${fact.id}::uuid, ${invoice.id}::uuid, ${receipt.id}::uuid, ${fact.policyId}::uuid, ${fact.versionId}::uuid, ${fact.originalPrice}, ${fact.reduction}, ${fact.serviceStart}::date, ${fact.serviceEnd}::date, ${fact.calendarEffectiveFrom}::date, ${fact.timezone}) RETURNING "id", "issuedAt"`;
         await this.ledger(tx, invoice, "COVERAGE_ISSUED", BigInt(fact.originalPrice) - BigInt(fact.reduction), { coverageId: coverage[0]!.id, sourceFactId: fact.id, receiptId: receipt.id, receivableId: fact.receivableId, coveredBillingMonth: fact.billingMonth }, coverage[0]!.issuedAt);
       }
      const closed = await tx.invoice.findFirstOrThrow({ where: { id: invoice.id, schoolId }, include: this.invoiceInclude });
      const result = this.invoiceDto(closed);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_RECEIPT_POSTED", operation, { id: invoice.id, status: "ISSUED" }, result);
      return result;
    });
  }
  private async coveragePreview(tx: any, schoolId: string, coverageId: string, effectiveOn: Date) {
    const coverage = await tx.studentPromotionalCoverage.findFirst({ where: { id: coverageId, schoolId }, include: { sourceInvoice: { select: { id: true, studentId: true, schoolYearId: true, status: true, studentNameSnapshot: true, reversalModeSnapshot: true } }, sourceReceipt: true } });
    if (!coverage) throw new NotFoundException({ code: "COVERAGE_NOT_FOUND", message: "Không tìm thấy coverage đã phát hành." });
    if (!coverage.sourceInvoice || !["CLOSED", "CANCELLED"].includes(coverage.sourceInvoice.status) || !coverage.sourceReceipt || coverage.sourceReceipt.invoiceId !== coverage.sourceInvoiceId || coverage.sourceReceipt.studentId !== coverage.studentId || coverage.sourceReceipt.schoolYearId !== coverage.schoolYearId || coverage.sourceInvoice.studentId !== coverage.studentId || coverage.sourceInvoice.schoolYearId !== coverage.schoolYearId || coverage.sourceReceipt.outcome !== "EXACT") throw new ConflictException({ code: "COVERAGE_SOURCE_INVALID", message: "Provenance thanh toán coverage không còn hợp lệ." });
    if (coverage.timezone !== "Asia/Ho_Chi_Minh") throw new ConflictException({ code: "COVERAGE_SNAPSHOT_INVALID", message: "Snapshot coverage không dùng timezone được hỗ trợ." });
    const calendar = await tx.schoolCalendarVersion.findFirst({ where: { schoolId, effectiveFrom: coverage.calendarEffectiveFrom }, include: { holidays: true } });
    if (!calendar) throw new ConflictException({ code: "COVERAGE_SNAPSHOT_INVALID", message: "Không tìm thấy snapshot lịch của coverage." });
    const operatingDays = (start: Date, end: Date) => {
      let count = 0;
      for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1))
        if (cursor.getUTCDay() !== 0 && !calendar.holidays.some((holiday: any) => holiday.startsOn <= cursor && holiday.endsOn >= cursor)) count++;
      return count;
    };
    const denominator = operatingDays(coverage.serviceStart, coverage.serviceEnd);
    if (denominator <= 0) throw new ConflictException({ code: "COVERAGE_DENOMINATOR_INVALID", message: "Coverage snapshot không có ngày vận hành hợp lệ." });
    const unusedStart = effectiveOn >= coverage.serviceEnd ? coverage.serviceEnd : effectiveOn < coverage.serviceStart ? coverage.serviceStart : new Date(effectiveOn.getTime() + 86400000);
    const remainingDays = operatingDays(unusedStart, coverage.serviceEnd);
    const paidAmount = BigInt(coverage.originalPrice) - BigInt(coverage.reduction);
    const prior = await tx.coverageReversal.aggregate({ where: { schoolId, coverageId }, _sum: { amount: true } });
    const available = paidAmount - (prior._sum.amount ?? 0n);
    const calculatedAmount = (paidAmount * BigInt(remainingDays)) / BigInt(denominator);
    if (remainingDays <= 0 || calculatedAmount <= 0n) throw new ConflictException({ code: "COVERAGE_NOT_REFUNDABLE", message: "Coverage không còn ngày vận hành để hoàn." });
    return { coverage, denominator, remainingDays, calculatedAmount, available: available < 0n ? 0n : available, paidAmount };
  }
  async previewCoverageReversal(identityId: string, schoolId: string, body: any) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const coverageId = this.identifier(body?.coverageId, "coverageId"); const effectiveOn = this.date(body?.effectiveOn, "effectiveOn")!;
    return this.prisma.$transaction(async (tx) => {
      await this.transactionActor(tx, schoolId, identityId, (await this.actor(identityId, schoolId)).membershipId);
      const result = await this.coveragePreview(tx, schoolId, coverageId, effectiveOn);
      return { coverageId, effectiveOn: effectiveOn.toISOString().slice(0, 10), denominator: result.denominator, remainingDays: result.remainingDays, calculatedAmount: result.calculatedAmount.toString(), availableAmount: result.available.toString(), source: { studentName: result.coverage.sourceInvoice.studentNameSnapshot, reversalMode: result.coverage.sourceInvoice.reversalModeSnapshot, invoiceId: result.coverage.sourceInvoiceId, receiptId: result.coverage.sourceReceiptId, serviceStart: result.coverage.serviceStart.toISOString().slice(0, 10), serviceEnd: result.coverage.serviceEnd.toISOString().slice(0, 10), calendarEffectiveFrom: result.coverage.calendarEffectiveFrom.toISOString().slice(0, 10), timezone: result.coverage.timezone } };
    });
  }
  async coverageReversalRequests(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId);
    const decisionEligible = await this.prisma.schoolMembership.count({ where: { id: actor.membershipId, schoolId, status: "ACTIVE", boundStaffProfile: { employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "SETTINGS_MANAGE" } } } } } }) > 0;
    const requests = await this.prisma.coverageReversalRequest.findMany({ where: { schoolId, status: "PENDING" }, include: { coverage: { include: { sourceInvoice: { select: { studentNameSnapshot: true } } } } }, orderBy: { createdAt: "asc" } });
    return { requests: requests.map((request) => ({ id: request.id, coverageId: request.coverageId, studentName: request.coverage.sourceInvoice.studentNameSnapshot, amount: request.amount.toString(), effectiveOn: request.effectiveOn.toISOString().slice(0, 10), reason: request.reason, canDecide: decisionEligible && request.requestedByMembershipId !== actor.membershipId })) };
  }
  async createCoverageReversal(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId);
    const coverageId = this.identifier(body?.coverageId, "coverageId"); const effectiveOn = this.date(body?.effectiveOn, "effectiveOn")!;
    const reason = this.text(body?.reason, "reason", true, 500)!; const override = body?.amount == null ? null : this.reversalAmount(body.amount);
    const confirmation = this.text(body?.confirmation, "confirmation", false, 200);
    return this.mutate(actor, identityId, schoolId, routes.coverageReversal, key, operationId, { coverageId, effectiveOn: effectiveOn.toISOString(), reason, amount: override?.toString() ?? null, confirmation }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "StudentPromotionalCoverage" WHERE "id" = ${coverageId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const preview = await this.coveragePreview(tx, schoolId, coverageId, effectiveOn);
      const amount = override ?? preview.calculatedAmount;
      if (amount <= 0n) throw validation("amount", "Số tiền hoàn phải lớn hơn 0.");
      if (amount > preview.available) throw new ConflictException({ code: "COVERAGE_REVERSAL_LIMIT", message: "Số tiền hoàn vượt phần nguồn đã thanh toán còn lại." });
      if (override !== null && override !== preview.calculatedAmount && !reason) throw validation("reason", "Cần lý do khi override số tiền máy chủ tính.");
      const invoice = await tx.invoice.findFirst({ where: { id: preview.coverage.sourceInvoiceId, schoolId } });
      if (!invoice?.reversalModeSnapshot) throw new ConflictException({ code: "COVERAGE_SNAPSHOT_INVALID", message: "Không có snapshot chính sách reversal." });
      if (invoice.reversalModeSnapshot === "DIRECT") {
        if (confirmation !== preview.coverage.sourceInvoice.studentNameSnapshot) throw validation("confirmation", "Cần xác nhận đúng tên học sinh từ dữ liệu máy chủ.");
        const reversal = await tx.coverageReversal.create({ data: { schoolId, coverageId, amount, calculatedAmount: preview.calculatedAmount, overrideReason: override !== null && override !== preview.calculatedAmount ? reason : null, effectiveOn, reason } });
        await this.ledger(tx, invoice, "COVERAGE_REVERSAL_POSTED", -amount, { coverageReversalId: reversal.id, coverageId, effectiveOn: effectiveOn.toISOString(), calculatedAmount: preview.calculatedAmount.toString(), reason }, reversal.postedAt);
        await this.audit(tx, schoolId, identityId, actor.membershipId, "COVERAGE_REVERSAL_POSTED", operation, null, { id: reversal.id, coverageId, calculatedAmount: preview.calculatedAmount.toString(), approvedAmount: amount.toString(), status: "POSTED" }, reason);
        return { status: "POSTED", id: reversal.id, amount: amount.toString() };
      }
      const request = await tx.coverageReversalRequest.create({ data: { schoolId, coverageId, amount, calculatedAmount: preview.calculatedAmount, overrideReason: override !== null && override !== preview.calculatedAmount ? reason : null, effectiveOn, reason, policyMode: "SCHOOL_ADMIN_APPROVAL", requestedByMembershipId: actor.membershipId } });
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COVERAGE_REVERSAL_REQUESTED", operation, null, { id: request.id, coverageId, calculatedAmount: preview.calculatedAmount.toString(), approvedAmount: amount.toString(), status: "PENDING" }, reason);
      return { status: "PENDING", id: request.id, amount: amount.toString() };
    });
  }
  async decideCoverageReversal(identityId: string, schoolId: string, requestId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(requestId, "requestId");
    const decision = body?.decision; if (!["APPROVE", "REFUSE"].includes(decision)) throw validation("decision", "Quyết định không hợp lệ.");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.coverageReversalDecision, key, operationId, { requestId, decision, reason }, async (tx, operation) => {
      const request = await tx.coverageReversalRequest.findFirst({ where: { id: requestId, schoolId } });
      if (!request || request.status !== "PENDING" || request.requestedByMembershipId === actor.membershipId) throw new ConflictException({ code: "COVERAGE_REVERSAL_DECISION_DENIED", message: "Yêu cầu không còn có thể quyết định." });
      const approver = await tx.schoolMembership.findFirst({ where: { id: actor.membershipId, schoolId, status: "ACTIVE", boundStaffProfile: { employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "SETTINGS_MANAGE" } } } } } });
      if (!approver) throw new UnauthorizedException({ code: "SCHOOL_ADMIN_APPROVAL_REQUIRED", message: "Cần quyền School Admin để quyết định." });
      await tx.$queryRaw`SELECT 1 FROM "CoverageReversalRequest" WHERE "id" = ${requestId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const lockedRequest = await tx.coverageReversalRequest.findFirst({ where: { id: requestId, schoolId } });
      if (!lockedRequest || lockedRequest.status !== "PENDING" || lockedRequest.requestedByMembershipId === actor.membershipId) throw new ConflictException({ code: "COVERAGE_REVERSAL_DECISION_DENIED", message: "Yêu cầu không còn có thể quyết định." });
      if (decision === "REFUSE") { await tx.coverageReversalRequest.update({ where: { id: request.id }, data: { status: "REFUSED", decidedByMembershipId: actor.membershipId, decidedAt: new Date(), refusalReason: reason } }); await this.audit(tx, schoolId, identityId, actor.membershipId, "COVERAGE_REVERSAL_REFUSED", operation, { id: request.id, status: "PENDING" }, { id: request.id, status: "REFUSED", calculatedAmount: request.calculatedAmount.toString(), approvedAmount: request.amount.toString() }, reason); return { status: "REFUSED", id: request.id }; }
      await tx.$queryRaw`SELECT 1 FROM "StudentPromotionalCoverage" WHERE "id" = ${request.coverageId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const preview = await this.coveragePreview(tx, schoolId, request.coverageId, request.effectiveOn);
      if (request.amount > preview.available) throw new ConflictException({ code: "COVERAGE_REVERSAL_LIMIT", message: "Số tiền hoàn không còn trong giới hạn nguồn." });
      if (request.amount <= 0n || preview.remainingDays <= 0) throw new ConflictException({ code: "COVERAGE_NOT_REFUNDABLE", message: "Coverage không còn phần hợp lệ để hoàn." });
      const reversal = await tx.coverageReversal.create({ data: { schoolId, coverageId: request.coverageId, requestId: request.id, amount: request.amount, calculatedAmount: request.calculatedAmount, overrideReason: request.overrideReason, effectiveOn: request.effectiveOn, reason: request.reason } });
      const invoice = await tx.invoice.findFirstOrThrow({ where: { id: preview.coverage.sourceInvoiceId, schoolId } });
      await this.ledger(tx, invoice, "COVERAGE_REVERSAL_POSTED", -BigInt(request.amount), { coverageReversalId: reversal.id, coverageId: request.coverageId, requestId: request.id, effectiveOn: request.effectiveOn.toISOString(), calculatedAmount: request.calculatedAmount.toString(), reason: request.reason }, reversal.postedAt);
      await tx.coverageReversalRequest.update({ where: { id: request.id }, data: { status: "POSTED", decidedByMembershipId: actor.membershipId, decidedAt: new Date() } });
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COVERAGE_REVERSAL_APPROVED_AND_POSTED", operation, { id: request.id, status: "PENDING" }, { id: reversal.id, requestId: request.id, calculatedAmount: request.calculatedAmount.toString(), approvedAmount: request.amount.toString(), status: "POSTED" }, reason);
      return { status: "POSTED", id: reversal.id, requestId: request.id, amount: request.amount.toString() };
    });
  }
  async issueInvoice(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const bankAccountId = this.identifier(body?.bankAccountId, "bankAccountId");
    return this.mutate(actor, identityId, schoolId, routes.issueInvoice, key, operationId, { invoiceId, bankAccountId }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT 1 FROM "BankAccount" WHERE "id" = ${bankAccountId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (invoice.status !== "DRAFT") throw new ConflictException({ code: "INVOICE_NOT_DRAFT", message: "Hóa đơn đã được phát hành hoặc không thể phát hành." });
      if (invoice.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_REVISION_ISSUE_REQUIRED", message: "Bản điều chỉnh phải được phát hành qua luồng thay thế." });
      const run = await this.lockRun(tx, schoolId, invoice.collectionRunId);
      const year = await this.lockYear(tx, schoolId, invoice.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      if (!invoice.lines.length || invoice.total <= 0n) throw validation("invoiceId", "Hóa đơn cần ít nhất một dòng và tổng VND dương để phát hành.");
      this.safeIssuedTotal(invoice.total);
      const bank = await tx.bankAccount.findFirst({ where: { id: bankAccountId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!bank || bank.lifecycleTransitions[0]?.status !== "ACTIVE") throw new NotFoundException({ code: "BANK_ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản nhận đang hoạt động." });
      if (bank.transferTemplate !== "{{studentName}} {{className}}") throw new ConflictException({ code: "BANK_ACCOUNT_TEMPLATE_INVALID", message: "Mẫu nội dung chuyển khoản không hợp lệ." });
      const now = new Date();
      const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const applications = await this.recheckPromotion(tx, schoolId, invoice, run.billingMonth);
      const obligationLines = invoice.lines.map((line: any) => this.lineDto(line));
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: now, bankAccountIdSnapshot: bank.id, receivingBankSnapshot: bank.receivingBank, accountNumberSnapshot: bank.accountNumber, accountHolderNameSnapshot: bank.accountHolderName, transferContentSnapshot: this.transferContent(invoice.studentNameSnapshot, invoice.classNameSnapshot), obligationLinesSnapshot: obligationLines, obligationTotalSnapshot: invoice.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn } });
      await this.createIssuedPromotionApplications(tx, schoolId, invoice.id, applications);
       const issued = await tx.invoice.findFirstOrThrow({ where: { id: invoice.id, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }], include: { promotionApplications: { orderBy: { ordinal: "asc" } } } } } });
       await this.ledger(tx, issued, "INVOICE_ISSUED", 0n, { issuedAt: now.toISOString() });
       const outcome = this.invoiceDto(issued); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_ISSUED", operation, { id: invoice.id, status: "DRAFT" }, outcome); return outcome;
    });
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
       if (source.status === "ISSUED" && await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId: source.id } })) throw new ConflictException({ code: "COVERAGE_REVISION_FORBIDDEN", message: "Coverage chưa settled không thể điều chỉnh." });
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
        selectionProvenance: source.selectionProvenance, revisesInvoiceId: source.id, revisionReason: reason,
      }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      const outcome = this.invoiceDto(replacement);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_REVISION_PREPARED", operation, { id: source.id, status: source.status }, outcome, reason);
      return outcome;
    });
  }
  async issueRevision(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const bankAccountId = this.identifier(body?.bankAccountId, "bankAccountId");
    return this.mutate(actor, identityId, schoolId, routes.issueRevision, key, operationId, { invoiceId, bankAccountId }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT 1 FROM "BankAccount" WHERE "id" = ${bankAccountId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
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
      const bank = await tx.bankAccount.findFirst({ where: { id: bankAccountId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!bank || bank.lifecycleTransitions[0]?.status !== "ACTIVE" || bank.transferTemplate !== "{{studentName}} {{className}}") throw new NotFoundException({ code: "BANK_ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản nhận đang hoạt động." });
      const now = new Date(); const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const applications = await this.recheckPromotion(tx, schoolId, replacement, run.billingMonth);
      await tx.invoice.update({ where: { id: replacement.id }, data: { status: "ISSUED", issuedAt: now, bankAccountIdSnapshot: bank.id, receivingBankSnapshot: bank.receivingBank, accountNumberSnapshot: bank.accountNumber, accountHolderNameSnapshot: bank.accountHolderName, transferContentSnapshot: this.transferContent(replacement.studentNameSnapshot, replacement.classNameSnapshot), obligationLinesSnapshot: replacement.lines.map((line: any) => this.lineDto(line)), obligationTotalSnapshot: replacement.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn } });
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
    if (await tx.invoicePromotionCoverageFact.count({ where: { schoolId, invoiceId } })) throw new ConflictException({ code: "COVERAGE_FACTS_IMMUTABLE", message: "Hóa đơn có fact coverage không thể sửa dòng nháp." });
    return invoice;
  }
  private async refreshInvoice(tx: any, schoolId: string, invoiceId: string) {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    return this.invoiceDto(invoice);
  }
  async addInvoiceLine(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const input = { receivableId: this.identifier(body?.receivableId, "receivableId"), quantity: this.quantity(body?.quantity), unitPrice: body?.unitPrice == null ? null : this.linePrice(body.unitPrice), overrideReason: body?.unitPrice == null ? null : this.text(body?.overrideReason, "overrideReason", true, 500)! };
    return this.mutate(actor, identityId, schoolId, routes.addInvoiceLine, key, operationId, { invoiceId, ...input, unitPrice: input.unitPrice?.toString() ?? null, source: body?.source ?? null, sourceReason: body?.sourceReason ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId);
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } });
      if (!receivable) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
      if (receivable.lifecycleTransitions[0]?.status !== "ACTIVE" || receivable.group.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu đã ngừng áp dụng.");
      const unitPrice = input.unitPrice ?? receivable.defaultUnitPrice; const amount = this.amount(unitPrice, input.quantity); const source = await this.source(tx, body, invoice, identityId, actor.membershipId);
      const evaluated = await this.evaluateDraftPromotion(tx, schoolId, invoice, { receivableId: receivable.id, receivableName: receivable.displayName, amount });
      const line = await tx.invoiceLine.create({ data: { schoolId, invoiceId, receivableId: receivable.id, receivableCodeSnapshot: receivable.code, receivableNameSnapshot: receivable.displayName, unitLabelSnapshot: receivable.unitLabel, defaultUnitPriceSnapshot: receivable.defaultUnitPrice, unitPrice, quantity: input.quantity, amount: BigInt(evaluated.netAmount), grossAmount: BigInt(evaluated.grossAmount), discountAmount: BigInt(evaluated.discountAmount), netAmount: BigInt(evaluated.netAmount), promotionEvaluationProvenance: evaluated.promotionEvaluation, overrideReason: input.overrideReason, ...source } });
      const outcome = await this.refreshInvoice(tx, schoolId, invoiceId); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_ADDED", operation, null, { line: this.lineDto(line), invoice: outcome }); return outcome;
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
      const overrideReason = input.unitPrice == null ? existing.overrideReason : input.overrideReason;
      const source = body?.source === undefined ? { source: existing.source ?? Prisma.DbNull, sourceReason: existing.sourceReason, sourceActorIdentityId: existing.sourceActorIdentityId, sourceMembershipId: existing.sourceMembershipId, sourceRecordedAt: existing.sourceRecordedAt, sourceProvenance: existing.sourceProvenance ?? Prisma.DbNull } : body.source === null ? { source: Prisma.DbNull, sourceReason: null, sourceActorIdentityId: null, sourceMembershipId: null, sourceRecordedAt: null, sourceProvenance: Prisma.DbNull } : await this.source(tx, body, invoice, identityId, actor.membershipId);
      const amount = this.amount(unitPrice, input.quantity);
      const evaluated = await this.evaluateDraftPromotion(tx, schoolId, invoice, { receivableId: existing.receivableId, receivableName: existing.receivableNameSnapshot, amount });
      const line = await tx.invoiceLine.update({ where: { id: lineId }, data: { quantity: input.quantity, unitPrice, amount: BigInt(evaluated.netAmount), grossAmount: BigInt(evaluated.grossAmount), discountAmount: BigInt(evaluated.discountAmount), netAmount: BigInt(evaluated.netAmount), promotionEvaluationProvenance: evaluated.promotionEvaluation, overrideReason, ...source } });
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
  async createGroup(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    schoolId = this.school(schoolId);
    const actor = await this.actor(identityId, schoolId);
    const input = { name: this.text(body?.name, "name")! };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.group,
      key,
      operationId,
      input,
      async (tx, operation) => {
        try {
          const group = await tx.receivableGroup.create({
            data: { schoolId, name: input.name },
          });
          const transition = await tx.receivableGroupLifecycleTransition.create(
            {
              data: {
                schoolId,
                receivableGroupId: group.id,
                status: "ACTIVE",
                actorIdentityId: identityId,
                membershipId: actor.membershipId,
                operationId: operation,
                sequence: 1,
              },
            },
          );
          const outcome = this.groupDto({
            ...group,
            lifecycleTransitions: [transition],
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "RECEIVABLE_GROUP_CREATED",
            operation,
            null,
            outcome,
          );
          return outcome;
        } catch (error) {
          if ((error as any)?.code === "P2002")
            throw validation("name", "Tên nhóm đã tồn tại trong trường.");
          throw error;
        }
      },
    );
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
    const input = {
      groupId: this.identifier(body?.groupId, "groupId"),
      code: this.text(body?.code, "code", false, 50),
      displayName: this.text(body?.displayName, "displayName")!,
      unitLabel: this.text(body?.unitLabel, "unitLabel", true, 50)!,
      defaultUnitPrice: this.price(body?.defaultUnitPrice),
    };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.receivable,
      key,
      operationId,
      { ...input, defaultUnitPrice: input.defaultUnitPrice.toString() },
      async (tx, operation) => {
        const group = await tx.receivableGroup.findFirst({
          where: { id: input.groupId, schoolId },
          include: {
            lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
          },
        });
        if (!group)
          throw new NotFoundException({
            code: "RECEIVABLE_GROUP_NOT_FOUND",
            message: "Không tìm thấy nhóm khoản thu.",
          });
        if (group.lifecycleTransitions[0]?.status !== "ACTIVE")
          throw validation("groupId", "Nhóm khoản thu đã ngừng áp dụng.");
        try {
          const item = await tx.receivable.create({
            data: { schoolId, ...input },
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
  async transitionGroup(
    identityId: string,
    schoolId: string,
    id: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    return this.transition(
      "group",
      identityId,
      this.school(schoolId),
      id,
      key,
      operationId,
      body,
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
    return this.transition(
      "receivable",
      identityId,
      this.school(schoolId),
      id,
      key,
      operationId,
      body,
    );
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
  private promotionValue(value: unknown, type: unknown) {
    if (type !== "FIXED_VND" && type !== "PERCENTAGE") throw validation("discountType", "Loại giảm không hợp lệ.");
    if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9007199254740991n || (type === "PERCENTAGE" && BigInt(value) > 100n)) throw validation("discountValue", type === "PERCENTAGE" ? "Phần trăm phải từ 1 đến 100." : "Mức giảm VND phải là số nguyên dương an toàn.");
    return BigInt(value);
  }
  private promotionDto(value: any) {
    return { id: value.id, name: value.name, versions: (value.versions ?? []).map((version: any) => ({
      id: version.id, version: version.version, status: version.status, discountType: version.discountType, discountValue: version.discountValue.toString(), priority: version.priority, stackingMode: version.stackingMode, fulfillmentMode: version.fulfillmentMode,
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
  async promotionStudents(identityId: string, schoolId: string) {
    schoolId = this.school(schoolId); await this.actor(identityId, schoolId);
    const students = await this.prisma.student.findMany({ where: { schoolId }, select: { id: true, studentCode: true, fullName: true }, orderBy: { studentCode: "asc" } });
    return { students };
  }
  async createPromotionPolicy(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId);
    const targetIds = Array.isArray(body?.receivableIds) ? body.receivableIds.map((id: unknown) => this.identifier(id, "receivableIds")) : [];
    if (!targetIds.length || new Set(targetIds).size !== targetIds.length) throw validation("receivableIds", "Chọn ít nhất một khoản thu không trùng lặp.");
    const input = { policyId: body?.policyId == null ? null : this.identifier(body.policyId, "policyId"), name: this.text(body?.name, "name")!, receivableIds: targetIds, discountType: body?.discountType, discountValue: this.promotionValue(body?.discountValue, body?.discountType), priority: Number(body?.priority), stackingMode: body?.stackingMode, fulfillmentMode: body?.fulfillmentMode ?? "DISCOUNT", effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom")!, effectiveTo: this.inclusiveEnd(body?.effectiveTo, "effectiveTo") };
    if (!Number.isInteger(input.priority) || input.priority < 1) throw validation("priority", "Ưu tiên phải là số nguyên dương.");
    if (input.stackingMode !== "STACKABLE" && input.stackingMode !== "EXCLUSIVE") throw validation("stackingMode", "Quy tắc kết hợp không hợp lệ.");
    if (!["DISCOUNT", "PREPAID_COVERAGE"].includes(input.fulfillmentMode)) throw validation("fulfillmentMode", "Cách thực hiện ưu đãi không hợp lệ.");
    if (input.effectiveTo && input.effectiveFrom >= input.effectiveTo) throw validation("effectiveTo", "Ngày kết thúc phải sau ngày bắt đầu.");
    return this.mutate(actor, identityId, schoolId, routes.promotionPolicy, key, operationId, { ...input, discountValue: input.discountValue.toString(), effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId);
      const receivables = await tx.receivable.findMany({ where: { schoolId, id: { in: input.receivableIds } }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } });
      if (receivables.length !== input.receivableIds.length || receivables.some((receivable: any) => receivable.lifecycleTransitions[0]?.status !== "ACTIVE" || receivable.group.lifecycleTransitions[0]?.status !== "ACTIVE")) throw validation("receivableIds", "Khoản thu và nhóm khoản thu phải đang áp dụng.");
      const policy = input.policyId ? await tx.promotionPolicy.findFirst({ where: { id: input.policyId, schoolId } }) : await tx.promotionPolicy.create({ data: { schoolId, name: input.name } });
      if (!policy) throw new NotFoundException({ code: "PROMOTION_POLICY_NOT_FOUND", message: "Không tìm thấy chính sách ưu đãi." });
      if (input.policyId && policy.name !== input.name) throw validation("name", "Tên chính sách không thể đổi khi tạo phiên bản mới.");
      const previous = await tx.promotionPolicyVersion.findFirst({ where: { schoolId, policyId: policy.id }, orderBy: { version: "desc" } });
      const version = await tx.promotionPolicyVersion.create({ data: { schoolId, policyId: policy.id, version: (previous?.version ?? 0) + 1, status: "DRAFT", discountType: input.discountType, discountValue: input.discountValue, priority: input.priority, stackingMode: input.stackingMode, fulfillmentMode: input.fulfillmentMode, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo } });
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
      if (status === "ACTIVE" && (version.status !== "DRAFT" || !version.targets.length)) throw new ConflictException({ code: "PROMOTION_POLICY_VERSION_NOT_ACTIVATABLE", message: "Chỉ phiên bản nháp có khoản thu mới được kích hoạt." });
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
    selections: { select: { studentId: true } },
    coverageSelections: { select: { studentId: true, versionId: true, billingMonth: true }, orderBy: [{ studentId: "asc" }, { billingMonth: "asc" }, { versionId: "asc" }] },
    templateLines: { include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } } }, orderBy: { id: "asc" } },
    invoices: {
      select: { id: true, studentId: true, studentCodeSnapshot: true, studentNameSnapshot: true, classNameSnapshot: true, status: true, total: true },
      orderBy: { studentCodeSnapshot: "asc" },
    },
    lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
  };
  private runDto(run: any) {
    const status = run.lifecycleTransitions?.[0]?.status ?? run.status;
    return {
      id: run.id,
      schoolYearId: run.schoolYearId,
      billingMonth: run.billingMonth,
      type: run.type,
      status,
      version: run.version,
      selectedStudentIds: (run.selections ?? []).map(
        (selection: any) => selection.studentId,
      ),
      coverageSelections: (run.coverageSelections ?? []).map((item: any) => ({ studentId: item.studentId, versionId: item.versionId, billingMonth: item.billingMonth })),
      templateLines: (run.templateLines ?? []).map((line: any) => this.templateLineDto(line)).sort(this.amountDescending),
      invoices: (run.invoices ?? []).map((invoice: any) => ({
        id: invoice.id, studentId: invoice.studentId, studentCode: invoice.studentCodeSnapshot,
        studentName: invoice.studentNameSnapshot, className: invoice.classNameSnapshot,
        status: invoice.status, total: invoice.total.toString(),
      })),
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
  private templateLineDto(line: any) {
    const receivable = line.receivable;
    const price = receivable.defaultUnitPrice;
    return { id: line.id, receivableId: line.receivableId, receivableName: receivable.displayName, unitLabel: receivable.unitLabel, defaultUnitPrice: price.toString(), quantity: line.quantity.toString(), amount: this.amount(price, line.quantity).toString() };
  }
  private async templateSnapshot(tx: any, schoolId: string, run: any, validateActive = true, includeLifecycleFacts = false) {
    await tx.$queryRaw`SELECT 1 FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT 1 FROM "Receivable" AS r JOIN "ReceivableGroup" AS g ON g."id" = r."groupId" AND g."schoolId" = r."schoolId" WHERE r."schoolId" = ${schoolId}::uuid AND r."id" IN (SELECT "receivableId" FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid) FOR UPDATE OF r, g`;
    await tx.$queryRaw`SELECT 1 FROM "ReceivableLifecycleTransition" WHERE "schoolId" = ${schoolId}::uuid AND "receivableId" IN (SELECT "receivableId" FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid) FOR UPDATE`;
    await tx.$queryRaw`SELECT 1 FROM "ReceivableGroupLifecycleTransition" WHERE "schoolId" = ${schoolId}::uuid AND "receivableGroupId" IN (SELECT r."groupId" FROM "Receivable" r WHERE r."schoolId" = ${schoolId}::uuid AND r."id" IN (SELECT "receivableId" FROM "CollectionRunTemplateLine" WHERE "schoolId" = ${schoolId}::uuid AND "collectionRunId" = ${run.id}::uuid)) FOR UPDATE`;
    const lines = await tx.collectionRunTemplateLine.findMany({
      where: { schoolId, collectionRunId: run.id },
      include: { receivable: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } } },
      orderBy: { id: "asc" },
    });
    if (!lines.length) throw validation("template", "Đợt thu phải có ít nhất một khoản thu mẫu.");
    return lines.map((line: any) => {
      const receivable = line.receivable;
      if (validateActive && (receivable.lifecycleTransitions[0]?.status !== "ACTIVE" || receivable.group.lifecycleTransitions[0]?.status !== "ACTIVE")) throw validation("receivableId", "Khoản thu mẫu đã ngừng áp dụng.");
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
        ...(includeLifecycleFacts
          ? {
              receivableStatus: receivable.lifecycleTransitions[0]?.status ?? null,
              receivableGroupStatus:
                receivable.group.lifecycleTransitions[0]?.status ?? null,
            }
          : {}),
      };
    }).sort((a: any, b: any) => this.amountDescending({ ...a, id: a.templateLineId }, { ...b, id: b.templateLineId }));
  }
  async saveTemplateLine(identityId: string, schoolId: string, runId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const input = { receivableId: this.identifier(body?.receivableId, "receivableId"), quantity: this.quantity(body?.quantity), expectedVersion: Number(body?.expectedVersion) };
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw validation("expectedVersion", "Phiên bản đợt thu không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.template, key, operationId, { runId, ...input }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId);
      if (run.status !== "DRAFT") throw new ConflictException({ code: "COLLECTION_RUN_NOT_DRAFT", message: "Chỉ được sửa khoản thu mẫu khi đợt thu ở trạng thái nháp." });
      if (run.version !== input.expectedVersion) throw new ConflictException({ code: "COLLECTION_RUN_VERSION_CONFLICT", message: "Đợt thu đã thay đổi. Hãy tải lại trước khi sửa khoản thu mẫu." });
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } });
      if (!receivable || receivable.lifecycleTransitions[0]?.status !== "ACTIVE" || receivable.group.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu không còn áp dụng.");
      const line = await tx.collectionRunTemplateLine.upsert({ where: { schoolId_collectionRunId_receivableId: { schoolId, collectionRunId: run.id, receivableId: receivable.id } }, create: { schoolId, collectionRunId: run.id, receivableId: receivable.id, quantity: input.quantity }, update: { quantity: input.quantity }, include: { receivable: true } });
      const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { version: { increment: 1 } }, include: this.runInclude });
      const outcome = this.runDto(updated); await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_TEMPLATE_SAVED", operation, null, { line: this.templateLineDto(line), run: outcome }); return outcome;
    });
  }
  async removeTemplateLine(identityId: string, schoolId: string, runId: string, lineId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId"); this.identifier(lineId, "lineId");
    const expectedVersion = Number(body?.expectedVersion); if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw validation("expectedVersion", "Phiên bản đợt thu không hợp lệ.");
    return this.mutate(actor, identityId, schoolId, routes.removeTemplate, key, operationId, { runId, lineId, expectedVersion }, async (tx, operation) => {
      const run = await this.lockRun(tx, schoolId, runId); if (run.status !== "DRAFT") throw new ConflictException({ code: "COLLECTION_RUN_NOT_DRAFT", message: "Chỉ được sửa khoản thu mẫu khi đợt thu ở trạng thái nháp." });
      if (run.version !== expectedVersion) throw new ConflictException({ code: "COLLECTION_RUN_VERSION_CONFLICT", message: "Đợt thu đã thay đổi. Hãy tải lại trước khi sửa khoản thu mẫu." });
      const line = await tx.collectionRunTemplateLine.findFirst({ where: { id: lineId, schoolId, collectionRunId: run.id }, include: { receivable: true } }); if (!line) throw new NotFoundException({ code: "COLLECTION_RUN_TEMPLATE_LINE_NOT_FOUND", message: "Không tìm thấy khoản thu mẫu." });
      await tx.collectionRunTemplateLine.delete({ where: { id: line.id } }); const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { version: { increment: 1 } }, include: this.runInclude }); const outcome = this.runDto(updated); await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_TEMPLATE_REMOVED", operation, this.templateLineDto(line), outcome); return outcome;
    });
  }
  async runs(identityId: string, schoolId: string, schoolYearId?: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    if (schoolYearId) this.identifier(schoolYearId, "schoolYearId");
    const runs = await this.prisma.collectionRun.findMany({
      where: { schoolId, ...(schoolYearId ? { schoolYearId } : {}) },
      include: this.runInclude,
      orderBy: { billingMonth: "desc" },
    });
    return { runs: runs.map((run) => this.runDto(run)) };
  }
  async candidates(
    identityId: string,
    schoolId: string,
    schoolYearId?: string,
  ) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    if (schoolYearId) this.identifier(schoolYearId, "schoolYearId");
    const [schoolYears, enrollments] = await Promise.all([
      this.prisma.schoolYear.findMany({
        where: { schoolId },
        orderBy: { startsOn: "desc" },
      }),
      schoolYearId
        ? this.prisma.studentEnrollment.findMany({
            where: { schoolId, schoolYearId },
            include: { student: true },
            orderBy: { student: { studentCode: "asc" } },
          })
        : Promise.resolve([]),
    ]);
    return {
      schoolYears: schoolYears.map((year) => ({
        id: year.id,
        name: year.name,
        startsOn: year.startsOn.toISOString(),
        endsOn: year.endsOn.toISOString(),
        closedAt: year.closedAt?.toISOString() ?? null,
      })),
      students: enrollments.map((enrollment) => ({
        id: enrollment.studentId,
        studentCode: enrollment.student.studentCode,
        fullName: enrollment.student.fullName,
      })),
    };
  }
  async run(identityId: string, schoolId: string, runId: string) {
    schoolId = this.school(schoolId);
    await this.actor(identityId, schoolId);
    this.identifier(runId, "runId");
    const run = await this.prisma.collectionRun.findFirst({
      where: { id: runId, schoolId },
      include: this.runInclude,
    });
    if (!run)
      throw new NotFoundException({
        code: "COLLECTION_RUN_NOT_FOUND",
        message: "Không tìm thấy đợt thu.",
      });
    return this.runDto(run);
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
      const outcome = this.runDto({
        ...run,
        selections: [],
        lifecycleTransitions: [transition],
      });
      await this.audit(
        tx,
        schoolId,
        identityId,
        actor.membershipId,
        "COLLECTION_RUN_OPENED",
        operation,
        null,
        outcome,
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
  async replaceSelection(
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
    if (!Array.isArray(body?.studentIds) || !body.studentIds.length)
      throw validation("studentIds", "Cần chọn ít nhất một học sinh.");
    const studentIds = [
      ...new Set(
        body.studentIds.map((id: unknown) => this.identifier(id, "studentIds")),
      ),
    ].sort();
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.selection,
      key,
      operationId,
      { runId, studentIds },
      async (tx, operation) => {
        const run = await this.lockRun(tx, schoolId, runId);
        const year = await this.lockYear(tx, schoolId, run.schoolYearId);
        if (year.closedAt)
          throw new ConflictException({
            code: "SCHOOL_YEAR_CLOSED",
            message: "Năm học đã đóng chỉ có thể xem.",
          });
        if (run.status !== "DRAFT")
          throw new ConflictException({
            code: "COLLECTION_RUN_NOT_DRAFT",
            message: "Chỉ được sửa danh sách khi đợt thu ở trạng thái nháp.",
          });
        const count = await tx.studentEnrollment.count({
          where: {
            schoolId,
            schoolYearId: run.schoolYearId,
            studentId: { in: studentIds },
          },
        });
        if (count !== studentIds.length)
          throw validation(
            "studentIds",
            "Học sinh phải thuộc năm học và trường hiện tại.",
          );
        await tx.collectionRunSelection.deleteMany({
          where: { schoolId, collectionRunId: run.id },
        });
        await tx.collectionRunSelection.createMany({
          data: studentIds.map((studentId) => ({
            schoolId,
            collectionRunId: run.id,
            studentId,
          })),
        });
        const updated = await tx.collectionRun.update({
          where: { id: run.id },
          data: { version: { increment: 1 } },
          include: this.runInclude,
        });
        const outcome = this.runDto(updated);
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "COLLECTION_RUN_SELECTION_REPLACED",
          operation,
          { runId, version: run.version },
          outcome,
        );
        return outcome;
      },
    );
  }
  private async selectionPreview(
    client: any,
    schoolId: string,
    run: any,
    studentIds = run.selections.map((item: any) => item.studentId),
    templateLines: any[] = [],
  ) {
    const asOf = this.asOf(run.billingMonth);
    const enrollments = await client.studentEnrollment.findMany({
      where: {
        schoolId,
        schoolYearId: run.schoolYearId,
        studentId: { in: studentIds },
      },
      include: {
        student: true,
      },
    });
    const byStudent = new Map(
      enrollments.map((item: any) => [item.studentId, item]),
    );
    const eligible: any[] = [];
    const skips: any[] = [];
    const sources: any[] = [];
    for (const studentId of [...studentIds].sort()) {
      const enrollment: any = byStudent.get(studentId);
      const assignments = enrollment
        ? (await client.enrollmentClassAssignment.findMany({
            where: { schoolId, enrollmentId: enrollment.id },
            include: { classroom: true },
          }))
            .filter(
          (item: any) =>
            item.effectiveFrom <= asOf &&
            (!item.effectiveTo || item.effectiveTo > asOf),
            )
            .sort(
          (a: any, b: any) =>
            b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
            a.id.localeCompare(b.id),
            )
        : [];
      const assignment = assignments?.[0];
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
    const promotionFacts = await this.promotionFacts(client, schoolId, asOf, studentIds, templateLines.map((line) => line.receivableId));
    const coverageSelections = await client.collectionRunCoverageSelection.findMany({ where: { schoolId, collectionRunId: run.id }, include: { version: { include: { targets: { include: { receivable: true } }, assignments: true } } }, orderBy: [{ studentId: "asc" }, { billingMonth: "asc" }, { versionId: "asc" }] });
    const covered = await client.studentPromotionalCoverage.findMany({ where: { schoolId, schoolYearId: run.schoolYearId, studentId: { in: studentIds }, billingMonth: run.billingMonth }, select: { studentId: true, receivableId: true } });
    const coveredKeys = new Set(covered.map((item: any) => `${item.studentId}:${item.receivableId}`));
    const eligibleRows = eligible.map(({ enrollment, assignment, ...item }) => ({
      ...item,
      lines: templateLines.filter((line) => !coveredKeys.has(`${item.studentId}:${line.receivableId}`)).map((line) => this.evaluatePromotionLine(item.studentId, line, promotionFacts)),
    }));
    const futureCoverageFacts = await this.deriveCoverageFacts(client, schoolId, run, coverageSelections, false);
    const facts = {
      runId: run.id,
      billingMonth: run.billingMonth,
      schoolYear: {
        id: run.schoolYear.id,
        startsOn: run.schoolYear.startsOn.toISOString(),
        endsOn: run.schoolYear.endsOn.toISOString(),
        closedAt: run.schoolYear.closedAt?.toISOString() ?? null,
      },
      selectedStudentIds: [...studentIds].sort(),
      templateLines,
       promotionFacts: promotionFacts.map((fact: any) => ({
        assignmentId: fact.assignmentId, studentId: fact.studentId, policyId: fact.policyId,
        versionId: fact.versionId, targetId: fact.targetId, receivableId: fact.receivableId,
        discountType: fact.discountType, discountValue: fact.discountValue.toString(), priority: fact.priority,
        stackingMode: fact.stackingMode, versionInterval: fact.versionInterval,
        assignmentInterval: fact.assignmentInterval, assignmentReason: fact.assignmentReason,
       })),
      coverageSelections: coverageSelections.map((selection: any) => ({ studentId: selection.studentId, versionId: selection.versionId, billingMonth: selection.billingMonth, status: selection.version.status, fulfillmentMode: selection.version.fulfillmentMode, policyId: selection.version.policyId, targets: selection.version.targets.map((target: any) => target.receivableId).sort(), assignments: selection.version.assignments.filter((assignment: any) => assignment.studentId === selection.studentId).map((assignment: any) => ({ id: assignment.id, effectiveFrom: assignment.effectiveFrom.toISOString(), effectiveTo: assignment.effectiveTo?.toISOString() ?? null })).sort((a: any, b: any) => a.id.localeCompare(b.id)) })),
      futureCoverageFacts,
      sources,
      eligible: eligibleRows,
       skips, covered: [...coveredKeys].sort(),
    };
    return {
      run: this.runDto(run),
      eligible: eligibleRows,
      skips,
      coverageSelections: coverageSelections.map((selection: any) => ({ studentId: selection.studentId, versionId: selection.versionId, billingMonth: selection.billingMonth })),
      futureCoverageFacts,
      fingerprint: requestFingerprint(facts),
      // This is the sole roster result used to create invoice snapshots below.
      snapshots: eligible.map((item) => ({
        ...item,
         calculatedLines: eligibleRows.find((row) => row.studentId === item.studentId)!.lines,
      })),
    };
  }
  private async deriveCoverageFacts(client: any, schoolId: string, run: any, selections: any[], strict: boolean) {
    const facts: any[] = [];
    for (const selection of selections) {
      const serviceStart = this.asOf(selection.billingMonth); const serviceEnd = new Date(serviceStart); serviceEnd.setUTCMonth(serviceEnd.getUTCMonth() + 1);
      const version = selection.version;
      const assignment = version.assignments.find((item: any) => item.studentId === selection.studentId && item.effectiveFrom <= serviceStart && (!item.effectiveTo || item.effectiveTo > serviceStart));
      const calendar = await client.schoolCalendarVersion.findFirst({ where: { schoolId, effectiveFrom: { lte: serviceStart } }, orderBy: { effectiveFrom: "desc" } });
      const invalid = selection.billingMonth <= run.billingMonth || serviceStart < run.schoolYear.startsOn || serviceStart >= run.schoolYear.endsOn || version.status !== "ACTIVE" || version.fulfillmentMode !== "PREPAID_COVERAGE" || version.effectiveFrom > serviceStart || (version.effectiveTo && version.effectiveTo <= serviceStart) || !assignment || !calendar;
      if (invalid) {
        if (strict) throw new ConflictException({ code: "COVERAGE_SELECTION_STALE", message: "Lựa chọn coverage hoặc lịch vận hành không còn hiệu lực." });
        continue;
      }
      for (const target of version.targets) {
        const exists = await client.studentPromotionalCoverage.findFirst({ where: { schoolId, studentId: selection.studentId, schoolYearId: run.schoolYearId, receivableId: target.receivableId, billingMonth: selection.billingMonth }, select: { id: true } });
        if (exists) {
          if (strict) throw new ConflictException({ code: "COVERAGE_ALREADY_ISSUED", message: "Kỳ khoản thu đã có coverage được phát hành." });
          continue;
        }
        const originalPrice = target.receivable.defaultUnitPrice;
        const discountValue = BigInt(version.discountValue);
        const requestedReduction = version.discountType === "FIXED_VND" ? discountValue : originalPrice * discountValue / 100n;
        const reduction = requestedReduction > originalPrice ? originalPrice : requestedReduction;
        const fact = { studentId: selection.studentId, billingMonth: selection.billingMonth, policyId: version.policyId, versionId: version.id, targetId: target.id, assignmentId: assignment.id, receivableId: target.receivableId, receivableName: target.receivable.displayName, originalPrice: originalPrice.toString(), reduction: reduction.toString(), serviceStart: serviceStart.toISOString().slice(0, 10), serviceEnd: serviceEnd.toISOString().slice(0, 10), calendarEffectiveFrom: calendar.effectiveFrom.toISOString().slice(0, 10), timezone: "Asia/Ho_Chi_Minh" };
        if (facts.some((item) => item.studentId === fact.studentId && item.billingMonth === fact.billingMonth && item.receivableId === fact.receivableId)) {
          if (strict) throw validation("selections", "Các phiên bản coverage trùng khoản thu và kỳ.");
          continue;
        }
        facts.push(fact);
      }
    }
    return facts;
  }
  async replaceCoverageSelection(identityId: string, schoolId: string, runId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(runId, "runId");
    const selections = Array.isArray(body?.selections) ? body.selections : null;
    if (!selections || selections.some((item: any) => !item || typeof item !== "object" || !uuid.test(item.studentId) || !uuid.test(item.versionId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.billingMonth))) throw validation("selections", "Danh sách coverage không hợp lệ.");
    const unique = new Set(selections.map((item: any) => `${item.studentId}:${item.versionId}:${item.billingMonth}`));
    if (unique.size !== selections.length) throw validation("selections", "Không được chọn coverage trùng lặp.");
    return this.mutate(actor, identityId, schoolId, routes.coverageSelection, key, operationId, { runId, selections }, async (tx, operation) => {
      await this.promotionLock(tx, schoolId); const run = await this.lockRun(tx, schoolId, runId);
      if (run.status !== "DRAFT" || run.type !== "MONTHLY") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ chọn coverage cho đợt monthly nháp." });
      const year = await this.lockYear(tx, schoolId, run.schoolYearId);
      const versions = await tx.promotionPolicyVersion.findMany({ where: { schoolId, id: { in: selections.map((item: any) => item.versionId) }, status: "ACTIVE", fulfillmentMode: "PREPAID_COVERAGE" }, include: { targets: true, assignments: true } });
      if (versions.length !== new Set(selections.map((item: any) => item.versionId)).size) throw validation("selections", "Phiên bản coverage không còn hiệu lực.");
      for (const item of selections as any[]) {
        const version = versions.find((candidate: any) => candidate.id === item.versionId)!;
        const period = this.asOf(item.billingMonth);
        if (item.billingMonth <= run.billingMonth || period < year.startsOn || period >= year.endsOn || version.effectiveFrom > period || (version.effectiveTo && version.effectiveTo <= period) || !version.assignments.some((assignment: any) => assignment.studentId === item.studentId && assignment.effectiveFrom <= period && (!assignment.effectiveTo || assignment.effectiveTo > period))) throw validation("selections", "Coverage phải thuộc kỳ tương lai cùng năm học và assignment hiệu lực.");
        if (await tx.studentPromotionalCoverage.findFirst({ where: { schoolId, studentId: item.studentId, schoolYearId: run.schoolYearId, billingMonth: item.billingMonth, receivableId: { in: version.targets.map((target: any) => target.receivableId) } } })) throw validation("selections", "Kỳ khoản thu đã có coverage được phát hành.");
      }
      await tx.collectionRunCoverageSelection.deleteMany({ where: { schoolId, collectionRunId: runId } });
      if (selections.length) await tx.collectionRunCoverageSelection.createMany({ data: selections.map((item: any) => ({ schoolId, collectionRunId: runId, ...item })) });
      const outcome = await tx.collectionRun.findFirstOrThrow({ where: { id: runId, schoolId }, include: this.runInclude });
      const dto = this.runDto(outcome); await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_COVERAGE_SELECTION_REPLACED", operation, null, dto); return dto;
    });
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
      const draft = { receivableId: line.receivableId, receivableName: line.receivableNameSnapshot, grossAmount: line.grossAmount.toString(), discountAmount: line.discountAmount.toString(), netAmount: line.netAmount.toString(), promotionEvaluation: line.promotionEvaluationProvenance };
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
      grossAmount: amounts.get(application.invoiceLineId)!.grossAmount, discountAmount: amounts.get(application.invoiceLineId)!.discountAmount, netAmount: amounts.get(application.invoiceLineId)!.netAmount,
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
    return this.selectionPreview(this.prisma, schoolId, run, undefined, templateLines);
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
        const preview = await this.selectionPreview(tx, schoolId, run, undefined, templateLines);
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
          selections: run.selections,
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
        const roster = await this.selectionPreview(tx, schoolId, run, undefined, currentTemplate);
        if (!run.readyPreviewFingerprint || roster.fingerprint !== run.readyPreviewFingerprint)
          throw new ConflictException({
            code: "PREVIEW_STALE",
            message: "Bản xem trước đã cũ. Hãy tải lại trước khi tiếp tục.",
          });
        // One authoritative roster read supplies both eligibility and immutable snapshots.
        const templateLines = currentTemplate.map(({ receivableStatus, receivableGroupStatus, ...line }: any) => line);
        const snapshots = roster.snapshots as any[];
        await tx.collectionRun.update({ where: { id: run.id }, data: { templateSnapshot: templateLines } });
        const generation = await tx.collectionRunGeneration.create({ data: { schoolId, collectionRunId: run.id, operationId: operation.id, actorIdentityId: identityId, membershipId: actor.membershipId, totalCount: snapshots.length + roster.skips.length, processedCount: roster.skips.length, eligibleCount: 0, skippedCount: roster.skips.length } });
        await tx.collectionRunGenerationItem.createMany({ data: [
          ...snapshots.map((item: any, ordinal: number) => ({ schoolId, generationId: generation.id, studentId: item.studentId, ordinal, snapshot: this.invoiceData(schoolId, run, item, templateLines) })),
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
          await tx.collectionRunGeneration.update({ where: { id: generation.id }, data: { processedCount: { increment: items.length }, eligibleCount: { increment: items.length }, leaseExpiresAt: new Date(Date.now() + 30_000) } });
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
      const created = items.filter((item) => insertedStudentIds.has(item.studentId)).map((item) => item.snapshot);
      const existing = items.filter((item) => !insertedStudentIds.has(item.studentId)).map((item) => ({ ...(item.snapshot as any), reason: "INVOICE_EXISTS" }));
      const skipped = await tx.collectionRunGenerationItem.findMany({ where: { schoolId: generation.schoolId, generationId, status: "SKIPPED" }, orderBy: { ordinal: "asc" } });
      const updated = await tx.collectionRun.update({ where: { id: run.id }, data: { status: "GENERATED", version: { increment: 1 } } });
      const transition = await tx.collectionRunLifecycleTransition.create({ data: { schoolId: generation.schoolId, collectionRunId: run.id, previousStatus: "READY", status: "GENERATED", actorIdentityId: generation.actorIdentityId, membershipId: generation.membershipId, operationId: generation.operationId, sequence: 3 } });
      const outcome = { run: this.runDto({ ...updated, selections: [], invoices: [], lifecycleTransitions: [transition] }), created, skipped: [...skipped.map((item) => item.skip), ...existing] };
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
        if (!templateLines?.length) throw new ConflictException({ code: "COLLECTION_RUN_TEMPLATE_SNAPSHOT_MISSING", message: "Không tìm thấy snapshot khoản thu của đợt đã tạo." });
        const roster = await this.selectionPreview(tx, schoolId, run, [studentId], templateLines);
        const candidate = roster.snapshots[0] as any;
        const skipped = [...roster.skips];
        const insertedStudentIds = candidate
          ? await this.insertInvoices(tx, [this.invoiceData(schoolId, run, candidate, templateLines)])
         : new Set<string>();
       const created = candidate && insertedStudentIds.has(studentId) ? [{ ...candidate, invoiceId: (await tx.invoice.findFirst({ where: { schoolId, collectionRunId: run.id, studentId }, select: { id: true } }))?.id }] : [];
       if (candidate && !insertedStudentIds.has(studentId))
         skipped.push({ studentId, studentCode: student.studentCode, fullName: student.fullName, reason: "INVOICE_EXISTS" });
      const outcome = { run: this.runDto(run), created: created.map(({ enrollment, assignment, ...item }: any) => item), skipped };
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_GENERATED_STUDENT_ADDED", operation, { runId, studentId }, outcome);
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
      await this.audit(tx, schoolId, identityId, actor.membershipId, "COLLECTION_RUN_CLOSED", operation, this.runDto({ ...locked, selections: [], invoices: [], lifecycleTransitions: [{ status: "GENERATED" }] }), outcome, reason);
      return outcome;
    });
  }
  private invoiceData(schoolId: string, run: any, item: any, templateLines: any[]) {
    const { enrollment, assignment } = item;
    return {
      schoolId, studentId: item.studentId, collectionRunId: run.id, schoolYearId: run.schoolYearId,
      billingMonth: run.billingMonth, rosterAsOf: this.asOf(run.billingMonth),
      studentCodeSnapshot: enrollment.student.studentCode, studentNameSnapshot: enrollment.student.fullName,
      enrollmentIdSnapshot: enrollment.id, enrollmentLifecycleSnapshot: enrollment.lifecycle,
      enrollmentEffectiveFromSnapshot: enrollment.effectiveFrom, enrollmentEndedOnSnapshot: enrollment.endedOn,
      classAssignmentIdSnapshot: assignment.id, classAssignmentEffectiveFromSnapshot: assignment.effectiveFrom,
      classAssignmentEffectiveToSnapshot: assignment.effectiveTo, classIdSnapshot: assignment.classId,
      classNameSnapshot: assignment.classroom.name,
      selectionProvenance: { policy: "COLLECTION_RUN_SELECTION_V1", runId: run.id, billingMonth: run.billingMonth,
        rosterAsOf: this.asOf(run.billingMonth).toISOString(), enrollmentId: enrollment.id,
        enrollmentInterval: [enrollment.effectiveFrom.toISOString(), enrollment.endedOn?.toISOString() ?? null],
        assignmentId: assignment.id, assignmentInterval: [assignment.effectiveFrom.toISOString(), assignment.effectiveTo?.toISOString() ?? null] },
      lines: templateLines.filter((line: any) => !item.calculatedLines || item.calculatedLines.some((candidate: any) => candidate.receivableId === line.receivableId)).map((line: any) => {
        const calculated = item.calculatedLines?.find((candidate: any) => candidate.receivableId === line.receivableId) ?? this.evaluatePromotionLine(item.studentId, line, []);
        return { schoolId, receivableId: line.receivableId, receivableCodeSnapshot: line.receivableCode, receivableNameSnapshot: line.receivableName, unitLabelSnapshot: line.unitLabel, defaultUnitPriceSnapshot: line.defaultUnitPrice, unitPrice: line.defaultUnitPrice, quantity: line.quantity, amount: calculated.netAmount, grossAmount: calculated.grossAmount, discountAmount: calculated.discountAmount, netAmount: calculated.netAmount, promotionEvaluationProvenance: calculated.promotionEvaluation };
      }),
    };
  }
  private async insertInvoices(tx: any, invoices: any[]) {
    if (!invoices.length) return new Set<string>();
    const rows = JSON.stringify(invoices.map(({ lines, ...invoice }) => invoice));
    const inserted = (await tx.$queryRaw(Prisma.sql`
      INSERT INTO "Invoice" (
        "schoolId", "studentId", "collectionRunId", "schoolYearId", "billingMonth", "rosterAsOf",
        "studentCodeSnapshot", "studentNameSnapshot", "enrollmentIdSnapshot", "enrollmentLifecycleSnapshot",
        "enrollmentEffectiveFromSnapshot", "enrollmentEndedOnSnapshot", "classAssignmentIdSnapshot",
        "classAssignmentEffectiveFromSnapshot", "classAssignmentEffectiveToSnapshot", "classIdSnapshot",
        "classNameSnapshot", "selectionProvenance"
      )
      SELECT
        "schoolId"::uuid, "studentId"::uuid, "collectionRunId"::uuid, "schoolYearId"::uuid, "billingMonth",
        "rosterAsOf"::date, "studentCodeSnapshot", "studentNameSnapshot", "enrollmentIdSnapshot"::uuid,
        "enrollmentLifecycleSnapshot"::"StudentEnrollmentLifecycle", "enrollmentEffectiveFromSnapshot"::date,
        "enrollmentEndedOnSnapshot"::date, "classAssignmentIdSnapshot"::uuid,
        "classAssignmentEffectiveFromSnapshot"::date, "classAssignmentEffectiveToSnapshot"::date,
        "classIdSnapshot"::uuid, "classNameSnapshot", "selectionProvenance"::jsonb
      FROM jsonb_to_recordset(${rows}::jsonb) AS input(
        "schoolId" text, "studentId" text, "collectionRunId" text, "schoolYearId" text, "billingMonth" text,
        "rosterAsOf" text, "studentCodeSnapshot" text, "studentNameSnapshot" text, "enrollmentIdSnapshot" text,
        "enrollmentLifecycleSnapshot" text, "enrollmentEffectiveFromSnapshot" text, "enrollmentEndedOnSnapshot" text,
        "classAssignmentIdSnapshot" text, "classAssignmentEffectiveFromSnapshot" text,
        "classAssignmentEffectiveToSnapshot" text, "classIdSnapshot" text, "classNameSnapshot" text,
        "selectionProvenance" jsonb
      )
       ON CONFLICT ("schoolId", "studentId", "collectionRunId") WHERE "revisesInvoiceId" IS NULL DO NOTHING
       RETURNING "id", "studentId"
    `)) as { id: string; studentId: string }[];
    const invoiceIds = new Map(inserted.map((invoice) => [invoice.studentId, invoice.id]));
    const lines = invoices.flatMap((invoice) => (invoiceIds.get(invoice.studentId) ? invoice.lines.map((line: any) => ({ ...line, invoiceId: invoiceIds.get(invoice.studentId) })) : []));
    if (lines.length) await tx.invoiceLine.createMany({ data: lines });
    for (const invoice of inserted) {
      const target = invoices.find((candidate) => candidate.studentId === invoice.studentId)!;
      await this.snapshotCoverageFacts(tx, target.schoolId, invoice.id, target);
      await this.materializeCarries(tx, target.schoolId, invoice.id, target.studentId, target.schoolYearId, target.billingMonth);
    }
    return new Set(inserted.map((invoice: { studentId: string }) => invoice.studentId));
  }
  private async snapshotCoverageFacts(tx: any, schoolId: string, invoiceId: string, invoice: any) {
    const selections = await tx.collectionRunCoverageSelection.findMany({
      where: { schoolId, collectionRunId: invoice.collectionRunId, studentId: invoice.studentId },
      include: { version: { include: { targets: { include: { receivable: true } }, assignments: { where: { studentId: invoice.studentId } } } } },
    });
    if (!selections.length) return;
    const run = await tx.collectionRun.findFirstOrThrow({ where: { id: invoice.collectionRunId, schoolId }, include: { schoolYear: true } });
    const facts = await this.deriveCoverageFacts(tx, schoolId, run, selections, true);
    for (const fact of facts) await tx.$executeRaw`INSERT INTO "InvoicePromotionCoverageFact" ("schoolId", "invoiceId", "studentId", "schoolYearId", "receivableId", "billingMonth", "policyId", "versionId", "targetId", "assignmentId", "originalPrice", "reduction", "serviceStart", "serviceEnd", "calendarEffectiveFrom", "timezone") VALUES (${schoolId}::uuid, ${invoiceId}::uuid, ${fact.studentId}::uuid, ${invoice.schoolYearId}::uuid, ${fact.receivableId}::uuid, ${fact.billingMonth}, ${fact.policyId}::uuid, ${fact.versionId}::uuid, ${fact.targetId}::uuid, ${fact.assignmentId}::uuid, ${BigInt(fact.originalPrice)}, ${BigInt(fact.reduction)}, ${fact.serviceStart}::date, ${fact.serviceEnd}::date, ${fact.calendarEffectiveFrom}::date, ${fact.timezone})`;
  }
  private async materializeCarries(tx: any, schoolId: string, invoiceId: string, studentId: string, schoolYearId: string, billingMonth: string) {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
    const differences = await tx.settlementDifference.findMany({
      where: { schoolId, studentId, schoolYearId, invoice: { collectionRun: { type: "MONTHLY", billingMonth: { lt: billingMonth } } } },
      include: { carries: true, invoice: { select: { billingMonth: true } } }, orderBy: { createdAt: "asc" },
    });
    let target = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, schoolId } });
    for (const difference of differences) {
      const eligible = await tx.invoice.findFirst({
        where: {
          schoolId,
          studentId,
          schoolYearId,
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
      const isShortfall = difference.signedAmount < 0n;
      const amount = isShortfall ? remaining : (remaining > target.total ? target.total : remaining);
      if (amount <= 0n) continue;
       await tx.settlementCarry.create({ data: { schoolId, studentId, schoolYearId, settlementDifferenceId: difference.id, invoiceId, type: isShortfall ? "SHORTFALL_CARRY" : "OVERPAYMENT_CARRY", amount } });
        await this.ledger(tx, target, "SETTLEMENT_CARRY_POSTED", amount, { settlementDifferenceId: difference.id, settlementCarryId: `${difference.id}:${invoiceId}`, type: isShortfall ? "SHORTFALL_CARRY" : "OVERPAYMENT_CARRY", statusSnapshot: "DRAFT" });
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
  private async transition(
    kind: "group" | "receivable",
    identityId: string,
    schoolId: string,
    id: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    this.identifier(id, kind === "group" ? "groupId" : "receivableId");
    const status = body?.status;
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (!["ACTIVE", "INACTIVE"].includes(status))
      throw validation("status", "Trạng thái không hợp lệ.");
    const route =
      kind === "group" ? routes.groupLifecycle : routes.receivableLifecycle;
    return this.mutate(
      actor,
      identityId,
      schoolId,
      route,
      key,
      operationId,
      { id, status, reason },
      async (tx, operation) => {
        const model = kind === "group" ? tx.receivableGroup : tx.receivable;
        const transitionModel =
          kind === "group"
            ? tx.receivableGroupLifecycleTransition
            : tx.receivableLifecycleTransition;
        const include =
          kind === "group"
            ? {
                lifecycleTransitions: {
                  orderBy: { sequence: "desc" },
                  take: 1,
                },
              }
            : {
                lifecycleTransitions: {
                  orderBy: { sequence: "desc" },
                  take: 1,
                },
                group: {
                  include: {
                    lifecycleTransitions: {
                      orderBy: { sequence: "desc" },
                      take: 1,
                    },
                  },
                },
              };
        const item = await model.findFirst({
          where: { id, schoolId },
          include,
        });
        if (!item)
          throw new NotFoundException({
            code:
              kind === "group"
                ? "RECEIVABLE_GROUP_NOT_FOUND"
                : "RECEIVABLE_NOT_FOUND",
            message: "Không tìm thấy catalog khoản thu.",
          });
        const prior = item.lifecycleTransitions[0];
        if (!prior || prior.status === status)
          throw validation("status", "Bản ghi đã ở trạng thái này.");
        if (
          kind === "receivable" &&
          status === "ACTIVE" &&
          item.group.lifecycleTransitions[0]?.status !== "ACTIVE"
        )
          throw validation(
            "status",
            "Không thể kích hoạt khoản thu khi nhóm đã ngừng áp dụng.",
          );
        const transition = await transitionModel.create({
          data: {
            schoolId,
            [kind === "group" ? "receivableGroupId" : "receivableId"]: id,
            previousStatus: prior.status,
            status,
            reason,
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
            operationId: operation,
            sequence: prior.sequence + 1,
          },
        });
        const oldValue =
          kind === "group" ? this.groupDto(item) : this.receivableDto(item);
        const outcome =
          kind === "group"
            ? this.groupDto({ ...item, lifecycleTransitions: [transition] })
            : this.receivableDto({
                ...item,
                lifecycleTransitions: [transition],
              });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          kind === "group"
            ? "RECEIVABLE_GROUP_LIFECYCLE_CHANGED"
            : "RECEIVABLE_LIFECYCLE_CHANGED",
          operation,
          oldValue,
          outcome,
        );
        return outcome;
      },
    );
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
      throw error;
    }
  }
}
