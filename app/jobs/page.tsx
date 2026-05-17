import JobsPage from '@/components/JobsPage';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

export const dynamic = 'force-dynamic';

export default async function JobsRoute() {
  const initialPublicOnly = await getServerIsPublicOnly();
  return <JobsPage initialPublicOnly={initialPublicOnly} />;
}
