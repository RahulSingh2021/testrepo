// Searches public food-composition databases (USDA + FSANZ) for ingredient
// matches when the user's local Ingredients DB doesn't have a confident hit.
//
// Both sources are normalised to the same shape so the UI layer (and the
// existing buildIngFromDb in RecipeCalculation) can consume them
// interchangeably.

export type ExternalSource = 'USDA' | 'FSANZ' | 'NIN' | 'JAPAN' | 'KOREA' | 'UK' | 'FRANCE' | 'CHINA' | 'ITALY' | 'OPENFOOD' | 'AI' | 'INTERNAL';

export interface ExternalFood {
  id: string;
  source: ExternalSource;
  subSource?: string; // e.g. USDA: "Foundation" / "SR Legacy" / "Branded"
  name: string;
  brand?: string;
  category?: string;
  portion: number; // grams (always 100 in our normalised shape)
  energy: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  sodium: number;
  // Sub-nutrients — populated when the upstream source reports them
  // (most USDA Foundation / SR Legacy foods do; FSANZ seed currently
  // omits them and they fall through as 0). Units match the master
  // ingredient schema: grams for sub-fats and sugars, milligrams for
  // cholesterol.
  totalSugar: number;
  addedSugar: number;
  saturatedFat: number;
  unsaturatedFat: number;
  polyunsaturatedFat: number;
  transFat: number;
  cholesterol: number;
  allergen: string;
  // Best-effort Veg / Non-Veg classification (same heuristic the
  // ingredient-import path uses) so result cards can show the FSSAI
  // veg/non-veg dot without consumers needing their own detector.
  symbol: 'Veg' | 'Non-Veg';
  matchScore: number; // 0-100, computed locally relative to the query
  // Optional secondary display name. Currently used by Japan MEXT to
  // surface a best-effort English alias (e.g. "soybean paste") under
  // the original Japanese name so non-Japanese-reading users can
  // understand and find entries by typing English queries.
  englishName?: string;
}

// Lightweight Jaro-Winkler (mirrors the matcher already used elsewhere in
// the app for fuzzy ingredient matching). Inlined here to keep this module
// dependency-free so it can be loaded in the browser.
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0, transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenScore(query: string, candidate: string): number {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (!q || !c) return 0;
  if (c.includes(q)) return 100;
  const qTokens = q.split(/[\s,()\-/]+/).filter(Boolean);
  const cTokens = c.split(/[\s,()\-/]+/).filter(Boolean);
  if (!qTokens.length) return 0;
  let hits = 0;
  for (const qt of qTokens) {
    if (cTokens.some(ct => ct === qt || ct.startsWith(qt))) hits++;
  }
  const overlap = (hits / qTokens.length) * 70;
  const fuzz = jaroWinkler(q, c) * 30;
  return Math.round(overlap + fuzz);
}

// Per-100 g sanity bounds for an external nutrition record. These are
// enforced both at the search-adapter boundary AND again in
// externalFoodToMasterIngredient so no upstream weirdness — wrong
// units, per-serving values mislabelled as per-100g, junk Branded
// label data — can ever reach a saved master ingredient with
// physically-impossible numbers (e.g. "889 g protein per 100 g").
//
// The bounds are deliberately loose so legitimate edge cases (pure
// olive oil = 100 g fat / 100 g, salt with very high sodium, etc.)
// still pass. Anything beyond is clamped to 0 rather than the cap so
// the user notices the missing value and can investigate, instead of
// silently storing a near-cap fabricated number.
const PER_100G_BOUNDS = {
  energy: 1100,        // pure fat ≈ 900 kcal/100 g
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
  sodium: 100_000,     // mg; 100 g pure salt ≈ 39 000 mg Na
  cholesterol: 10_000, // mg; effectively unreachable
} as const;

type SanitizableFood = {
  energy?: number;
  protein?: number;
  carb?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
  totalSugar?: number;
  addedSugar?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
  polyunsaturatedFat?: number;
  transFat?: number;
  cholesterol?: number;
};

function clampField(v: unknown, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > max) return 0;
  return n;
}

/**
 * Defensively sanitise an external food record so callers can trust the
 * per-100 g values. Three guarantees after this runs:
 *
 *   1. Every nutrient field is a finite, non-negative number.
 *   2. No field exceeds its physical PER_100G_BOUNDS cap (out-of-range
 *      values are zeroed, not clamped to the cap, so the user can see
 *      the field is empty rather than carrying a fabricated near-max).
 *   3. Cross-nutrient consistency: sub-fats can't exceed total fat,
 *      sugars can't exceed carbs, added sugar can't exceed total sugar.
 *      Violations are repaired by zeroing the offending sub-fields
 *      (the parent nutrient is left intact since it's the more reliable
 *      headline number).
 *
 * Mutates and returns the same object for ergonomic call sites; safe
 * to invoke repeatedly (idempotent).
 */
