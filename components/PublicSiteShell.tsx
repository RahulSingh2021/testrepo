'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLandingT } from '@/lib/landingI18n';
import {
  TopBar,
  MobileDrawer,
  SiteFooter,
} from '@/components/AcademyPublicHome';
import { usePublicOnlyMirror } from '@/utils/usePublicOnlyMirror';

interface AppSettingsBag {
  contact_email?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  default_wa_country_code?: string;
}

// Self-contained chrome wrapper used by every PUBLIC page that isn't the
// public home (tip detail, news detail, etc). It renders the same
// TopBar / MobileDrawer / SiteFooter as the home page so the brand and
// navigation stay consistent — and routes nav clicks back to the home
// page's section anchors (`/#tips`, `/#training`, …) since those
// sections only exist on the home page.
export default function PublicSiteShell({
  activeSection = 'tips',
  children,
  onSignInClick,
  initialPublicOnly = false,
}: {
  activeSection?: string;
  children: ReactNode;
  onSignInClick?: () => void;
  // Server-resolved mirror flag (see lib/serverIsPublicOnly.ts).
  initialPublicOnly?: boolean;
}) {
  const { t, lang, setLang } = useLandingT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettingsBag>({});
  // On public-only mirror domains, hide every sign-in CTA in the
  // shared chrome (TopBar + MobileDrawer). Initial value is server-
  // resolved so SSR HTML on the mirror has no sign-in button.
  const hideSignIn = usePublicOnlyMirror(initialPublicOnly);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/app-settings');
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setAppSettings({
          contact_email: j.contact_email,
          contact_phone: j.contact_phone,
          whatsapp_number: j.whatsapp_number,
          default_wa_country_code: j.default_wa_country_code,
        });
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const waNumber = (appSettings.whatsapp_number || appSettings.contact_phone || '')
    .replace(/[^0-9]/g, '');
  const waHref = waNumber
    ? `https://wa.me/${
        waNumber.startsWith(appSettings.default_wa_country_code || '')
          ? waNumber
          : `${(appSettings.default_wa_country_code || '').replace(/[^0-9]/g, '')}${waNumber}`
      }`
    : null;

  const contactEmail = appSettings.contact_email || 'hello@haccppro.com';

  const handleNav = (id: string) => {
    setDrawerOpen(false);
    if (typeof window !== 'undefined') {
      // The "News" and "Jobs" tabs point at dedicated public pages
      // (/news and /jobs) rather than scrolling to home-page anchors.
      if (id === 'news' || id === 'jobs') {
        window.location.href = `/${id}`;
      } else {
        window.location.href = `/#${id}`;
      }
    }
  };

  const handleSignIn = () => {
    if (onSignInClick) {
      onSignInClick();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <TopBar
        activeSection={activeSection}
        onNav={handleNav}
        onSignIn={handleSignIn}
        hideSignIn={hideSignIn}
        onOpenDrawer={() => setDrawerOpen(true)}
        waHref={waHref}
        t={t}
        lang={lang}
        onChangeLang={setLang}
      />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
        onNav={handleNav}
        onSignIn={handleSignIn}
        hideSignIn={hideSignIn}
        waHref={waHref}
        t={t}
        lang={lang}
        onChangeLang={setLang}
      />

      <div className="flex-1">{children}</div>

      <SiteFooter
        contactEmail={contactEmail}
        contactPhone={appSettings.contact_phone}
        waHref={waHref}
        onNav={handleNav}
        t={t}
      />
    </div>
  );
}
