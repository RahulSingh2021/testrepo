import { NextRequest, NextResponse } from 'next/server';
import { readNutritionCache, writeNutritionCache } from '@/lib/nutritionCache';

// Server-side proxy for USDA FoodData Central. Keeps the API key off the
// browser. Free key signup: https://fdc.nal.usda.gov/api-key-signup.html
//
// Returns up to 200 normalised candidates per query (FDC's per-page max)
// in the same shape the Recipe Studio uses for ingredient rows
// (per-100 g portion). The client-side adapter trims to the user-visible
// cap after re-scoring locally.

type UsdaFood = {
  id: string;
  source: 'USDA';
  subSource: string; // SR Legacy / Foundation / Branded / Survey (FNDDS)
  name: string;
  brand?: string;
  portion: number; // always 100 g (we normalise)
  energy: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  sodium: number;
  // Sub-nutrients — FDC reports these for most Foundation / SR Legacy
  // foods. Branded items vary; missing values default to 0 so the row
  // still renders cleanly. Units match the rest of the app: grams for
  // macros and sub-fats, milligrams for sodium and cholesterol, kcal
  // for energy.
  totalSugar: number;
  addedSugar: number;
  saturatedFat: number;
  unsaturatedFat: number;     // monounsaturated (TMUFA)
  polyunsaturatedFat: number; // TPUFA
  transFat: number;
  cholesterol: number;
  allergen: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
export type CacheEntry = { foods: UsdaFood[]; expiresAt: number };
// Exported so other server routes (notably the Recipe Studio bootstrap)
// can read pre-warmed USDA lookups for the recipe ingredient names a user
// already requested this session, without paying the round-trip again.
export const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 200;

// Map FDC nutrient numbers to our internal fields. Numbers come from
// the USDA FoodData Central nutrient list:
// https://fdc.nal.usda.gov/portal-data/external/dataDictionary
type NumericKey = keyof Pick<UsdaFood,
  'energy' | 'protein' | 'carb' | 'fat' | 'fiber' | 'sodium' |
  'totalSugar' | 'addedSugar' | 'saturatedFat' | 'unsaturatedFat' |
  'polyunsaturatedFat' | 'transFat' | 'cholesterol'
>;

const NUTRIENT_MAP: Record<string, NumericKey> = {
  '208': 'energy',             // Energy (kcal)
  '268': 'energy',             // Energy (kJ) — converted to kcal below
  '203': 'protein',
  '205': 'carb',               // Carbohydrate, by difference
  '204': 'fat',                // Total lipid (fat)
  '291': 'fiber',              // Fiber, total dietary
  '307': 'sodium',             // Sodium, Na (mg)
  '269': 'totalSugar',         // Sugars, total including NLEA
  '539': 'addedSugar',         // Sugars, added
  '606': 'saturatedFat',       // Fatty acids, total saturated (TSFA)
  '645': 'unsaturatedFat',     // Fatty acids, total monounsaturated (TMUFA)
  '646': 'polyunsaturatedFat', // Fatty acids, total polyunsaturated (TPUFA)
  '605': 'transFat',           // Fatty acids, total trans
  '601': 'cholesterol',        // Cholesterol (mg)
};

// Expected internal unit per field. Macros and sub-fats are stored in
// grams; sodium and cholesterol in milligrams; energy in kcal. FDC
// reports nutrient values with a `unitName` that may not match (most
// commonly protein/carbs labelled in MG, or energy labelled in KJ);
// `convertToInternal` re-scales the raw value into our internal unit
// before we store it. Without this step the proxy returned mg as if
// they were grams, producing the "8.89 g → 889" basmati-rice bug.
const EXPECTED_UNIT: Record<NumericKey, 'G' | 'MG' | 'KCAL'> = {
  energy: 'KCAL',
  protein: 'G',
  carb: 'G',
  fat: 'G',
  fiber: 'G',
  sodium: 'MG',
  cholesterol: 'MG',
  totalSugar: 'G',
  addedSugar: 'G',
  saturatedFat: 'G',
  unsaturatedFat: 'G',
  polyunsaturatedFat: 'G',
  transFat: 'G',
};

function convertToInternal(value: number, rawUnit: string, expected: 'G' | 'MG' | 'KCAL'): number | null {
  if (!Number.isFinite(value)) return null;
  const u = (rawUnit || '').trim().toUpperCase();
  // Mass conversions
  if (expected === 'G') {
    if (!u || u === 'G' || u === 'GRAM' || u === 'GRAMS') return value;
    if (u === 'MG') return value / 1000;
    if (u === 'UG' || u === 'MCG' || u === 'µG') return value / 1_000_000;
    if (u === 'KG') return value * 1000;
    return null; // unknown unit — drop rather than store wrong-scale value
  }
  if (expected === 'MG') {
    if (!u || u === 'MG') return value;
    if (u === 'G' || u === 'GRAM' || u === 'GRAMS') return value * 1000;
    if (u === 'UG' || u === 'MCG' || u === 'µG') return value / 1000;
    return null;
  }
  // Energy
  if (!u || u === 'KCAL') return value;
  if (u === 'KJ') return value / 4.184;
  if (u === 'CAL') return value / 1000;
  return null;
}

// Per-100 g sanity caps. Anything beyond these is physically impossible
// and is almost always an upstream unit mismatch we couldn't decode
// (e.g. an unfamiliar `unitName`). Drop the value rather than overwrite
// a clean default of 0 — the user can still pick a different USDA
// candidate or fill the field manually.
const PER_100G_MAX: Record<NumericKey, number> = {
  energy: 1100,        // pure fat ≈ 900 kcal/100 g; leave headroom
  protein: 100,
  carb: 100,
  fat: 100,
  fiber: 100,
  totalSugar: 100,
  addedSugar: 100,
  saturatedFat: 100,
  unsaturatedFat: 100,
  polyunsaturatedFat: 100,
  transFat: 100,
  sodium: 100_000,     // 100 g of pure salt ≈ 39 g Na = 39 000 mg
  cholesterol: 10_000, // 10 g/100 g — effectively unreachable
};

function normaliseFood(raw: any): UsdaFood | null {
  const name = (raw?.description || raw?.lowercaseDescription || '').toString().trim();
  if (!name) return null;
  const subSource = (raw?.dataType || 'Unknown').toString();
  const out: UsdaFood = {
    id: `USDA-${raw?.fdcId ?? Math.random().toString(36).slice(2)}`,
    source: 'USDA',
    subSource,
    name,
    brand: raw?.brandOwner || raw?.brandName || undefined,
    portion: 100,
    energy: 0, protein: 0, carb: 0, fat: 0, fiber: 0, sodium: 0,
    totalSugar: 0, addedSugar: 0, saturatedFat: 0, unsaturatedFat: 0,
    polyunsaturatedFat: 0, transFat: 0, cholesterol: 0,
    allergen: 'None',
  };

  // FDC returns nutrients as either `foodNutrients[].nutrientNumber` or
  // `foodNutrients[].nutrient.number` — handle both. Branded foods report
  // per-serving — the search endpoint already returns per-100 g where
  // available; if not, we fall back to whatever's there and warn the user
  // via the portion field staying at 100.
  const nutrients: any[] = Array.isArray(raw?.foodNutrients) ? raw.foodNutrients : [];
  // Sort so kcal entries (208) are processed before kJ entries (268) for
  // the energy slot — both map to `energy` and we use first-wins below.
  // Without this, a food that lists kJ first would let the kJ→kcal
  // conversion win even when an authoritative kcal entry is present.
  const sortedNutrients = [...nutrients].sort((a, b) => {
    const an = String(a?.nutrientNumber ?? a?.nutrient?.number ?? '');
    const bn = String(b?.nutrientNumber ?? b?.nutrient?.number ?? '');
    if (an === '208' && bn === '268') return -1;
    if (an === '268' && bn === '208') return 1;
    return 0;
  });
  // Track which fields we've already filled. FDC sometimes lists the
  // same nutrient number twice (e.g. once in G and once in % DV); the
  // first valid, in-range, unit-decodable hit wins so a junk duplicate
  // can't clobber a good value.
  const filled = new Set<NumericKey>();
  for (const n of sortedNutrients) {
    const num = String(n?.nutrientNumber ?? n?.nutrient?.number ?? '');
    const key = NUTRIENT_MAP[num];
    if (!key) continue;
    if (filled.has(key)) continue;
    const rawValue = Number(n?.value ?? n?.amount ?? 0);
    if (!Number.isFinite(rawValue)) continue;
    const rawUnit = String(n?.unitName ?? n?.nutrient?.unitName ?? '');
    const converted = convertToInternal(rawValue, rawUnit, EXPECTED_UNIT[key]);
    if (converted === null) continue;
    if (converted < 0) continue;
    if (converted > PER_100G_MAX[key]) continue;
    out[key] = converted;
    filled.add(key);
  }

  // Sodium comes back in mg already; everything else in g/kcal — match the
  // app's existing scale.
  return out;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) {
    // Return 200 with an explicit notConfigured flag so the client can hide
    // the USDA section gracefully (rather than rendering it with a 5xx
    // error message). FSANZ still works on its own.
    return NextResponse.json({
      foods: [],
      notConfigured: true,
      error: 'USDA_FDC_API_KEY is not set. Get a free key at https://fdc.nal.usda.gov/api-key-signup.html and add it as a Replit secret.',
    });
  }

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ foods: [] });

  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ foods: hit.foods, cached: true });
  }

  // Try the persistent DB cache before paying the USDA round-trip.
  // Survives process restarts and is shared across users, so a row
  // any teammate fetched recently still hits warm here.
  const dbHit = await readNutritionCache('USDA', cacheKey);
  if (dbHit) {
    const foods = dbHit.foods as UsdaFood[];
    // Mirror into the in-process map so the rest of this Lambda
    // invocation can hit the fast path too.
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(cacheKey, { foods, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ foods, cached: true });
  }

  // FDC's `dataType` query param is finicky: comma-joined values get
  // double-encoded by URLSearchParams (the parens in "Survey (FNDDS)" become
  // %28/%29 which FDC rejects with a 400), and appending multiple
  // dataType= params behaves inconsistently. Omitting it makes FDC fall
  // back to searching every dataset — exactly what we want for a "find
  // anything that looks like this ingredient" lookup. Branded results may
  // appear higher; we leave it to the client-side scorer in
  // lib/externalNutritionLookup.ts to rank by name similarity.
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', q);
  // FDC's max page size is 200. We pull the full page so the client-side
  // re-scorer has the complete candidate set to rank — otherwise rare
  // entries (e.g. obscure truffle / mushroom sub-varieties) get clipped
  // before they ever reach the user.
  url.searchParams.set('pageSize', '200');

  let res: Response;
  try {
    res = await fetch(url.toString(), { next: { revalidate: 0 } });
  } catch (e) {
    return NextResponse.json({ error: 'USDA API request failed', detail: String(e) }, { status: 502 });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ error: `USDA API error ${res.status}`, detail: text.slice(0, 300) }, { status: 502 });
  }
  const json: any = await res.json();
  const rawFoods: any[] = Array.isArray(json?.foods) ? json.foods : [];
  const foods = rawFoods.map(normaliseFood).filter((f): f is UsdaFood => f !== null);

  // Trim cache before insert.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, { foods, expiresAt: Date.now() + CACHE_TTL_MS });

  // Write-through to the persistent DB cache so future bootstraps
  // (and other users) can preload this lookup. Best-effort; failures
  // are logged inside writeNutritionCache and don't affect the
  // response.
  void writeNutritionCache('USDA', cacheKey, foods);

  return NextResponse.json({ foods, cached: false });
}
