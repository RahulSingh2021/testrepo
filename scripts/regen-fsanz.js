#!/usr/bin/env node
/* eslint-disable */
/**
 * Regenerate public/data/fsanz-foods.json from an FSANZ Australian Food
 * Composition Database release Excel file.
 *
 * Usage:
 *   node scripts/regen-fsanz.js path/to/fsanz-release.xlsx
 *
 * Where to download the source file (free, Crown copyright, free reuse with
 * attribution):
 *   https://www.foodstandards.gov.au/science/monitoringnutrients/afcd
 *
 * The seed file shipped at public/data/fsanz-foods.json is a small curated
 * subset (~120 foods) of widely-used pantry items. Replacing it with the full
 * release adds ~1,500 more foods for the Recipe Studio's "Search FSANZ" path.
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/regen-fsanz.js path/to/fsanz-release.xlsx');
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error('File not found:', inputPath);
  process.exit(1);
}

let xlsx;
try {
  xlsx = require('xlsx');
} catch (e) {
  console.error('Missing dependency. Install with: npm install xlsx');
  process.exit(1);
}

const wb = xlsx.readFile(inputPath);
// FSANZ release typically uses a sheet named "All solids & liquids per 100g"
// or "Foods". Adjust the sheet name to match the release in use.
const sheetName = wb.SheetNames.find((n) => /food|all solids|composition/i.test(n)) || wb.SheetNames[0];
const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
console.log(`Reading ${rows.length} rows from sheet "${sheetName}"`);

// Best-effort column header normalisation. The FSANZ release uses long human
// labels — we map them by fuzzy keyword.
function pick(row, ...keys) {
  for (const k of keys) {
    for (const col of Object.keys(row)) {
      if (col.toLowerCase().includes(k.toLowerCase())) {
        const v = row[col];
        if (v !== null && v !== undefined && v !== '') return v;
      }
    }
  }
  return null;
}
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const foods = rows
  .map((row, i) => {
    const name = pick(row, 'food name', 'name', 'description');
    if (!name) return null;
    return {
      id: `FSANZ-${String(i + 1).padStart(4, '0')}`,
      name: String(name).trim(),
      category: pick(row, 'classification', 'category', 'group') || 'Other',
      portion: 100,
      energy: num(pick(row, 'energy with', 'energy, with', 'energy kj') / 4.184) || num(pick(row, 'energy kcal', 'energy (kcal)')),
      protein: num(pick(row, 'protein')),
      carb: num(pick(row, 'carbohydrate, with', 'available carbohydrate', 'total carbohydrate')),
      fat: num(pick(row, 'total fat', 'fat, total')),
      fiber: num(pick(row, 'dietary fibre', 'fibre')),
      sodium: num(pick(row, 'sodium')),
      allergen: 'None',
    };
  })
  .filter(Boolean);

const out = {
  source: 'FSANZ Australian Food Composition Database (full release)',
  license: 'Crown copyright, FSANZ — values per 100 g, free reuse with attribution',
  version: `regen-${new Date().toISOString().slice(0, 10)}`,
  note: `Generated from ${path.basename(inputPath)} on ${new Date().toISOString()}`,
  foods,
};

const outPath = path.join(__dirname, '..', 'public', 'data', 'fsanz-foods.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${foods.length} foods to ${outPath}`);
