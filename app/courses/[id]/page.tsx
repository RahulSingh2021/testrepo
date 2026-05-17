import CourseDetailPage from '@/components/CourseDetailPage';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

// Public detail page for a single Academy course OR Training Calendar
// session. The id may be either; the client component resolves which by
// checking the optional ?source=academy|training query param first, then
// falling back to trying both public APIs. No login required.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Course details | HACCP PRO',
  description:
    'Course outcomes, requirements, schedule and registration for HACCP PRO Academy and Training Calendar offerings.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailRoute({ params }: PageProps) {
  const { id } = await params;
  const initialPublicOnly = await getServerIsPublicOnly();
  return <CourseDetailPage id={id} initialPublicOnly={initialPublicOnly} />;
}
