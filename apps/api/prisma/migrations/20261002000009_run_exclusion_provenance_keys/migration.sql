-- Story 5.36 review: the run-exclusion provenance (membership, Operation, identity) is tenant- and identity-keyed like the other aggregates.
ALTER TABLE "CollectionRunExtracurricularExclusion"
  ADD CONSTRAINT "CollectionRunExtracurricularExclusion_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CollectionRunExtracurricularExclusion_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CollectionRunExtracurricularExclusion_actor_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
