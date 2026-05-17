// Server-side helper that asks Gemini to predict approximate per-100g
// nutrition for an ingredient name. Mirrors the pattern used in
// `app/api/rewrite/route.ts` (`tryGemini`) so the env var lookup, model
// choice, and JSON-extraction quirks stay consistent across the app.
//
// All failure modes (missing API key, network error, malformed response)
// resolve to `null` so callers can silently fall back to their existing
// non-AI flow without surfacing a Gemini-specific error to the user.

export type AINutritionPrediction = {
  energy: number;        // kcal per 100g
  protein: number;       // g
  carb: number;          // g
  fat: number;           // g
  totalSugar: number;    // g
  saturatedFat: number;  // g
  transFat: number;      // g
  fiber: number;         // g
  sodium: number;        // mg
  cholesterol: number;   // mg
  allergens: string[];   // labels from EU Top 14 (matching ALLERGEN_OPTIONS)
  symbol: 'Veg' | 'Non-Veg';
};

const ALLOWED_ALLERGENS = new Set([
  'Gluten', 'Crustaceans', 'Eggs', 'Fish', 'Peanuts', 'Soy', 'Milk',
  'Nuts', 'Celery', 'Mustard', 'Sesame', 'Sulphur dioxide/sulphites',
  'Lupin', 'Molluscs',
]);

const PREDICT_PROMPT = (name: string) => `You are a food nutrition expert. Predict approximate per-100g nutrition values for the food ingredient: "${name}".

Rules:
- Return ONLY a JSON object — no markdown, no code fences, no commentary.
- All numeric values are per 100g of the raw / typical form of this ingredient.
- Energy in kcal. Macros + sub-nutrients in grams. Sodium and cholesterol in milligrams.
- If unsure of a sub-nutrient, give your best approximate value (do not return null).
- Allergens MUST be a subset of: ["Gluten","Crustaceans","Eggs","Fish","Peanuts","Soy","Milk","Nuts","Celery","Mustard","Sesame","Sulphur dioxide/sulphites","Lupin","Molluscs"]. Use [] when none apply.
- Symbol is "Non-Veg" when the ingredient is meat, poultry, fish, seafood, whole eggs, or any animal flesh; otherwise "Veg".

Return EXACTLY this JSON shape:
{"energy":0,"protein":0,"carb":0,"fat":0,"totalSugar":0,"saturatedFat":0,"transFat":0,"fiber":0,"sodium":0,"cholesterol":0,"allergens":[],"symbol":"Veg"}

Ingredient: ${name}`;

function extractJson(raw: string | undefined | null): any | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function toNumber(v: any): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function predictNutritionWithAI(
  name: string,
): Promise<AINutritionPrediction | null> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: PREDICT_PROMPT(trimmed),
    });
    const parsed = extractJson(response?.text);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Number.isFinite(Number(parsed.energy))) return null;
    const allergens: string[] = Array.isArray(parsed.allergens)
      ? parsed.allergens
          .filter((a: any) => typeof a === 'string')
          .map((a: string) => a.trim())
          .filter((a: string) => ALLOWED_ALLERGENS.has(a))
      : [];
    const symbol: 'Veg' | 'Non-Veg' = parsed.symbol === 'Non-Veg' ? 'Non-Veg' : 'Veg';
    return {
      energy: toNumber(parsed.energy),
      protein: toNumber(parsed.protein),
      carb: toNumber(parsed.carb),
      fat: toNumber(parsed.fat),
      totalSugar: toNumber(parsed.totalSugar),
      saturatedFat: toNumber(parsed.saturatedFat),
      transFat: toNumber(parsed.transFat),
      fiber: toNumber(parsed.fiber),
      sodium: toNumber(parsed.sodium),
      cholesterol: toNumber(parsed.cholesterol),
      allergens,
      symbol,
    };
  } catch {
    return null;
  }
}
