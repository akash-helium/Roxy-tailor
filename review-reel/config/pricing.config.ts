/**
 * Central pricing configuration — edit this file to change plans, limits, and prices.
 * After changes, redeploy the app. Existing subscribers keep their plan until they change it.
 *
 * Shopify Billing API uses recurring charges in USD (or shop currency where supported).
 */

export type PlanId = "free" | "starter" | "growth" | "pro";

export interface PricingPlan {
  id: PlanId;
  /** Display name in the app and Shopify billing confirmation */
  name: string;
  /** Short tagline for pricing page */
  tagline: string;
  /** Monthly price in USD. 0 = free tier (no Shopify charge) */
  priceMonthlyUsd: number;
  /** Max AI videos generated per billing cycle */
  videosPerMonth: number;
  /** Max reviews that can be synced per product */
  maxReviewsPerProduct: number;
  /** Allow custom branding (logo, colors) on videos */
  customBranding: boolean;
  /** Auto-schedule posts to Instagram (future feature flag) */
  instagramAutoPost: boolean;
  /** Shopify App Subscription plan name (must be unique per shop) */
  shopifyPlanName: string;
  /** Highlight as recommended on pricing UI */
  recommended?: boolean;
}

/**
 * ─── ADJUST PRICING HERE ───────────────────────────────────────────────────
 * Change numbers below, then run `npm run dev` or redeploy.
 */
export const PRICING_PLANS: Record<PlanId, PricingPlan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try it on your best-selling product",
    priceMonthlyUsd: 0,
    videosPerMonth: 2,
    maxReviewsPerProduct: 5,
    customBranding: false,
    instagramAutoPost: false,
    shopifyPlanName: "ReviewReel Free",
  },
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For small catalogs posting weekly",
    priceMonthlyUsd: 19,
    videosPerMonth: 15,
    maxReviewsPerProduct: 20,
    customBranding: false,
    instagramAutoPost: false,
    shopifyPlanName: "ReviewReel Starter",
    recommended: true,
  },
  growth: {
    id: "growth",
    name: "Growth",
    tagline: "Scale UGC across your whole store",
    priceMonthlyUsd: 49,
    videosPerMonth: 60,
    maxReviewsPerProduct: 50,
    customBranding: true,
    instagramAutoPost: false,
    shopifyPlanName: "ReviewReel Growth",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "High-volume brands and agencies",
    priceMonthlyUsd: 99,
    videosPerMonth: 200,
    maxReviewsPerProduct: 100,
    customBranding: true,
    instagramAutoPost: true,
    shopifyPlanName: "ReviewReel Pro",
  },
};

/** Paid plans only (for Shopify billing) */
export const PAID_PLAN_IDS: PlanId[] = ["starter", "growth", "pro"];

export function getPlan(planId: PlanId): PricingPlan {
  return PRICING_PLANS[planId];
}

export function getPaidPlans(): PricingPlan[] {
  return PAID_PLAN_IDS.map((id) => PRICING_PLANS[id]);
}

export function canGenerateVideo(
  planId: PlanId,
  videosUsedThisMonth: number
): { allowed: boolean; reason?: string } {
  const plan = getPlan(planId);
  if (videosUsedThisMonth >= plan.videosPerMonth) {
    return {
      allowed: false,
      reason: `You've used all ${plan.videosPerMonth} videos on the ${plan.name} plan this month. Upgrade to generate more.`,
    };
  }
  return { allowed: true };
}

/** Annual discount shown on pricing page (billing still monthly via Shopify unless you add annual plans) */
export const ANNUAL_DISCOUNT_PERCENT = 20;

export function annualPriceMonthly(plan: PricingPlan): number {
  if (plan.priceMonthlyUsd === 0) return 0;
  return Math.round(plan.priceMonthlyUsd * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
}
