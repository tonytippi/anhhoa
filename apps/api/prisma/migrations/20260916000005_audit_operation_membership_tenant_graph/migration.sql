ALTER TABLE "AuditRecord" DROP CONSTRAINT "AuditRecord_membershipId_fkey";
ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_schoolId_membershipId_fkey"
  FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_membershipId_fkey";
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_schoolId_membershipId_fkey"
  FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;
