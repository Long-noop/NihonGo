// ══════════════════════════════════════════════════════════════════
//  search.js  —  Kanji full-text search module
//
//  Public API (window.KanjiSearch):
//    init(indexData)       — load data/index.json array
//    query(text, limit=50) — return matching cards
//
//  Priority tiers (lower = better rank):
//    0 — exact lowercase match in han_viet  (diacritics preserved)
//    1 — normalised match in han_viet       (diacritics stripped)
//    2 — exact lowercase match in meaning
//    3 — normalised match in kanji / meaning
//  Examples: "tang"→TANG(0)>TĂNG(1)  |  "nhất"→NHẤT(0)>NHAT(1)
//  Within same tier, shorter field length ranks first.
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  let _index  = [];
  let _normed = [];

  // Strip diacritics + lowercase
  function normalise(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Lowercase only (keep diacritics)
  function lc(str) {
    return str ? str.toLowerCase() : '';
  }

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

  function query(text, limit) {
    limit = (typeof limit === 'number') ? limit : 50;

    const qNorm  = normalise(text);
    const qExact = lc(text);

    if (!qNorm) return [];

    const results = [];

    for (let k = 0; k < _index.length; k++) {
      const n    = _normed[k];
      const card = _index[k];

      const hvExact = lc(card.han_viet);
      const mExact  = lc(card.meaning);

      let tier = -1;
      let len  = 0;

      if (hvExact.includes(qExact)) {
        tier = 0; len = hvExact.length;
      } else if (n.han_viet.includes(qNorm)) {
        tier = 1; len = n.han_viet.length;
      } else if (mExact.includes(qExact)) {
        tier = 2; len = mExact.length;
      } else if (n.kanji.includes(qNorm)) {
        tier = 3; len = n.kanji.length;
      } else if (n.meaning.includes(qNorm)) {
        tier = 3; len = n.meaning.length;
      }

      if (tier >= 0) results.push({ card, tier, len });
    }

    results.sort((a, b) => a.tier - b.tier || a.len - b.len);
    return results.map(x => x.card).slice(0, limit);
  }

  const _api = { init, query };
  if (typeof window !== 'undefined') window.KanjiSearch = _api;
  if (typeof module !== 'undefined') module.exports = _api;
})();
