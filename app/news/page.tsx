import type { Metadata } from 'next';
import LatestNewsPage from '@/components/LatestNewsPage';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Global Safety Intelligence — Latest News | HACCP PRO',
  description:
    'Authorized regulatory updates and curated industry news to help your business stay compliant.',
};

export default async function NewsIndexRoute() {
  const initialPublicOnly = await getServerIsPublicOnly();
  return <LatestNewsPage initialPublicOnly={initialPublicOnly} />;
}
