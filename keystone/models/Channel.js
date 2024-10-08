import {
  integer,
  text,
  relationship,
  virtual,
  float,
  json,
} from "@keystone-6/core/fields";
import { group, list } from "@keystone-6/core";
import { isSignedIn, rules, permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const Channel = list({
  access: {
    // create: isSignedIn,
    // read: rules.canReadChannels,
    // update: rules.canUpdateChannels,
    // delete: rules.canUpdateChannels,
    operation: {
      create: isSignedIn,
      query: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
    filter: {
      query: rules.canReadChannels,
      update: rules.canUpdateChannels,
      delete: rules.canUpdateChannels,
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    ...group({
      label: "Credentials",
      description: "Channel credentials",
      fields: {
        domain: text(),
        accessToken: text(),
      },
    }),

    links: relationship({ ref: "Link.channel", many: true }),

    platform: relationship({
      ref: "ChannelPlatform.channels",
      ui: {
        displayMode: "select",
        labelField: "name",
      },
    }),

    channelItems: relationship({ ref: "ChannelItem.channel", many: true }),
    cartItems: relationship({ ref: "CartItem.channel", many: true }),

    metadata: json(),

    user: relationship({
      ref: "User.channels",
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
