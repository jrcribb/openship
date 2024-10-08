import { keystoneContext } from "@keystone/keystoneContext";

const handler = async (req, res) => {
  res.status(200).json({ received: true });

  const { shopId } = req.query;
  try {
    // Find the shop and its platform
    const shop = await keystoneContext.sudo().query.Shop.findOne({
      where: { id: shopId },
      query: 'id platform { cancelOrderWebhookHandler }',
    });
    const platformFunctions = await import(`../../../../../shopAdapters/${shop.platform.cancelOrderWebhookHandler}.js`);
    const orderId = await platformFunctions.cancelOrderWebhookHandler(req, res);

    const [foundOrder] = await keystoneContext.sudo().query.Order.findMany({
      where: {
        orderId: { equals: parseFloat(orderId) },
      },
    });

    if (foundOrder) {
      await keystoneContext.sudo().query.Order.updateOne({
        where: { id: foundOrder.id },
        data: { status: "CANCELLED" },
      });
      return { success: "Order cancelled" };
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    return { error: "Order could not be cancelled" };
  }
};

export default handler;