CREATE TYPE "OperationState" AS ENUM ('COMPLETED');

CREATE TABLE "Operation" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "state" "OperationState" NOT NULL DEFAULT 'COMPLETED',
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Operation_pkey" PRIMARY KEY ("adminId", "route", "id")
);

CREATE INDEX "Operation_id_idx" ON "Operation"("id");
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
