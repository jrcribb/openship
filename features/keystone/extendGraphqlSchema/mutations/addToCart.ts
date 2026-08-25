import type { KeystoneContext } from '@keystone-6/core/types';

interface AddToCartArgs {
  channelId: string;
  image?: string;
  name: string;
  price: string;
  productId: string;
  variantId: string;
  quantity: string;
  orderId: string;
  lineItemId?: string;
}

function positiveQuantity(value: string): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Cart quantity must be a positive integer');
  }
  return quantity;
}

async function addToCart(
  _root: unknown,
  {
    channelId,
    image,
    name,
    price,
    productId,
    variantId,
    quantity: quantityInput,
    orderId,
    lineItemId: requestedSourceLineId,
  }: AddToCartArgs,
  context: KeystoneContext
) {
  const session = context.session;
  if (!session?.itemId) {
    throw new Error('You must be logged in to do this!');
  }

  const quantity = positiveQuantity(quantityInput);
  const sourceOrder = await context.query.Order.findOne({
    where: { id: orderId },
    query: 'id status error lineItems { id lineItemId quantity name }',
  });
  if (!sourceOrder) throw new Error('Source order not found');

  const sourceLines = (sourceOrder.lineItems || []).filter(
    (item: any) => String(item.lineItemId || '').trim()
  );
  const requestedId = String(requestedSourceLineId || '').trim();
  const matchingSourceLines = requestedId
    ? sourceLines.filter(
        (item: any) => item.id === requestedId || String(item.lineItemId) === requestedId
      )
    : sourceLines.length === 1
      ? sourceLines
      : [];

  if (matchingSourceLines.length !== 1) {
    throw new Error(
      sourceLines.length > 1
        ? 'Select exactly one source order line for this channel item'
        : 'Channel item must map to exactly one source order line'
    );
  }

  const sourceLine = matchingSourceLines[0] as any;
  const sourceLineItemId = String(sourceLine.lineItemId);
  const mappedCartItems = await context.query.CartItem.findMany({
    where: {
      order: { id: { equals: orderId } },
      user: { id: { equals: session.itemId } },
      lineItemId: { equals: sourceLineItemId },
      status: { not: { equals: 'CANCELLED' } },
    },
    query: 'id quantity productId variantId purchaseId url channel { id }',
  });

  const alreadyRouted = mappedCartItems.reduce(
    (total: number, item: any) => total + Number(item.quantity || 0),
    0
  );
  if (alreadyRouted + quantity > Number(sourceLine.quantity || 0)) {
    throw new Error(
      `Routing quantity exceeds the remaining quantity for ${sourceLine.name || 'the source line'}`
    );
  }

  const existingCartItem = mappedCartItems.find(
    (item: any) =>
      item.channel?.id === channelId &&
      item.productId === productId &&
      item.variantId === variantId &&
      !item.purchaseId &&
      !item.url
  );

  if (existingCartItem) {
    await context.query.CartItem.updateOne({
      where: { id: existingCartItem.id },
      data: {
        quantity: Number(existingCartItem.quantity || 0) + quantity,
        lineItemId: sourceLineItemId,
      },
      query: 'id',
    });
  } else {
    await context.query.CartItem.createOne({
      data: {
        price,
        productId,
        variantId,
        lineItemId: sourceLineItemId,
        quantity,
        image,
        name,
        user: { connect: { id: session.itemId } },
        order: { connect: { id: orderId } },
        channel: { connect: { id: channelId } },
      },
      query: 'id',
    });
  }

  if (String(sourceOrder.error || '').startsWith('MATCH_ERROR')) {
    await context.query.Order.updateOne({
      where: { id: orderId },
      data: { error: '', status: 'PENDING' },
      query: 'id',
    });
  }

  return context.db.Order.findOne({ where: { id: orderId } });
}

export default addToCart;
