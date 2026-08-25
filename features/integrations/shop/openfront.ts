import { GraphQLClient, gql } from "graphql-request";
import { keystoneContext } from '@/features/keystone/context';
import {
  deriveOpenFrontShopWebhookSecret,
  verifyOpenFrontShopWebhook,
} from './openfront-webhook-security';
import { openFrontOrderSearchWhere } from './openfront-order-search';
import {
  OPENFRONT_SHOP_TOPIC_BY_EVENT,
  openFrontShopEvents,
} from '../openfront-webhook-topics';
import { buildOpenFrontOAuthUrl } from '../lib/openfront-oauth-url';

interface OpenFrontPlatform {
  domain: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | string;
  appKey?: string;
  appSecret?: string;
  webhookSecret?: string;
  resourceId?: string;
}

interface SearchProductsArgs {
  searchEntry: string;
  after?: string;
}

interface GetProductArgs {
  productId: string;
  variantId?: string;
}

interface SearchOrdersArgs {
  searchEntry: string;
  after?: string;
}

interface UpdateProductArgs {
  productId: string;
  variantId: string;
  inventory?: number;
  price?: string;
}

interface CreateWebhookArgs {
  endpoint: string;
  events: string[];
}

interface DeleteWebhookArgs {
  webhookId: string;
}

interface OAuthArgs {
  callbackUrl: string;
}

interface OAuthCallbackArgs {
  code: string;
  shop: string;
  state: string;
}

interface WebhookEventArgs {
  event: any;
  headers: Record<string, string>;
}

// Helper function to get fresh access token with proper OAuth 2.0 flow
const getFreshAccessToken = async (platform: OpenFrontPlatform) => {
  
  // Get shop with OAuth credentials from database
  const shops = await keystoneContext.sudo().query.Shop.findMany({
    where: { 
      domain: { equals: platform.domain },
      accessToken: { equals: platform.accessToken }
    },
    query: 'id refreshToken tokenExpiresAt platform { appKey appSecret }'
  });
  
  if (!shops || shops.length === 0) {
    return platform.accessToken;
  }
  
  const shop = shops[0];
  
  // If we have a refresh token, check if we need to refresh
  if (shop.refreshToken) {
    // Check if access token has expired (if we have expiry info)
    let shouldRefresh = false;
    
    if (shop.tokenExpiresAt) {
      const expiresAt = typeof shop.tokenExpiresAt === 'string' 
        ? new Date(shop.tokenExpiresAt) 
        : shop.tokenExpiresAt;
      
      const now = new Date();
      shouldRefresh = expiresAt <= now;
    } else {
      // If no expiry info, assume token needs refresh
      shouldRefresh = true;
    }
    
    if (shouldRefresh) {
      
      // Use refresh token to get new access token
      const tokenUrl = `${platform.domain}/api/oauth/token`;
      
      const formData = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: shop.refreshToken,
        client_id: shop.platform?.appKey || "",
        client_secret: shop.platform?.appSecret || "",
      });
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh access token: ${response.statusText} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      const { access_token, refresh_token, expires_in } = tokenData;
      
      // Update stored access token and expiry in database
      try {
        await keystoneContext.sudo().query.Shop.updateOne({
          where: { id: shop.id },
          data: {
            accessToken: access_token,
            ...(refresh_token && { refreshToken: refresh_token }),
            ...(expires_in && { tokenExpiresAt: new Date(Date.now() + (expires_in * 1000)) })
          }
        });
      } catch (error) {
        // Continue with the request even if database update fails
      }
      
      return access_token;
    } else {
      // Token hasn't expired yet, use existing one
      return platform.accessToken;
    }
  }
  
  // If no refresh token, just use the access token as-is
  return platform.accessToken;
};

