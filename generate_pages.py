import json
from pathlib import Path

root = Path(__file__).resolve().parent
source_path = root / 'data' / 'kanji-sample.json'
out_dir = root / 'data' / 'pages'
out_dir.mkdir(exist_ok=True)

with open(source_path, 'r', encoding='utf-8') as f:
    base = json.load(f)

if not isinstance(base, list):
    raise SystemExit('Base data must be a JSON array')

per_page = 80
page_count = 27

for page in range(1, page_count + 1):
    items = []
    for i in range(per_page):
        src = base[i % len(base)]
        item = {
            'kanji': src.get('kanji', ''),
            'han_viet': src.get('han_viet', ''),
            'meaning': src.get('meaning', ''),
            'examples': [
                {
                    'word': ex.get('word', ''),
                    'hiragana': ex.get('hiragana', ''),
                    'meaning': ex.get('meaning', '')
                }
                for ex in src.get('examples', [])
            ]
        }
        item['meaning'] = f"{item['meaning']} (Trang {page})"
        items.append(item)

    out_path = out_dir / f'page-{page}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write('\n')

print(f'Created {page_count} files in {out_dir}')
