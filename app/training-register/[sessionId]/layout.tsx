import sql from '@/lib/db';
import { Metadata } from 'next';

interface Props {
  params: Promise<{ sessionId: string }>;
  children: React.ReactNode;
}

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://haccppro.in').replace(/\/$/, '');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  
  try {
    const rows = await sql`SELECT id, data FROM training_calendar WHERE id = ${sessionId}`;
    if (!rows || rows.length === 0) return { title: 'Training Registration — HACCP PRO' };
    
    const session = { id: rows[0].id, ...(rows[0].data as any) };
    const title = `${session.topic || 'Training'} — Register Now`;
    const description = session.description
      || `Register for ${session.topic || 'training'} by ${session.trainer || 'our expert'}.${session.date ? ` Date: ${new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`;

    const hasThumbnail = !!session.thumbnailImage;

    // Cache-buster: use thumbnailVersion (bumped every time admin uploads a new
    // thumbnail or hits "Refresh Preview") so WhatsApp re-fetches the image.
    const vParam = session.thumbnailVersion ?? 0;
    const ogImageUrl = `${BASE_URL}/api/training-og?sessionId=${sessionId}&v=${vParam}`;

    const ogImages = hasThumbnail
      ? [{ url: ogImageUrl, width: 1200, height: 630, alt: title }]
      : [];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/training-register/${sessionId}`,
        siteName: 'HACCP PRO',
        ...(ogImages.length > 0 ? { images: ogImages } : {}),
      },
      twitter: {
        card: hasThumbnail ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(hasThumbnail ? { images: [ogImageUrl] } : {}),
      },
    };
  } catch {
    return { title: 'Training Registration — HACCP PRO' };
  }
}

export default function TrainingRegisterLayout({ children }: Props) {
  return <>{children}</>;
}
