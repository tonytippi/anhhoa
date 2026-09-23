ALTER TABLE "StaffProfile"
  ADD COLUMN "staffCode" TEXT,
  ADD COLUMN "personalIdentifier" TEXT;

CREATE UNIQUE INDEX "StaffProfile_schoolId_staffCode_present_key"
  ON "StaffProfile" ("schoolId", "staffCode")
  WHERE "staffCode" IS NOT NULL;

CREATE INDEX "StaffProfile_schoolId_staffCode_idx"
  ON "StaffProfile" ("schoolId", "staffCode");

CREATE TABLE "StaffCodeRegistry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "staffCode" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffCodeRegistry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffCodeRegistry_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StaffCodeRegistry_staff_fkey" FOREIGN KEY ("schoolId", "staffId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "StaffCodeRegistry_schoolId_staffCode_key" ON "StaffCodeRegistry" ("schoolId", "staffCode");
CREATE UNIQUE INDEX "StaffCodeRegistry_schoolId_staffId_staffCode_key" ON "StaffCodeRegistry" ("schoolId", "staffId", "staffCode");

CREATE TABLE "StaffPhoto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "blob" BYTEA NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StaffPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffPhoto_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StaffPhoto_staff_fkey" FOREIGN KEY ("schoolId", "staffId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "StaffPhoto_schoolId_id_key" ON "StaffPhoto" ("schoolId", "id");
CREATE UNIQUE INDEX "StaffPhoto_schoolId_staffId_key" ON "StaffPhoto" ("schoolId", "staffId");
