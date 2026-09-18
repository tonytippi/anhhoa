ALTER TABLE "SchoolYear" DROP CONSTRAINT "SchoolYear_closeOperation_fkey";
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_school_id_unique" UNIQUE ("schoolId", "id");
ALTER TABLE "SchoolYear" ADD CONSTRAINT "SchoolYear_closeOperation_school_fkey"
  FOREIGN KEY ("schoolId", "closeOperationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT;
