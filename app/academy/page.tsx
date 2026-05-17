import AcademyPublicHome from '@/components/AcademyPublicHome';
import { getServerIsPublicOnly } from '@/lib/serverIsPublicOnly';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Academy — Top Courses | HACCP PRO',
  description:
    'Explore our active training programs. Browse courses, see outcomes, and register in seconds.',
};

export default async function AcademyHomePage() {
  const initialPublicOnly = await getServerIsPublicOnly();
  return <AcademyPublicHome initialPublicOnly={initialPublicOnly} />;
}
