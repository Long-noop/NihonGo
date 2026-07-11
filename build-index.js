// ══════════════════════════════════════════════════════════════════
//  build-index.js
//  Aggregates all data/pages/page-N.json into data/index.json.
//  Each entry: { id, kanji, han_viet, meaning, page, i }
//
//  Usage:  node build-index.js
//  Output: data/index.json
// ══════════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const PAGES_DIR  = path.join(__dirname, 'data', 'pages');
const OUT_FILE   = path.join(__dirname, 'data', 'index.json');
const PAGE_TOTAL = 27;

const index = [];

for (let p = 1; p <= PAGE_TOTAL; p++) {
  const filePath = path.join(PAGES_DIR, `page-${p}.json`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[build-index] WARN: page-${p}.json not found, skipping.`);
    continue;
  }

  let cards;
  try {
    cards = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[build-index] ERROR: Failed to parse page-${p}.json:`, err.message);
    continue;
  }

  if (!Array.isArray(cards)) {
    console.warn(`[build-index] WARN: page-${p}.json is not an array, skipping.`);
    continue;
  }

  cards.forEach((card, i) => {
    const id       = card.kanji   || `page${p}-${i}`;
    const kanji    = card.kanji   || '';
    const han_viet = card.han_viet || '';
    const meaning  = card.meaning  || '';

    index.push({ id, kanji, han_viet, meaning, page: p, i });
  });
}

fs.writeFileSync(OUT_FILE, JSON.stringify(index, null, 2), 'utf-8');

console.log(`[build-index] Done. Total cards: ${index.length}`);
console.log(`[build-index] Output: ${OUT_FILE}`);
