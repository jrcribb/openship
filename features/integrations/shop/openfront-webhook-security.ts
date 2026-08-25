import crypto from 'node:crypto';

const SHOP_WEBHOOK_SECRET_PURPOSE = 'openship:openfront:shop-webhook:v1';

export function deriveOpenFrontShopWebhookSecret(appSecret: string): string {
  if (!appSecret) throw new Error('OpenFront shop webhook app secret is not configured');
  return crypto
    .createHmac('sha256', appSecret)
    .update(SHOP_WEBHOOK_SECRET_PURPOSE)
    .digest('hex');
}

export function verifyOpenFrontShopWebhook(
  event: unknown,
  signature: string | undefined,
  appSecret: string | undefined,
  webhookSecret?: string
): boolean {
  const secret = webhookSecret || (appSecret ? deriveOpenFrontShopWebhookSecret(appSecret) : '');
  if (!signature || !secret) return false;

  const suppliedHex = signature.replace(/^sha256=/i, '');
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(event))
    .digest();
  const supplied = Buffer.from(suppliedHex, 'hex');

  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
