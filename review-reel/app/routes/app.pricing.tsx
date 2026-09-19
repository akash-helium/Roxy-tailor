import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getShopUsage,
  listPlansForDisplay,
  requestSubscription,
  setShopPlan,
} from "../services/billing.server";
import {
  annualPriceMonthly,
  ANNUAL_DISCOUNT_PERCENT,
  type PlanId,
} from "../../config/pricing.config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  const plans = listPlansForDisplay();

  return {
    currentPlanId: usage.shop.planId,
    plans,
    annualDiscount: ANNUAL_DISCOUNT_PERCENT,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planId = formData.get("planId") as PlanId;

  if (!planId) {
    return json({ error: "Plan required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const returnUrl = `${url.origin}/app/pricing?billing=success`;

  if (planId === "free") {
    await setShopPlan(session.shop, "free");
    return redirect("/app/pricing");
  }

  const { confirmationUrl } = await requestSubscription(
    admin,
    session.shop,
    planId,
    returnUrl
  );

  if (confirmationUrl) {
    return redirect(confirmationUrl);
  }

  return redirect("/app/pricing?billing=success");
};

export default function PricingPage() {
  const { currentPlanId, plans, annualDiscount } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="Pricing" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Edit plan prices anytime in <code>config/pricing.config.ts</code> — changes
            apply to new subscribers automatically.
          </p>
        </Banner>

        <Layout>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const annualMonthly = annualPriceMonthly(plan);

            return (
              <Layout.Section key={plan.id} variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">
                        {plan.name}
                      </Text>
                      {plan.recommended && <Badge tone="success">Popular</Badge>}
                      {isCurrent && <Badge tone="info">Current</Badge>}
                    </InlineStack>

                    <Text as="p" tone="subdued">
                      {plan.tagline}
                    </Text>

                    <BlockStack gap="100">
                      <InlineStack gap="100" blockAlign="end">
                        <Text as="span" variant="heading2xl">
                          ${plan.priceMonthlyUsd}
                        </Text>
                        <Text as="span" tone="subdued">
                          /month
                        </Text>
                      </InlineStack>
                      {plan.priceMonthlyUsd > 0 && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          or ${annualMonthly}/mo billed annually ({annualDiscount}% off)
                        </Text>
                      )}
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p">{plan.videosPerMonth} videos / month</Text>
                      <Text as="p">Up to {plan.maxReviewsPerProduct} reviews per product</Text>
                      <Text as="p">
                        {plan.customBranding ? "Custom branding" : "ReviewReel branding"}
                      </Text>
                      <Text as="p">
                        {plan.instagramAutoPost
                          ? "Instagram auto-post"
                          : "Manual download"}
                      </Text>
                    </BlockStack>

                    <Form method="post">
                      <input type="hidden" name="planId" value={plan.id} />
                      <Button
                        submit
                        variant={plan.recommended ? "primary" : undefined}
                        disabled={isCurrent}
                        loading={navigation.state === "submitting"}
                        fullWidth
                      >
                        {isCurrent
                          ? "Current plan"
                          : plan.priceMonthlyUsd === 0
                            ? "Downgrade to Free"
                            : `Upgrade to ${plan.name}`}
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>
      </BlockStack>
    </Page>
  );
}
