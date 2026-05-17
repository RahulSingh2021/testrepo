import { NextRequest, NextResponse } from 'next/server';

// Server-side NIN / ICMR nutrition lookup.
// Data source: IFCT 2017 (Indian Food Composition Tables) published by the
// National Institute of Nutrition, Hyderabad. Provided via the `ifct2017`
// npm package — no API key required, data is bundled.
//
// 528 key Indian foods × 151 nutrients, all per 100 g edible portion.
// INFOODS tag reference: https://www.fao.org/infoods/infoods/standards-guidelines/food-component-identifiers-tagnames/en/

// ifct2017 is a CommonJS module — must be required (not ESM-imported).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ifct2017 = require('ifct2017');

type NinFood = {
  id: string;
  source: 'NIN';
  subSource: string;
  name: string;
  scientificName?: string;
  category?: string;
  portion: number;
  energy: number;       // kcal / 100 g
  protein: number;      // g   / 100 g
  carb: number;         // g   / 100 g (available carbohydrate, by difference)
  fat: number;          // g   / 100 g
  fiber: number;        // g   / 100 g
  sodium: number;       // mg  / 100 g
  totalSugar: number;   // g   / 100 g (free sugars)
  addedSugar: number;   // g   / 100 g (not reported by IFCT — always 0)
  saturatedFat: number; // g   / 100 g
  unsaturatedFat: number;       // g / 100 g  (mono: fams)
  polyunsaturatedFat: number;   // g / 100 g  (fapu)
  transFat: number;     // g   / 100 g
  cholesterol: number;  // mg  / 100 g (cholc × 1000 — IFCT reports g/100 g)
  allergen: string;
  symbol: 'Veg' | 'Non-Veg';
};

