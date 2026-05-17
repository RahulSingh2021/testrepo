import React from 'react';
import { Languages, AlertCircle } from 'lucide-react';
import { useIngredientAliases } from '@/utils/useIngredientAliases';

// Tiny inline meta line shown beneath an ingredient name in the
// ingredients table and the CSV review lists. Auto-fetches Google
// aliases + spell-correction once per name (results are cached on the
// server for ~1 year), and renders nothing while empty so untouched
// rows stay visually clean.

interface Props {
  name: string;
  className?: string;
  size?: 'xs' | 'sm';
}

const IngredientAliasesLine: React.FC<Props> = ({ name, className = '', size = 'xs' }) => {
  const info = useIngredientAliases(name);
  const txt = size === 'sm' ? 'text-[11px]' : 'text-[10px]';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  if (info.loading && !info.aliases.length && !info.corrected) return null;
  if (!info.aliases.length && !info.corrected) return null;
  const original = (name || '').trim();
  const showCorrection = info.corrected && info.corrected.toLowerCase() !== original.toLowerCase();
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {showCorrection && (
        <div className={`inline-flex items-center gap-1 ${txt} font-semibold text-amber-700`} title={`Google suggests this may be a misspelling of "${info.corrected}".`}>
          <AlertCircle className={icon} />
          <span>Did you mean: <span className="font-bold">{info.corrected}</span>?</span>
        </div>
      )}
      {info.aliases.length > 0 && (
        <div className={`inline-flex items-start gap-1 ${txt} text-slate-500`} title={`Other names found via Google: ${info.aliases.join(', ')}`}>
          <Languages className={`${icon} mt-0.5 flex-shrink-0 text-slate-400`} />
          <span className="leading-snug">
            <span className="font-semibold text-slate-600">Aliases:</span>{' '}
            <span className="italic">{info.aliases.join(', ')}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default IngredientAliasesLine;
