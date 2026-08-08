// ══════════════════════════════════════════════════════════════════
//  build-kanji2k.js
//  Parses CSV files in data/kanji2k into data/kanji2k-pages/page-N.json
//  and aggregates into data/kanji2k-index.json.
//  Merges with existing page cards when Kanji characters match.
// ══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { parseKanjiCsv } = require('./kanji-csv-parser');
const { mergeKanjiEntry } = require('./kanji-merge');

const KANJI2K_DIR = path.join(__dirname, 'data', 'kanji2k');
const PAGES_DIR = path.join(__dirname, 'data', 'pages');
const OUT_DIR = path.join(__dirname, 'data', 'kanji2k-pages');
const INDEX_OUT = path.join(__dirname, 'data', 'kanji2k-index.json');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Build a lookup map of existing Kanji cards from data/pages/page-N.json
const existingKanjiMap = new Map();
if (fs.existsSync(PAGES_DIR)) {
  const pageFiles = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of pageFiles) {
    try {
      const cards = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8'));
      if (Array.isArray(cards)) {
        for (const card of cards) {
          if (card.kanji) {
            existingKanjiMap.set(card.kanji, card);
          }
        }
      }
    } catch (e) {
      console.warn(`[build-kanji2k] Could not read ${file}:`, e.message);
    }
  }
}
console.log(`[build-kanji2k] Loaded ${existingKanjiMap.size} existing kanji cards for matching.`);

// 2. Read and sort CSV files in data/kanji2k/
if (!fs.existsSync(KANJI2K_DIR)) {
  console.error(`[build-kanji2k] Directory ${KANJI2K_DIR} does not exist.`);
  process.exit(1);
}

const csvFiles = fs.readdirSync(KANJI2K_DIR).filter((f) => f.endsWith('.csv'));
csvFiles.sort((a, b) => {
  const numA = (a.match(/trang\s*(\d+)/i) || [])[1] || 0;
  const numB = (b.match(/trang\s*(\d+)/i) || [])[1] || 0;
  return Number(numA) - Number(numB);
});

if (csvFiles.length === 0) {
  console.warn('[build-kanji2k] No CSV files found in data/kanji2k/');
}

const allKanji2kIndex = [];

csvFiles.forEach((fileName) => {
  const match = fileName.match(/trang\s*(\d+)/i);
  const pageNum = match ? parseInt(match[1], 10) : 1;
  const filePath = path.join(KANJI2K_DIR, fileName);
  const content = fs.readFileSync(filePath, 'utf-8');

  const entries = parseKanjiCsv(content, pageNum);
  const mergedCards = entries.map((csvEntry) => {
    const existingCard = existingKanjiMap.get(csvEntry.kanji) || null;
    return mergeKanjiEntry(existingCard, csvEntry);
  });

  // Write page file
  const outPageFile = path.join(OUT_DIR, `page-${pageNum}.json`);
  fs.writeFileSync(outPageFile, JSON.stringify(mergedCards, null, 2), 'utf-8');
  console.log(`[build-kanji2k] Saved ${outPageFile} (${mergedCards.length} entries)`);

  // Append to index
  mergedCards.forEach((card, i) => {
    allKanji2kIndex.push({
      id: card.kanji || `kanji2k-p${pageNum}-${i}`,
      kanji: card.kanji || '',
      han_viet: card.han_viet || '',
      meaning: card.meaning || '',
      on_yomi: card.on_yomi || [],
      jlpt_level: card.jlpt_level || null,
      page: pageNum,
      i,
    });
  });
});

// Write full index file
fs.writeFileSync(INDEX_OUT, JSON.stringify(allKanji2kIndex, null, 2), 'utf-8');
console.log(`[build-kanji2k] Complete. Total cards in Kanji2K index: ${allKanji2kIndex.length}`);
console.log(`[build-kanji2k] Saved ${INDEX_OUT}`);
