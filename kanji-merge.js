// ══════════════════════════════════════════════════════════════════
//  kanji-merge.js
//  Logic merge dữ liệu Kanji từ CSV vào bộ thẻ hiện tại
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /**
   * Tạo card object mới hoàn toàn từ CSV entry
   * @param {Object} csvEntry 
   * @returns {Object}
   */
  function createCardFromCsvEntry(csvEntry) {
    const examples = [];
    const seen = new Set();

    function addEx(word, reading, meaning, type) {
      const w = (word || '').trim();
      const r = (reading || '').trim();
      const m = (meaning || '').trim();
      if (!w && !r && !m) return;
      const key = `${w}|${r}`;
      if (!seen.has(key)) {
        seen.add(key);
        const item = { word: w, hiragana: r, meaning: m };
        if (type) item.type = type;
        examples.push(item);
      }
    }

    if (Array.isArray(csvEntry.kunExamples)) {
      csvEntry.kunExamples.forEach((ex) => addEx(ex.word, ex.reading, ex.meaning, 'kun'));
    }
    if (Array.isArray(csvEntry.onExamples)) {
      csvEntry.onExamples.forEach((ex) => addEx(ex.word, ex.reading, ex.meaning, 'on'));
    }

    return {
      kanji: csvEntry.kanji || '',
      han_viet: csvEntry.hanViet || '',
      meaning: csvEntry.meaning || '',
      on_yomi: csvEntry.onYomi || [],
      jlpt_level: csvEntry.jlptLevel || null,
      is_radical: !!csvEntry.isRadical,
      examples,
    };
  }

  /**
   * Merge thông tin từ csvEntry vào existingCard (bổ sung, không ghi đè dữ liệu cũ, không trùng)
   * @param {Object|null} existingCard 
   * @param {Object} csvEntry 
   * @returns {Object}
   */
  function mergeKanjiEntry(existingCard, csvEntry) {
    if (!existingCard) {
      return createCardFromCsvEntry(csvEntry);
    }

    const merged = Object.assign({}, existingCard);

    // Bổ sung Hán Việt nếu card cũ chưa có hoặc rỗng
    if (!merged.han_viet || merged.han_viet.trim() === '') {
      merged.han_viet = csvEntry.hanViet || '';
    }

    // Bổ sung Nghĩa nếu card cũ chưa có hoặc rỗng
    if (!merged.meaning || merged.meaning.trim() === '') {
      merged.meaning = csvEntry.meaning || '';
    }

    // Bổ sung Âm On nếu card cũ chưa có
    if ((!merged.on_yomi || merged.on_yomi.length === 0) && csvEntry.onYomi && csvEntry.onYomi.length > 0) {
      merged.on_yomi = csvEntry.onYomi.slice();
    }

    // Bổ sung JLPT level
    if (!merged.jlpt_level && csvEntry.jlptLevel) {
      merged.jlpt_level = csvEntry.jlptLevel;
    }

    // Cờ bộ thủ
    if (csvEntry.isRadical) {
      merged.is_radical = true;
    }

    // Merge danh sách ví dụ, loại trùng theo cặp (word + reading/hiragana)
    const examples = [];
    const seen = new Set();

    // Thêm các ví dụ cũ trước
    if (Array.isArray(existingCard.examples)) {
      existingCard.examples.forEach((ex) => {
        const w = (ex.word || '').trim();
        const r = (ex.hiragana || ex.reading || '').trim();
        const m = (ex.meaning || '').trim();
        const key = `${w}|${r}`;
        seen.add(key);
        examples.push(Object.assign({}, ex, { word: w, hiragana: r, meaning: m }));
      });
    }

    // Thêm ví dụ mới từ CSV (Kun)
    if (Array.isArray(csvEntry.kunExamples)) {
      csvEntry.kunExamples.forEach((ex) => {
        const w = (ex.word || '').trim();
        const r = (ex.reading || '').trim();
        const m = (ex.meaning || '').trim();
        if (!w && !r && !m) return;
        const key = `${w}|${r}`;
        if (!seen.has(key)) {
          seen.add(key);
          examples.push({ word: w, hiragana: r, meaning: m, type: 'kun' });
        }
      });
    }

    // Thêm ví dụ mới từ CSV (On)
    if (Array.isArray(csvEntry.onExamples)) {
      csvEntry.onExamples.forEach((ex) => {
        const w = (ex.word || '').trim();
        const r = (ex.reading || '').trim();
        const m = (ex.meaning || '').trim();
        if (!w && !r && !m) return;
        const key = `${w}|${r}`;
        if (!seen.has(key)) {
          seen.add(key);
          examples.push({ word: w, hiragana: r, meaning: m, type: 'on' });
        }
      });
    }

    merged.examples = examples;

    return merged;
  }

  const _api = {
    createCardFromCsvEntry,
    mergeKanjiEntry,
  };

  if (typeof window !== 'undefined') {
    window.KanjiMerge = _api;
  }

  if (typeof module !== 'undefined') {
    module.exports = _api;
  }
})();