// Helper function to create OpenFront GraphQL client with fresh token
const createOpenFrontClient = async (platform: OpenFrontPlatform) => {
  const freshAccessToken = await getFreshAccessToken(platform);
  
  return new GraphQLClient(
    `${platform.domain}/api/graphql`,
    {
      headers: {
        "Authorization": `Bearer ${freshAccessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
};

// Helper function to get product image URL
// imagePath is a relative path (e.g., "/images/product.jpg") that needs domain prepended
// image.url is an absolute S3 URL that can be used directly
const getProductImageUrl = (productImage: any, domain: string): string | null => {
  if (productImage?.imagePath) {
    return `${domain}${productImage.imagePath}`;
  }
  return productImage?.image?.url || null;
};

// Function to search products
export async function searchProductsFunction({ 
  platform, 
  searchEntry, 
  after 
}: { 
  platform: OpenFrontPlatform; 
  searchEntry: string; 
  after?: string; 
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const gqlQuery = gql`
    query SearchProducts($where: ProductWhereInput, $take: Int, $skip: Int) {
      products(where: $where, take: $take, skip: $skip, orderBy: { createdAt: desc }) {
        id
        title
        handle
        description {
          document
        }
        productImages {
          image {
            url
          }
          imagePath
        }
        productVariants {
          id
          title
          sku
          inventoryQuantity
          prices {
            id
            amount
            currency {
              code
            }
            region {
              countries {
                iso2
              }
            }
          }
        }
        productCollections {
          id
          title
        }
        metadata
        status
        createdAt
      }
      productsCount(where: $where)
    }
  `;

  // Build search filter
  const where: any = {
    status: { equals: "published" }
  };

  if (searchEntry && searchEntry.trim()) {
    where.OR = [
      { title: { contains: searchEntry, mode: "insensitive" } },
      { handle: { contains: searchEntry, mode: "insensitive" } },
      { productVariants: { some: { sku: { contains: searchEntry, mode: "insensitive" } } } }
    ];
  }

  // Handle pagination
  const take = 15;
  const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

  const { products, productsCount } = await openFrontClient.request(gqlQuery, {
    where,
    take,
    skip,
  }) as any;

  if (!products || products.length === 0) {
    throw new Error("No products found from OpenFront");
  }

  // Transform products to Openship format
  const transformedProducts = products.flatMap((product: any) => 
    product.productVariants.map((variant: any) => {
      const firstPrice = variant.prices[0];
      const firstImage = product.productImages[0];
      
      return {
        image: getProductImageUrl(firstImage, platform.domain),
        title: `${product.title} - ${variant.title}`,
        productId: product.id,
        variantId: variant.id,
        price: firstPrice ? (firstPrice.amount / 100).toFixed(2) : "0.00", // Convert from cents
        availableForSale: product.status === "published" && variant.inventoryQuantity > 0,
        inventory: variant.inventoryQuantity || 0,
        inventoryTracked: true,
        productLink: `https://${platform.domain}/products/${product.handle}`,
        cursor: Buffer.from((skip + products.indexOf(product) + 1).toString()).toString('base64'),
      };
    })
  );

  const hasNextPage = skip + take < productsCount;
  const endCursor = hasNextPage ? Buffer.from((skip + take).toString()).toString('base64') : null;

  return { 
    products: transformedProducts, 
    pageInfo: {
      hasNextPage,
      endCursor
    }
  };
}

// Function to get a specific product by variantId and productId
export async function getProductFunction({
  platform,
  productId,
  variantId,
}: {
  platform: OpenFrontPlatform;
  productId: string;
  variantId?: string;
}) {
  
  const openFrontClient = await createOpenFrontClient(platform);

  // Build the query conditionally based on whether variantId is provided
  const gqlQuery = variantId ? gql`
    query GetProduct($productId: ID!, $variantId: ID!) {
      product(where: { id: $productId }) {
        id
        title
        handle
        description {
          document
        }
        productImages {
          image {
            url
          }
          imagePath
        }
        productVariants(where: { id: { equals: $variantId } }) {
          id
          title
          sku
          inventoryQuantity
          prices {
            id
            amount
            currency {
              code
            }
          }
        }
        status
      }
    }
  ` : gql`
    query GetProduct($productId: ID!) {
      product(where: { id: $productId }) {
        id
        title
        handle
        description {
          document
        }
        productImages {
          image {
            url
          }
          imagePath
        }
        productVariants {
          id
          title
          sku
          inventoryQuantity
          prices {
            id
            amount
            currency {
              code
            }
          }
        }
        status
      }
    }
  `;

  const variables: any = { productId };
  if (variantId) {
    variables.variantId = variantId;
  }

  const { product } = await openFrontClient.request(gqlQuery, variables) as any;

  if (!product) {
    throw new Error("Product not found from OpenFront");
  }

  const variant = variantId 
    ? product.productVariants.find((v: any) => v.id === variantId)
    : product.productVariants[0];

  if (!variant) {
    throw new Error("Product variant not found from OpenFront");
  }

  const firstPrice = variant.prices[0];
  const firstImage = product.productImages[0];

  const transformedProduct = {
    image: getProductImageUrl(firstImage, platform.domain),
    title: `${product.title} - ${variant.title}`,
    productId: product.id,
    variantId: variant.id,
    price: firstPrice ? (firstPrice.amount / 100).toFixed(2) : "0.00",
    availableForSale: product.status === "published" && variant.inventoryQuantity > 0,
    inventory: variant.inventoryQuantity || 0,
    inventoryTracked: true,
    productLink: `https://${platform.domain}/products/${product.handle}`,
  };

  return { product: transformedProduct };
}

