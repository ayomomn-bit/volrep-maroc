import { HomepageRenderer } from "@/components/home/HomepageRenderer";
import { getStorefrontHomepage } from "@/lib/backend/homepage";

// Homepage is statically generated; revalidate periodically so backend data
// (Homepage Studio document, catalog) doesn't go stale between deploys. A
// publish also triggers immediate revalidation via app/api/revalidate/route.ts.
export const revalidate = 300;

export default async function Home() {
  const { page } = await getStorefrontHomepage();

  return <HomepageRenderer document={page} />;
}
