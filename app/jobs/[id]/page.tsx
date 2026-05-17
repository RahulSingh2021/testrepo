import JobDetailPage from '@/components/JobDetailPage';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialPublicOnly = await getServerIsPublicOnly();
  return <JobDetailPage jobId={id} initialPublicOnly={initialPublicOnly} />;
}
