import { NextRequest, NextResponse } from 'next/server';
import { detectAllergensFromName } from '@/lib/externalNutritionLookup';

type OffFood = {
  id: string;
  source: 'OPENFOOD';
  subSource: string;
  name: string;
  brand?: string;
  category?: string;
  portion: number;
  energy: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  sodium: number;
  totalSugar: number;
  addedSugar: number;
  saturatedFat: number;
  unsaturatedFat: number;
  polyunsaturatedFat: number;
  transFat: number;
  cholesterol: number;
  allergen: string;
  symbol?: 'Veg' | 'Non-Veg';
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { foods: OffFood[]; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 200;

const PER_100G_MAX: Record<string, number> = {
  energy: 1100,
  protein: 100, carb: 100, fat: 100, fiber: 100,
  totalSugar: 100, addedSugar: 100,
  saturatedFat: 100, unsaturatedFat: 100, polyunsaturatedFat: 100, transFat: 100,
  sodium: 100_000,
  cholesterol: 10_000,
};

function clampField(v: unknown, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > max) return 0;
  return n;
}

function detectSymbol(name: string, ingredientsText: string): 'Veg' | 'Non-Veg' {
  const text = `${name} ${ingredientsText}`.toLowerCase();
  const hints = ['chicken','beef','pork','mutton','lamb','turkey','duck','goose','fish','salmon','tuna','cod','prawn','shrimp','crab','lobster','oyster','mussel','clam','squid','octopus','mince','sausage','bacon','ham','meat','liver','venison','rabbit','anchovy','sardine','mackerel','egg'];
  return hints.some(h => text.includes(h)) ? 'Non-Veg' : 'Veg';
}

function normaliseAllergens(raw: string | undefined): string {
  if (!raw) return 'None';
  const map: Record<string, string> = {
    'en:gluten': 'Gluten', 'en:crustaceans': 'Crustaceans', 'en:eggs': 'Eggs',
    'en:fish': 'Fish', 'en:peanuts': 'Peanuts', 'en:soybeans': 'Soy', 'en:soy': 'Soy',
    'en:milk': 'Milk', 'en:nuts': 'Nuts', 'en:celery': 'Celery', 'en:mustard': 'Mustard',
    'en:sesame-seeds': 'Sesame', 'en:sesame': 'Sesame',
    'en:sulphur-dioxide-and-sulphites': 'Sulphur dioxide/sulphites',
    'en:lupin': 'Lupin', 'en:molluscs': 'Molluscs',
  };
  const found: string[] = [];
  for (const tag of raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)) {
    const mapped = map[tag];
    if (mapped && !found.includes(mapped)) found.push(mapped);
  }
  return found.length > 0 ? found.join(', ') : 'None';
}

function normaliseProduct(p: any): OffFood | null {
  const name = (p?.product_name_en || p?.product_name || p?.generic_name_en || p?.generic_name || '').toString().trim();
  if (!name) return null;
  const n = p?.nutriments || {};
  // Prefer the explicit kcal field. OFF's `energy_100g` is reported in
  // whichever unit the contributor entered (commonly kJ for products
  // packaged under EU labelling rules), so falling back to it raw would
  // inflate calories ~4.184x. Use the unit hint when present to convert,
  // otherwise assume kJ as the safer default for the fallback field.
  let energyKcal = 0;
  if (n['energy-kcal_100g'] != null) {
    energyKcal = Number(n['energy-kcal_100g']) || 0;
  } else if (n['energy_100g'] != null) {
    const raw = Number(n['energy_100g']) || 0;
    const unit = String(n['energy_unit'] || '').toLowerCase();
    energyKcal = unit === 'kcal' ? raw : raw / 4.184;
  }
  const out: OffFood = {
    id: `OPENFOOD-${p?.code || p?._id || Math.random().toString(36).slice(2)}`,
    source: 'OPENFOOD',
    subSource: 'Open Food Facts',
    name,
    brand: (p?.brands || '').toString().split(',')[0].trim() || undefined,
    category: (p?.categories || '').toString().split(',')[0].trim() || undefined,
    portion: 100,
    energy: clampField(energyKcal, PER_100G_MAX.energy),
    protein: clampField(n['proteins_100g'], PER_100G_MAX.protein),
    carb: clampField(n['carbohydrates_100g'], PER_100G_MAX.carb),
    fat: clampField(n['fat_100g'], PER_100G_MAX.fat),
    fiber: clampField(n['fiber_100g'], PER_100G_MAX.fiber),
    sodium: clampField(Number(n['sodium_100g'] || 0) * 1000, PER_100G_MAX.sodium),
    totalSugar: clampField(n['sugars_100g'], PER_100G_MAX.totalSugar),
    addedSugar: 0,
    saturatedFat: clampField(n['saturated-fat_100g'], PER_100G_MAX.saturatedFat),
    unsaturatedFat: clampField(n['monounsaturated-fat_100g'], PER_100G_MAX.unsaturatedFat),
    polyunsaturatedFat: clampField(n['polyunsaturated-fat_100g'], PER_100G_MAX.polyunsaturatedFat),
    transFat: clampField(n['trans-fat_100g'], PER_100G_MAX.transFat),
    cholesterol: clampField(Number(n['cholesterol_100g'] || 0) * 1000, PER_100G_MAX.cholesterol),
    allergen: (() => {
      // Primary: OFF's structured allergens_tags (en:eggs, en:milk, ...).
      // Many community-uploaded products leave this empty though, so we
      // also fall back to keyword-scanning the product name + the full
      // ingredients_text. That way packets like "Papadi" with "wheat
      // flour" in the ingredients still surface a Gluten pill on the
      // result card instead of showing nothing.
      const structured = normaliseAllergens(p?.allergens_tags ? (Array.isArray(p.allergens_tags) ? p.allergens_tags.join(',') : String(p.allergens_tags)) : p?.allergens);
      if (structured && structured.toLowerCase() !== 'none') return structured;
      const ingredientsText = (p?.ingredients_text_en || p?.ingredients_text || '').toString();
      const fromText = detectAllergensFromName(`${name} ${ingredientsText}`);
      return fromText;
    })(),
    symbol: detectSymbol(name, (p?.ingredients_text_en || p?.ingredients_text || '').toString()),
  };
  if (out.energy === 0 && out.protein === 0 && out.carb === 0 && out.fat === 0) return null;
  return out;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ foods: [] });

  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ foods: hit.foods, cached: true });
  }

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', q);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '40');
  url.searchParams.set('fields', 'code,product_name,product_name_en,generic_name,generic_name_en,brands,categories,nutriments,allergens,allergens_tags,ingredients_text,ingredients_text_en');

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'HACCP-PRO/1.0 (Recipe Studio nutrition lookup)' },
        next: { revalidate: 0 },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return NextResponse.json({ error: 'Open Food Facts request failed', detail: String(e) }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Open Food Facts error ${res.status}` }, { status: 502 });
  }
  const json: any = await res.json().catch(() => ({}));
  const products: any[] = Array.isArray(json?.products) ? json.products : [];
  const foods = products.map(normaliseProduct).filter((f): f is OffFood => f !== null);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, { foods, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json({ foods, cached: false });
}
