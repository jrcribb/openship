import {
  deleteShopWebhook as executeDeleteShopWebhook,
  getShopWebhooks as executeGetShopWebhooks,
} from "../../utils/shopProviderAdapter";
import {
  assertWebhookBelongsToResource,
  requestOrigin,
  requireWebhookOwner,
} from "./webhook-security";

interface DeleteShopWebhookArgs {
  shopId: string;
  webhookId: string;
}

async function deleteShopWebhook(
  root: any,
  { shopId, webhookId }: DeleteShopWebhookArgs,
  context: any
) {
  try {
    const shop = await requireWebhookOwner(context, "shop", shopId);
    if (!shop.platform?.deleteWebhookFunction || !shop.platform?.getWebhooksFunction) {
      return { success: false, error: "Webhook functions not configured." };
    }
    const expectedOrigin = requestOrigin(context);
    if (!expectedOrigin) return { success: false, error: "Unable to determine Openship origin." };

    const platform = {
      ...(shop.metadata || {}),
      resourceId: shop.id,
      id: shop.platform.id,
      domain: shop.domain,
      accessToken: shop.accessToken,
      getWebhooksFunction: shop.platform.getWebhooksFunction,
      deleteWebhookFunction: shop.platform.deleteWebhookFunction,
    };
    const result = await executeGetShopWebhooks({ platform });
    const webhook = (result.webhooks || []).find((item: any) => String(item.id) === webhookId);
    if (!webhook) return { success: false, error: "Webhook not found." };
    assertWebhookBelongsToResource({
      kind: "shop",
      resourceId: shopId,
      endpoint: webhook.callbackUrl,
      expectedOrigin,
    });

    await executeDeleteShopWebhook({ platform, webhookId });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook deletion failed" };
  }
}

export default deleteShopWebhook;
