CREATE TABLE "OAuthTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "audience" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "correlationHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "redirect" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OAuthTransaction_stateHash_key" ON "OAuthTransaction"("stateHash");
CREATE INDEX "OAuthTransaction_audience_expiresAt_idx" ON "OAuthTransaction"("audience", "expiresAt");
