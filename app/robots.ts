import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isPublicOnlyHost } from '@/lib/publicOnlyHosts';

// Per-host robots.txt. The primary domain advertises its sitemap and
// the usual disallow list; the public-only mirror disallows every
// authenticated/admin path so search engines don't index links the
// mirror doesn't even serve.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get('host') || '';
  const publicOnly = isPublicOnlyHost(host);

  if (publicOnly) {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/api/',
            '/admin',
            '/admin/',
            '/obs-share/',
            '/supplier-portal/',
            '/training-portal/',
            '/scan/',
          ],
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/obs-share/',
          '/supplier-portal/',
          '/training-portal/',
          '/scan/',
        ],
      },
    ],
    sitemap: 'https://haccppro.in/sitemap.xml',
  };
}
