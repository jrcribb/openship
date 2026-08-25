import crypto from "node:crypto";

export const SUPPLIER_PURCHASE_PROCESSING = "PURCHASE_PROCESSING";
export const SUPPLIER_PURCHASE_UNKNOWN = "PURCHASE_OUTCOME_UNKNOWN";
export const SUPPLIER_PURCHASE_COMPLETE = "AWAITING";
export const SUPPLIER_PURCHASE_STALE_MS = 5 * 60 * 1000;

type ClaimInput = {
  orderId: string;
  channelId: string;
  cartItemIds: string[];
};

type ClaimResult = {
  claimed: boolean;
  attemptKey: string;
  state: string;
  claimedAt?: Date | null;
};

export function shouldReconcileOpenFrontPurchase(
  claim: ClaimResult,
  createPurchaseFunction: string | undefined,
  now = Date.now()
): boolean {
  if (claim.claimed || createPurchaseFunction !== 'openfront') return false;
  if (claim.state === SUPPLIER_PURCHASE_UNKNOWN) return true;
  return claim.state === SUPPLIER_PURCHASE_PROCESSING &&
    Boolean(claim.claimedAt) &&
    now - new Date(claim.claimedAt as Date).getTime() >= SUPPLIER_PURCHASE_STALE_MS;
}

export function supplierPurchaseAttemptKey({
  orderId,
  channelId,
  cartItemIds,
}: ClaimInput): string {
  const itemIds = [...new Set(cartItemIds)].sort();
  if (!orderId || !channelId || itemIds.length === 0) {
    throw new Error("Supplier purchase claim requires an order, channel, and cart items");
  }
  return `supplier-purchase:${crypto
    .createHash("sha256")
    .update(`${orderId}\0${channelId}\0${itemIds.join("\0")}`)
    .digest("hex")}`;
}

async function readClaim(prisma: any, cartItemIds: string[]) {
  return prisma.cartItem.findMany({
    where: { id: { in: cartItemIds } },
    select: {
      id: true,
      status: true,
      purchaseId: true,
      purchaseAttemptKey: true,
      purchaseClaimedAt: true,
    },
  });
}

function existingClaimResult(
  rows: any[],
  cartItemIds: string[],
  attemptKey: string
): ClaimResult | null {
  if (
    rows.length === cartItemIds.length &&
    rows.every((row) => row.purchaseAttemptKey === attemptKey)
  ) {
    const state = rows.every((row) => row.purchaseId)
      ? SUPPLIER_PURCHASE_COMPLETE
      : rows.some((row) => row.status === SUPPLIER_PURCHASE_UNKNOWN)
        ? SUPPLIER_PURCHASE_UNKNOWN
        : SUPPLIER_PURCHASE_PROCESSING;
    const claimedAt = rows
      .map((row) => row.purchaseClaimedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null;
    return { claimed: false, attemptKey, state, claimedAt };
  }
  return null;
}

/**
 * Atomically claims a channel-sized group before any external supplier call.
 * A PROCESSING/UNKNOWN claim is intentionally not lease-stealable: an operator
 * must reconcile an uncertain supplier outcome before permitting another call.
 */
export async function claimSupplierPurchase(
  prisma: any,
  input: ClaimInput
): Promise<ClaimResult> {
  const cartItemIds = [...new Set(input.cartItemIds)].sort();
  const attemptKey = supplierPurchaseAttemptKey({ ...input, cartItemIds });

  try {
    return await prisma.$transaction(async (tx: any) => {
      const current = await readClaim(tx, cartItemIds);
      const existing = existingClaimResult(current, cartItemIds, attemptKey);
      if (existing) return existing;
      if (
        current.length !== cartItemIds.length ||
        current.some(
          (row: any) =>
            row.purchaseId ||
            row.purchaseAttemptKey ||
            row.status !== "PENDING"
        )
      ) {
        throw new Error("Supplier purchase items are already claimed or changed");
      }

      const claimedAt = new Date();
      const claimed = await tx.cartItem.updateMany({
        where: {
          id: { in: cartItemIds },
          orderId: input.orderId,
          channelId: input.channelId,
          purchaseId: "",
          url: "",
          purchaseAttemptKey: null,
          status: "PENDING",
        },
        data: {
          purchaseAttemptKey: attemptKey,
          purchaseClaimedAt: claimedAt,
          status: SUPPLIER_PURCHASE_PROCESSING,
          error: "",
        },
      });
      if (claimed.count !== cartItemIds.length) {
        throw new Error("Supplier purchase claim lost a concurrent race");
      }
      return {
        claimed: true,
        attemptKey,
        state: SUPPLIER_PURCHASE_PROCESSING,
        claimedAt,
      };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const winner = existingClaimResult(
      await readClaim(prisma, cartItemIds),
      cartItemIds,
      attemptKey
    );
    if (winner) return winner;
    throw error;
  }
}

export async function completeSupplierPurchase(
  prisma: any,
  {
    attemptKey,
    cartItemIds,
    purchaseId,
    url = "",
  }: {
    attemptKey: string;
    cartItemIds: string[];
    purchaseId: string;
    url?: string;
  }
): Promise<void> {
  if (!purchaseId) throw new Error("Supplier purchase ID is required");
  await prisma.$transaction(async (tx: any) => {
    const result = await tx.cartItem.updateMany({
      where: {
        id: { in: cartItemIds },
        purchaseAttemptKey: attemptKey,
        purchaseId: "",
        status: { in: [SUPPLIER_PURCHASE_PROCESSING, SUPPLIER_PURCHASE_UNKNOWN] },
      },
      data: {
        purchaseId,
        url,
        status: SUPPLIER_PURCHASE_COMPLETE,
        error: "",
      },
    });
    if (result.count !== cartItemIds.length) {
      throw new Error("Supplier purchase result could not be recorded atomically");
    }
  });
}

export async function markSupplierPurchaseUnknown(
  prisma: any,
  {
    attemptKey,
    cartItemIds,
    error,
  }: {
    attemptKey: string;
    cartItemIds: string[];
    error: string;
  }
): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    const result = await tx.cartItem.updateMany({
      where: {
        id: { in: cartItemIds },
        purchaseAttemptKey: attemptKey,
        purchaseId: "",
        status: { in: [SUPPLIER_PURCHASE_PROCESSING, SUPPLIER_PURCHASE_UNKNOWN] },
      },
      data: {
        status: SUPPLIER_PURCHASE_UNKNOWN,
        error: `PURCHASE_OUTCOME_UNKNOWN [${attemptKey}]: ${error}`,
      },
    });
    if (result.count !== cartItemIds.length) {
      throw new Error("Supplier purchase uncertainty could not be recorded atomically");
    }
  });
}
