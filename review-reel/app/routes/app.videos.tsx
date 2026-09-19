import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopUsage } from "../services/billing.server";
import { listShopVideos } from "../services/video.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);
  const videos = await listShopVideos(usage.shop.id);
  return { videos };
};

export default function VideosPage() {
  const { videos } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const createdId = searchParams.get("created");

  return (
    <Page title="My Videos" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {createdId && (
          <Banner tone="success" title="Video generated">
            Your Reel is ready to download and post on Instagram.
          </Banner>
        )}

        {videos.length === 0 ? (
          <Card>
            <EmptyState
              heading="No videos yet"
              action={{ content: "Generate your first Reel", url: "/app/generate" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Turn your best product reviews into scroll-stopping Instagram content.</p>
            </EmptyState>
          </Card>
        ) : (
          <Layout>
            {videos.map((video) => (
              <Layout.Section key={video.id} variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">
                        {video.productTitle}
                      </Text>
                      <Badge tone={video.status === "ready" ? "success" : "attention"}>
                        {video.status}
                      </Badge>
                    </InlineStack>
                    <Text as="p" tone="subdued">
                      &ldquo;{video.reviewText}&rdquo;
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      — {video.reviewerName} · {video.rating}★
                    </Text>
                    {video.status === "ready" && video.videoUrl && (
                      <Button url={video.videoUrl} target="_blank" variant="primary">
                        Download MP4
                      </Button>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            ))}
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
