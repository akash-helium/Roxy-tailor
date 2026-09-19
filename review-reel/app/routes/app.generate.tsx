import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Select,
  Button,
  Banner,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getShopUsage, incrementVideoUsage } from "../services/billing.server";
import { canGenerateVideo } from "../../config/pricing.config";
import {
  fetchProductReviews,
  fetchProducts,
  filterReviewsByPlan,
} from "../services/reviews.server";
import { generateReviewVideo, getVideoProviderLabel } from "../services/video.server";
import { isCreatomateConfigured } from "../services/creatomate.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  const products = await fetchProducts(admin);
  const reviews = filterReviewsByPlan(
    await fetchProductReviews(admin),
    usage.shop.planId as "free" | "starter" | "growth" | "pro"
  );

  return {
    products,
    reviews,
    planId: usage.shop.planId,
    videoProvider: getVideoProviderLabel(),
    creatomateReady: isCreatomateConfigured(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const reviewId = formData.get("reviewId") as string;

  const usage = await getShopUsage(session.shop);
  const check = canGenerateVideo(
    usage.shop.planId as "free" | "starter" | "growth" | "pro",
    usage.videosUsed
  );

  if (!check.allowed) {
    return json({ error: check.reason }, { status: 403 });
  }

  const products = await fetchProducts(admin);
  const reviews = await fetchProductReviews(admin);
  const review = reviews.find((r) => r.id === reviewId);

  if (!review) {
    return json({ error: "Review not found" }, { status: 404 });
  }

  const productImageUrl = products.find(
    (p: { id: string; imageUrl?: string }) => p.id === review.productId
  )?.imageUrl;

  const result = await generateReviewVideo(
    usage.shop.id,
    review,
    usage.shop.planId as "free" | "starter" | "growth" | "pro",
    { productImageUrl }
  );

  await incrementVideoUsage(session.shop);

  return redirect(`/app/videos?created=${result.videoId}`);
};

export default function GeneratePage() {
  const { products, reviews, videoProvider, creatomateReady } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [selectedReview, setSelectedReview] = useState(reviews[0]?.id ?? "");

  const reviewOptions = reviews.map((r) => ({
    label: `${r.reviewerName} — ${r.body.slice(0, 50)}… (${r.rating}★)`,
    value: r.id,
  }));

  const productOptions = products.map((p: { id: string; title: string }) => ({
    label: p.title,
    value: p.id,
  }));

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page title="Generate Instagram Reel" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {!creatomateReady && (
              <Banner tone="warning" title="Demo mode">
                <p>
                  Add <code>CREATOMATE_API_KEY</code> to <code>.env</code> for real videos.
                  Sign up free at creatomate.com (50 credits, no card).
                </p>
              </Banner>
            )}

            {creatomateReady && (
              <Banner tone="info">
                <p>
                  Rendering via {videoProvider}. Each Reel takes about 30–90 seconds.
                </p>
              </Banner>
            )}

            {actionData?.error && (
              <Banner tone="critical" title="Cannot generate">
                <p>{actionData.error}</p>
              </Banner>
            )}

            <Card>
              <Form method="post">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Select a review
                  </Text>

                  {products.length > 0 && (
                    <Select
                      label="Product"
                      options={productOptions}
                      value={productOptions[0]?.value}
                      onChange={() => {}}
                      disabled
                      helpText="Showing reviews from your catalog. Connect Judge.me or Loox for live reviews."
                    />
                  )}

                  <Select
                    label="Review"
                    options={reviewOptions}
                    value={selectedReview}
                    onChange={setSelectedReview}
                  />

                  <input type="hidden" name="reviewId" value={selectedReview} />

                  <InlineStack gap="200">
                    {(() => {
                      const rating = reviews.find((r) => r.id === selectedReview)?.rating;
                      return rating ? (
                        <Badge tone="success">{`${rating} stars`}</Badge>
                      ) : null;
                    })()}
                  </InlineStack>

                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    disabled={!selectedReview}
                  >
                    {isSubmitting ? "Rendering Reel…" : "Generate Reel (9:16)"}
                  </Button>
                </BlockStack>
              </Form>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
