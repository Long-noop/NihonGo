// ══════════════════════════════════════════════════════════════════
//  search.js  —  Kanji full-text search module
//
//  Public API (attached to window.KanjiSearch):
//    init(indexData)         — load the index array from data/index.json
//    query(text, limit=50)   — return matching cards
//
//  Each card in index: { id, kanji, han_viet, meaning, page, i }
//  query() returns the same shape, filtered + limited.
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Internal state ────────────────────────────────────────────────
  let _index    = [];   // raw index array
  let _normed   = [];   // parallel array of normalised strings for fast match

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Normalise a string for comparison:
   *   - NFD decompose → strip combining diacritics (covers Vietnamese, etc.)
   *   - lowercase
   * This allows searching "nhat" and matching "NHẤT".
   */
  function normalise(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // strip combining marks
      .toLowerCase();
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * init(indexData)
   * Must be called once with the parsed data/index.json array before query().
   */
  function init(indexData) {
    if (!Array.isArray(indexData)) {
      console.error('[KanjiSearch] init() expects an array');
      return;
    }
    _index  = indexData;
    _normed = indexData.map(card => ({
      kanji:    normalise(card.kanji),
      han_viet: normalise(card.han_viet),
      meaning:  normalise(card.meaning),
    }));
    console.log('[KanjiSearch] Index loaded:', _index.length, 'cards');
  }

  /**
   * query(text, limit = 50)
   * Returns up to `limit` cards whose kanji / han_viet / meaning
   * contain the query string (diacritic-insensitive, case-insensitive).
   * Returns [] for empty queries.
   */
  function query(text, limit) {
    limit = (typeof limit === 'number') ? limit : 50;

    const q = normalise(text);
    if (!q) return [];

    const hanVietMatches = [];
    const otherMatches = [];

    for (let k = 0; k < _index.length; k++) {
      const n = _normed[k];
      const card = _index[k];

      if (n.han_viet.includes(q)) {
        hanVietMatches.push({ card, len: n.han_viet.length });
      } else if (n.kanji.includes(q)) {
        otherMatches.push({ card, len: n.kanji.length });
      } else if (n.meaning.includes(q)) {
        otherMatches.push({ card, len: n.meaning.length });
      }
    }

    hanVietMatches.sort((a, b) => a.len - b.len);
    otherMatches.sort((a, b) => a.len - b.len);

    const sortedHanViet = hanVietMatches.map(x => x.card);
    const sortedOther = otherMatches.map(x => x.card);

    return sortedHanViet.concat(sortedOther).slice(0, limit);
  }

  // ── Export ────────────────────────────────────────────────────────
  const _api = { init, query };
  if (typeof window !== 'undefined') {
    window.KanjiSearch = _api;
  }
  if (typeof module !== 'undefined') {
    module.exports = _api;
  }
})();
