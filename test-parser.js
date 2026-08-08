const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseKanjiCsv, toHalfWidth } = require('./kanji-csv-parser');

console.log('--- Testing kanji-csv-parser.js ---');

// 1. Test toHalfWidth
assert.strictEqual(toHalfWidth('４４'), '44');
assert.strictEqual(toHalfWidth('７６'), '76');
assert.strictEqual(toHalfWidth('123'), '123');
console.log('✓ toHalfWidth passed');

// 2. Test sample CSV string parsing
const sampleCsv = `"1
N5",一,Nhất,Một
訓,一つ,ひとつ,một cái
,一言,ひとこと,một lời
音： いち、いつ,一時,いちじ,một giờ
,万一,まんいち,bất đắc dĩ
,統一,とういつ,sự thống nhất
"４４
N5",京,Kinh,Kinh đô
音： きょう、けい,東京,とうきょう,đông kinh
,上京,じょうきょう,lên tokyo
４７,イ,Bộ nhân đứng,
`;

const entries = parseKanjiCsv(sampleCsv, 1);
assert.strictEqual(entries.length, 3, 'Should parse 3 kanji entries');

// Entry 1
const e1 = entries[0];
assert.strictEqual(e1.index, 1);
assert.strictEqual(e1.jlptLevel, 'N5');
assert.strictEqual(e1.kanji, '一');
assert.strictEqual(e1.hanViet, 'Nhất');
assert.strictEqual(e1.meaning, 'Một');
assert.strictEqual(e1.isRadical, false);
assert.deepStrictEqual(e1.onYomi, ['いち', 'いつ']);
assert.strictEqual(e1.kunExamples.length, 2);
assert.strictEqual(e1.onExamples.length, 3);
assert.strictEqual(e1.kunExamples[0].word, '一つ');
assert.strictEqual(e1.onExamples[0].word, '一時');

// Entry 2 (Full-width digits)
const e2 = entries[1];
assert.strictEqual(e2.index, 44);
assert.strictEqual(e2.jlptLevel, 'N5');
assert.strictEqual(e2.kanji, '京');
assert.strictEqual(e2.hanViet, 'Kinh');
assert.strictEqual(e2.meaning, 'Kinh đô');
assert.deepStrictEqual(e2.onYomi, ['きょう', 'けい']);
assert.strictEqual(e2.kunExamples.length, 0);
assert.strictEqual(e2.onExamples.length, 2);

// Entry 3 (Radical)
const e3 = entries[2];
assert.strictEqual(e3.index, 47);
assert.strictEqual(e3.jlptLevel, null);
assert.strictEqual(e3.kanji, 'イ');
assert.strictEqual(e3.hanViet, 'Bộ nhân đứng');
assert.strictEqual(e3.meaning, '');
assert.strictEqual(e3.isRadical, true);
assert.strictEqual(e3.kunExamples.length, 0);
assert.strictEqual(e3.onExamples.length, 0);

console.log('✓ Sample CSV string parsing passed');

// 3. Test actual CSV file in data/kanji2k if exists
const file1Path = path.join(__dirname, 'data', 'kanji2k', '漢字(音・訓) trang 1 - Table 1.csv');
if (fs.existsSync(file1Path)) {
  const content = fs.readFileSync(file1Path, 'utf-8');
  const realEntries = parseKanjiCsv(content, 1);
  console.log(`✓ Real file trang 1 parsed successfully: ${realEntries.length} entries found.`);
  assert(realEntries.length >= 70, 'Should find at least 70 entries in page 1');
}

console.log('🎉 ALL PARSER TESTS PASSED!');
