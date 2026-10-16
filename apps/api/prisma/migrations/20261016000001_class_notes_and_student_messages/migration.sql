-- Sprint change 2026-10-16: Class-wide daily notes and per-Student teacher-parent messages.
-- CreateEnum
CREATE TYPE "StudentMessageParty" AS ENUM ('TEACHER', 'PARENT');

-- CreateTable
CREATE TABLE "ClassDailyNote" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "noteDate" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "mediaIds" UUID[],
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "actorIdentityId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "staffProfileId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassDailyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassDailyNoteMedia" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "noteDate" DATE NOT NULL,
    "contentType" TEXT NOT NULL,
    "blob" BYTEA NOT NULL,
    "uploadedByMembershipId" UUID NOT NULL,
    "uploadedByStaffProfileId" UUID NOT NULL,
    "attachedNoteId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassDailyNoteMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMessage" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "senderType" "StudentMessageParty" NOT NULL,
    "senderIdentityId" UUID NOT NULL,
    "senderReference" UUID NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "operationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMessageRead" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "readerType" "StudentMessageParty" NOT NULL,
    "readerReference" UUID NOT NULL,
    "lastReadAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentMessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassDailyNote_schoolId_id_key" ON "ClassDailyNote"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ClassDailyNote_schoolId_classId_noteDate_key" ON "ClassDailyNote"("schoolId", "classId", "noteDate");

-- CreateIndex
CREATE INDEX "ClassDailyNoteMedia_schoolId_classId_noteDate_idx" ON "ClassDailyNoteMedia"("schoolId", "classId", "noteDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClassDailyNoteMedia_schoolId_id_key" ON "ClassDailyNoteMedia"("schoolId", "id");

-- CreateIndex
CREATE INDEX "StudentMessage_schoolId_studentId_createdAt_idx" ON "StudentMessage"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMessage_schoolId_id_key" ON "StudentMessage"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMessageRead_schoolId_studentId_readerType_readerRefe_key" ON "StudentMessageRead"("schoolId", "studentId", "readerType", "readerReference");

-- AddForeignKey
ALTER TABLE "ClassDailyNote" ADD CONSTRAINT "ClassDailyNote_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassDailyNote" ADD CONSTRAINT "ClassDailyNote_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassDailyNote" ADD CONSTRAINT "ClassDailyNote_schoolId_staffProfileId_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassDailyNoteMedia" ADD CONSTRAINT "ClassDailyNoteMedia_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassDailyNoteMedia" ADD CONSTRAINT "ClassDailyNoteMedia_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassDailyNoteMedia" ADD CONSTRAINT "ClassDailyNoteMedia_schoolId_uploadedByStaffProfileId_fkey" FOREIGN KEY ("schoolId", "uploadedByStaffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMessage" ADD CONSTRAINT "StudentMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMessage" ADD CONSTRAINT "StudentMessage_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMessageRead" ADD CONSTRAINT "StudentMessageRead_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMessageRead" ADD CONSTRAINT "StudentMessageRead_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Positions that already run a Class get the new messaging capability; Admin can revoke it per position.
INSERT INTO "PositionCapabilityGrant" ("id", "schoolId", "positionId", "capability")
SELECT gen_random_uuid(), "schoolId", "positionId", 'PARENT_MESSAGE_WRITE'
FROM "PositionCapabilityGrant"
WHERE "capability" IN ('ATTENDANCE_WRITE', 'DAILY_JOURNAL_WRITE')
GROUP BY "schoolId", "positionId"
ON CONFLICT ("schoolId", "positionId", "capability") DO NOTHING;
