import { getChannelWebhooks as executeGetChannelWebhooks } from "../../utils/channelProviderAdapter";
import { requireWebhookOwner } from "../mutations/webhook-security";

interface GetChannelWebhooksArgs {
  channelId: string;
}

async function getChannelWebhooks(
  root: any,
  { channelId }: GetChannelWebhooksArgs,
  context: any
) {
  try {
    const channel = await requireWebhookOwner(context, "channel", channelId);
    if (!channel.platform?.getWebhooksFunction) {
      throw new Error("Get webhooks function not configured.");
    }

    const result = await executeGetChannelWebhooks({
      platform: {
        ...(channel.metadata || {}),
        resourceId: channel.id,
        id: channel.platform.id,
        domain: channel.domain,
        accessToken: channel.accessToken,
        getWebhooksFunction: channel.platform.getWebhooksFunction,
      },
    });
    return result.webhooks;
  } catch (error: any) {
    throw new Error(`Error getting channel webhooks: ${error.message}`);
  }
}

export default getChannelWebhooks;
