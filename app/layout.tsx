import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import React from "react";
import WhatsAppObservationHost from "@/components/WhatsAppObservationHost";
import WhatsAppInboxFloating from "@/components/WhatsAppInboxFloating";
import { isPublicOnlyHost } from "@/lib/publicOnlyHosts";

const inter = Inter({ 
  subsets: ["latin"],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
});

// Host-aware metadata. We derive metadataBase + canonical from the
// actual incoming Host header so the public-only mirror domain emits
// canonical URLs pointing at ITSELF (Google sees it as its own
// indexable site) rather than always at the primary haccppro.in.
// Falls back to NEXT_PUBLIC_APP_URL for local/edge cases. All other
// metadata fields (icons, robots, OG, twitter, appleWebApp) match the
// previous static config.
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL || 'https://haccppro.in';
  const base = host ? `${proto}://${host}` : fallbackBase;
  const isMirror = isPublicOnlyHost(host);
  return {
    metadataBase: new URL(base),
    title: 'HACCP PRO Dashboard',
    description:
      'Enterprise Food Safety Management System for HACCP compliance, audits, training, recipes and food safety records.',
    keywords: ['HACCP', 'food safety', 'FSSAI compliance', 'food safety audit', 'kitchen hygiene', 'HACCP software', 'food safety management'],
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
        { url: '/logo.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon-32.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    // Canonical is host-relative ('/') — Next.js resolves it against
    // the host-aware metadataBase above, so the mirror canonicalises
    // to the mirror's own root and the primary canonicalises to
    // haccppro.in.
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      title: isMirror ? 'HACCP PRO — Food Safety Intelligence' : 'HACCP PRO — Food Safety Management',
      description:
        'Enterprise Food Safety Management System for HACCP compliance, audits, training, and records.',
      siteName: 'HACCP PRO',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'HACCP PRO — Food Safety Management',
      description:
        'Enterprise Food Safety Management System for HACCP compliance, audits, training, and records.',
    },
    appleWebApp: {
      capable: true,
      title: 'HACCP PRO',
      statusBarStyle: 'black-translucent',
    },
    other: { 'mobile-web-app-capable': 'yes' },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ef4444",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css" />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
        <WhatsAppObservationHost />
        <WhatsAppInboxFloating />
      </body>
    </html>
  );
}
