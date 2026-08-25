const SHOP_TOPICS: Record<string, string> = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.canceled',
};

const CHANNEL_TOPICS: Record<string, string> = {
  TRACKING_CREATED: 'fulfillment.created',
};

function mapSingleTopic(events: string[], mapping: Record<string, string>, kind: string): string[] {
  if (events.length !== 1 || !mapping[events[0]]) {
    throw new Error(`OpenFront does not support ${kind} webhook topic: ${events.join(', ')}`);
  }
  return [mapping[events[0]]];
}

export function openFrontShopEvents(events: string[]): string[] {
  return mapSingleTopic(events, SHOP_TOPICS, 'shop');
}

export function openFrontChannelEvents(events: string[]): string[] {
  return mapSingleTopic(events, CHANNEL_TOPICS, 'channel');
}

export const OPENFRONT_SHOP_TOPIC_BY_EVENT = Object.fromEntries(
  Object.entries(SHOP_TOPICS).map(([topic, event]) => [event, topic])
) as Record<string, string>;
