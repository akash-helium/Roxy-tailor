import type { ProductReview } from "./reviews.server";

const CREATOMATE_API = "https://api.creatomate.com/v2/renders";
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40;

export interface CreatomateRenderResult {
  id: string;
  url: string;
}

interface CreatomateRenderStatus {
  id: string;
  status: "planned" | "waiting" | "transcribing" | "rendering" | "succeeded" | "failed";
  url?: string;
  error_message?: string;
}

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY ?? process.env.VIDEO_API_KEY;
  if (!key) {
    throw new Error(
      "Creatomate API key missing. Add CREATOMATE_API_KEY to .env (free at creatomate.com)."
    );
  }
  return key;
}

function starsText(rating: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Builds a 9:16 Instagram Reel via Creatomate RenderScript.
 * No pre-made template required — works out of the box with a free Creatomate account.
 */
export function buildReviewReelScript(
  review: ProductReview,
  options: { showWatermark: boolean; productImageUrl?: string }
) {
  const quote = truncate(review.body, 220);
  const productTitle = truncate(review.productTitle, 60);
  const reviewer = truncate(review.reviewerName || "Verified Customer", 40);

  const backgroundElement = options.productImageUrl
    ? {
        type: "image",
        track: 1,
        time: 0,
        width: "100%",
        height: "100%",
        source: options.productImageUrl,
        fit: "cover",
        opacity: "35%",
      }
    : {
        type: "shape",
        track: 1,
        time: 0,
        width: "100%",
        height: "100%",
        fill_color: "#0f0f23",
      };

  const elements: Record<string, unknown>[] = [
    backgroundElement,
    {
      type: "shape",
      track: 2,
      time: 0,
      width: "100%",
      height: "100%",
      fill_color: "rgba(15,15,35,0.75)",
    },
    {
      type: "text",
      track: 3,
      time: 0,
      y: "12%",
      width: "88%",
      height: "8%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: productTitle,
      font_family: "Montserrat",
      font_weight: "700",
      font_size: "5.5 vmin",
      fill_color: "#ffffff",
      animations: [
        {
          time: 0,
          duration: 0.6,
          easing: "quadratic-out",
          type: "fade",
        },
      ],
    },
    {
      type: "text",
      track: 4,
      time: 0.2,
      y: "20%",
      width: "88%",
      height: "5%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: starsText(review.rating),
      font_size: "6 vmin",
      fill_color: "#fbbf24",
      animations: [
        {
          time: 0,
          duration: 0.5,
          easing: "quadratic-out",
          type: "scale",
          start_scale: "80%",
        },
      ],
    },
    {
      type: "text",
      track: 5,
      time: 0.4,
      y: "38%",
      width: "85%",
      height: "35%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: `"${quote}"`,
      font_family: "Montserrat",
      font_weight: "500",
      font_size: "5 vmin",
      line_height: "140%",
      fill_color: "#f8fafc",
      animations: [
        {
          time: 0,
          duration: 0.8,
          easing: "quadratic-out",
          type: "text-slide",
          scope: "split-clip",
          split: "line",
          direction: "up",
        },
      ],
    },
    {
      type: "text",
      track: 6,
      time: 0.8,
      y: "72%",
      width: "85%",
      height: "6%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: `— ${reviewer}`,
      font_family: "Montserrat",
      font_weight: "600",
      font_size: "4.2 vmin",
      fill_color: "#94a3b8",
      animations: [
        {
          time: 0,
          duration: 0.5,
          easing: "quadratic-out",
          type: "fade",
        },
      ],
    },
    {
      type: "audio",
      track: 7,
      time: 0,
      duration: null,
      source: "https://cdn.creatomate.com/demo/music3.mp3",
      volume: "18%",
      audio_fade_in: 0.5,
      audio_fade_out: 1,
    },
  ];

  if (options.showWatermark) {
    elements.push({
      type: "text",
      track: 8,
      time: 0,
      y: "92%",
      width: "88%",
      height: "4%",
      x_alignment: "50%",
      y_alignment: "50%",
      text: "Made with ReviewReel",
      font_family: "Montserrat",
      font_size: "3 vmin",
      fill_color: "rgba(255,255,255,0.45)",
    });
  }

  return {
    output_format: "mp4",
    width: 1080,
    height: 1920,
    duration: 8,
    frame_rate: 30,
    elements,
  };
}

async function createRender(body: Record<string, unknown>): Promise<string> {
  const response = await fetch(CREATOMATE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as CreatomateRenderStatus | CreatomateRenderStatus[];

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (Array.isArray(data) ? data[0]?.error_message : (data as CreatomateRenderStatus).error_message) ??
      response.statusText;
    throw new Error(`Creatomate render failed: ${message}`);
  }

  const render = Array.isArray(data) ? data[0] : data;
  if (!render?.id) {
    throw new Error("Creatomate did not return a render ID");
  }

  return render.id;
}

async function getRenderStatus(renderId: string): Promise<CreatomateRenderStatus> {
  const response = await fetch(`${CREATOMATE_API}/${renderId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!response.ok) {
    throw new Error(`Creatomate status check failed: ${response.statusText}`);
  }

  return response.json() as Promise<CreatomateRenderStatus>;
}

async function waitForRender(renderId: string): Promise<string> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const status = await getRenderStatus(renderId);

    if (status.status === "succeeded" && status.url) {
      return status.url;
    }

    if (status.status === "failed") {
      throw new Error(status.error_message ?? "Creatomate render failed");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Video render timed out. Check Creatomate dashboard → API Log.");
}

/**
 * Renders a review Reel. Uses custom template if CREATOMATE_TEMPLATE_ID is set,
 * otherwise builds the video from RenderScript (zero template setup).
 */
export async function renderReviewReel(
  review: ProductReview,
  options: { showWatermark: boolean; productImageUrl?: string }
): Promise<CreatomateRenderResult> {
  const templateId = process.env.CREATOMATE_TEMPLATE_ID;

  const body = templateId
    ? {
        template_id: templateId,
        modifications: {
          "Review-Text": review.body,
          "Reviewer-Name": review.reviewerName,
          "Product-Name": review.productTitle,
          "Star-Rating": starsText(review.rating),
          "Show-Watermark": options.showWatermark ? "true" : "false",
          ...(options.productImageUrl
            ? { "Product-Image": options.productImageUrl }
            : {}),
        },
      }
    : buildReviewReelScript(review, options);

  const renderId = await createRender(body);
  const url = await waitForRender(renderId);

  return { id: renderId, url };
}

export function isCreatomateConfigured(): boolean {
  return Boolean(process.env.CREATOMATE_API_KEY ?? process.env.VIDEO_API_KEY);
}
