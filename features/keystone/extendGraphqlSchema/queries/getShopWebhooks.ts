import { getShopWebhooks as executeGetShopWebhooks } from "../../utils/shopProviderAdapter";
import { requireWebhookOwner } from "../mutations/webhook-security";

interface GetShopWebhooksArgs {
  shopId: string;
}

async function getShopWebhooks(
  root: any,
  { shopId }: GetShopWebhooksArgs,
  context: any
) {
  try {
    const shop = await requireWebhookOwner(context, "shop", shopId);
    if (!shop.platform?.getWebhooksFunction) {
      throw new Error("Get webhooks function not configured.");
    }

    const result = await executeGetShopWebhooks({
      platform: {
        ...(shop.metadata || {}),
        resourceId: shop.id,
        id: shop.platform.id,
        domain: shop.domain,
        accessToken: shop.accessToken,
        getWebhooksFunction: shop.platform.getWebhooksFunction,
      },
    });
    return result.webhooks;
  } catch (error: any) {
    throw new Error(`Error getting shop webhooks: ${error.message}`);
  }
}

export default getShopWebhooks;
