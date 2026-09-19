import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { getShopUsage } from "../services/billing.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const usage = await getShopUsage(session.shop);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage: {
      planName: usage.plan.name,
      videosRemaining: usage.videosRemaining,
      videosUsed: usage.videosUsed,
      videosLimit: usage.plan.videosPerMonth,
    },
  };
};

export default function AppLayout() {
  const { apiKey, usage } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        <Link to="/app/generate">Generate Video</Link>
        <Link to="/app/videos">My Videos</Link>
        <Link to="/app/pricing">Pricing</Link>
      </NavMenu>
      <Outlet context={{ usage }} />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
