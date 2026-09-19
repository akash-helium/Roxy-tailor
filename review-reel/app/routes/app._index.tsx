import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopUsage } from "../services/billing.server";
import { listShopVideos } from "../services/video.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  const recentVideos = await listShopVideos(usage.shop.id);

  return {
    usage: {
      planName: usage.plan.name,
      videosRemaining: usage.videosRemaining,
      videosUsed: usage.videosUsed,
      videosLimit: usage.plan.videosPerMonth,
      tagline: usage.plan.tagline,
    },
    recentVideos: recentVideos.slice(0, 5),
  };
};

export default function Dashboard() {
  const { usage, recentVideos } = useLoaderData<typeof loader>();
  const usagePercent = Math.min(
    100,
    Math.round((usage.videosUsed / usage.videosLimit) * 100)
  );

  return (
    <Page title="ReviewReel">
      <BlockStack gap="500">
        {usage.videosRemaining === 0 && (
          <Banner tone="warning" title="Video limit reached">
            <p>
              You&apos;ve used all {usage.videosLimit} videos on the {usage.planName}{" "}
              plan. Upgrade to keep creating Reels.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    This month
                  </Text>
                  <Badge tone="info">{usage.planName}</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  {usage.videosRemaining} of {usage.videosLimit} videos remaining
                </Text>
                <ProgressBar progress={usagePercent} size="small" />
                <InlineStack gap="300">
                  <Button url="/app/generate" variant="primary">
                    Generate video
                  </Button>
                  <Button url="/app/pricing">View plans</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  How it works
                </Text>
                <Text as="p" tone="subdued">
                  1. Pick a product review
                  <br />
                  2. AI creates a 9:16 Instagram Reel
                  <br />
                  3. Download and post to Instagram
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Recent videos
            </Text>
            {recentVideos.length === 0 ? (
              <Text as="p" tone="subdued">
                No videos yet. Generate your first Reel from a product review.
              </Text>
            ) : (
              recentVideos.map((video) => (
                <InlineStack key={video.id} align="space-between">
                  <BlockStack gap="100">
                    <Text as="span" fontWeight="semibold">
                      {video.productTitle}
                    </Text>
                    <Text as="span" tone="subdued">
                      {video.reviewText.slice(0, 60)}…
                    </Text>
                  </BlockStack>
                  <Badge tone={video.status === "ready" ? "success" : "attention"}>
                    {video.status}
                  </Badge>
                </InlineStack>
              ))
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
