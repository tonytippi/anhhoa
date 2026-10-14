CREATE TABLE "Impersonation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "platformOperatorGrantId" UUID NOT NULL,
  "operatorIdentityId" UUID NOT NULL,
  "targetIdentityId" UUID NOT NULL,
  "audience" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ticketHash" TEXT NOT NULL,
  "ticketExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "startedAt" TIMESTAMPTZ(3),
  "endedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Impersonation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Impersonation_audience_check" CHECK ("audience" IN ('app', 'teacher', 'parent')),
  CONSTRAINT "Impersonation_not_self_check" CHECK ("operatorIdentityId" <> "targetIdentityId"),
  CONSTRAINT "Impersonation_platformOperatorGrantId_fkey" FOREIGN KEY ("platformOperatorGrantId") REFERENCES "PlatformOperatorGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Impersonation_operatorIdentityId_fkey" FOREIGN KEY ("operatorIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Impersonation_targetIdentityId_fkey" FOREIGN KEY ("targetIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Impersonation_ticketHash_key" ON "Impersonation"("ticketHash");
CREATE INDEX "Impersonation_operatorIdentityId_createdAt_idx" ON "Impersonation"("operatorIdentityId", "createdAt");
CREATE INDEX "Impersonation_targetIdentityId_createdAt_idx" ON "Impersonation"("targetIdentityId", "createdAt");

ALTER TABLE "Operation" ADD COLUMN "impersonationId" UUID;
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_impersonationId_fkey" FOREIGN KEY ("impersonationId") REFERENCES "Impersonation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditRecord" ADD COLUMN "impersonationId" UUID;
ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_impersonationId_fkey" FOREIGN KEY ("impersonationId") REFERENCES "Impersonation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
