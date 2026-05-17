import { NextRequest, NextResponse } from 'next/server';
import {
  readIngredientAliases,
  writeIngredientAliases,
  scrapeGoogleAliases,
} from '@/lib/ingredientAliasesCache';

// GET /api/ingredient-aliases?name=Taquan
//
// Returns: { aliases: string[], corrected: string | null, cached: boolean }
//
// Lazy, DB-cached Google scrape. Empty results are still cached so the
// frontend doesn't keep retrying for unknown names. Errors return an
// empty payload (never throw to the caller) — the alias row is purely
// informational.

export const dynamic = 'force-dynamic';

// In-flight de-dupe so 30 cards mounting at once don't fire 30 scrapes
// for the same name (the DB cache covers across-process repeats; this
// covers within-process simultaneous mounts before the first write).
const inflight = new Map<string, Promise<{ aliases: string[]; corrected: string | null }>>();

export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get('name') || '').trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ aliases: [], corrected: null, cached: false });
  }

  const cached = await readIngredientAliases(name);
  if (cached) {
    return NextResponse.json({ aliases: cached.aliases, corrected: cached.corrected, cached: true });
  }

  const key = name.toLowerCase();
  let promise = inflight.get(key);
  if (!promise) {
    promise = (async () => {
      const result = await scrapeGoogleAliases(name);
      // Persist even when empty so the UI doesn't re-fire forever for
      // names Google has nothing for.
      await writeIngredientAliases(name, result);
      return result;
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
  }

  const result = await promise;
  return NextResponse.json({ aliases: result.aliases, corrected: result.corrected, cached: false });
}
