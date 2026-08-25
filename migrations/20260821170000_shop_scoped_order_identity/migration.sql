-- Provider order IDs are unique only within their source shop.
DROP INDEX IF EXISTS "Order_orderId_key";
CREATE INDEX IF NOT EXISTS "Order_orderId_idx" ON "Order"("orderId");
CREATE UNIQUE INDEX "Order_shop_orderId_key" ON "Order"("shop", "orderId");
