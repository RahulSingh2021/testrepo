import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function runRecovery(): Promise<any> {
  const imageEntries: { text: string; location: string; image: string }[] = [];

  try {
    const reports = await sql`SELECT id, type, data FROM audit_reports 
      WHERE data->>'unitName' ILIKE '%jai mahal%' 
        AND LENGTH(data::text) > 10000`;

    for (const report of (reports || [])) {
      const reportData = report.data;
      if (!reportData) continue;
      const comments = reportData.comments;
      if (!comments || typeof comments !== 'object') continue;

      let entryCount = 0;
      for (const [, commentData] of Object.entries(comments as Record<string, any>)) {
        const entries = (commentData as any)?.entries;
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (!entry || !entry.text) continue;
          const images = entry.images;
          if (!Array.isArray(images) || images.length === 0) continue;
          for (const imgItem of images) {
            const img = typeof imgItem === 'string' ? imgItem : imgItem?.url || imgItem?.data || '';
            if (!img || img.length < 100) continue;
            imageEntries.push({
              text: entry.text.trim(),
              location: (entry.location || '').trim(),
              image: img,
            });
          }
          entryCount++;
        }
      }
      console.log(`[recover] Report ${report.id} (${report.type}): ${entryCount} entries with images`);
    }
  } catch (e) {
    console.error(`[recover] Error reading audit reports:`, e);
  }

  console.log(`[recover] Total image entries found: ${imageEntries.length}`);

  if (imageEntries.length === 0) {
    return { success: false, message: 'No image entries found in audit reports', imageEntriesFound: 0 };
  }

  const obsRows = await sql`SELECT id, data FROM observations 
    WHERE data->>'unitName' ILIKE '%jai mahal%'
      AND (data->>'thumbnail' = '' OR data->>'thumbnail' IS NULL OR LENGTH(data->>'thumbnail') < 10)
      AND data->>'observationText' IS NOT NULL 
      AND data->>'observationText' != ''`;

  console.log(`[recover] Found ${obsRows?.length || 0} observations without images`);

  let recovered = 0;
  let skipped = 0;
  const matched: { obsId: string; entryText: string; area: string }[] = [];

  for (const obs of (obsRows || [])) {
    const obsData = obs.data || {};
    const obsText = (obsData.observationText || '').trim();
    const obsArea = (obsData.area || '').trim().toLowerCase();
    if (!obsText) { skipped++; continue; }

    const obsTextParts = obsText.split(';').map((p: string) => p.trim()).filter((p: string) => p.length > 3);
    const firstPart = obsTextParts[0] || obsText;

    let bestMatch: { text: string; location: string; image: string } | null = null;
    let bestScore = 0;

    for (const entry of imageEntries) {
      const entryLoc = entry.location.toLowerCase();
      const locationMatch = !entryLoc || !obsArea || 
        obsArea.includes(entryLoc) || entryLoc.includes(obsArea) || 
        obsArea.replace(/[\s-]+/g, '') === entryLoc.replace(/[\s-]+/g, '');

      if (firstPart === entry.text && locationMatch) {
        bestMatch = entry;
        bestScore = 100;
        break;
      }

      if (firstPart === entry.text) {
        if (bestScore < 90) { bestMatch = entry; bestScore = 90; }
        continue;
      }

      if (obsText.includes(entry.text) && locationMatch) {
        const score = 50 + entry.text.length;
        if (score > bestScore) { bestMatch = entry; bestScore = score; }
      }

      if (entry.text.length > 10 && firstPart.length > 10) {
        const prefix = entry.text.substring(0, Math.min(35, entry.text.length));
        if (firstPart.startsWith(prefix) && locationMatch) {
          const score = 40 + prefix.length;
          if (score > bestScore) { bestMatch = entry; bestScore = score; }
        }
        if (firstPart.startsWith(prefix)) {
          const score = 30 + prefix.length;
          if (score > bestScore) { bestMatch = entry; bestScore = score; }
        }
      }
    }

    if (bestMatch && bestScore >= 30) {
      try {
        const imgData = bestMatch.image;
        const allImgs = imageEntries
          .filter(e => e.text === bestMatch!.text && e.location === bestMatch!.location)
          .map(e => e.image);
        const updateData = JSON.stringify({ 
          thumbnail: imgData, 
          allEvidence: allImgs.length > 0 ? allImgs : [imgData] 
        });
        await sql`UPDATE observations SET data = data || ${updateData}::jsonb, updated_at = NOW() WHERE id = ${obs.id}`;
        recovered++;
        matched.push({ obsId: obs.id, entryText: bestMatch.text.substring(0, 60), area: obsArea });
      } catch (e) {
        console.error(`[recover] Failed to update ${obs.id}:`, e);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`[recover] Recovery complete: ${recovered} recovered, ${skipped} unmatched`);

  return {
    success: true,
    imageEntriesFound: imageEntries.length,
    observationsWithoutImages: (obsRows || []).length,
    recovered,
    skipped,
    sampleMatches: matched.slice(0, 50),
  };
}

export async function POST(request: NextRequest) {
  try {
    const result = await runRecovery();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[recover] Recovery failed:', error);
    return NextResponse.json({ error: 'Recovery failed', details: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await runRecovery();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[recover] Recovery failed:', error);
    return NextResponse.json({ error: 'Recovery failed', details: String(error) }, { status: 500 });
  }
}
