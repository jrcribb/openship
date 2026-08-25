import { NextRequest, NextResponse } from 'next/server';
import { keystoneContext } from '@/features/keystone/context';
import { handleShopCancelWebhook } from '@/features/integrations/shop/lib/executor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    // Get the webhook payload
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());
    const { shopId } = await params;

    await processWebhook(shopId, body, headers);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing cancel order webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function processWebhook(shopId: string, body: any, headers: any) {
    // Find the shop and its platform
    const shop = await keystoneContext.sudo().query.Shop.findOne({
      where: { id: shopId },
      query: `
        id
        domain
        accessToken
        metadata
        webhookSecret
        platform {
          id
          name
          cancelOrderWebhookHandler
          appKey
          appSecret
        }
      `,
    });

    if (!shop) throw new Error(`Shop not found: ${shopId}`);

    // Use the shop provider adapter to handle the webhook
    const orderId = await handleShopCancelWebhook({
      platform: {
        ...shop.platform,
        ...(shop.metadata || {}),
        webhookSecret: shop.webhookSecret,
        resourceId: shop.id,
        domain: shop.domain,
        accessToken: shop.accessToken,
      },
      event: body,
      headers,
    });

    // Find the order in our database
    const [foundOrder] = await keystoneContext.sudo().query.Order.findMany({
      where: {
        orderId: { equals: orderId },
        shop: { id: { equals: shopId } },
      },
      query: 'id status orderId orderName',
    });

    if (foundOrder) {
      // Update the order status to cancelled
      const updatedOrder = await keystoneContext.sudo().query.Order.updateOne({
        where: { id: foundOrder.id },
        data: { status: 'CANCELLED' },
        query: 'id status orderId orderName',
      });

      return updatedOrder;
    }
    throw new Error(`Order not found for orderId: ${orderId} in shop: ${shopId}`);
}