// EU Top 14 allergen keywords — same list as in externalNutritionLookup.ts
// so NIN result cards show auto-detected allergens without needing the client.
const EU_ALLERGEN_KEYWORDS: { allergen: string; keywords: string[] }[] = [
  { allergen: 'Gluten',                    keywords: ['wheat', 'rye', 'barley', 'oat', 'spelt', 'kamut', 'bulgur', 'semolina', 'farro', 'durum', 'triticale', 'flour', 'bread', 'pasta', 'noodle', 'couscous', 'seitan', 'malt'] },
  { allergen: 'Crustaceans',               keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'langoustine', 'krill'] },
  { allergen: 'Eggs',                      keywords: ['egg', 'albumin', 'ovalbumin', 'meringue', 'mayonnaise'] },
  { allergen: 'Fish',                      keywords: ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'sardine', 'anchovy', 'mackerel', 'trout', 'herring', 'tilapia', 'pollock', 'snapper', 'bass', 'sole', 'halibut', 'perch', 'pike', 'carp'] },
  { allergen: 'Peanuts',                   keywords: ['peanut', 'groundnut'] },
  { allergen: 'Soy',                       keywords: ['soy', 'soya', 'tofu', 'edamame', 'tempeh', 'miso', 'natto'] },
  { allergen: 'Milk',                      keywords: ['milk', 'butter', 'cheese', 'yogurt', 'yoghurt', 'cream', 'whey', 'casein', 'lactose', 'ghee', 'curd', 'paneer', 'dairy', 'kefir', 'custard', 'condensed', 'evaporated'] },
  { allergen: 'Nuts',                      keywords: ['almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'brazil nut', 'pistachio', 'macadamia', 'chestnut', 'pine nut', 'pinenut'] },
  { allergen: 'Celery',                    keywords: ['celery', 'celeriac'] },
  { allergen: 'Mustard',                   keywords: ['mustard'] },
  { allergen: 'Sesame',                    keywords: ['sesame', 'tahini', 'gomashio'] },
  { allergen: 'Sulphur dioxide/sulphites', keywords: ['sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide'] },
  { allergen: 'Lupin',                     keywords: ['lupin', 'lupine'] },
  { allergen: 'Molluscs',                  keywords: ['mollusc', 'mollusk', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'octopus', 'cuttlefish', 'snail', 'abalone'] },
];

function detectAllergens(name: string): string {
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

function detectSymbol(name: string, tags: string): 'Veg' | 'Non-Veg' {
  const t = (tags || '').toLowerCase();
  if (t.includes('nonveg')) return 'Non-Veg';
  // Double-check name for fish/meat keywords
  const NON_VEG = ['chicken', 'beef', 'pork', 'mutton', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'lobster', 'oyster', 'mussel', 'squid', 'meat', 'liver', 'kidney', 'bacon', 'ham', 'sausage', 'mince', 'anchovy', 'sardine', 'mackerel', 'egg, hen', 'whole egg', 'egg white', 'egg yolk'];
  const lower = (name || '').toLowerCase();
  if (NON_VEG.some(h => lower.includes(h))) return 'Non-Veg';
  return 'Veg';
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Load state — the ifct2017 corpus is loaded once per process and then
// cached. The compositions.load() call is idempotent; subsequent calls
// return immediately. We track a promise to avoid parallel loads.
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = ifct2017.compositions.load();
  }
  return loadPromise;
}

function normaliseFood(raw: any, matchScore: number): NinFood {
  // enerc is in kJ/100g → convert to kcal (1 kcal = 4.184 kJ)
  const energyKcal = Math.round(safeNum(raw.enerc) / 4.184);

  // cholc is reported in g/100g by IFCT — convert to mg/100g so it is
  // consistent with the rest of the app (which stores cholesterol in mg).
  const cholesterolMg = Math.round(safeNum(raw.cholc) * 1000);

  // na is in g/100g in IFCT 2017 (same as other minerals like ca, fe, k).
  // Multiply by 1000 to convert to mg/100g.
  const sodiumMg = safeNum(raw.na) * 1000;

  const name = (raw.name || '').toString().trim();
  const tags = (raw.tags || '').toString();

  return {
    id: `NIN-${raw.code}`,
    source: 'NIN',
    subSource: (raw.grup || 'IFCT 2017').toString(),
    name,
    scientificName: raw.scie || undefined,
    category: raw.grup || undefined,
    portion: 100,
    energy: energyKcal,
    protein: safeNum(raw.protcnt),
    carb: safeNum(raw.choavldf),
    fat: safeNum(raw.fatce),
    fiber: safeNum(raw.fibtg),
    sodium: sodiumMg,
    totalSugar: safeNum(raw.fsugar),
    addedSugar: 0,            // IFCT 2017 does not report added sugar separately
    saturatedFat: safeNum(raw.fasat),
    unsaturatedFat: safeNum(raw.fams),       // MUFA
    polyunsaturatedFat: safeNum(raw.fapu),   // PUFA
    transFat: safeNum(raw.fatrn),
    cholesterol: cholesterolMg,
    allergen: detectAllergens(name),
    symbol: detectSymbol(name, tags),
  };
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ foods: [] });

  try {
    await ensureLoaded();
  } catch (e) {
    console.error('[NIN] Failed to load ifct2017 corpus:', e);
    return NextResponse.json({ error: 'NIN data failed to load', detail: String(e) }, { status: 502 });
  }

  let raw: any[];
  try {
    raw = ifct2017.compositions(q);
    if (!Array.isArray(raw)) raw = raw ? [raw] : [];
  } catch (e) {
    console.error('[NIN] compositions() threw:', e);
    return NextResponse.json({ foods: [] });
  }

  // The ifct2017 library searches by name / language / code internally.
  // All results it returns are relevant; we attach a rough match score
  // (exact name match wins, then descending to partial substring hits)
  // so the client-side scorer can blend NIN, USDA, and FSANZ results.
  const lowerQ = q.toLowerCase();
  const foods: NinFood[] = raw
    .filter((f): f is any => f && typeof f === 'object')
    .map(f => {
      const nameLower = (f.name || '').toLowerCase();
      let score = 50;
      if (nameLower === lowerQ) score = 100;
      else if (nameLower.startsWith(lowerQ)) score = 85;
      else if (nameLower.includes(lowerQ)) score = 70;
      return normaliseFood(f, score);
    })
    // Per-100g sanity check: drop entries where ALL macros are zero
    // (indicates a data gap or a non-food code entry).
    .filter(f => f.energy > 0 || f.protein > 0 || f.carb > 0 || f.fat > 0);

  return NextResponse.json({ foods });
}
