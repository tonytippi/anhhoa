CREATE TYPE "FinanceTaxTreatment" AS ENUM ('NOT_APPLICABLE', 'TAX_INCLUDED', 'TAX_EXCLUDED');
CREATE TYPE "FinanceDebtScope" AS ENUM ('CURRENT_SCHOOL_YEAR_ONLY');
CREATE TYPE "FinanceReversalMode" AS ENUM ('DIRECT', 'SCHOOL_ADMIN_APPROVAL');
CREATE TYPE "BankAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "FinancePolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "dueDaysAfterIssue" INTEGER NOT NULL,
  "taxTreatment" "FinanceTaxTreatment" NOT NULL, "debtScope" "FinanceDebtScope" NOT NULL,
  "reversalMode" "FinanceReversalMode" NOT NULL, "reason" TEXT,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancePolicy_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "FinancePolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "FinancePolicy_due_days_check" CHECK ("dueDaysAfterIssue" BETWEEN 0 AND 365),
  CONSTRAINT "FinancePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancePolicy_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinancePolicy_schoolId_effectiveFrom_idx" ON "FinancePolicy"("schoolId", "effectiveFrom");

CREATE TABLE "BankAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "receivingBank" TEXT NOT NULL, "accountNumber" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL, "transferTemplate" TEXT NOT NULL,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankAccount_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "BankAccount_template_check" CHECK ("transferTemplate" = '{{studentName}} {{className}}'),
  CONSTRAINT "BankAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankAccount_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BankAccount_schoolId_createdAt_idx" ON "BankAccount"("schoolId", "createdAt");

CREATE TABLE "BankAccountLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "bankAccountId" UUID NOT NULL,
  "previousStatus" "BankAccountStatus", "status" "BankAccountStatus" NOT NULL, "reason" TEXT,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "operationId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankAccountLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankAccountLifecycleTransition_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "BankAccountLifecycleTransition_account_sequence_key" UNIQUE ("schoolId", "bankAccountId", "sequence"),
  CONSTRAINT "BankAccountLifecycleTransition_account_graph_fkey" FOREIGN KEY ("schoolId", "bankAccountId") REFERENCES "BankAccount"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankAccountLifecycleTransition_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankAccountLifecycleTransition_operation_graph_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankAccountLifecycleTransition_initial_status_check" CHECK (("previousStatus" IS NULL AND "status" = 'ACTIVE' AND "reason" IS NULL) OR ("previousStatus" IS NOT NULL AND "previousStatus" <> "status" AND length(trim("reason")) > 0))
);
CREATE INDEX "BankAccountLifecycleTransition_schoolId_bankAccountId_sequence_idx" ON "BankAccountLifecycleTransition"("schoolId", "bankAccountId", "sequence");

CREATE TRIGGER finance_policy_append_only BEFORE UPDATE OR DELETE ON "FinancePolicy" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE FUNCTION reject_bank_account_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Bank account history cannot be deleted'; END IF;
  RAISE EXCEPTION 'Bank account financial identity is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER bank_account_append_only BEFORE UPDATE OR DELETE ON "BankAccount" FOR EACH ROW EXECUTE FUNCTION reject_bank_account_mutation();
CREATE TRIGGER bank_account_lifecycle_append_only BEFORE UPDATE OR DELETE ON "BankAccountLifecycleTransition" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
