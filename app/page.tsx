import ClientApp from "@/components/ClientApp";
import { getServerIsPublicOnly } from "@/lib/serverIsPublicOnly";

// Force dynamic rendering on every request. The previous default
// (static + s-maxage=31536000 on the CDN) meant deployments shipped new
// code but the edge kept serving the old HTML — and therefore old JS
// chunk references — for up to a year. With this flag, every request
// returns fresh HTML pointing at the latest chunks.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const isPublicOnly = await getServerIsPublicOnly();
  return <ClientApp isPublicOnly={isPublicOnly} />;
}
