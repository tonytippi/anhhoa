-- Story 5.34 (decision 2026-10-02 §3.3): finance-owned extracurricular classes and effective-dated memberships.
-- They reference StudentEnrollment and Receivable only; Class, EnrollmentClassAssignment and staff authorization are untouched.
CREATE UNIQUE INDEX "StudentEnrollment_schoolId_schoolYearId_id_key" ON "StudentEnrollment"("schoolId", "schoolYearId", "id");

CREATE TABLE "ExtracurricularClass" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "receivableId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtracurricularClass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtracurricularClass_name_present" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "ExtracurricularClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularClass_year_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularClass_receivable_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExtracurricularClass_schoolId_id_key" ON "ExtracurricularClass"("schoolId", "id");
CREATE UNIQUE INDEX "ExtracurricularClass_schoolId_schoolYearId_id_key" ON "ExtracurricularClass"("schoolId", "schoolYearId", "id");
CREATE UNIQUE INDEX "ExtracurricularClass_schoolId_schoolYearId_name_key" ON "ExtracurricularClass"("schoolId", "schoolYearId", "name");
CREATE INDEX "ExtracurricularClass_schoolId_receivableId_idx" ON "ExtracurricularClass"("schoolId", "receivableId");

CREATE TABLE "ExtracurricularClassLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "extracurricularClassId" UUID NOT NULL,
  "previousStatus" "ReceivableStatus",
  "status" "ReceivableStatus" NOT NULL,
  "reason" TEXT,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtracurricularClassLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtracurricularClassLifecycleTransition_valid" CHECK (("previousStatus" IS NULL AND "status" = 'ACTIVE' AND "reason" IS NULL) OR ("previousStatus" IS NOT NULL AND "previousStatus" <> "status" AND length(btrim("reason")) > 0)),
  CONSTRAINT "ExtracurricularClassLifecycleTransition_class_fkey" FOREIGN KEY ("schoolId", "extracurricularClassId") REFERENCES "ExtracurricularClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularClassLifecycleTransition_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularClassLifecycleTransition_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExtracurricularClassLifecycleTransition_schoolId_id_key" ON "ExtracurricularClassLifecycleTransition"("schoolId", "id");
CREATE UNIQUE INDEX "ExtracurricularClassLifecycleTransition_sequence_key" ON "ExtracurricularClassLifecycleTransition"("schoolId", "extracurricularClassId", "sequence");

CREATE TABLE "ExtracurricularMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "extracurricularClassId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" TEXT NOT NULL,
  "endReason" TEXT,
  "actorIdentityId" UUID NOT NULL,
  "createdByMembershipId" UUID NOT NULL,
  "createOperationId" UUID NOT NULL,
  "endedByMembershipId" UUID,
  "endOperationId" UUID,
  "endedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtracurricularMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtracurricularMembership_interval_valid" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ExtracurricularMembership_reason_present" CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "ExtracurricularMembership_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_year_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_class_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "extracurricularClassId") REFERENCES "ExtracurricularClass"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_enrollment_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "enrollmentId") REFERENCES "StudentEnrollment"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_created_by_fkey" FOREIGN KEY ("schoolId", "createdByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_ended_by_fkey" FOREIGN KEY ("schoolId", "endedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_create_operation_fkey" FOREIGN KEY ("schoolId", "createOperationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExtracurricularMembership_end_operation_fkey" FOREIGN KEY ("schoolId", "endOperationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- A Student never holds two overlapping memberships in the same class; different classes may overlap.
  CONSTRAINT "ExtracurricularMembership_no_overlap" EXCLUDE USING gist ("schoolId" WITH =, "extracurricularClassId" WITH =, "enrollmentId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&)
);
CREATE UNIQUE INDEX "ExtracurricularMembership_schoolId_id_key" ON "ExtracurricularMembership"("schoolId", "id");
CREATE INDEX "ExtracurricularMembership_class_from_idx" ON "ExtracurricularMembership"("schoolId", "extracurricularClassId", "effectiveFrom");
CREATE INDEX "ExtracurricularMembership_enrollment_from_idx" ON "ExtracurricularMembership"("schoolId", "enrollmentId", "effectiveFrom");

-- Classes and lifecycle history are append-only (history cleanup mode only for test/seed cleanup).
CREATE OR REPLACE FUNCTION reject_extracurricular_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'Extracurricular class history is append-only';
END;
$$;
CREATE TRIGGER extracurricular_class_append_only BEFORE UPDATE OR DELETE ON "ExtracurricularClass" FOR EACH ROW EXECUTE FUNCTION reject_extracurricular_history_mutation();
CREATE TRIGGER extracurricular_class_transition_append_only BEFORE UPDATE OR DELETE ON "ExtracurricularClassLifecycleTransition" FOR EACH ROW EXECUTE FUNCTION reject_extracurricular_history_mutation();

-- A class may only use an EXTRACURRICULAR Receivable.
CREATE OR REPLACE FUNCTION validate_extracurricular_class_receivable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId"
    WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId" AND g."kind" = 'EXTRACURRICULAR'
  ) THEN
    RAISE EXCEPTION 'An extracurricular class requires an EXTRACURRICULAR Receivable of the same School';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER extracurricular_class_receivable_kind BEFORE INSERT ON "ExtracurricularClass" FOR EACH ROW EXECUTE FUNCTION validate_extracurricular_class_receivable();

-- Memberships: only an open membership may be ended (effectiveTo + end facts); nothing else changes and nothing is deleted.
-- New memberships need an ACTIVE class.
CREATE OR REPLACE FUNCTION guard_extracurricular_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'INSERT' THEN
    IF coalesce((SELECT t."status"::text FROM "ExtracurricularClassLifecycleTransition" t WHERE t."schoolId" = NEW."schoolId" AND t."extracurricularClassId" = NEW."extracurricularClassId" ORDER BY t."sequence" DESC LIMIT 1), '') <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Memberships can only be added to an ACTIVE extracurricular class';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."effectiveTo" IS NULL AND NEW."effectiveTo" IS NOT NULL
     AND (to_jsonb(OLD) - 'effectiveTo' - 'endReason' - 'endedByMembershipId' - 'endOperationId' - 'endedAt') = (to_jsonb(NEW) - 'effectiveTo' - 'endReason' - 'endedByMembershipId' - 'endOperationId' - 'endedAt')
     AND NEW."endReason" IS NOT NULL AND NEW."endOperationId" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Extracurricular memberships are append-only; an open membership can only be ended with its reason and Operation';
END;
$$;
CREATE TRIGGER extracurricular_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON "ExtracurricularMembership" FOR EACH ROW EXECUTE FUNCTION guard_extracurricular_membership();

-- A Receivable attached to an extracurricular class keeps its kind (Story 5.33 rule extended).
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') THEN
    IF NEW."groupId" <> OLD."groupId" AND (
      EXISTS (SELECT 1 FROM "InvoiceLine" l WHERE l."schoolId" = OLD."schoolId" AND l."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "CollectionRunTemplateLine" t WHERE t."schoolId" = OLD."schoolId" AND t."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "ExtracurricularClass" c WHERE c."schoolId" = OLD."schoolId" AND c."receivableId" = OLD."id")
    ) THEN
      RAISE EXCEPTION 'Receivable kind cannot change once the Receivable is used on an Invoice, collection template or extracurricular class';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;
