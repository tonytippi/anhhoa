CREATE INDEX "Invoice_schoolId_status_schoolYearId_billingMonth_classIdSnapshot_issuedAt_id_idx"
ON "Invoice" ("schoolId", "status", "schoolYearId", "billingMonth", "classIdSnapshot", "issuedAt", "id");
