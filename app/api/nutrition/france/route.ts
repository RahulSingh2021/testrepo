import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAliases, buildSearchHaystack, decorateName } from '@/lib/data/foreign-food-aliases';

interface FranceFood {
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

let corpus: FranceFood[] | null = null;

function loadCorpus(): FranceFood[] {
  if (corpus) return corpus;
  const filePath = path.join(process.cwd(), 'lib', 'data', 'france-ciqual.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  corpus = JSON.parse(raw) as FranceFood[];
  return corpus;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return NextResponse.json({ foods: [] });

  let data: FranceFood[];
  try {
    data = loadCorpus();
  } catch (e) {
    console.error('[France Ciqual] Failed to load corpus:', e);
    return NextResponse.json({ error: 'France Ciqual data failed to load', detail: String(e) }, { status: 502 });
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = data
    .map((f) => {
      const nameLower = f.name.toLowerCase();
      const aliases = getAliases('FRANCE', f.name);
      const haystack = buildSearchHaystack(f.name, aliases);
      let score = 0;
      if (nameLower === q) score = 100;
      else if (nameLower.startsWith(q)) score = 88;
      else if (nameLower.includes(q)) score = 75;
      else if (haystack.includes(q)) score = 70;
      else if (tokens.every(t => nameLower.includes(t))) score = 62;
      else if (tokens.every(t => haystack.includes(t))) score = 58;
      else if (tokens.some(t => nameLower.includes(t))) score = 40;
      else if (tokens.some(t => haystack.includes(t))) score = 35;
      else return null;
      return { f, score, aliases };
    })
    .filter((x): x is { f: FranceFood; score: number; aliases: string[] } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ f, score, aliases }) => ({
      id: `FRANCE-${f.code}`,
      source: 'FRANCE',
      subSource: 'Ciqual ANSES',
      name: decorateName(f.name, aliases),
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