export function sanitizeNutritionPer100g<T extends SanitizableFood>(food: T): T {
  food.energy = clampField(food.energy, PER_100G_BOUNDS.energy);
  food.protein = clampField(food.protein, PER_100G_BOUNDS.protein);
  food.carb = clampField(food.carb, PER_100G_BOUNDS.carb);
  food.fat = clampField(food.fat, PER_100G_BOUNDS.fat);
  food.fiber = clampField(food.fiber, PER_100G_BOUNDS.fiber);
  food.sodium = clampField(food.sodium, PER_100G_BOUNDS.sodium);
  food.totalSugar = clampField(food.totalSugar, PER_100G_BOUNDS.totalSugar);
  food.addedSugar = clampField(food.addedSugar, PER_100G_BOUNDS.addedSugar);
  food.saturatedFat = clampField(food.saturatedFat, PER_100G_BOUNDS.saturatedFat);
  food.unsaturatedFat = clampField(food.unsaturatedFat, PER_100G_BOUNDS.unsaturatedFat);
  food.polyunsaturatedFat = clampField(food.polyunsaturatedFat, PER_100G_BOUNDS.polyunsaturatedFat);
  food.transFat = clampField(food.transFat, PER_100G_BOUNDS.transFat);
  food.cholesterol = clampField(food.cholesterol, PER_100G_BOUNDS.cholesterol);

  // Cross-nutrient consistency. Each rule only fires when the PARENT
  // nutrient is present and credible — otherwise a missing parent
  // (which is common for FSANZ seed rows or partial Branded USDA
  // entries) would cause us to erase perfectly valid sub-nutrients.
  // Tolerate small rounding (5 % of parent value, minimum 0.5 g)
  // before flagging a violation — FDC's reported sub-fats often add
  // up to slightly more than total fat due to independent
  // measurements.
  const fatTotal = food.fat || 0;
  if (fatTotal > 0) {
    const subFats = (food.saturatedFat || 0) + (food.unsaturatedFat || 0) +
                    (food.polyunsaturatedFat || 0) + (food.transFat || 0);
    const fatTolerance = Math.max(0.5, fatTotal * 0.05);
    if (subFats > fatTotal + fatTolerance) {
      // Sub-fats are inconsistent with total fat — drop them rather
      // than displaying numbers that don't add up. Total fat (the
      // headline) is kept since it's reported to the FDA on every
      // label.
      food.saturatedFat = 0;
      food.unsaturatedFat = 0;
      food.polyunsaturatedFat = 0;
      food.transFat = 0;
    }
  }

  // Sugars can't exceed carbohydrates. Only enforce when carb is
  // present (>0); if carb is missing we have no parent to compare to
  // and would otherwise wipe out a valid sugar reading. Cap rather
  // than zero — a small overshoot is usually rounding, not garbage.
  const carbTotal = food.carb || 0;
  if (carbTotal > 0 && (food.totalSugar || 0) > carbTotal) {
    food.totalSugar = carbTotal;
  }
  // Added sugar ≤ total sugar — only enforce when total sugar is
  // known (>0); if total sugar is absent the parent–child relation
  // can't be evaluated.
  const totalSugar = food.totalSugar || 0;
  if (totalSugar > 0 && (food.addedSugar || 0) > totalSugar) {
    food.addedSugar = totalSugar;
  }

  return food;
}

// FSANZ data is bundled with the app. Cache after first fetch so subsequent
// searches are synchronous.
let fsanzCache: any[] | null = null;
let fsanzPromise: Promise<any[]> | null = null;

async function loadFsanz(): Promise<any[]> {
  if (fsanzCache) return fsanzCache;
  if (fsanzPromise) return fsanzPromise;
  fsanzPromise = (async () => {
    try {
      const res = await fetch('/data/fsanz-foods.json', { cache: 'force-cache' });
      if (!res.ok) {
        console.error('Failed to load FSANZ dataset:', res.status);
        fsanzCache = [];
        return fsanzCache;
      }
      const json = await res.json();
      fsanzCache = Array.isArray(json?.foods) ? json.foods : [];
      return fsanzCache;
    } catch (e) {
      console.error('FSANZ load error:', e);
      fsanzCache = [];
      return fsanzCache;
    } finally {
      fsanzPromise = null;
    }
  })();
  return fsanzPromise;
}

async function searchFsanz(query: string, limit: number): Promise<ExternalFood[]> {
  const foods = await loadFsanz();
  if (!foods.length) return [];
  const scored = foods
    .map((f: any) => {
      const score = tokenScore(query, f.name);
      return { f, score };
    })
    .filter(x => x.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ f, score }): ExternalFood => sanitizeNutritionPer100g({
      id: String(f.id),
      source: 'FSANZ',
      subSource: f.category,
      name: f.name,
      category: f.category,
      portion: f.portion || 100,
      energy: Number(f.energy) || 0,
      protein: Number(f.protein) || 0,
      carb: Number(f.carb) || 0,
      fat: Number(f.fat) || 0,
      fiber: Number(f.fiber) || 0,
      sodium: Number(f.sodium) || 0,
      // Sub-nutrients — the bundled FSANZ seed doesn't carry these, but
      // pass them through if a future regenerated dataset adds them so
      // we don't have to touch this adapter again.
      totalSugar: Number(f.totalSugar) || 0,
      addedSugar: Number(f.addedSugar) || 0,
      saturatedFat: Number(f.saturatedFat) || 0,
      unsaturatedFat: Number(f.unsaturatedFat) || 0,
      polyunsaturatedFat: Number(f.polyunsaturatedFat) || 0,
      transFat: Number(f.transFat) || 0,
      cholesterol: Number(f.cholesterol) || 0,
      allergen: (() => {
        const upstream = (f.allergen || '').trim();
        return upstream && upstream.toLowerCase() !== 'none' ? upstream : detectAllergensFromName(f.name);
      })(),
      symbol: detectSymbolFromName(f.name),
      matchScore: score,
    }));
  return scored;
}

