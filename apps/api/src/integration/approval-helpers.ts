import { randomUUID } from 'node:crypto';
import type { FinanceService } from '../modules/finance/finance.service.js';

// Sprint change 2026-10-17: an Invoice reaches ISSUED only by being submitted and then approved. Tests that only need
// an issued Invoice go through both steps; the old bank account request becomes the submission fallback account.
export async function submitForApproval(finance: FinanceService, identityId: string, schoolId: string, invoiceIds: string[], body: Record<string, unknown> = {}) {
  const operationId = randomUUID();
  const personalBankAccountId = body.personalBankAccountId ?? body.bankAccountId;
  await finance.submitInvoicesForApproval(identityId, schoolId, randomUUID(), operationId, { invoiceIds, ...(personalBankAccountId ? { personalBankAccountId } : {}), ...(body.schoolBankAccountId ? { schoolBankAccountId: body.schoolBankAccountId } : {}) });
  return operationId;
}

// Replaying an approval with the same Idempotency-Key needs the same request, so the submission it named is kept.
const submissionsByKey = new Map<string, string>();

// Submits the Invoice unless it already waits for approval (an earlier approval was refused), then approves it.
export async function issueThroughApproval(finance: FinanceService, identityId: string, schoolId: string, invoiceId: string, key: string = randomUUID(), operationId: string = randomUUID(), body: Record<string, unknown> = {}) {
  let submissionId = submissionsByKey.get(key);
  if (!submissionId) {
    const current = await finance.invoice(identityId, schoolId, invoiceId) as any;
    submissionId = current.approval?.submission?.submissionId ?? await submitForApproval(finance, identityId, schoolId, [invoiceId], body);
    submissionsByKey.set(key, submissionId!);
  }
  // Same shape as the former issue Operation: the approval Operation, with the issued Invoice as its outcome.
  const approval = await finance.approveInvoices(identityId, schoolId, key, operationId, { items: [{ invoiceId, submissionId }] }) as unknown as { id: string; status: string };
  return { ...approval, outcome: await finance.invoice(identityId, schoolId, invoiceId) as any };
}
