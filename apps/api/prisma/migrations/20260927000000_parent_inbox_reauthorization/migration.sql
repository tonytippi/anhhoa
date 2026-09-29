ALTER TABLE "NotificationSourceEvent"
  ADD COLUMN "studentDisplayNameSnapshot" TEXT;

CREATE TABLE "ParentInboxEventRead" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "parentProfileId" UUID NOT NULL,
  "notificationSourceEventId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentInboxEventRead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentInboxEventRead_school_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "ParentInboxEventRead_parent_event_key" UNIQUE ("schoolId", "parentProfileId", "notificationSourceEventId"),
  CONSTRAINT "ParentInboxEventRead_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "ParentInboxEventRead_parent_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT,
  CONSTRAINT "ParentInboxEventRead_event_fkey" FOREIGN KEY ("schoolId", "notificationSourceEventId") REFERENCES "NotificationSourceEvent"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ParentInboxEventRead_student_parent_fkey" FOREIGN KEY ("schoolId", "studentId", "parentProfileId") REFERENCES "StudentParent"("schoolId", "studentId", "parentProfileId") ON DELETE RESTRICT
);

CREATE INDEX "ParentInboxEventRead_parent_read_idx" ON "ParentInboxEventRead"("schoolId", "parentProfileId", "readAt");
