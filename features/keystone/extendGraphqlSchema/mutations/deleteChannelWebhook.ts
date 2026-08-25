import {
  deleteChannelWebhook as executeDeleteChannelWebhook,
  getChannelWebhooks as executeGetChannelWebhooks,
} from "../../utils/channelProviderAdapter";
import {
  assertWebhookBelongsToResource,
  requestOrigin,
  requireWebhookOwner,
} from "./webhook-security";

interface DeleteChannelWebhookArgs {
  channelId: string;
  webhookId: string;
}

async function deleteChannelWebhook(
  root: any,
  { channelId, webhookId }: DeleteChannelWebhookArgs,
  context: any
) {
  try {
    const channel = await requireWebhookOwner(context, "channel", channelId);
    if (!channel.platform?.deleteWebhookFunction || !channel.platform?.getWebhooksFunction) {
      return { success: false, error: "Webhook functions not configured." };
    }
    const expectedOrigin = requestOrigin(context);
    if (!expectedOrigin) return { success: false, error: "Unable to determine Openship origin." };

    const platform = {
      ...(channel.metadata || {}),
      resourceId: channel.id,
      id: channel.platform.id,
      domain: channel.domain,
      accessToken: channel.accessToken,
      getWebhooksFunction: channel.platform.getWebhooksFunction,
      deleteWebhookFunction: channel.platform.deleteWebhookFunction,
    };
    const result = await executeGetChannelWebhooks({ platform });
    const webhook = (result.webhooks || []).find((item: any) => String(item.id) === webhookId);
    if (!webhook) return { success: false, error: "Webhook not found." };
    assertWebhookBelongsToResource({
      kind: "channel",
      resourceId: channelId,
      endpoint: webhook.callbackUrl,
      expectedOrigin,
    });

    await executeDeleteChannelWebhook({ platform, webhookId });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook deletion failed" };
  }
}

export default deleteChannelWebhook;
