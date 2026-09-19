# How ReviewReel Makes Money

## Revenue model

ReviewReel is a **subscription Micro-SaaS** sold through the **Shopify App Store**. Merchants install your app, pick a plan, and Shopify bills them on your behalf.

| Stream | How it works |
|--------|----------------|
| **Monthly subscriptions** | Starter $19, Growth $49, Pro $99 (edit in `config/pricing.config.ts`) |
| **Free tier → paid conversion** | 2 free videos/month; merchants hit the limit and upgrade |
| **Usage limits** | Video caps per plan drive upgrades without metering complexity |
| **Shopify revenue share** | Shopify keeps **0%** on the first $1M lifetime app revenue, then **15%** |

## Why this works on Shopify

1. **Built-in distribution** — Merchants search the App Store for "reviews", "Instagram", "UGC", "social video".
2. **Trust** — Billing through Shopify means no separate credit card flow for merchants.
3. **Sticky workflow** — Videos are tied to their catalog; switching apps loses templates and history.
4. **Clear ROI** — One good Reel can outperform paid ads; easy to justify $19–99/mo.

## Go-to-market checklist

### App Store listing (SEO)

- **Name**: ReviewReel — Review to Instagram Videos
- **Keywords**: product reviews, Instagram reels, UGC, social proof, video marketing, AI video
- **Screenshots**: Before/after (review text → Reel), pricing page, one-click generate flow
- **Demo video**: 30s showing install → pick review → download Reel

### Pricing psychology (defaults in `pricing.config.ts`)

| Plan | Price | Videos/mo | Target merchant |
|------|-------|-----------|-----------------|
| Free | $0 | 2 | Trial / single hero product |
| Starter | $19 | 15 | 1–2 posts/week |
| Growth | $49 | 60 | Daily posting, multiple SKUs |
| Pro | $99 | 200 | Agencies / large catalogs |

Adjust prices by editing `config/pricing.config.ts` — no code changes elsewhere required.

### Conversion tactics

- Show **"X videos left this month"** in the dashboard (implemented).
- **Watermark** on free-tier exports (optional — enable in video service).
- **Email** when they're 1 video away from the limit (add with Shopify Flow or your own cron).
- **Annual plan** — offer 20% off (config constant `ANNUAL_DISCOUNT_PERCENT`); implement annual billing in Shopify when ready.

## Cost structure (keep margins healthy)

| Cost | Estimate | Mitigation |
|------|----------|------------|
| AI video API (Creatomate) | ~$0.02–0.10/video | 50 free credits to start; ~$49/mo for 2,000 renders |
| AI voice / script (OpenAI) | ~$0.01/review | Batch prompts; reuse scripts |
| Hosting (Fly.io, Railway, Vercel) | $5–30/mo | Start small; scale with revenue |
| Shopify Partner account | Free | — |

**Target margin**: At Starter ($19) with 15 videos, keep AI cost under ~$5/merchant/month → **~70%+ gross margin**.

## Billing flow (technical)

1. Merchant clicks **Upgrade** on `/app/pricing`.
2. App calls Shopify **App Subscription API** with price from `pricing.config.ts`.
3. Merchant approves charge in Shopify admin.
4. Webhook `APP_SUBSCRIPTIONS_UPDATE` syncs plan to your database.
5. `videosUsedThisMonth` resets each billing cycle.

## Legal & compliance

- Privacy policy and data handling (reviews are customer PII).
- GDPR: allow data export/delete on uninstall webhook.
- Instagram: use Meta's APIs only if you add auto-posting; manual download avoids most compliance issues at launch.

## Milestones to first dollar

1. [ ] Shopify Partner account + dev store
2. [ ] App working on dev store (generate 1 video end-to-end)
3. [ ] App Store listing submitted (review ~5–10 business days)
4. [ ] 5 beta merchants from Shopify communities / Twitter
5. [ ] First paid subscription via Shopify billing
