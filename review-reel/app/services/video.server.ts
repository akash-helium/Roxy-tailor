import type { PlanId } from "../../config/pricing.config";
import prisma from "../db.server";
import { isCreatomateConfigured, renderReviewReel } from "./creatomate.server";
import type { ProductReview } from "./reviews.server";

export interface VideoGenerationResult {
  videoId: string;
  status: "pending" | "processing" | "ready" | "failed";
  videoUrl?: string;
}

export interface GenerateVideoOptions {
  productImageUrl?: string;
}

/**
 * Review → Instagram Reel pipeline.
 * Uses Creatomate (template or built-in RenderScript). Falls back to mock without API key.
 */
export async function generateReviewVideo(
  shopId: string,
  review: ProductReview,
  planId: PlanId,
  options: GenerateVideoOptions = {}
): Promise<VideoGenerationResult> {
  const video = await prisma.video.create({
    data: {
      shopId,
      productId: review.productId,
      productTitle: review.productTitle,
      reviewId: review.id,
      reviewText: review.body,
      reviewerName: review.reviewerName,
      rating: review.rating,
      status: "processing",
    },
  });

  try {
    const videoUrl = await callVideoProvider(review, planId, options);

    await prisma.video.update({
      where: { id: video.id },
      data: { status: "ready", videoUrl },
    });

    return { videoId: video.id, status: "ready", videoUrl };
  } catch (error) {
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "failed" },
    });
    throw error;
  }
}

async function callVideoProvider(
  review: ProductReview,
  planId: PlanId,
  options: GenerateVideoOptions
): Promise<string> {
  if (isCreatomateConfigured()) {
    const result = await renderReviewReel(review, {
      showWatermark: planId === "free",
      productImageUrl: options.productImageUrl,
    });
    return result.url;
  }

  return generateMockVideo(review, planId);
}

/** Local dev fallback when no Creatomate API key is configured */
async function generateMockVideo(review: ProductReview, planId: PlanId): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const watermark = planId === "free" ? "&watermark=1" : "";
  return `https://storage.example.com/reels/${review.id}.mp4?text=${encodeURIComponent(review.body.slice(0, 40))}${watermark}`;
}

export async function listShopVideos(shopId: string) {
  return prisma.video.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function getVideoProviderLabel(): string {
  return isCreatomateConfigured() ? "Creatomate" : "Mock (add CREATOMATE_API_KEY)";
}
