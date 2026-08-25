-- Expand-only reliability fields. Existing rows remain unclaimed and continue
-- to use their current PENDING/purchaseId state until first processed.
ALTER TABLE "CartItem"
  ADD COLUMN "purchaseAttemptKey" TEXT,
  ADD COLUMN "purchaseClaimedAt" TIMESTAMP(3);

CREATE INDEX "CartItem_purchaseAttemptKey_idx"
  ON "CartItem"("purchaseAttemptKey");
