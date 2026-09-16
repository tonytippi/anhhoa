ALTER TABLE "UserIdentity" ADD COLUMN "googleSubject" TEXT;
CREATE UNIQUE INDEX "UserIdentity_googleSubject_key" ON "UserIdentity"("googleSubject");
