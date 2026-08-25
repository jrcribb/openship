import { createShopWebhook as executeCreateShopWebhook } from "../../utils/shopProviderAdapter";
import {
  ensureConnectionWebhookSecret,
  requestOrigin,
  requireWebhookOwner,
  validateWebhookConfiguration,
  webhookRegistrationKey,
} from "./webhook-security";

interface CreateShopWebhookArgs {
  shopId: string;
  topic: string;
  endpoint: string;
}

async function createShopWebhook(
  root: any,
  { shopId, topic, endpoint }: CreateShopWebhookArgs,
  context: any
) {
  try {
    const shop = await requireWebhookOwner(context, "shop", shopId);
    if (!shop.platform?.createWebhookFunction) {
      return { success: false, error: "Create webhook function not configured." };
    }
    const expectedOrigin = requestOrigin(context);
    if (!expectedOrigin) {
      return { success: false, error: "Configured Openship origin is required." };
    }
    const validated = validateWebhookConfiguration({
      kind: "shop",
      resourceId: shopId,
      topic,
      endpoint,
      expectedOrigin,
    });

    const webhookSecret = shop.platform.createWebhookFunction === "openfront"
      ? await ensureConnectionWebhookSecret(context, "shop", shop)
      : undefined;
    const result = await executeCreateShopWebhook({
      platform: {
        ...(shop.metadata || {}),
        resourceId: shop.id,
        webhookSecret,
        id: shop.platform.id,
        domain: shop.domain,
        accessToken: shop.accessToken,
        appKey: shop.platform.appKey,
        appSecret: shop.platform.appSecret,
        createWebhookFunction: shop.platform.createWebhookFunction,
      },
      endpoint: validated.endpoint,
      events: [validated.topic],
      registrationKey: webhookRegistrationKey('shop', shopId, validated.topic),
    });

    return { success: true, webhookId: result.webhookId };
  } catch (error: any) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook creation failed" };
  }
}

export default createShopWebhook;