async function searchUsda(query: string, limit: number): Promise<{ foods: ExternalFood[]; error?: string; notConfigured?: boolean }> {
  try {
    // Check the bootstrap-installed prewarm cache first. The Recipe Studio
    // bootstrap endpoint stashes server-cached USDA results for the names
    // referenced by the user's recipes on `window.__usdaPrewarm` (lower-
    // cased key → raw foods array). Hitting it skips the network call
    // entirely for the common "open a recipe with red-flagged ingredients"
    // path.
    let raw: any[] | null = null;
    if (typeof window !== 'undefined') {
      const w = window as any;
      const key = query.trim().toLowerCase();
      const hit = w.__usdaPrewarm?.get?.(key);
      if (Array.isArray(hit)) raw = hit;
    }
    if (raw === null) {
      const res = await fetch(`/api/nutrition/usda?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { foods: [], error: json?.error || `USDA lookup failed (${res.status})` };
      }
      const json = await res.json();
      if (json?.notConfigured) {
        return { foods: [], notConfigured: true };
      }
      raw = Array.isArray(json?.foods) ? json.foods : [];
    }
    const scored = raw
      .map((f: any) => ({
        f,
        score: tokenScore(query, f.name),
      }))
      .filter(x => x.score >= 25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ f, score }): ExternalFood => sanitizeNutritionPer100g({
        id: String(f.id),
        source: 'USDA',
        subSource: f.subSource,
        name: f.name,
        brand: f.brand,
        portion: f.portion || 100,
        energy: Number(f.energy) || 0,
        protein: Number(f.protein) || 0,
        carb: Number(f.carb) || 0,
        fat: Number(f.fat) || 0,
        fiber: Number(f.fiber) || 0,
        sodium: Number(f.sodium) || 0,
        // FDC reports these per-100 g for most Foundation / SR Legacy
        // foods. Branded items vary; the proxy normalises missing
        // entries to 0 so the row still renders cleanly.
        totalSugar: Number(f.totalSugar) || 0,
        addedSugar: Number(f.addedSugar) || 0,
        saturatedFat: Number(f.saturatedFat) || 0,
        unsaturatedFat: Number(f.unsaturatedFat) || 0,
        polyunsaturatedFat: Number(f.polyunsaturatedFat) || 0,
        transFat: Number(f.transFat) || 0,
        cholesterol: Number(f.cholesterol) || 0,
        // USDA never reports allergens — fall back to keyword detection
        // so the result card surfaces likely allergens to the user.
        allergen: detectAllergensFromName(f.name),
        symbol: detectSymbolFromName(f.name),
        matchScore: score,
      }));
    return { foods: scored };
  } catch (e) {
    return { foods: [], error: 'USDA lookup failed: network error' };
  }
}

export interface ExternalSearchResult {
  fsanz: ExternalFood[];
  usda: ExternalFood[];
  nin: ExternalFood[];
  japan: ExternalFood[];
  korea: ExternalFood[];
  uk: ExternalFood[];
  france: ExternalFood[];
  china: ExternalFood[];
  italy: ExternalFood[];
  // Open Food Facts — open, free, no-key public product database. Covers
  // ~3M global / branded / regional products (e.g. French biscuits like
  // Tuiles) that aren't in the curated national DBs.
  openfood: ExternalFood[];
  // AI-estimated nutrition. Only populated as a last-resort fallback when
  // every other source returned zero results. Tagged in the UI so users
  // know it's an estimate that needs verification.
  aiPredict: ExternalFood[];
  // Results from the user's own master-ingredient catalogue, scored against
  // the same query and ranked by relevance. Carried in the orchestrator so
  // every source — internal + USDA + FSANZ + NIN + JAPAN + KOREA — is fired
  // in parallel from a single call site (instead of internal happening
  // synchronously elsewhere and racing the network calls).
  internal: ExternalFood[];
  usdaError?: string;
  usdaNotConfigured?: boolean;
  fsanzError?: string;
  ninError?: string;
  japanError?: string;
  koreaError?: string;
  ukError?: string;
  franceError?: string;
  chinaError?: string;
  italyError?: string;
  openfoodError?: string;
  aiPredictError?: string;
  internalError?: string;
}

// Per-source timeout. Set high enough to absorb a slow USDA round-trip
// from the other side of the world but short enough that a hung remote
// call can't make the whole lookup feel broken.
const DEFAULT_PER_SOURCE_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} lookup timed out after ${ms}ms`)), ms);
    p.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); },
    );
  });
}

