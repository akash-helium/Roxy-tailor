# ReviewReel

**Shopify Micro-SaaS** — Turn product reviews into Instagram-ready AI videos.

Merchants install from the Shopify App Store, pick a plan, and generate 9:16 Reels from their best reviews in one click.

## Quick start

```bash
cd review-reel
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

Press `p` in the Shopify CLI prompt to open your dev store and install the app.

## Adjust pricing

Edit **`config/pricing.config.ts`** — change `priceMonthlyUsd`, `videosPerMonth`, and plan features. No other code changes needed.

```ts
starter: {
  priceMonthlyUsd: 19,  // ← change this
  videosPerMonth: 15,   // ← or this
  ...
}
```

Redeploy after changes. Existing subscribers keep their current plan until they switch.

## How you earn money

See **[config/monetization.md](config/monetization.md)** for the full playbook:

| Plan    | Default price | Videos/mo |
|---------|---------------|-----------|
| Free    | $0            | 2         |
| Starter | $19           | 15        |
| Growth  | $49           | 60        |
| Pro     | $99           | 200       |

- **Shopify bills merchants** via App Subscription API (implemented in `app/services/billing.server.ts`)
- **Shopify keeps 0%** on first $1M lifetime revenue, then 15%
- **Free tier** drives upgrades when merchants hit the video cap

## Project structure

```
review-reel/
├── config/
│   ├── pricing.config.ts    ← Edit plans & prices here
│   └── monetization.md      ← Revenue strategy
├── app/
│   ├── routes/              ← Dashboard, generate, videos, pricing
│   ├── services/
│   │   ├── billing.server.ts
│   │   ├── creatomate.server.ts  ← Creatomate API + Reel template
│   │   ├── reviews.server.ts
│   │   └── video.server.ts
│   └── shopify.server.ts
├── prisma/schema.prisma
└── shopify.app.toml
```

## Next steps to launch

1. Create a [Shopify Partner](https://partners.shopify.com) account
2. Create an app and copy API key/secret to `.env`
3. Connect **Creatomate** — add `CREATOMATE_API_KEY` to `.env` (50 free credits)
4. Integrate Judge.me or Loox for real review data
5. Submit to the Shopify App Store

## Video engine (Creatomate)

Rendering uses **Creatomate** with a built-in 9:16 Instagram Reel template — no custom template required.

1. Sign up at [creatomate.com](https://creatomate.com) (50 free credits, no card)
2. Copy your API key from **Project Settings → API Keys**
3. Add to `.env`: `CREATOMATE_API_KEY=your_key_here`
4. Generate a Reel from the app (takes ~30–90 seconds)

Without an API key, the app runs in **mock mode** (placeholder download URLs).

Optional: create a custom template in Creatomate and set `CREATOMATE_TEMPLATE_ID`.

## Tech stack

- Remix + Shopify App Remix
- Polaris UI
- Prisma + SQLite (dev) / PostgreSQL (prod)
- Creatomate API (video rendering)
- Shopify Billing API
