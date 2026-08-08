const assert = require('assert');
const { createCardFromCsvEntry, mergeKanjiEntry } = require('./kanji-merge');

console.log('--- Testing kanji-merge.js ---');

// 1. Test createCardFromCsvEntry
const csvEntry = {
  index: 1,
  jlptLevel: 'N5',
  kanji: '一',
  hanViet: 'Nhất',
  meaning: 'Một',
  isRadical: false,
  onYomi: ['いち', 'いつ'],
  kunExamples: [{ word: '一つ', reading: 'ひとつ', meaning: 'một cái' }],
  onExamples: [{ word: '一時', reading: 'いちじ', meaning: 'một giờ' }],
  sourcePage: 1,
};

const newCard = createCardFromCsvEntry(csvEntry);
assert.strictEqual(newCard.kanji, '一');
assert.strictEqual(newCard.han_viet, 'Nhất');
assert.strictEqual(newCard.meaning, 'Một');
assert.deepStrictEqual(newCard.on_yomi, ['いち', 'いつ']);
assert.strictEqual(newCard.examples.length, 2);
assert.strictEqual(newCard.examples[0].type, 'kun');
assert.strictEqual(newCard.examples[1].type, 'on');
console.log('✓ createCardFromCsvEntry passed');

// 2. Test mergeKanjiEntry with existing card
const existingCard = {
  kanji: '一',
  han_viet: 'NHẤT',
  meaning: 'Một',
  examples: [
    { word: '一日', hiragana: 'いちにち', meaning: 'Một ngày' },
    { word: '一つ', hiragana: 'ひとつ', meaning: 'Một cái' }, // trùng với CSV entry
  ],
};

const merged = mergeKanjiEntry(existingCard, csvEntry);

// Keeps existing non-empty han_viet and meaning
assert.strictEqual(merged.han_viet, 'NHẤT');
assert.strictEqual(merged.meaning, 'Một');
// Fills missing on_yomi
assert.deepStrictEqual(merged.on_yomi, ['いち', 'いつ']);
// Examples deduplication:
// Existing: 一日 (いちにち), 一つ (ひとつ)
// CSV Kun: 一つ (ひとつ) -> duplicate, skipped!
// CSV On: 一時 (いちじ) -> new, added!
assert.strictEqual(merged.examples.length, 3);
assert.strictEqual(merged.examples[0].word, '一日');
assert.strictEqual(merged.examples[1].word, '一つ');
assert.strictEqual(merged.examples[2].word, '一時');

console.log('✓ mergeKanjiEntry supplementary & deduplication passed');

// 3. Test mergeKanjiEntry filling missing fields
const emptyCard = {
  kanji: '一',
  han_viet: '',
  meaning: '',
  examples: [],
};
const mergedEmpty = mergeKanjiEntry(emptyCard, csvEntry);
assert.strictEqual(mergedEmpty.han_viet, 'Nhất');
assert.strictEqual(mergedEmpty.meaning, 'Một');
assert.strictEqual(mergedEmpty.examples.length, 2);
console.log('✓ mergeKanjiEntry empty field filling passed');

console.log('🎉 ALL MERGE TESTS PASSED!');