async function searchNin(query: string, limit: number): Promise<{ foods: ExternalFood[]; error?: string }> {
  try {
    const res = await fetch(`/api/nutrition/nin?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { foods: [], error: json?.error || `NIN lookup failed (${res.status})` };
    }
    const json = await res.json();
    const raw: any[] = Array.isArray(json?.foods) ? json.foods : [];
    // Re-score client-side so NIN results rank consistently alongside USDA/FSANZ.
    const scored = raw
      .map(f => ({ f, score: tokenScore(query, f.name) }))
      .filter(x => x.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ f, score }): ExternalFood => sanitizeNutritionPer100g({
        id: String(f.id),
        source: 'NIN' as ExternalSource,
        subSource: f.subSource || 'IFCT 2017',
        name: f.name,
        category: f.category,
        portion: 100,
        energy: Number(f.energy) || 0,
        protein: Number(f.protein) || 0,
        carb: Number(f.carb) || 0,
        fat: Number(f.fat) || 0,
        fiber: Number(f.fiber) || 0,
        sodium: Number(f.sodium) || 0,
        totalSugar: Number(f.totalSugar) || 0,
        addedSugar: 0,
        saturatedFat: Number(f.saturatedFat) || 0,
        unsaturatedFat: Number(f.unsaturatedFat) || 0,
        polyunsaturatedFat: Number(f.polyunsaturatedFat) || 0,
        transFat: Number(f.transFat) || 0,
        cholesterol: Number(f.cholesterol) || 0,
        allergen: f.allergen || 'None',
        symbol: (f.symbol === 'Non-Veg' ? 'Non-Veg' : 'Veg') as 'Veg' | 'Non-Veg',
        matchScore: score,
      }));
    return { foods: scored };
  } catch (e) {
    return { foods: [], error: 'NIN lookup failed: network error' };
  }
}

// Generic helper for bundled-JSON sources (Japan MEXT, Korea KFCT, UK CoFID) that
// expose the same /api/nutrition/<source>?q= contract as NIN.
async function searchBundled(
  sourceKey: 'JAPAN' | 'KOREA' | 'UK' | 'FRANCE' | 'CHINA' | 'ITALY',
  endpoint: string,
  query: string,
  limit: number,
  label: string,
): Promise<{ foods: ExternalFood[]; error?: string }> {
  try {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { foods: [], error: json?.error || `${label} lookup failed (${res.status})` };
    }
    const json = await res.json();
    const raw: any[] = Array.isArray(json?.foods) ? json.foods : [];
    const scored = raw
      .map(f => {
        // Prefer the upstream score when the API provides one (e.g.
        // Japan MEXT scores against Japanese name + English alias +
        // category, which a name-only tokenScore here would discard).
        // Fall back to a local score against the best display name.
        const upstream = Number(f.matchScore);
        const local = tokenScore(query, f.englishName || f.name);
        const score = Number.isFinite(upstream) && upstream > 0 ? upstream : local;
        return { f, score };
      })
      .filter(x => x.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ f, score }): ExternalFood => {
        // Display preference: when the API provides a translated
        // English name (currently only Japan MEXT), surface that as the
        // primary name so non-Japanese-reading users can actually read
        // the result card. The original Japanese name is preserved in
        // englishName -> nope, we keep it the other way: name shows
        // English, englishName retains the original native string for
        // traceability / debugging.
        const hasEnglish = !!(f.englishName && String(f.englishName).trim());
        const displayName = hasEnglish ? String(f.englishName).trim() : f.name;
        // Allergen detection: most bundled sources don't carry an
        // allergen field at all (Korea KFCT, China CDC, Italy CREA,
        // Japan MEXT). Fall back to keyword detection on the *English*
        // display name so eggs / fish / crustaceans / molluscs / milk /
        // gluten etc. surface on the card automatically. Keeps any
        // upstream-provided allergen string when present (UK CoFID
        // sometimes does).
        const upstreamAllergen = (f.allergen || '').trim();
        const allergen = upstreamAllergen && upstreamAllergen.toLowerCase() !== 'none'
          ? upstreamAllergen
          : detectAllergensFromName(displayName);
        return sanitizeNutritionPer100g({
          id: String(f.id),
          source: sourceKey as ExternalSource,
          subSource: f.subSource,
          name: displayName,
          englishName: hasEnglish ? f.name : undefined,
          category: f.category,
          portion: 100,
          energy: Number(f.energy) || 0,
          protein: Number(f.protein) || 0,
          carb: Number(f.carb) || 0,
          fat: Number(f.fat) || 0,
          fiber: Number(f.fiber) || 0,
          sodium: Number(f.sodium) || 0,
          totalSugar: Number(f.totalSugar) || 0,
          addedSugar: 0,
          saturatedFat: Number(f.saturatedFat) || 0,
          unsaturatedFat: Number(f.unsaturatedFat) || 0,
          polyunsaturatedFat: Number(f.polyunsaturatedFat) || 0,
          transFat: Number(f.transFat) || 0,
          cholesterol: Number(f.cholesterol) || 0,
          allergen,
          symbol: (f.symbol === 'Non-Veg' ? 'Non-Veg' : 'Veg') as 'Veg' | 'Non-Veg',
          matchScore: score,
        });
      });
    return { foods: scored };
  } catch (e) {
    return { foods: [], error: `${label} lookup failed: network error` };
  }
}

function searchJapan(query: string, limit: number) {
  return searchBundled('JAPAN', '/api/nutrition/japan', query, limit, 'Japan MEXT');
}

function searchKorea(query: string, limit: number) {
  return searchBundled('KOREA', '/api/nutrition/korea', query, limit, 'Korea KFCT');
}

function searchUK(query: string, limit: number) {
  return searchBundled('UK', '/api/nutrition/uk', query, limit, 'UK CoFID');
}

function searchFrance(query: string, limit: number) {
  return searchBundled('FRANCE', '/api/nutrition/france', query, limit, 'France Ciqual');
}

function searchChina(query: string, limit: number) {
  return searchBundled('CHINA', '/api/nutrition/china', query, limit, 'China CDC');
}

function searchItaly(query: string, limit: number) {
  return searchBundled('ITALY', '/api/nutrition/italy', query, limit, 'Italy CREA');
}

async function searchOpenFood(query: string, limit: number): Promise<{ foods: ExternalFood[]; error?: string }> {
  try {
    const res = await fetch(`/api/nutrition/openfoodfacts?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { foods: [], error: json?.error || `Open Food Facts lookup failed (${res.status})` };
    }
    const json = await res.json();
    const raw: any[] = Array.isArray(json?.foods) ? json.foods : [];
    const scored = raw
      .map((f: any) => ({ f, score: tokenScore(query, f.name) }))
      .filter(x => x.score >= 25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ f, score }): ExternalFood => sanitizeNutritionPer100g({
        id: String(f.id),
        source: 'OPENFOOD' as ExternalSource,
        subSource: f.subSource || 'Open Food Facts',
        name: f.name,
        brand: f.brand,
        category: f.category,
        portion: 100,
        energy: Number(f.energy) || 0,
        protein: Number(f.protein) || 0,
        carb: Number(f.carb) || 0,
        fat: Number(f.fat) || 0,
        fiber: Number(f.fiber) || 0,
        sodium: Number(f.sodium) || 0,
        totalSugar: Number(f.totalSugar) || 0,
        addedSugar: 0,
        saturatedFat: Number(f.saturatedFat) || 0,
        unsaturatedFat: Number(f.unsaturatedFat) || 0,
        polyunsaturatedFat: Number(f.polyunsaturatedFat) || 0,
        transFat: Number(f.transFat) || 0,
        cholesterol: Number(f.cholesterol) || 0,
        allergen: (f.allergen && f.allergen.toLowerCase() !== 'none') ? f.allergen : detectAllergensFromName(f.name),
        symbol: (f.symbol === 'Non-Veg' ? 'Non-Veg' : detectSymbolFromName(f.name)) as 'Veg' | 'Non-Veg',
        matchScore: score,
      }));
    return { foods: scored };
  } catch (e) {
    return { foods: [], error: 'Open Food Facts lookup failed: network error' };
  }
}

