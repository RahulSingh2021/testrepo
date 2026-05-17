import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

// Shared, lightweight layout for legal/policy routes (Privacy, Terms,
// Security). Each route passes its title and an array of sections;
// styling matches the public marketing pages so visitors stay in
// HACCP PRO's brand world without us having to replicate the entire
// landing chrome on every legal page.

interface Section {
  heading: string;
  body: string;
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  sections: Section[];
}

export default function LegalPage({ title, lastUpdated, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shadow-md shadow-slate-900/20">
              HP
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900 tracking-tight">
                HACCP <span className="text-indigo-600">PRO</span>
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Food Safety Intelligence
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 pb-20">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
          <ShieldCheck className="w-3.5 h-3.5" /> Legal
        </span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-500 font-bold">
          Last updated: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-extrabold text-slate-900">{s.heading}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
