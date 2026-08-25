-- Signing secrets are connection-scoped and hidden from general metadata reads.
ALTER TABLE "Shop" ADD COLUMN "webhookSecret" TEXT;
ALTER TABLE "Channel" ADD COLUMN "webhookSecret" TEXT;
