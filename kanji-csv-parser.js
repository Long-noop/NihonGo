// ══════════════════════════════════════════════════════════════════
//  kanji-csv-parser.js
//  RFC 4180 compliant parser for Kanji CSV data source (Kanji N5-N1 Âm/Huấn)
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /**
   * Chuyển đổi chữ số full-width sang half-width (VD: '４４' -> '44')
   */
  function toHalfWidth(str) {
    if (!str) return '';
    return str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  }

  /**
   * Parse chuỗi CSV chuẩn RFC 4180 (xử lý dấu ngoặc kép, xuống dòng trong ô)
   */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(field);
          field = '';
        } else if (c === '\r') {
          // Bỏ qua carriage return
        } else if (c === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += c;
        }
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  /**
   * Parse nội dung file CSV thành mảng KanjiEntry
   * @param {string} csvContent 
   * @param {number} sourcePage 
   * @returns {Array<Object>}
   */
  function parseKanjiCsv(csvContent, sourcePage = 1) {
    const rows = parseCSV(csvContent);
    const entries = [];
    let currentEntry = null;
    let currentGroup = null; // 'kun' | 'on' | null

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;

      const rawCol1 = (row[0] || '').trim();
      const col1Normalized = toHalfWidth(rawCol1);
      const col2 = (row[1] || '').trim();
      const col3 = (row[2] || '').trim();
      const col4 = (row[3] || '').trim();

      // Dòng rỗng hoàn toàn -> bỏ qua
      if (!col1Normalized && !col2 && !col3 && !col4) {
        continue;
      }

      // Kiểm tra dòng tiêu đề Kanji (Cột 1 chứa STT số)
      const isHeaderRow = /^\d+(\n|$)|\d+\s*\n/i.test(col1Normalized) || 
                          (/^\d+/.test(col1Normalized) && col2 !== '' && col1Normalized !== '訓');

      if (isHeaderRow) {
        if (currentEntry) {
          entries.push(currentEntry);
        }

        let index = null;
        let jlptLevel = null;

        const lines = col1Normalized.split('\n').map((s) => s.trim()).filter(Boolean);
        if (lines.length >= 1 && /^\d+$/.test(lines[0])) {
          index = parseInt(lines[0], 10);
        }
        if (lines.length >= 2 && /^N[1-5]$/i.test(lines[1])) {
          jlptLevel = lines[1].toUpperCase();
        } else if (lines.length >= 1 && /^N[1-5]$/i.test(lines[0])) {
          jlptLevel = lines[0].toUpperCase();
        }

        currentEntry = {
          index,
          jlptLevel,
          kanji: col2,
          hanViet: col3,
          meaning: col4,
          isRadical: !jlptLevel && !col4,
          onYomi: [],
          kunExamples: [],
          onExamples: [],
          sourcePage,
        };
        currentGroup = null;
        continue;
      }

      // Nếu chưa có khối Kanji nào active -> bỏ qua
      if (!currentEntry) continue;

      // Xử lý dòng ví dụ
      if (col1Normalized === '訓') {
        currentGroup = 'kun';
        if (col2 || col3 || col4) {
          currentEntry.kunExamples.push({ word: col2, reading: col3, meaning: col4 });
        }
      } else if (col1Normalized.startsWith('音：') || col1Normalized.startsWith('音:')) {
        currentGroup = 'on';
        // Tách danh sách âm On từ col1 (VD: "音： いち、いつ" -> ["いち", "いつ"])
        const rawOn = col1Normalized.replace(/^音[：:]\s*/, '').trim();
        if (rawOn) {
          currentEntry.onYomi = rawOn.split(/[、,]/).map((s) => s.trim()).filter(Boolean);
        }
        if (col2 || col3 || col4) {
          currentEntry.onExamples.push({ word: col2, reading: col3, meaning: col4 });
        }
      } else if (rawCol1 === '') {
        // Dòng tiếp theo cùng nhóm với marker phía trên
        if (currentGroup === 'kun' && (col2 || col3 || col4)) {
          currentEntry.kunExamples.push({ word: col2, reading: col3, meaning: col4 });
        } else if (currentGroup === 'on' && (col2 || col3 || col4)) {
          currentEntry.onExamples.push({ word: col2, reading: col3, meaning: col4 });
        }
      }
    }

    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  const _api = {
    parseCSV,
    parseKanjiCsv,
    toHalfWidth,
  };

  if (typeof window !== 'undefined') {
    window.KanjiCsvParser = _api;
  }

  if (typeof module !== 'undefined') {
    module.exports = _api;
  }
})();
