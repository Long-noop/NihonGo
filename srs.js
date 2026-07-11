// ══════════════════════════════════════════════════════════════════
//  srs.js  —  Spaced Repetition System module (SM-2 variant)
//
//  Public API (attached to window.KanjiSRS):
//    loadState()                     — đọc nihongo_srs_v1 từ localStorage
//    saveState(state)                — ghi vào localStorage
//    getCard(state, id)              — trả CardState (mặc định nếu chưa có)
//    reviewCard(cardState, grade)    — grade 0/1/2/3 → CardState mới (không mutate)
//    buildQueue(index, state, opts)  — mảng thẻ cần ôn hôm nay
//    getDueCount(index, state)       — đếm nhanh số thẻ due
//
//  CardState shape: { ef, interval, reps, lapses, due, status }
//    status: 'new' | 'learning' | 'review'
//    due:    timestamp ms (Date.now())
//    ef:     ease factor, khởi đầu 2.5
//
//  grade:  0 = Again (Quên), 1 = Hard (Khó), 2 = Good (Tốt), 3 = Easy (Dễ)
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────
  const STORAGE_KEY = 'nihongo_srs_v1';
  const MIN_EF      = 1.3;
  const INIT_EF     = 2.5;

  // Learning steps: [10 phút, 1 ngày] (đơn vị ms)
  const LEARNING_STEPS = [10 * 60 * 1000, 24 * 60 * 60 * 1000];

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // ── Helpers ───────────────────────────────────────────────────────

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /** Trả CardState mặc định cho thẻ chưa từng học */
  function defaultCard() {
    return {
      ef:       INIT_EF,
      interval: 0,
      reps:     0,
      lapses:   0,
      due:      null,   // null = chưa từng chạm đến
      status:   'new',
    };
  }

  // ── Core API ──────────────────────────────────────────────────────

  /**
   * loadState()
   * Đọc toàn bộ SRS state từ localStorage.
   * Trả {} nếu chưa có hoặc JSON hỏng.
   */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * saveState(state)
   * Ghi toàn bộ SRS state vào localStorage.
   */
  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[KanjiSRS] Không thể ghi localStorage:', err.message);
    }
  }

  /**
   * getCard(state, id)
   * Trả CardState của thẻ id, hoặc defaultCard() nếu chưa có.
   */
  function getCard(state, id) {
    const cs = state && state[id];
    if (!cs) return defaultCard();
    return cs;
  }

  /**
   * reviewCard(cardState, grade)
   * Tính CardState mới sau khi chấm điểm. Không mutate input.
   *
   * grade: 0=Again, 1=Hard, 2=Good, 3=Easy
   */
  function reviewCard(cardState, grade) {
    const now = Date.now();
    // Clone để không mutate
    const cs = Object.assign({}, cardState);

    // ── Again (grade 0) ──────────────────────────────────────────
    if (grade === 0) {
      cs.lapses++;
      cs.reps    = 0;
      cs.status  = 'learning';
      cs.due     = now + LEARNING_STEPS[0];          // +10 phút
      cs.ef      = Math.max(MIN_EF, cs.ef - 0.2);
      return cs;
    }

    // ── new / learning ───────────────────────────────────────────
    if (cs.status === 'new' || cs.status === 'learning') {
      // Easy ngay từ đầu → tốt nghiệp luôn
      if (grade === 3) {
        cs.status   = 'review';
        cs.interval = 4;
        cs.reps     = 1;
        cs.due      = now + 4 * MS_PER_DAY;
        return cs;
      }

      // Còn bước learning chưa qua hết?
      if (cs.reps < LEARNING_STEPS.length - 1) {
        cs.reps++;
        cs.status = 'learning';
        cs.due    = now + LEARNING_STEPS[cs.reps];   // bước tiếp theo
        return cs;
      }

      // Hết bước learning → tốt nghiệp
      cs.status   = 'review';
      cs.interval = (grade === 2) ? 1 : 1;           // Hard/Good đều bắt đầu 1 ngày
      cs.reps     = 1;
      cs.due      = now + cs.interval * MS_PER_DAY;
      return cs;
    }

    // ── review ───────────────────────────────────────────────────
    if (cs.status === 'review') {
      let mult;
      if (grade === 1) {
        // Hard
        mult   = 1.2;
        cs.ef  = Math.max(MIN_EF, cs.ef - 0.15);
      } else if (grade === 2) {
        // Good
        mult = cs.ef;
      } else {
        // Easy
        mult   = cs.ef * 1.3;
        cs.ef  = cs.ef + 0.15;
      }

      cs.interval = Math.max(1, Math.round(cs.interval * mult));
      cs.reps++;
      cs.due      = now + cs.interval * MS_PER_DAY;
      return cs;
    }

    // Fallback (không nên xảy ra)
    return cs;
  }

  /**
   * buildQueue(index, state, opts)
   * Xây hàng chờ ôn tập hôm nay.
   *
   * opts = { newLimit: 20 }
   * Trả mảng item cùng shape { id, kanji, han_viet, meaning, page, i }
   */
  function buildQueue(index, state, opts) {
    const newLimit = (opts && typeof opts.newLimit === 'number') ? opts.newLimit : 20;
    const now      = Date.now();

    const dueCards  = [];
    const newCards  = [];

    for (let k = 0; k < index.length; k++) {
      const item = index[k];
      const cs   = state[item.id];

      if (!cs || cs.status === 'new' || cs.due === null) {
        // Thẻ mới (chưa chạm đến)
        newCards.push(item);
      } else if (cs.due <= now) {
        // Thẻ đến hạn
        dueCards.push({ item, due: cs.due });
      }
    }

    // Sort due cards: hạn cũ nhất lên trước
    dueCards.sort((a, b) => a.due - b.due);

    // Lấy tối đa newLimit thẻ mới
    const newSlice = newCards.slice(0, newLimit);

    // Xen kẽ: cứ 4 due chen 1 new
    const queue  = [];
    let di = 0; // due index
    let ni = 0; // new index
    let batch = 0;

    while (di < dueCards.length || ni < newSlice.length) {
      // 4 due
      for (let t = 0; t < 4 && di < dueCards.length; t++, di++) {
        queue.push(dueCards[di].item);
      }
      // 1 new
      if (ni < newSlice.length) {
        queue.push(newSlice[ni]);
        ni++;
      }
      batch++;
      // Tránh vòng lặp vô tận nếu cả hai đều rỗng (không nên xảy ra)
      if (batch > index.length) break;
    }

    return queue;
  }

  /**
   * getDueCount(index, state)
   * Đếm nhanh số thẻ đến hạn (due <= now).
   * Không tính thẻ mới chưa từng học.
   */
  function getDueCount(index, state) {
    const now = Date.now();
    let count = 0;
    for (let k = 0; k < index.length; k++) {
      const cs = state[index[k].id];
      if (cs && cs.due !== null && cs.due <= now) {
        count++;
      }
    }
    return count;
  }

  // ── Export ────────────────────────────────────────────────────────
  const _api = {
    loadState,
    saveState,
    getCard,
    reviewCard,
    buildQueue,
    getDueCount,
  };

  // Browser: attach to window
  if (typeof window !== 'undefined') {
    window.KanjiSRS = _api;
  }

  // Node.js compatibility (optional — for unit testing via node -e "...")
  if (typeof module !== 'undefined') {
    module.exports = _api;
  }
})();
