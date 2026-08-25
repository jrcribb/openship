-- Track the exact supplier quantities represented by each webhook and whether
-- relay to the source store completed successfully.
ALTER TABLE "TrackingDetail"
  ADD COLUMN "fulfillmentLineItems" JSONB DEFAULT '[]',
  ADD COLUMN "relayedAt" TIMESTAMP(3);
