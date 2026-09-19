import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (!shop) {
    throw new Response("Unauthorized", { status: 401 });
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.shop.deleteMany({ where: { shopDomain: shop } });
      break;
    case "APP_SUBSCRIPTIONS_UPDATE": {
      const subscription = payload as {
        app_subscription?: { status?: string; name?: string; admin_graphql_api_id?: string };
      };
      const status = subscription.app_subscription?.status;
      const name = subscription.app_subscription?.name ?? "";
      const subId = subscription.app_subscription?.admin_graphql_api_id;

      if (status === "ACTIVE") {
        const planId = name.toLowerCase().includes("pro")
          ? "pro"
          : name.toLowerCase().includes("growth")
            ? "growth"
            : name.toLowerCase().includes("starter")
              ? "starter"
              : "free";

        await prisma.shop.upsert({
          where: { shopDomain: shop },
          create: {
            shopDomain: shop,
            planId,
            shopifySubscriptionId: subId,
          },
          update: {
            planId,
            shopifySubscriptionId: subId,
            videosUsedThisMonth: 0,
            billingCycleStart: new Date(),
          },
        });
      }
      break;
    }
  }

  return new Response();
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.webhook(request);
  return new Response();
};
