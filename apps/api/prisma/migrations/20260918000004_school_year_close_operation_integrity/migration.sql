ALTER TABLE "SchoolYear" ADD CONSTRAINT "SchoolYear_closeOperation_fkey"
  FOREIGN KEY ("closeOperationId") REFERENCES "Operation"("id") ON DELETE RESTRICT;
