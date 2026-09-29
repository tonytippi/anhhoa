ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_state_check";
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_state_check" CHECK (
  ("status" IN ('PENDING', 'AUTO_APPROVED', 'CANCELLED') AND "decidedAt" IS NULL AND "decidedByMembershipId" IS NULL AND "rejectedReason" IS NULL)
  OR ("status" = 'APPROVED' AND "decidedAt" IS NOT NULL AND "decidedByMembershipId" IS NOT NULL AND "rejectedReason" IS NULL)
  OR ("status" = 'REJECTED' AND "decidedAt" IS NOT NULL AND "decidedByMembershipId" IS NOT NULL AND length(btrim("rejectedReason")) > 0)
);
