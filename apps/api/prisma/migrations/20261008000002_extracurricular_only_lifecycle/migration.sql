-- Decision 2026-10-08 (extracurricular-only-students): a Student who attends only extracurricular classes has its own lifecycle.
-- The value is added in its own migration because PostgreSQL cannot use a new enum value in the transaction that adds it.
ALTER TYPE "StudentEnrollmentLifecycle" ADD VALUE IF NOT EXISTS 'EXTRACURRICULAR_ONLY' AFTER 'ENROLLED';
