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
  private lineDto(line: any) {
    return {
      id: line.id, receivableId: line.receivableId, receivableCode: line.receivableCodeSnapshot,
      receivableName: line.receivableNameSnapshot, unitLabel: line.unitLabelSnapshot,
      defaultUnitPrice: line.defaultUnitPriceSnapshot.toString(), unitPrice: line.unitPrice.toString(),
      quantity: line.quantity.toString(), amount: line.amount.toString(), overrideReason: line.overrideReason,
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
      lines: (invoice.lines ?? []).map((line: any) => this.lineDto(line)).sort(this.amountDescending),
      revisesInvoiceId: invoice.revisesInvoiceId ?? null,
      revisionReason: invoice.revisionReason ?? null,
      replacementInvoiceId: invoice.replacementInvoices?.[0]?.id ?? null,
    };
    if (invoice.status === "ISSUED" || invoice.status === "CANCELLED") result.issue = {
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
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] }, replacementInvoices: { select: { id: true }, take: 1 } } });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
    return this.invoiceDto(invoice);
  }
  async issueInvoice(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const bankAccountId = this.identifier(body?.bankAccountId, "bankAccountId");
    return this.mutate(actor, identityId, schoolId, routes.issueInvoice, key, operationId, { invoiceId, bankAccountId }, async (tx, operation) => {
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
      const bank = await tx.bankAccount.findFirst({ where: { id: bankAccountId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!bank || bank.lifecycleTransitions[0]?.status !== "ACTIVE") throw new NotFoundException({ code: "BANK_ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản nhận đang hoạt động." });
      if (bank.transferTemplate !== "{{studentName}} {{className}}") throw new ConflictException({ code: "BANK_ACCOUNT_TEMPLATE_INVALID", message: "Mẫu nội dung chuyển khoản không hợp lệ." });
      const now = new Date();
      const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const obligationLines = invoice.lines.map((line: any) => this.lineDto(line));
      const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: now, bankAccountIdSnapshot: bank.id, receivingBankSnapshot: bank.receivingBank, accountNumberSnapshot: bank.accountNumber, accountHolderNameSnapshot: bank.accountHolderName, transferContentSnapshot: this.transferContent(invoice.studentNameSnapshot, invoice.classNameSnapshot), obligationLinesSnapshot: obligationLines, obligationTotalSnapshot: invoice.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      const outcome = this.invoiceDto(updated); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_ISSUED", operation, { id: invoice.id, status: "DRAFT" }, outcome); return outcome;
    });
  }
  async prepareRevision(identityId: string, schoolId: string, invoiceId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId");
    const reason = this.text(body?.reason, "reason", true, 500)!;
    return this.mutate(actor, identityId, schoolId, routes.prepareRevision, key, operationId, { invoiceId, reason }, async (tx, operation) => {
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const source = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (!source) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (source.status !== "ISSUED" || source.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_NOT_REVISION_SOURCE", message: "Chỉ hóa đơn gốc đã phát hành mới có thể được điều chỉnh." });
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
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT 1 FROM "BankAccount" WHERE "id" = ${bankAccountId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const replacement = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      if (!replacement) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn." });
      if (replacement.status !== "DRAFT" || !replacement.revisesInvoiceId) throw new ConflictException({ code: "INVOICE_NOT_REVISION_DRAFT", message: "Chỉ bản điều chỉnh nháp mới có thể phát hành thay thế." });
      await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${replacement.revisesInvoiceId}::uuid AND "schoolId" = ${schoolId}::uuid FOR UPDATE`;
      const source = await tx.invoice.findFirst({ where: { id: replacement.revisesInvoiceId, schoolId } });
      if (!source || source.status !== "ISSUED" || source.studentId !== replacement.studentId || source.collectionRunId !== replacement.collectionRunId) throw new ConflictException({ code: "INVOICE_REVISION_GRAPH_CONFLICT", message: "Hóa đơn nguồn không còn hợp lệ để thay thế." });
      const run = await this.lockRun(tx, schoolId, replacement.collectionRunId);
      const year = await this.lockYear(tx, schoolId, replacement.schoolYearId);
      if (run.status === "CLOSED" || year.closedAt) throw new ConflictException({ code: "COLLECTION_RUN_CLOSED", message: "Đợt thu hoặc năm học đã đóng chỉ có thể xem." });
      if (!replacement.lines.length || replacement.total <= 0n) throw validation("invoiceId", "Hóa đơn cần ít nhất một dòng và tổng VND dương để phát hành.");
      const bank = await tx.bankAccount.findFirst({ where: { id: bankAccountId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!bank || bank.lifecycleTransitions[0]?.status !== "ACTIVE" || bank.transferTemplate !== "{{studentName}} {{className}}") throw new NotFoundException({ code: "BANK_ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản nhận đang hoạt động." });
      const now = new Date(); const issueDate = this.localIssueDate(now);
      const policy = await tx.financePolicy.findFirst({ where: { schoolId, effectiveFrom: { lte: issueDate } }, orderBy: { effectiveFrom: "desc" } });
      if (!policy) throw new ConflictException({ code: "FINANCE_POLICY_NOT_CONFIGURED", message: "Chưa có chính sách Finance hiệu lực để phát hành." });
      const dueOn = new Date(issueDate); dueOn.setUTCDate(dueOn.getUTCDate() + policy.dueDaysAfterIssue);
      const updated = await tx.invoice.update({ where: { id: replacement.id }, data: { status: "ISSUED", issuedAt: now, bankAccountIdSnapshot: bank.id, receivingBankSnapshot: bank.receivingBank, accountNumberSnapshot: bank.accountNumber, accountHolderNameSnapshot: bank.accountHolderName, transferContentSnapshot: this.transferContent(replacement.studentNameSnapshot, replacement.classNameSnapshot), obligationLinesSnapshot: replacement.lines.map((line: any) => this.lineDto(line)), obligationTotalSnapshot: replacement.total, financePolicyEffectiveFrom: policy.effectiveFrom, dueDaysAfterIssueSnapshot: policy.dueDaysAfterIssue, taxTreatmentSnapshot: policy.taxTreatment, debtScopeSnapshot: policy.debtScope, reversalModeSnapshot: policy.reversalMode, dueOn }, include: { lines: { orderBy: [{ amount: "desc" }, { id: "asc" }] } } });
      await tx.invoice.update({ where: { id: source.id }, data: { status: "CANCELLED" } });
      const outcome = this.invoiceDto(updated);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_REVISION_ISSUED", operation, { sourceInvoiceId: source.id, sourceStatus: "ISSUED" }, outcome, replacement.revisionReason ?? undefined);
      await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_CANCELLED_FOR_REVISION", operation, { id: source.id, status: "ISSUED" }, { id: source.id, status: "CANCELLED", replacementInvoiceId: replacement.id }, replacement.revisionReason ?? undefined);
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
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId);
      const receivable = await tx.receivable.findFirst({ where: { id: input.receivableId, schoolId }, include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 }, group: { include: { lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 } } } } });
      if (!receivable) throw new NotFoundException({ code: "RECEIVABLE_NOT_FOUND", message: "Không tìm thấy khoản thu." });
      if (receivable.lifecycleTransitions[0]?.status !== "ACTIVE" || receivable.group.lifecycleTransitions[0]?.status !== "ACTIVE") throw validation("receivableId", "Khoản thu đã ngừng áp dụng.");
      const unitPrice = input.unitPrice ?? receivable.defaultUnitPrice; const amount = this.amount(unitPrice, input.quantity); const source = await this.source(tx, body, invoice, identityId, actor.membershipId);
      const line = await tx.invoiceLine.create({ data: { schoolId, invoiceId, receivableId: receivable.id, receivableCodeSnapshot: receivable.code, receivableNameSnapshot: receivable.displayName, unitLabelSnapshot: receivable.unitLabel, defaultUnitPriceSnapshot: receivable.defaultUnitPrice, unitPrice, quantity: input.quantity, amount, overrideReason: input.overrideReason, ...source } });
      const outcome = await this.refreshInvoice(tx, schoolId, invoiceId); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_ADDED", operation, null, { line: this.lineDto(line), invoice: outcome }); return outcome;
    });
  }
  async editInvoiceLine(identityId: string, schoolId: string, invoiceId: string, lineId: string, key: string, operationId: string, body: any) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId"); this.identifier(lineId, "lineId");
    const input = { quantity: this.quantity(body?.quantity), unitPrice: body?.unitPrice == null ? null : this.linePrice(body.unitPrice), overrideReason: body?.unitPrice == null ? null : this.text(body?.overrideReason, "overrideReason", true, 500)! };
    return this.mutate(actor, identityId, schoolId, routes.editInvoiceLine, key, operationId, { invoiceId, lineId, ...input, unitPrice: input.unitPrice?.toString() ?? null, source: body?.source ?? null, sourceReason: body?.sourceReason ?? null }, async (tx, operation) => {
      const invoice = await this.draftInvoice(tx, schoolId, invoiceId); const existing = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId, schoolId } });
      if (!existing) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
      const unitPrice = input.unitPrice ?? existing.unitPrice;
      const overrideReason = input.unitPrice == null ? existing.overrideReason : input.overrideReason;
      const source = body?.source === undefined ? { source: existing.source, sourceReason: existing.sourceReason, sourceActorIdentityId: existing.sourceActorIdentityId, sourceMembershipId: existing.sourceMembershipId, sourceRecordedAt: existing.sourceRecordedAt, sourceProvenance: existing.sourceProvenance } : body.source === null ? { source: Prisma.DbNull, sourceReason: null, sourceActorIdentityId: null, sourceMembershipId: null, sourceRecordedAt: null, sourceProvenance: Prisma.DbNull } : await this.source(tx, body, invoice, identityId, actor.membershipId);
      const line = await tx.invoiceLine.update({ where: { id: lineId }, data: { quantity: input.quantity, unitPrice, amount: this.amount(unitPrice, input.quantity), overrideReason, ...source } });
      const outcome = await this.refreshInvoice(tx, schoolId, invoiceId); await this.audit(tx, schoolId, identityId, actor.membershipId, "INVOICE_LINE_EDITED", operation, this.lineDto(existing), { line: this.lineDto(line), invoice: outcome }); return outcome;
    });
  }
  async removeInvoiceLine(identityId: string, schoolId: string, invoiceId: string, lineId: string, key: string, operationId: string) {
    schoolId = this.school(schoolId); const actor = await this.actor(identityId, schoolId); this.identifier(invoiceId, "invoiceId"); this.identifier(lineId, "lineId");
    return this.mutate(actor, identityId, schoolId, routes.removeInvoiceLine, key, operationId, { invoiceId, lineId }, async (tx, operation) => {
      await this.draftInvoice(tx, schoolId, invoiceId); const existing = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId, schoolId } }); if (!existing) throw new NotFoundException({ code: "INVOICE_LINE_NOT_FOUND", message: "Không tìm thấy dòng hóa đơn." });
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
  private asOf(billingMonth: string) {
    const [year, month] = billingMonth.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1, 1));
  }
  private runInclude: any = {
    selections: { select: { studentId: true } },
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
    const eligibleRows = eligible.map(({ enrollment, assignment, ...item }) => item);
    const facts = {
      runId: run.id,
      version: run.version,
      billingMonth: run.billingMonth,
      schoolYear: {
        id: run.schoolYear.id,
        startsOn: run.schoolYear.startsOn.toISOString(),
        endsOn: run.schoolYear.endsOn.toISOString(),
        closedAt: run.schoolYear.closedAt?.toISOString() ?? null,
      },
      selectedStudentIds: [...studentIds].sort(),
      templateLines,
      sources,
      eligible: eligibleRows,
      skips,
    };
    return {
      run: this.runDto(run),
      eligible: eligibleRows,
      skips,
      fingerprint: requestFingerprint(facts),
      // This is the sole roster result used to create invoice snapshots below.
      snapshots: eligible,
    };
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
          data: { status: "READY", version: { increment: 1 } },
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
        // One authoritative roster read supplies both eligibility and immutable snapshots.
        const templateLines = await this.templateSnapshot(tx, schoolId, run);
        const roster = await this.selectionPreview(tx, schoolId, run, undefined, templateLines);
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
      const locked = await this.lockRun(tx, schoolId, runId);
      const year = await this.lockYear(tx, schoolId, locked.schoolYearId);
      if (year.closedAt) throw new ConflictException({ code: "SCHOOL_YEAR_CLOSED", message: "Năm học đã đóng chỉ có thể xem." });
      const run = await tx.collectionRun.findFirst({ where: { id: runId, schoolId }, include: { ...this.runInclude, schoolYear: true } });
      if (!run) throw new NotFoundException({ code: "COLLECTION_RUN_NOT_FOUND", message: "Không tìm thấy đợt thu." });
      if (run.status !== "GENERATED") throw new ConflictException({ code: "COLLECTION_RUN_STATE_CONFLICT", message: "Chỉ có thể thêm học sinh khi đợt thu đã được tạo." });
      const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
      if (!student) throw new NotFoundException({ code: "STUDENT_NOT_FOUND", message: "Không tìm thấy học sinh." });
        const roster = await this.selectionPreview(tx, schoolId, run, [studentId]);
        const candidate = roster.snapshots[0] as any;
        const skipped = [...roster.skips];
        const templateLines = run.templateSnapshot as any[] | null;
        if (!templateLines?.length) throw new ConflictException({ code: "COLLECTION_RUN_TEMPLATE_SNAPSHOT_MISSING", message: "Không tìm thấy snapshot khoản thu của đợt đã tạo." });
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
      const invoices = await tx.invoice.findMany({ where: { schoolId, collectionRunId: runId }, select: { status: true } });
      if (invoices.some((invoice: { status: string }) => !["ISSUED", "CANCELLED"].includes(invoice.status)))
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
      lines: templateLines.map((line: any) => ({ schoolId, receivableId: line.receivableId, receivableCodeSnapshot: line.receivableCode, receivableNameSnapshot: line.receivableName, unitLabelSnapshot: line.unitLabel, defaultUnitPriceSnapshot: line.defaultUnitPrice, unitPrice: line.defaultUnitPrice, quantity: line.quantity, amount: line.amount })),
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
    return new Set(inserted.map((invoice: { studentId: string }) => invoice.studentId));
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
