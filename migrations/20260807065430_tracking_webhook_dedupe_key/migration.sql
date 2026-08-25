/*
  Warnings:

  - A unique constraint covering the columns `[dedupeKey]` on the table `TrackingDetail` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TrackingDetail" ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrackingDetail_dedupeKey_key" ON "TrackingDetail"("dedupeKey");
