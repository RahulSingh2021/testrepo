'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

export function sessionShortCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).padStart(6, '0').slice(0, 6);
}

export default function ShortRegLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) return;
    // Use the public endpoint so sessions the admin has explicitly
    // deactivated (isActive === false) are stripped server-side. A
    // short link that resolves to an inactive session would otherwise
    // bounce the visitor to /training-register/<id>, which then shows
    // an empty/locked state — confusing. Treating inactive sessions
    // as "not found" here matches admin intent and gives users the
    // same clean "Link Not Found" UX as a truly invalid code.
    fetch('/api/training-calendar?public=1')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => {
        const sessions = data.items || [];
        const match = sessions.find((s: any) => sessionShortCode(s.id) === code);
        if (match) {
          router.replace(`/training-register/${match.id}`);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [code, router]);

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-rose-500" />
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-2">Link Not Found</h2>
        <p className="text-sm text-slate-500">This registration link is invalid or the session no longer exists.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="text-indigo-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400">Loading registration…</p>
      </div>
    </div>
  );
}
