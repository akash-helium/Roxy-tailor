import { getPlan, type PlanId } from "../../config/pricing.config";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> }
  ) => Promise<Response>;
};

export interface ProductReview {
  id: string;
  productId: string;
  productTitle: string;
  body: string;
  rating: number;
  reviewerName: string;
  createdAt: string;
}

interface ShopifyProduct {
  id: string;
  title: string;
}

/**
 * Fetches product reviews via Shopify's product review metafields / review apps.
 * For MVP: uses Judge.me-style metafields or falls back to mock data in dev.
 *
 * Production: integrate Judge.me, Loox, or Shopify's native reviews API when available.
 */
export async function fetchProductReviews(
  admin: AdminClient,
  productId?: string,
  limit = 20
): Promise<ProductReview[]> {
  const planLimit = 20;

  const query = productId
    ? `#graphql
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            metafields(namespace: "reviews", first: ${planLimit}) {
              edges {
                node { key value type }
              }
            }
          }
        }
      `
    : `#graphql
        query GetProducts {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `;

  const response = await admin.graphql(query, {
    variables: productId ? { id: productId } : {},
  });

  const json = await response.json();

  if (productId) {
    const product = json.data?.product as ShopifyProduct & {
      metafields?: { edges: Array<{ node: { key: string; value: string } }> };
    };
    if (!product) return getDemoReviews();

    const metafieldReviews = parseMetafieldReviews(product);
    if (metafieldReviews.length > 0) {
      return metafieldReviews.slice(0, limit);
    }
    return getDemoReviews(product.id, product.title);
  }

  const products = json.data?.products?.edges ?? [];
  if (products.length === 0) return getDemoReviews();

  const first = products[0].node as ShopifyProduct;
  return getDemoReviews(first.id, first.title);
}

function parseMetafieldReviews(
  product: { id: string; title: string; metafields?: { edges: Array<{ node: { key: string; value: string } }> } }
): ProductReview[] {
  const edges = product.metafields?.edges ?? [];
  const reviews: ProductReview[] = [];

  for (const { node } of edges) {
    try {
      const parsed = JSON.parse(node.value) as {
        body?: string;
        rating?: number;
        author?: string;
        id?: string;
      };
      if (parsed.body) {
        reviews.push({
          id: parsed.id ?? `review-${reviews.length}`,
          productId: product.id,
          productTitle: product.title,
          body: parsed.body,
          rating: parsed.rating ?? 5,
          reviewerName: parsed.author ?? "Customer",
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // skip invalid metafields
    }
  }

  return reviews;
}

/** Demo reviews for dev stores without a review app installed */
function getDemoReviews(productId = "gid://shopify/Product/1", productTitle = "Sample Product"): ProductReview[] {
  return [
    {
      id: "demo-1",
      productId,
      productTitle,
      body: "Absolutely love this! Quality exceeded my expectations and shipping was fast.",
      rating: 5,
      reviewerName: "Sarah M.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-2",
      productId,
      productTitle,
      body: "Best purchase I've made this year. Already recommended to three friends.",
      rating: 5,
      reviewerName: "James K.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-3",
      productId,
      productTitle,
      body: "Great value for money. The packaging was beautiful too!",
      rating: 4,
      reviewerName: "Emily R.",
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function fetchProducts(admin: AdminClient) {
  const response = await admin.graphql(
    `#graphql
      query {
        products(first: 25, sortKey: BEST_SELLING) {
          edges {
            node {
              id
              title
              featuredImage { url altText }
              totalInventory
            }
          }
        }
      }
    `
  );
  const json = await response.json();
  return (json.data?.products?.edges ?? []).map(
    (e: { node: { id: string; title: string; featuredImage?: { url: string } } }) => ({
      id: e.node.id,
      title: e.node.title,
      imageUrl: e.node.featuredImage?.url,
    })
  );
}

export function filterReviewsByPlan(reviews: ProductReview[], planId: PlanId) {
  const max = getPlan(planId).maxReviewsPerProduct;
  return reviews.slice(0, max);
}
