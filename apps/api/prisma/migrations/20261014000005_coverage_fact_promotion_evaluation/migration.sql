-- Decision 2026-10-14 §2.7: a prepaid month records how the package stacked with the Student's other promotions.
ALTER TABLE "InvoicePromotionCoverageFact" ADD COLUMN "promotionEvaluation" JSONB;
