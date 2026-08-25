import { createChannelWebhook as executeCreateChannelWebhook } from "../../utils/channelProviderAdapter";
import {
  ensureConnectionWebhookSecret,
  requestOrigin,
  requireWebhookOwner,
  validateWebhookConfiguration,
  webhookRegistrationKey,
} from "./webhook-security";

interface CreateChannelWebhookArgs {
  channelId: string;
  topic: string;
  endpoint: string;
}

async function createChannelWebhook(
  root: any,
  { channelId, topic, endpoint }: CreateChannelWebhookArgs,
  context: any
) {
  try {
    const channel = await requireWebhookOwner(context, "channel", channelId);
    if (!channel.platform?.createWebhookFunction) {
      return { success: false, error: "Create webhook function not configured." };
    }
    const expectedOrigin = requestOrigin(context);
    if (!expectedOrigin) {
      return { success: false, error: "Configured Openship origin is required." };
    }
    const validated = validateWebhookConfiguration({
      kind: "channel",
      resourceId: channelId,
      topic,
      endpoint,
      expectedOrigin,
    });

    const webhookSecret = channel.platform.createWebhookFunction === "openfront"
      ? await ensureConnectionWebhookSecret(context, "channel", channel)
      : undefined;
    const result = await executeCreateChannelWebhook({
      platform: {
        ...(channel.metadata || {}),
        resourceId: channel.id,
        id: channel.platform.id,
        domain: channel.domain,
        accessToken: channel.accessToken,
        appKey: channel.platform.appKey,
        appSecret: channel.platform.appSecret,
        webhookSecret: webhookSecret || channel.platform.webhookSecret,
        createWebhookFunction: channel.platform.createWebhookFunction,
      },
      endpoint: validated.endpoint,
      events: [validated.topic],
      registrationKey: webhookRegistrationKey('channel', channelId, validated.topic),
    });

    return { success: true, webhookId: result.webhookId };
  } catch (error: any) {
    return { success: false, error: error instanceof Error ? error.message : "Webhook creation failed" };
  }
}

export default createChannelWebhook;
