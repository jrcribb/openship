import { list, group, graphql } from "@keystone-6/core";
import { relationship, text, virtual } from "@keystone-6/core/fields";
import { isSignedIn, rules, permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const ShopPlatform = list({
  access: {
    operation: {
      create: isSignedIn,
      query: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
    filter: {
      query: rules.canReadShops,
      update: rules.canUpdateShops,
      delete: rules.canUpdateShops,
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    ...group({
      label: "App Credentials",
      description:
        "Adding these fields will enable this platform to be installed as an app by users",
      fields: {
        appKey: text({
          isRequired: true,
        }),
        appSecret: text({
          isRequired: true,
        }),
        callbackUrl: virtual({
          field: graphql.field({
            type: graphql.String,
            resolve: (item) =>
              `${process.env.FRONTEND_URL}/api/o-auth/shop/callback/${item.id}`,
          }),
          ui: {
            description:
              "This URL needs to be set as the callback in your app settings",
          },
        }),
      },
    }),
    ...group({
      label: "Adapter Functions",
      description: "These functions link to built-in adapters, but can also be external endpoints",
      fields: {
        orderLinkFunction: text({
          isRequired: true,
          ui: {
            description: "Function to generate the order link for this platform",
          },
        }),
        updateProductFunction: text({
          isRequired: true,
        }),
        getWebhooksFunction: text({
          isRequired: true,
        }),
        deleteWebhookFunction: text({
          isRequired: true,
        }),
        createWebhookFunction: text({
          isRequired: true,
        }),
        searchProductsFunction: text({
          isRequired: true,
        }),
        getProductFunction: text({
          isRequired: true,
        }),
        searchOrdersFunction: text({
          isRequired: true,
        }),
        addTrackingFunction: text({
          isRequired: true,
        }),
        addCartToPlatformOrderFunction: text({
          isRequired: true,
        }),
        cancelOrderWebhookHandler: text({
          isRequired: true,
        }),
        createOrderWebhookHandler: text({
          isRequired: true,
        }),
        oAuthFunction: text({
          isRequired: true,
        }),
        oAuthCallbackFunction: text({
          isRequired: true,
        }),
      },
    }),
    shops: relationship({ ref: "Shop.platform", many: true }),
    user: relationship({
      ref: "User.shopPlatforms",
      hooks: {
        resolveInput({ operation, resolvedData, context }) {
          // Default to the currently logged in user on create.
          if (
            operation === "create" &&
            !resolvedData.user &&
            context.session?.itemId
          ) {
            return { connect: { id: context.session?.itemId } };
          }
          return resolvedData.user;
        },
      },
    }),
    ...trackingFields,
  },
});
