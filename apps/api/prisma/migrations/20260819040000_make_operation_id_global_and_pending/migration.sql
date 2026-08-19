ALTER TYPE "OperationState" ADD VALUE 'PENDING';

ALTER TABLE "Operation" ALTER COLUMN "response" DROP NOT NULL;
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_pkey";
DROP INDEX "Operation_id_idx";
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_pkey" PRIMARY KEY ("id");
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_adminId_route_id_key" UNIQUE ("adminId", "route", "id");