export async function searchOrdersFunction({
  platform,
  searchEntry,
  after,
}: {
  platform: OpenFrontPlatform;
  searchEntry: string;
  after?: string;
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const gqlQuery = gql`
    query SearchOrders($where: OrderWhereInput, $take: Int, $skip: Int) {
      orders(where: $where, take: $take, skip: $skip, orderBy: { createdAt: desc }) {
        id
        displayId
        email
        status
        total
        rawTotal
        currency {
          code
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          postalCode
          phone
          country {
            iso2
          }
        }
        lineItems {
          id
          title
          quantity
          sku
          variantTitle
          thumbnail
          formattedUnitPrice
          formattedTotal
          moneyAmount {
            amount
            originalAmount
          }
          productVariant {
            id
            title
            sku
            product {
              id
              title
              handle
              thumbnail
            }
          }
          productData
          variantData
        }
        createdAt
        updatedAt
      }
      ordersCount(where: $where)
    }
  `;

  const where = openFrontOrderSearchWhere(searchEntry);

  // Handle pagination
  const take = 15;
  const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;

  const { orders, ordersCount } = await openFrontClient.request(gqlQuery, {
    where,
    take,
    skip,
  }) as any;


  // Transform orders to Openship format
  const transformedOrders = orders.map((order: any) => {
    const shippingAddress = order.shippingAddress || {};
    
    return {
      orderId: order.id,
      orderName: `#${order.displayId}`,
      link: `${platform.domain}/dashboard/platform/orders/${order.id}`,
      date: new Date(order.createdAt).toLocaleDateString(),
      firstName: shippingAddress.firstName || "",
      lastName: shippingAddress.lastName || "",
      streetAddress1: shippingAddress.address1 || "",
      streetAddress2: shippingAddress.address2 || "",
      city: shippingAddress.city || "",
      state: shippingAddress.province || "",
      zip: shippingAddress.postalCode || "",
      country: shippingAddress.country?.iso2 || "",
      email: order.email || "",
      fulfillmentStatus: order.status,
      financialStatus: order.status,
      totalPrice: order.rawTotal ? (order.rawTotal / 100).toFixed(2) : "0.00",
      currency: order.currency?.code || "USD",
      lineItems: (order.lineItems || []).map((lineItem: any) => {
        // Combine product title and variant title like in channel search
        const productTitle = lineItem.productVariant?.product?.title || '';
        const variantTitle = lineItem.productVariant?.title || '';
        const combinedTitle = productTitle && variantTitle ? `${productTitle} - ${variantTitle}` : lineItem.title;
        
        return {
          lineItemId: lineItem.id,
          name: combinedTitle,
          quantity: lineItem.quantity,
          image: getProductImageUrl({ imagePath: lineItem.thumbnail, image: { url: lineItem.productVariant?.product?.thumbnail } }, platform.domain) || "",
          price: lineItem.moneyAmount ? (lineItem.moneyAmount.amount / 100).toFixed(2) : "0.00",
          variantId: lineItem.productVariant?.id || "",
          productId: lineItem.productVariant?.product?.id || "",
          sku: lineItem.sku || lineItem.productVariant?.sku || "",
        };
      }),
      cartItems: [],
      fulfillments: [],
      note: "",
      cursor: Buffer.from((skip + orders.indexOf(order) + 1).toString()).toString('base64'),
    };
  });


  const hasNextPage = skip + take < ordersCount;
  const endCursor = hasNextPage ? Buffer.from((skip + take).toString()).toString('base64') : null;

  return { 
    orders: transformedOrders, 
    pageInfo: {
      hasNextPage,
      endCursor
    }
  };
}

export async function updateProductFunction({
  platform,
  productId,
  variantId,
  inventory,
  price,
}: {
  platform: OpenFrontPlatform;
  productId: string;
  variantId: string;
  inventory?: number;
  price?: string;
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const mutations = [];

  if (inventory !== undefined) {
    const updateInventoryMutation = gql`
      mutation UpdateProductVariantInventory($where: ProductVariantWhereUniqueInput!, $data: ProductVariantUpdateInput!) {
        updateProductVariant(where: $where, data: $data) {
          id
          inventoryQuantity
        }
      }
    `;

    mutations.push(
      openFrontClient.request(updateInventoryMutation, {
        where: { id: variantId },
        data: { inventoryQuantity: inventory },
      })
    );
  }

  if (price !== undefined) {
    // Note: Price updates in OpenFront might require updating the Price model separately
    // This is a simplified approach - you might need to adjust based on your schema
    // Actual price update would depend on how prices are structured in OpenFront
  }

  const results = await Promise.all(mutations);
  return { success: true, results };
}

export async function createWebhookFunction({
  platform,
  endpoint,
  events,
  registrationKey,
}: {
  platform: OpenFrontPlatform;
  endpoint: string;
  events: string[];
  registrationKey?: string;
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const openFrontEvents = openFrontShopEvents(events);

  if (!registrationKey) throw new Error('OpenFront shop webhook registration key is required');
  const webhookSecret = platform.webhookSecret || deriveOpenFrontShopWebhookSecret(platform.appSecret || '');
  const result = await openFrontClient.request(gql`
    mutation RegisterShopWebhook(
      $registrationKey: String!
      $url: String!
      $events: [String!]!
      $secret: String!
    ) {
      registerWebhookEndpoint(
        registrationKey: $registrationKey
        url: $url
        events: $events
        secret: $secret
        requiredScope: "STORE"
      ) {
        id
        url
        events
        isActive
      }
    }
  `, {
    registrationKey,
    url: endpoint,
    events: openFrontEvents,
    secret: webhookSecret,
  }) as any;
  const webhook = result.registerWebhookEndpoint;

  if (!webhook?.id) {
    throw new Error('OpenFront did not persist the shop webhook endpoint');
  }

  return { 
    webhooks: [webhook], 
    webhookId: webhook.id 
  };
}

export async function deleteWebhookFunction({
  platform,
  webhookId,
}: {
  platform: OpenFrontPlatform;
  webhookId: string;
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const deleteWebhookMutation = gql`
    mutation DeleteWebhookEndpoint($where: WebhookEndpointWhereUniqueInput!) {
      deleteWebhookEndpoint(where: $where) {
        id
      }
    }
  `;

  const result = await openFrontClient.request(deleteWebhookMutation, {
    where: { id: webhookId },
  });

  return result;
}

export async function getWebhooksFunction({
  platform,
}: {
  platform: OpenFrontPlatform;
}) {
  const openFrontClient = await createOpenFrontClient(platform);

  const query = gql`
    query GetWebhookEndpoints {
      webhookEndpoints(where: { isActive: { equals: true }, scope: { equals: "STORE" } }) {
        id
        url
        events
        isActive
        createdAt
      }
    }
  `;

  const { webhookEndpoints } = await openFrontClient.request(query) as any;

  const resourceId = String(platform.resourceId || '').trim();
  const webhooks = webhookEndpoints.flatMap((webhook: any) => {
    let pathname = '';
    try {
      pathname = new URL(webhook.url).pathname;
    } catch {
      return [];
    }
    const allowedPaths = resourceId
      ? new Set([
          `/api/handlers/shop/create-order/${resourceId}`,
          `/api/handlers/shop/cancel-order/${resourceId}`,
        ])
      : null;
    if (allowedPaths && !allowedPaths.has(pathname)) return [];
    return (webhook.events || [])
      .filter((event: string) => Boolean(OPENFRONT_SHOP_TOPIC_BY_EVENT[event]))
      .map((event: string) => ({
        id: webhook.id,
        callbackUrl: webhook.url,
        topic: OPENFRONT_SHOP_TOPIC_BY_EVENT[event],
        format: "JSON",
        createdAt: webhook.createdAt,
      }));
  });

  return { webhooks };
}

export async function oAuthFunction({
  platform,
  callbackUrl,
  state,
}: {
  platform: OpenFrontPlatform;
  callbackUrl: string;
  state: string;
}) {
  if (!platform.appKey) {
    throw new Error("OpenFront OAuth requires appKey in platform configuration");
  }

  const authUrl = buildOpenFrontOAuthUrl({
    domain: platform.domain,
    appKey: platform.appKey,
    callbackUrl,
    state,
    scopes: "read_products,write_products,read_orders,write_orders,read_customers,write_customers,read_webhooks,write_webhooks",
  });

  return { authUrl };
}

export async function oAuthCallbackFunction({
  platform,
  code,
  shop,
  state,
  appKey,
  appSecret,
  redirectUri,
}: {
  platform: OpenFrontPlatform;
  code: string;
  shop: string;
  state: string;
  appKey?: string;
  appSecret?: string;
  redirectUri?: string;
}) {
  // Use platform domain or shop parameter
  const domain = platform.domain || shop;
  const tokenUrl = `${domain}/api/oauth/token`;
  
  // Use passed credentials first (for flexibility), then platform's credentials
  const clientId = appKey || platform.appKey;
  const clientSecret = appSecret || platform.appSecret;
  
  
  if (!clientId || !clientSecret) {
    throw new Error("OpenFront OAuth requires appKey and appSecret in platform configuration or as parameters");
  }
  
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri || "",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange OAuth code for access token: ${response.statusText} - ${errorText}`);
  }

  const { access_token, refresh_token, expires_in } = await response.json();
  
  // Return OAuth response with refresh token support
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    tokenExpiresAt: new Date(Date.now() + (expires_in * 1000)).toISOString()
  };
}

export async function createOrderWebhookHandler({
  platform,
  event,
  headers,
}: {
  platform: OpenFrontPlatform;
  event: any;
  headers: Record<string, string>;
}) {
  const signature = headers["x-openfront-webhook-signature"] || headers["X-OpenFront-Webhook-Signature"];
  if (!verifyOpenFrontShopWebhook(event, signature, platform.appSecret, platform.webhookSecret)) {
    throw new Error("Invalid OpenFront shop webhook signature");
  }

  // Transform OpenFront order to Openship format
  const lineItemsOutput = event.data?.lineItems?.map((item: any) => {
    // Combine product title and variant title like in channel search
    const productTitle = item.productVariant?.product?.title || '';
    const variantTitle = item.productVariant?.title || '';
    const combinedTitle = productTitle && variantTitle ? `${productTitle} - ${variantTitle}` : item.title;
    
    return {
      name: combinedTitle,
      image: getProductImageUrl(item.productVariant?.product?.productImages?.[0], platform.domain) || item.thumbnail,
      price: item.moneyAmount?.amount ? (item.moneyAmount.amount / 100) : 0, // Convert from cents to float
      quantity: item.quantity || 0,
      productId: item.productVariant?.product?.id?.toString(),
      variantId: item.productVariant?.id?.toString(),
      sku: item.productVariant?.sku || item.sku || "",
      lineItemId: item.id?.toString(),
    };
  }) || [];

  // Return Keystone-ready order data
  const orderData = event.data;
  const shippingAddress = orderData.shippingAddress || {};
  
  return {
    orderId: orderData.id?.toString(),
    orderName: orderData.displayId ? `#${orderData.displayId}` : "",
    email: orderData.email || "",
    firstName: shippingAddress.firstName || "",
    lastName: shippingAddress.lastName || "",
    streetAddress1: shippingAddress.address1 || "",
    streetAddress2: shippingAddress.address2 || "",
    city: shippingAddress.city || "",
    state: shippingAddress.province || "",
    zip: shippingAddress.postalCode || "",
    country: shippingAddress.country?.iso2?.toUpperCase() || "",
    phone: shippingAddress.phone || "",
    currency: orderData.currency?.code?.toUpperCase() || "USD",
    totalPrice: orderData.rawTotal ? (orderData.rawTotal / 100) : 0, // rawTotal is in cents, convert to float
    subTotalPrice: parseFloat(orderData.subtotal?.replace(/[$,]/g, '') || '0'), // Parse formatted string to float
    totalDiscounts: parseFloat(orderData.discount?.replace(/[$,]/g, '') || '0'), // Parse formatted string to float
    totalTax: parseFloat(orderData.tax?.replace(/[$,]/g, '') || '0'), // Parse formatted string to float
    status: "INPROCESS",
    linkOrder: true,
    matchOrder: true,
    processOrder: true,
    lineItems: { create: lineItemsOutput },
  };
}

export async function cancelOrderWebhookHandler({
  platform,
  event,
  headers,
}: {
  platform: OpenFrontPlatform;
  event: any;
  headers: Record<string, string>;
}) {
  const signature = headers["x-openfront-webhook-signature"] || headers["X-OpenFront-Webhook-Signature"];
  if (!verifyOpenFrontShopWebhook(event, signature, platform.appSecret, platform.webhookSecret)) {
    throw new Error("Invalid OpenFront shop webhook signature");
  }

  const orderId = event.data?.id;
  if (!orderId) throw new Error("Missing order ID in cancellation webhook");
  return String(orderId);
}

// Required OAuth scopes for OpenFront shop integration
const REQUIRED_SCOPES = "read_products,write_products,read_orders,write_orders,read_customers,write_customers,read_webhooks,write_webhooks";

export function scopes() {
  return REQUIRED_SCOPES;
}

export async function addTrackingFunction({
  platform,
  order,
  trackingCompany,
  trackingNumber,
  lineItems,
}: {
  platform: OpenFrontPlatform;
  order: any;
  trackingCompany: string;
  trackingNumber: string;
  lineItems: Array<{ lineItemId: string; quantity: number }>;
}) {

  const openFrontClient = await createOpenFrontClient(platform);

  // First, get the order with its line items to create fulfillment items
  const getOrderQuery = gql`
    query GetOrderForFulfillment($orderId: ID!) {
      order(where: { id: $orderId }) {
        id
        displayId
        lineItems {
          id
          quantity
        }
      }
    }
  `;

  const { order: orderData } = await openFrontClient.request(getOrderQuery, {
    orderId: order.orderId
  }) as any;

  if (!orderData || !orderData.lineItems || orderData.lineItems.length === 0) {
    throw new Error(`Order ${order.orderId} not found or has no line items`);
  }

  // Fulfillment state is command-owned in hardened OpenFront. Use the narrow
  // idempotent command instead of generic Fulfillment CRUD.
  const createFulfillmentMutation = gql`
    mutation CreateOrderFulfillment(
      $orderId: ID!
      $lineItems: [LineItemInput!]!
      $trackingNumber: String
      $carrier: String
      $idempotencyKey: String!
    ) {
      createOrderFulfillment(
        orderId: $orderId
        lineItems: $lineItems
        trackingNumber: $trackingNumber
        carrier: $carrier
        noNotification: false
        idempotencyKey: $idempotencyKey
      ) {
        id
        shippingLabels {
          id
          status
          trackingNumber
          trackingUrl
          carrier
        }
        fulfillmentItems {
          id
          quantity
          lineItem { id }
        }
      }
    }
  `;

  const sourceLines = new Map<string, number>(
    orderData.lineItems.map((lineItem: any) => [String(lineItem.id), Number(lineItem.quantity)])
  );
  for (const item of lineItems) {
    const sourceQuantity = sourceLines.get(item.lineItemId);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || sourceQuantity === undefined || item.quantity > sourceQuantity) {
      throw new Error(`Invalid source fulfillment quantity for line ${item.lineItemId}`);
    }
  }

  return openFrontClient.request(createFulfillmentMutation, {
    orderId: order.orderId,
    lineItems,
    trackingNumber,
    carrier: trackingCompany,
    idempotencyKey: `openship-tracking:${order.orderId}:${trackingCompany}:${trackingNumber}`,
  });
}