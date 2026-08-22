ALTER TABLE "Invoice" ADD COLUMN "paymentSnapshotTransferContent" TEXT;

UPDATE "Invoice"
SET "paymentSnapshotTransferContent" = "studentName"
  || CASE WHEN "studentNickname" IS NULL THEN '' ELSE ' [' || "studentNickname" || ']' END
  || ' ' || "className" || ' chuyển tiền'
WHERE "status" = 'PENDING'
  AND "paymentSnapshotMethod" = 'TRANSFER'
  AND btrim("studentName") <> ''
  AND btrim("className") <> ''
  AND "paymentSnapshotBankCode" IS NOT NULL
  AND btrim("paymentSnapshotBankCode") <> ''
  AND "paymentSnapshotAccountNumber" IS NOT NULL
  AND btrim("paymentSnapshotAccountNumber") <> ''
  AND "paymentSnapshotAccountHolderName" IS NOT NULL
  AND btrim("paymentSnapshotAccountHolderName") <> ''
  AND "paymentSnapshotBankCode" IN ('ABB', 'ACB', 'AGRIBANK', 'BAB', 'BAOVIETBANK', 'BVB', 'BIDC', 'BID', 'CAKE', 'VNCB', 'CIMB', 'COOPBANK', 'DBS', 'DONGABANK', 'EIB', 'GPBANK', 'HDB', 'HLB', 'HSBC', 'IBKHCM', 'IBKHN', 'IVB', 'KBANK', 'KLB', 'KBHCM', 'KBHN', 'LPB', 'LIOBANK', 'MBB', 'MBV', 'MSB', 'NAB', 'NVB', 'NONGHYUP', 'OCB', 'OCEANBANK', 'PGB', 'PBVN', 'PVCOMBANK', 'STB', 'SGB', 'SCB', 'SSB', 'SHB', 'SVB', 'SC', 'TCB', 'TIMO', 'TPB', 'UBANK', 'UOB', 'VIB', 'VAB', 'VBB', 'VCB', 'CTG', 'VIKKI', 'VPB', 'VRB', 'WRB', 'MOMO');