async function searchAiPredict(query: string): Promise<{ foods: ExternalFood[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let res: Response;
    try {
      res = await fetch('/api/nutrition/ai-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (res.status === 503) return { foods: [], error: 'AI estimate unavailable right now' };
      return { foods: [], error: `AI predict failed (${res.status})` };
    }
    const json = await res.json();
    const p = json?.prediction;
    if (!p) return { foods: [] };
    const allergen = Array.isArray(p.allergens) && p.allergens.length > 0 ? p.allergens.join(', ') : detectAllergensFromName(query);
    const food: ExternalFood = sanitizeNutritionPer100g({
      id: `AI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: 'AI' as ExternalSource,
      subSource: 'AI estimate (verify before saving)',
      name: query,
      portion: 100,
      energy: Number(p.energy) || 0,
      protein: Number(p.protein) || 0,
      carb: Number(p.carb) || 0,
      fat: Number(p.fat) || 0,
      fiber: Number(p.fiber) || 0,
      sodium: Number(p.sodium) || 0,
      totalSugar: Number(p.totalSugar) || 0,
      addedSugar: 0,
      saturatedFat: Number(p.saturatedFat) || 0,
      unsaturatedFat: 0,
      polyunsaturatedFat: 0,
      transFat: Number(p.transFat) || 0,
      cholesterol: Number(p.cholesterol) || 0,
      allergen,
      symbol: (p.symbol === 'Non-Veg' ? 'Non-Veg' : detectSymbolFromName(query)) as 'Veg' | 'Non-Veg',
      matchScore: 50,
    });
    return { foods: [food] };
  } catch (e) {
    return { foods: [], error: 'AI predict failed: network error' };
  }
}

export interface SearchExternalOptions {
  perSource?: number;
  sources?: ExternalSource[];
  timeoutMs?: number;
  // Optional callback that runs the local master-ingredient match for the
  // same query. Provided by callers (e.g. Recipe Studio) so the
  // orchestrator can fire it in parallel with USDA / FSANZ / NIN and
  // stream its result alongside theirs. Returns ExternalFood[] so it
  // slots straight into the merged result shape.
  internalSearch?: (query: string) => Promise<ExternalFood[]>;
  // Set to false to skip the AI-predict tail task entirely. Default is
  // true — the UI gates whether to actually render the AI estimate based
  // on whether every real DB returned zero results.
  aiFallback?: boolean;
}

/**
 * Streaming variant of `searchExternal`: fires every requested source in
 * parallel and invokes `onPartial` as each one settles, so the UI can
 * progressively render results without blocking on the slowest source.
 *
 * Per-source errors and timeouts are isolated — a USDA failure never
 * affects FSANZ (and vice-versa). The caller still gets a final
 * Promise it can await for "everything's done" semantics.
 */
export async function searchExternalStream(
  query: string,
  options: SearchExternalOptions,
  onPartial: (partial: Partial<ExternalSearchResult>) => void,
): Promise<void> {
  const perSource = options.perSource ?? 50;
  const sources = options.sources ?? ['NIN', 'JAPAN', 'KOREA', 'CHINA', 'UK', 'FRANCE', 'ITALY', 'USDA', 'FSANZ', 'OPENFOOD'];
  const timeoutMs = options.timeoutMs ?? DEFAULT_PER_SOURCE_TIMEOUT_MS;
  const q = (query || '').trim();
  if (!q) return;

  const tasks: Promise<void>[] = [];

  if (options.internalSearch) {
    tasks.push(
      withTimeout(options.internalSearch(q), timeoutMs, 'Internal')
        .then(foods => onPartial({ internal: foods }))
        .catch(e => {
          console.warn('Internal lookup failed:', e);
          onPartial({ internal: [], internalError: 'Internal lookup failed' });
        }),
    );
  }

  if (sources.includes('NIN')) {
    tasks.push(
      withTimeout(searchNin(q, perSource), timeoutMs, 'NIN')
        .then(r => onPartial({ nin: r.foods, ninError: r.error }))
        .catch(e => {
          console.warn('NIN lookup failed:', e);
          onPartial({ nin: [], ninError: 'NIN lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('JAPAN')) {
    tasks.push(
      withTimeout(searchJapan(q, perSource), timeoutMs, 'Japan MEXT')
        .then(r => onPartial({ japan: r.foods, japanError: r.error }))
        .catch(e => {
          console.warn('Japan MEXT lookup failed:', e);
          onPartial({ japan: [], japanError: 'Japan MEXT lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('KOREA')) {
    tasks.push(
      withTimeout(searchKorea(q, perSource), timeoutMs, 'Korea KFCT')
        .then(r => onPartial({ korea: r.foods, koreaError: r.error }))
        .catch(e => {
          console.warn('Korea KFCT lookup failed:', e);
          onPartial({ korea: [], koreaError: 'Korea KFCT lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('UK')) {
    tasks.push(
      withTimeout(searchUK(q, perSource), timeoutMs, 'UK CoFID')
        .then(r => onPartial({ uk: r.foods, ukError: r.error }))
        .catch(e => {
          console.warn('UK CoFID lookup failed:', e);
          onPartial({ uk: [], ukError: 'UK CoFID lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('FRANCE')) {
    tasks.push(
      withTimeout(searchFrance(q, perSource), timeoutMs, 'France Ciqual')
        .then(r => onPartial({ france: r.foods, franceError: r.error }))
        .catch(e => {
          console.warn('France Ciqual lookup failed:', e);
          onPartial({ france: [], franceError: 'France Ciqual lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('CHINA')) {
    tasks.push(
      withTimeout(searchChina(q, perSource), timeoutMs, 'China CDC')
        .then(r => onPartial({ china: r.foods, chinaError: r.error }))
        .catch(e => {
          console.warn('China CDC lookup failed:', e);
          onPartial({ china: [], chinaError: 'China CDC lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('ITALY')) {
    tasks.push(
      withTimeout(searchItaly(q, perSource), timeoutMs, 'Italy CREA')
        .then(r => onPartial({ italy: r.foods, italyError: r.error }))
        .catch(e => {
          console.warn('Italy CREA lookup failed:', e);
          onPartial({ italy: [], italyError: 'Italy CREA lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('FSANZ')) {
    tasks.push(
      withTimeout(searchFsanz(q, perSource), timeoutMs, 'FSANZ')
        .then(foods => onPartial({ fsanz: foods }))
        .catch(e => {
          console.warn('FSANZ lookup failed:', e);
          onPartial({ fsanz: [], fsanzError: 'FSANZ lookup failed (timeout or load error)' });
        }),
    );
  }

  if (sources.includes('USDA')) {
    tasks.push(
      withTimeout(searchUsda(q, perSource), timeoutMs, 'USDA')
        .then(r => onPartial({
          usda: r.foods,
          usdaError: r.error,
          usdaNotConfigured: r.notConfigured,
        }))
        .catch(e => {
          console.warn('USDA lookup failed:', e);
          onPartial({ usda: [], usdaError: 'USDA lookup failed (timeout or network)' });
        }),
    );
  }

  if (sources.includes('OPENFOOD')) {
    tasks.push(
      withTimeout(searchOpenFood(q, perSource), timeoutMs + 2000, 'Open Food Facts')
        .then(r => onPartial({ openfood: r.foods, openfoodError: r.error }))
        .catch(e => {
          console.warn('Open Food Facts lookup failed:', e);
          onPartial({ openfood: [], openfoodError: 'Open Food Facts lookup failed (timeout or network)' });
        }),
    );
  }

  await Promise.allSettled(tasks);

  // AI predict fallback: fire as a tail task so it never blocks the main
  // result render. We don't know the aggregate from inside this function,
  // so we run AI whenever the explicit opt-out flag isn't set, and let the
  // UI gate visibility on "all real sources empty". Callers that don't
  // want AI suggestions at all can pass `aiFallback: false`.
  if (options.aiFallback !== false) {
    try {
      const aiRes = await withTimeout(searchAiPredict(q), 8000, 'AI predict');
      onPartial({ aiPredict: aiRes.foods, aiPredictError: aiRes.error });
    } catch (e) {
      onPartial({ aiPredict: [], aiPredictError: 'AI estimate unavailable' });
    }
  }
}

export async function searchExternal(
  query: string,
  options: SearchExternalOptions = {},
): Promise<ExternalSearchResult> {
  // Default cap raised so users see the long tail of obscure entries
  // (e.g. multiple truffle sub-varieties) rather than only the top 10.
  const merged: ExternalSearchResult = { fsanz: [], usda: [], nin: [], japan: [], korea: [], uk: [], france: [], china: [], italy: [], openfood: [], aiPredict: [], internal: [] };
  await searchExternalStream(query, options, partial => {
    Object.assign(merged, partial);
  });
  return merged;
}

// EU Top 14 allergen keyword map. Keys must match the labels in the
// ALLERGEN_OPTIONS dropdown (RecipeCalculation.tsx) so the auto-detected
// values populate the UI cleanly without needing a translation step.
//
// Keyword matching is intentionally substring-based (not word-boundary)
// because USDA names commonly compound things like "wheatberries" or
// "almondmilk" and we'd rather over-tag than miss. The user can clear
// any false positive with one click on the allergen pill.
const EU_ALLERGEN_KEYWORDS: { allergen: string; keywords: string[] }[] = [
  { allergen: 'Gluten',                     keywords: ['wheat', 'rye', 'barley', 'oat', 'spelt', 'kamut', 'bulgur', 'semolina', 'farro', 'durum', 'triticale', 'flour', 'bread', 'pasta', 'noodle', 'couscous', 'seitan', 'malt'] },
  { allergen: 'Crustaceans',                keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'langoustine', 'krill'] },
  { allergen: 'Eggs',                       keywords: ['egg', 'albumin', 'ovalbumin', 'meringue', 'mayonnaise'] },
  { allergen: 'Fish',                       keywords: ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'sardine', 'anchovy', 'mackerel', 'trout', 'herring', 'tilapia', 'pollock', 'snapper', 'bass', 'sole', 'halibut', 'perch', 'pike', 'carp'] },
  { allergen: 'Peanuts',                    keywords: ['peanut', 'groundnut'] },
  { allergen: 'Soy',                        keywords: ['soy', 'soya', 'tofu', 'edamame', 'tempeh', 'miso', 'natto'] },
  { allergen: 'Milk',                       keywords: ['milk', 'butter', 'cheese', 'yogurt', 'yoghurt', 'cream', 'whey', 'casein', 'lactose', 'ghee', 'curd', 'paneer', 'dairy', 'kefir', 'custard', 'condensed', 'evaporated'] },
  { allergen: 'Nuts',                       keywords: ['almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'brazil nut', 'pistachio', 'macadamia', 'chestnut', 'pine nut', 'pinenut'] },
  { allergen: 'Celery',                     keywords: ['celery', 'celeriac'] },
  { allergen: 'Mustard',                    keywords: ['mustard'] },
  { allergen: 'Sesame',                     keywords: ['sesame', 'tahini', 'gomashio'] },
  { allergen: 'Sulphur dioxide/sulphites',  keywords: ['sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide'] },
  { allergen: 'Lupin',                      keywords: ['lupin', 'lupine'] },
  { allergen: 'Molluscs',                   keywords: ['mollusc', 'mollusk', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'octopus', 'cuttlefish', 'snail', 'abalone'] },
];

// Best-effort Veg / Non-Veg classification by scanning the food name for
// common animal-product keywords. Returns 'Non-Veg' on any hit, 'Veg'
// otherwise. Kept conservative so that imported produce / spices / dairy
// stay Veg by default — the user can always flip the symbol in one click.
const NON_VEG_HINTS = [
  'chicken', 'beef', 'pork', 'mutton', 'lamb', 'turkey', 'duck', 'goose',
  'fish', 'salmon', 'tuna', 'cod', 'prawn', 'shrimp', 'crab', 'lobster',
  'oyster', 'mussel', 'clam', 'squid', 'octopus', 'mince', 'sausage',
  'bacon', 'ham', 'meat', 'liver', 'kidney', 'tripe', 'venison', 'rabbit',
  'anchovy', 'sardine', 'mackerel', 'haddock', 'trout', 'herring',
  'tilapia', 'pollock', 'snapper', 'scallop', 'caviar', 'roe',
  'egg, hen', 'whole egg', 'egg white', 'egg yolk',
];

/**
 * Best-effort Veg / Non-Veg classifier exported so callers can render
 * the FSSAI symbol on imported foods without duplicating the keyword list.
 */
export function detectSymbolFromName(name: string): 'Veg' | 'Non-Veg' {
  if (!name) return 'Veg';
  const lower = name.toLowerCase();
  return NON_VEG_HINTS.some(h => lower.includes(h)) ? 'Non-Veg' : 'Veg';
}

/**
 * Detect EU Top 14 allergens by scanning a free-text food name for
 * known keywords. Returns a comma-separated list (matching the
 * existing allergen storage convention) or 'None' when nothing matches.
 *
 * Exported so the manual ingredient-add path in the UI can call it too.
 */
export function detectAllergensFromName(name: string): string {
  if (!name) return 'None';
  const lower = name.toLowerCase();
  const found: string[] = [];
  for (const { allergen, keywords } of EU_ALLERGEN_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) {
      if (!found.includes(allergen)) found.push(allergen);
    }
  }
  return found.length > 0 ? found.join(', ') : 'None';
}

// ---------------------------------------------------------------------------
// Allergen bit registry
// ---------------------------------------------------------------------------
// Each EU Top 14 allergen gets a stable bit index so recipe-wide aggregation
// can OR masks together in a single pass instead of building Sets of strings.
// Text remains the canonical persisted form; masks are an in-memory derivation
// computed on demand and cached by raw text key.

export const ALLERGEN_BITS: Readonly<Record<string, number>> = (() => {
  const out: Record<string, number> = {};
  EU_ALLERGEN_KEYWORDS.forEach(({ allergen }, i) => {
    out[allergen] = 1 << i;
  });
  return out;
})();

const KNOWN_ALLERGENS_BY_BIT: readonly string[] = EU_ALLERGEN_KEYWORDS.map(k => k.allergen);

export interface AllergenMask {
  /** OR of bit flags for EU Top 14 allergens present. */
  mask: number;
  /** Allergen names not in the EU14 registry, preserved verbatim. */
  extras: string[];
}

/** Parse a comma-separated allergen text into a mask + extras. */
export function allergenTextToMask(text: string | undefined | null): AllergenMask {
  if (!text || text === 'None' || text === '-') return { mask: 0, extras: [] };
  let mask = 0;
  const extras: string[] = [];
  for (const part of text.split(',')) {
    const t = part.trim();
    if (!t || t === 'None') continue;
    const bit = ALLERGEN_BITS[t];
    if (bit !== undefined) mask |= bit;
    else if (!extras.includes(t)) extras.push(t);
  }
  return { mask, extras };
}

/**
 * Convert a mask + extras back to the canonical comma-separated display text.
 *
 * Ordering note: EU14 allergens are emitted in stable bit-index (registry)
 * order, then any custom (non-EU14) names follow in first-seen order. This
 * differs from the prior Set-based rollup which emitted EU14 names in
 * whichever order the first ingredient string introduced them. The set of
 * allergens is identical; only the comma order is canonicalised.
 */
export function allergenMaskToText(m: AllergenMask): string {
  const out: string[] = [];
  for (let i = 0; i < KNOWN_ALLERGENS_BY_BIT.length; i++) {
    if (m.mask & (1 << i)) out.push(KNOWN_ALLERGENS_BY_BIT[i]);
  }
  if (m.extras.length) out.push(...m.extras);
  return out.length > 0 ? out.join(', ') : 'None';
}

// Process-wide cache: identical allergen-text strings (the common case across
// many ingredients sharing the same allergen list) reuse the same parsed mask.
// Bounded so a long-running session can't grow it unboundedly if every row had
// a unique string.
const ALLERGEN_MASK_CACHE = new Map<string, AllergenMask>();
const ALLERGEN_MASK_CACHE_LIMIT = 2048;

/** Memoised variant of allergenTextToMask keyed by the raw input string. */
export function getAllergenMask(text: string | undefined | null): AllergenMask {
  const key = text || '';
  const hit = ALLERGEN_MASK_CACHE.get(key);
  if (hit) return hit;
  const computed = allergenTextToMask(key);
  if (ALLERGEN_MASK_CACHE.size >= ALLERGEN_MASK_CACHE_LIMIT) {
    // Drop the oldest entry to keep the cache bounded.
    const firstKey = ALLERGEN_MASK_CACHE.keys().next().value;
    if (firstKey !== undefined) ALLERGEN_MASK_CACHE.delete(firstKey);
  }
  ALLERGEN_MASK_CACHE.set(key, computed);
  return computed;
}

// Helper: turn an ExternalFood into a partial MasterIngredient suitable for
// POSTing to /api/ingredients. The caller adds the id + createdOn.
export function externalFoodToMasterIngredient(food: ExternalFood) {
  // Both `symbol` and `allergen` are now populated upstream by the search
  // adapters (using detectSymbolFromName / detectAllergensFromName) so the
  // result cards can already render them. Re-derive defensively here in
  // case a caller hand-builds an ExternalFood without those fields.
  const symbol = food.symbol || detectSymbolFromName(food.name);
  const upstreamAllergen = (food.allergen || '').trim();
  const allergen = upstreamAllergen && upstreamAllergen.toLowerCase() !== 'none'
    ? upstreamAllergen
    : detectAllergensFromName(food.name);
  // Belt-and-suspenders: sanitise once more right before this becomes a
  // saved master ingredient. The search adapters already sanitise the
  // ExternalFood, but a future caller could hand-build one (e.g.
  // bootstrap prewarm bypassing the adapter), and we never want
  // physically-impossible numbers landing in the master catalogue.
  const safe = sanitizeNutritionPer100g({
    energy: food.energy,
    protein: food.protein,
    carb: food.carb,
    fat: food.fat,
    fiber: food.fiber,
    sodium: food.sodium,
    totalSugar: food.totalSugar,
    addedSugar: food.addedSugar,
    saturatedFat: food.saturatedFat,
    unsaturatedFat: food.unsaturatedFat,
    polyunsaturatedFat: food.polyunsaturatedFat,
    transFat: food.transFat,
    cholesterol: food.cholesterol,
  });
  return {
    name: food.name,
    symbol,
    keyword: '',
    // Most external sources ('USDA', 'FSANZ', 'NIN', ...) already match
    // REFERENCE_OPTIONS verbatim. The 'INTERNAL' source (used when the
    // user picks one of their own saved sub-recipes from the recipe-data
    // panel) needs to be normalized to the canonical 'Internal Recipe'
    // label so reference dropdowns / sorting / filters stay consistent.
    refrence: food.source === 'INTERNAL' ? 'Internal Recipe' : food.source,
    allergen,
    portion: food.portion || 100,
    energy: safe.energy,
    protein: safe.protein,
    carb: safe.carb,
    fat: safe.fat,
    // Sub-nutrients now flow through from the source instead of being
    // hard-coded to 0. When the upstream record doesn't report a field
    // (e.g. FSANZ seed, some Branded USDA items) it defaults to 0
    // upstream, so the row still saves cleanly and the user can edit
    // the master ingredient later to fill it in.
    totalSugar: safe.totalSugar,
    addedSugar: safe.addedSugar,
    saturatedFat: safe.saturatedFat,
    unsaturatedFat: safe.unsaturatedFat,
    polyunsaturatedFat: safe.polyunsaturatedFat,
    transFat: safe.transFat,
    fiber: safe.fiber,
    cholesterol: safe.cholesterol,
    sodium: safe.sodium,
    status: 'active' as const,
  };
}
