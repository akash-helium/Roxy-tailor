import {
  getPlan,
  type PlanId,
  PRICING_PLANS,
  PAID_PLAN_IDS,
} from "../../config/pricing.config";
import prisma from "../db.server";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> }
  ) => Promise<Response>;
};

export async function getOrCreateShop(shopDomain: string) {
  return prisma.shop.upsert({
    where: { shopDomain },
    create: { shopDomain, planId: "free" },
    update: {},
  });
}

export async function getShopUsage(shopDomain: string) {
  const shop = await getOrCreateShop(shopDomain);
  const plan = getPlan(shop.planId as PlanId);
  return {
    shop,
    plan,
    videosRemaining: Math.max(0, plan.videosPerMonth - shop.videosUsedThisMonth),
    videosUsed: shop.videosUsedThisMonth,
  };
}

export async function incrementVideoUsage(shopDomain: string) {
  await prisma.shop.update({
    where: { shopDomain },
    data: { videosUsedThisMonth: { increment: 1 } },
  });
}

export async function setShopPlan(
  shopDomain: string,
  planId: PlanId,
  shopifySubscriptionId?: string
) {
  await prisma.shop.update({
    where: { shopDomain },
    data: {
      planId,
      shopifySubscriptionId: shopifySubscriptionId ?? null,
      videosUsedThisMonth: 0,
      billingCycleStart: new Date(),
    },
  });
}

/**
 * Create a Shopify recurring app subscription charge.
 * Merchant must approve in Shopify admin before the plan activates.
 */
export async function requestSubscription(
  admin: AdminClient,
  shopDomain: string,
  planId: PlanId,
  returnUrl: string
) {
  const plan = getPlan(planId);

  if (plan.priceMonthlyUsd === 0) {
    await setShopPlan(shopDomain, "free");
    return { confirmationUrl: null, activated: true };
  }

  if (!PAID_PLAN_IDS.includes(planId)) {
    throw new Error(`Invalid paid plan: ${planId}`);
  }

  const response = await admin.graphql(
    `#graphql
      mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $test: Boolean) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          test: $test
        ) {
          appSubscription {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        name: plan.shopifyPlanName,
        returnUrl,
        test: process.env.SHOPIFY_BILLING_TEST === "true",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.priceMonthlyUsd, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    }
  );

  const json = await response.json();
  const result = json.data?.appSubscriptionCreate;

  if (result?.userErrors?.length) {
    throw new Error(result.userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  return {
    confirmationUrl: result?.confirmationUrl as string | null,
    subscriptionId: result?.appSubscription?.id as string | undefined,
    activated: false,
  };
}

export async function cancelSubscription(
  admin: AdminClient,
  subscriptionId: string
) {
  await admin.graphql(
    `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription { id status }
          userErrors { field message }
        }
      }
    `,
    { variables: { id: subscriptionId } }
  );
}

export function listPlansForDisplay() {
  return Object.values(PRICING_PLANS);
}
