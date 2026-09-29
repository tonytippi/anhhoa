WITH numbered AS (
  SELECT
    "id",
    'OBL-' || to_char(("issuedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYYMM') || '-' ||
      lpad(row_number() OVER (
        PARTITION BY "schoolId", to_char(("issuedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYYMM')
        ORDER BY "issuedAt", "id"
      )::text, 6, '0') AS code
  FROM "Invoice"
  WHERE "status" IN ('ISSUED', 'CLOSED', 'CANCELLED') AND "obligationCodeSnapshot" IS NULL
)
UPDATE "Invoice" invoice
SET "obligationCodeSnapshot" = numbered.code
FROM numbered
WHERE invoice."id" = numbered."id";

CREATE OR REPLACE FUNCTION reject_obligation_code_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."obligationCodeSnapshot" IS NOT NULL
     AND OLD."obligationCodeSnapshot" IS DISTINCT FROM NEW."obligationCodeSnapshot" THEN
    RAISE EXCEPTION 'Obligation code snapshot is immutable';
  END IF;
  IF NEW."status" IN ('ISSUED', 'CLOSED', 'CANCELLED') AND NEW."obligationCodeSnapshot" IS NULL THEN
    RAISE EXCEPTION 'Effective invoice requires an obligation code snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
