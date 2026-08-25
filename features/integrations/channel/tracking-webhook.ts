import crypto from 'node:crypto';

export function trackingDedupeKey(
  channelId: string,
  purchaseId: string,
  trackingNumber: string,
  fulfillmentId?: string
): string {
  const eventIdentity = String(fulfillmentId || trackingNumber).trim().toUpperCase();
  return crypto
    .createHash('sha256')
    .update(`${channelId}\0${purchaseId}\0${eventIdentity}`)
    .digest('hex');
}

export type SupplierCartItemAllocation = {
  cartItemId: string;
  quantity: number;
};

export function supplierCartItemAllocations(lineItems: unknown): SupplierCartItemAllocation[] {
  if (!Array.isArray(lineItems)) return [];
  const allocations = new Map<string, number>();
  for (const item of lineItems as any[]) {
    const cartItemId = String(
      Array.isArray(item)
        ? item[2]?.cartItemId || item[2]?.openshipCartItemId || ''
        : item?.cartItemId ||
          item?.metadata?.openshipCartItemId ||
          item?.lineItem?.metadata?.openshipCartItemId ||
          ''
    ).trim();
    const quantity = Number(Array.isArray(item) ? item[1] : item?.quantity);
    if (!cartItemId) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Supplier fulfillment has an invalid quantity for cart item ${cartItemId}`);
    }
    allocations.set(cartItemId, (allocations.get(cartItemId) || 0) + quantity);
  }
  return [...allocations].map(([cartItemId, quantity]) => ({ cartItemId, quantity }));
}

export function supplierCartItemIds(lineItems: unknown): string[] {
  if (!Array.isArray(lineItems)) return [];
  return [
    ...new Set(
      lineItems
        .map((item: any) =>
          String(
            Array.isArray(item)
              ? item[2]?.cartItemId || item[2]?.openshipCartItemId || ''
              : item?.cartItemId ||
                item?.metadata?.openshipCartItemId ||
                item?.lineItem?.metadata?.openshipCartItemId ||
                ''
          ).trim()
        )
        .filter(Boolean)
    ),
  ];
}
