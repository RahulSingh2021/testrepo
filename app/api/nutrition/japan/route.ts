import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface JapanFood {
  code: string;
  name: string;
  category: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  saturatedFat: number;
  mufa: number;
  pufa: number;
  transFat: number;
  cholesterol: number;
  sugar: number;
  symbol: 'Veg' | 'Non-Veg';
}

interface EnrichedJapanFood extends JapanFood {
  englishName: string;
  searchHaystack: string;
}

let corpus: JapanFood[] | null = null;
let enriched: EnrichedJapanFood[] | null = null;
let dictionary: Record<string, string> | null = null;

function loadDictionary(): Record<string, string> {
  if (dictionary) return dictionary;
  const filePath = path.join(process.cwd(), 'lib', 'data', 'japan-mext-ja-en.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, string>;
  // Strip the leading "_comment" doc field so it can never match a real token.
  delete parsed._comment;
  dictionary = parsed;
  return dictionary;
}

function loadCorpus(): JapanFood[] {
  if (corpus) return corpus;
  const filePath = path.join(process.cwd(), 'lib', 'data', 'japan-mext.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  corpus = JSON.parse(raw) as JapanFood[];
  return corpus;
}

// Translate a single Japanese food name into a best-effort English
// alias by tokenising on whitespace and looking each token up in the
// dictionary. Tokens that don't match are dropped (the displayed
// English name is a "best understood" alias, not a literal
// transliteration), but the original Japanese name is always kept
// untouched on the entry. Designed to be cheap and side-effect-free
// so it can run at module load time.
// A handful of MEXT tokens have two unrelated senses depending on
// which food group the entry belongs to (e.g. かき is "persimmon" in
// Fruits and "oyster" in Fish and shellfish). Looked up by token,
// then matched against substrings of the entry's category to pick
// the right English alias. Tokens not listed here use the plain
// dictionary lookup.
const CATEGORY_AMBIGUOUS: Record<string, Array<{ categoryIncludes: string; en: string }>> = {
  'かき': [
    { categoryIncludes: 'Fruit', en: 'persimmon' },
    { categoryIncludes: 'Fish', en: 'oyster' },
    { categoryIncludes: 'shell', en: 'oyster' },
  ],
};

function translateName(name: string, category: string, dict: Record<string, string>): string {
  if (!name) return '';
  const tokens = name.split(/[\s　]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const senses = CATEGORY_AMBIGUOUS[t];
    if (senses) {
      const hit = senses.find(s => category.toLowerCase().includes(s.categoryIncludes.toLowerCase()));
      if (hit) { out.push(hit.en); continue; }
      // Fall through to plain dict if no category sense matches.
    }
    const direct = dict[t];
    if (direct) out.push(direct);
  }
  return out.join(' ').trim();
}

function loadEnriched(): EnrichedJapanFood[] {
  if (enriched) return enriched;
  const data = loadCorpus();
  const dict = loadDictionary();
  enriched = data.map(f => {
    const englishName = translateName(f.name, f.category || '', dict);
    // Single lowercased haystack used for matching: original Japanese
    // (so direct kana/kanji queries still work) plus the English alias
    // (so users typing "tofu" or "soybean paste" find the right
    // entries). Category is included too because users sometimes
    // search "fish" or "dairy" expecting to browse a section.
    const searchHaystack = `${f.name} ${englishName} ${f.category || ''}`.toLowerCase();
    return { ...f, englishName, searchHaystack };
  });
  return enriched;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return NextResponse.json({ foods: [] });

  let data: EnrichedJapanFood[];
  try {
    data = loadEnriched();
  } catch (e) {
    console.error('[Japan MEXT] Failed to load corpus:', e);
    return NextResponse.json({ error: 'Japan MEXT data failed to load', detail: String(e) }, { status: 502 });
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = data
    .map((f) => {
      const haystack = f.searchHaystack;
      const enLower = f.englishName.toLowerCase();
      const jaLower = f.name.toLowerCase();
      let score = 0;
      // Exact / prefix on either name wins. Fall back to substring,
      // then token-level inclusion against the combined haystack so
      // multi-word English queries like "soybean paste" still match.
      if (jaLower === q || enLower === q) score = 100;
      else if (jaLower.startsWith(q) || enLower.startsWith(q)) score = 88;
      else if (jaLower.includes(q) || enLower.includes(q)) score = 78;
      else if (haystack.includes(q)) score = 70;
      else if (tokens.length > 0 && tokens.every(t => haystack.includes(t))) score = 62;
      else if (tokens.length > 0 && tokens.some(t => haystack.includes(t))) score = 40;
      else return null;
      return { f, score };
    })
    .filter((x): x is { f: EnrichedJapanFood; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ f, score }) => ({
      id: `JAPAN-${f.code}`,
      source: 'JAPAN',
      subSource: 'MEXT 2020',
      name: f.name,
      englishName: f.englishName || undefined,
      category: f.category,
      portion: 100,
      energy: safeNum(f.energy),
      protein: safeNum(f.protein),
      fat: safeNum(f.fat),
      carb: safeNum(f.carb),
      fiber: safeNum(f.fiber),
      sodium: safeNum(f.sodium),
      totalSugar: safeNum(f.sugar),
      addedSugar: 0,
      saturatedFat: safeNum(f.saturatedFat),
      unsaturatedFat: safeNum(f.mufa),
      polyunsaturatedFat: safeNum(f.pufa),
      transFat: safeNum(f.transFat),
      cholesterol: safeNum(f.cholesterol),
      allergen: 'None',
      symbol: f.symbol,
      matchScore: score,
    }));

  return NextResponse.json({ foods: scored });
}
