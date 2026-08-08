# Thêm bộ dữ liệu Kanji mới vào Flashcard (NihonGo)

## Bối cảnh

Repo: `https://github.com/Long-noop/NihonGo`
Đây là app học Kanji bằng flashcard. Cần thêm một **nguồn dữ liệu (data source) mới** để học, lấy từ các file CSV có cấu trúc "Hán tự - Âm - Huấn" (sẽ có tổng cộng **28 trang/file CSV**, mỗi trang chứa khoảng 80 kanji).

## Việc đầu tiên bắt buộc phải làm: khảo sát repo hiện tại

Trước khi viết code, hãy đọc và nắm rõ:

1. Cấu trúc thư mục dự án, framework đang dùng (React/Vue/vanilla JS/mobile...).
2. Model dữ liệu hiện tại của một "flashcard" kanji (các field: kanji, âm on, âm kun, nghĩa, ví dụ, JLPT level, deck/bộ thẻ...).
3. Cơ chế hiện tại để chọn "bộ thẻ" (deck) trước khi học — nếu đã có UI chọn deck, tái sử dụng pattern đó thay vì tạo mới từ đầu.
4. Nơi lưu trữ dữ liệu (file JSON tĩnh, localStorage, IndexedDB, API...).
5. Cách flashcard hiện tại được nạp và hiển thị (component nào render mặt trước/sau của thẻ).

Nếu có điểm nào không rõ, hãy để lại giả định rõ ràng trong code/PR description thay vì đoán mò.

## Đặc tả định dạng file CSV nguồn

File CSV có 4 cột, KHÔNG có header, mỗi "khối" tương ứng 1 kanji gồm 1 dòng tiêu đề + N dòng ví dụ.

### Dòng tiêu đề (bắt đầu 1 khối kanji mới)

Cột 1 chứa 2 dòng gộp bằng ký tự xuống dòng (`\n`) bên trong 1 ô: `STT\nJLPT_LEVEL`

```
["1\nN5", "一", "Nhất", "Một"]
 col1(STT+Level)  col2(Kanji)  col3(Hán Việt)  col4(Nghĩa)
```

- Cột 1: STT (số thứ tự, có thể là số thường hoặc số full-width như "７６") + JLPT level (N5/N4/N3/N2/N1). **Lưu ý:** một số khối là bộ thủ (radical), không có JLPT level và cột nghĩa (col4) rỗng, ví dụ: `["47", "イ", "Bộ nhân đứng", ""]` — các khối này thường không có dòng ví dụ nào theo sau. Cần xử lý gracefully (bỏ qua hoặc gắn cờ "radical", không bắt buộc phải tạo flashcard ví dụ cho chúng).
- Cột 2: Chữ Kanji chính.
- Cột 3: Cách đọc Hán Việt.
- Cột 4: Nghĩa (tiếng Việt).

### Các dòng ví dụ theo sau (thuộc về khối kanji phía trên, cho tới khi gặp dòng tiêu đề tiếp theo)

```
["訓", "一つ", "ひとつ", "một cái"]
["", "一言", "ひとこと", "một lời"]
["音： いち、いつ", "一時", "いちじ", "một giờ"]
["", "万一", "まんいち", "bất đắc dĩ"]
["", "統一", "とういつ", "sự thống nhất"]
```

- Cột 1 = `"訓"`: đánh dấu **dòng đầu tiên** của nhóm ví dụ đọc theo Kun-yomi (từ ghép/từ đơn dùng âm huấn).
- Cột 1 bắt đầu bằng `"音："`: đánh dấu **dòng đầu tiên** của nhóm ví dụ đọc theo On-yomi, và liệt kê luôn danh sách các âm On của kanji đó, cách nhau bằng dấu `、`. Ví dụ `"音： いち、いつ"` → on-yomi = `["いち", "いつ"]`.
- Cột 1 rỗng (`""`): dòng tiếp theo cùng nhóm (kun hoặc on) với dòng có marker gần nhất phía trên.
- Cột 2: từ ví dụ (có thể là kanji đơn lẻ hoặc từ ghép, đôi khi có ký hiệu trợ từ trong ngoặc như `（を）上げる`).
- Cột 3: cách đọc (hiragana) của từ ví dụ.
- Cột 4: nghĩa tiếng Việt của từ ví dụ.

**Quy tắc quan trọng đã kiểm chứng trên dữ liệu thật (80 khối/trang):**

- Mỗi khối có **tối đa 1 dòng marker `訓`** và **tối đa 1 dòng marker `音：...`**.
- Thứ tự luôn là: nhóm `訓` (nếu có) xuất hiện trước, nhóm `音：` (nếu có) xuất hiện sau.
- Không phải khối nào cũng có cả 2 nhóm — có khối chỉ có on-yomi (không có kun), có khối chỉ có kun.
- Vì file dùng CSV chuẩn (RFC 4180), các ô có chứa dấu phẩy hoặc xuống dòng đã được bao trong dấu ngoặc kép `"..."` — hãy dùng thư viện CSV parser chuẩn của ngôn ngữ đang dùng, KHÔNG tự viết regex split theo dấu phẩy.

### Mô hình dữ liệu chuẩn hóa đề xuất sau khi parse 1 file CSV

```ts
type ExampleWord = {
  word: string; // cột 2, VD: "一時"
  reading: string; // cột 3, VD: "いちじ"
  meaning: string; // cột 4, VD: "một giờ"
};

type KanjiEntry = {
  index: number | null; // STT trong trang (đổi số full-width -> số thường nếu cần)
  jlptLevel: string | null; // "N5" | "N4" | "N3" | "N2" | "N1" | null (bộ thủ không có)
  kanji: string; // "一"
  hanViet: string; // "Nhất"
  meaning: string; // "Một" (rỗng với bộ thủ)
  isRadical: boolean; // true nếu không có ví dụ + không có JLPT level
  onYomi: string[]; // ["いち", "いつ"]
  kunExamples: ExampleWord[]; // các dòng thuộc nhóm 訓
  onExamples: ExampleWord[]; // các dòng thuộc nhóm 音
  sourcePage: number; // trang thứ mấy trong bộ 28 trang (để debug/trace nguồn)
};
```

## Yêu cầu tính năng cần triển khai

### 1. Thêm "Data Source / Bộ dữ liệu" mới, chọn được trước khi vào học

- Thêm 1 màn hình/bước chọn **bộ dữ liệu** (deck source) trước khi bắt đầu phiên học flashcard, tương tự (hoặc mở rộng từ) cơ chế chọn deck hiện có.
- Danh sách lựa chọn tương ứng với 28 trang dữ liệu (ví dụ: "Trang 1 (Kanji 1-80)", "Trang 2 (Kanji 81-160)"...). Cho phép chọn 1 trang, nhiều trang, hoặc "Tất cả".
- Đặt tên option rõ ràng để phân biệt với bộ dữ liệu Kanji hiện có trong app, ví dụ: **"Kanji N5-N1 (Âm/Huấn)"** hoặc tên do agent tự đề xuất cho phù hợp UI hiện tại — miễn nhất quán với convention đặt tên có sẵn trong app.

### 2. Parser CSV → dữ liệu hiển thị

- Viết module parser riêng (theo spec định dạng ở trên), có unit test với ít nhất vài khối dữ liệu mẫu (bao gồm case: có cả kun+on, chỉ có kun, chỉ có on, khối bộ thủ không ví dụ, STT số full-width).
- Import 28 file CSV (khi có đủ) vào thư mục data của app theo cách nhất quán với cách app hiện đang bundle dữ liệu tĩnh (build-time import hay runtime fetch — theo đúng pattern đã dùng trong repo).

### 3. Hiển thị trong Flashcard

- Mặt trước thẻ: Kanji.
- Mặt sau thẻ (tối thiểu): Hán Việt, Nghĩa, On-yomi, danh sách ví dụ Kun + On (từ, cách đọc, nghĩa).
- Giữ nguyên layout/style hiện có của flashcard, chỉ bổ sung field mới nếu component card cũ chưa có chỗ hiển thị (ví dụ: chưa có phần "ví dụ" thì cần thêm section mới, có thể thu gọn/expand để không phá layout).

### 4. Logic "bổ sung dữ liệu mới cho card đã có, không tạo trùng"

Đây là yêu cầu quan trọng nhất — khi 1 kanji từ file CSV **trùng** với kanji đã tồn tại trong bộ flashcard hiện có của app:

- **Không tạo thẻ mới trùng lặp.** Match theo ký tự Kanji (cột 2 dòng tiêu đề) là khóa chính để so khớp.
- Merge dữ liệu theo nguyên tắc **bổ sung, không ghi đè, không nhân bản**:
  - Nếu card cũ **chưa có** Hán Việt / nghĩa / on-yomi → điền thêm từ dữ liệu CSV.
  - Nếu card cũ **đã có** field đó rồi (không rỗng) → giữ nguyên dữ liệu cũ, không ghi đè.
  - Với danh sách ví dụ (kun/on examples): thêm các ví dụ mới từ CSV vào danh sách ví dụ của card, **loại trùng** theo cặp (word + reading) để tránh liệt kê lặp nếu ví dụ đó đã tồn tại sẵn trong card cũ.
- Nếu kanji **chưa từng có** trong bộ thẻ hiện tại → tạo card mới hoàn toàn từ dữ liệu CSV.
- Cần viết rõ hàm `mergeKanjiEntry(existingCard, newEntry)` (hoặc tên tương đương) tách biệt, có thể unit test độc lập.

### 5. Không phá vỡ tính năng hiện có

- Các bộ dữ liệu/deck hiện tại trong app phải hoạt động y như cũ.
- Tính năng chọn bộ dữ liệu mới phải là lựa chọn **cộng thêm**, không thay thế flow học hiện tại.

## Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] Người dùng có thể chọn 1 hoặc nhiều "trang" trong 28 trang dữ liệu mới trước khi vào phiên học.
- [ ] Flashcard hiển thị đúng: Kanji, Hán Việt, Nghĩa, On-yomi, ví dụ Kun, ví dụ On.
- [ ] Với kanji đã có sẵn trong bộ thẻ cũ, dữ liệu được bổ sung (không trùng, không mất dữ liệu cũ).
- [ ] Với kanji chưa có, thẻ mới được tạo đầy đủ.
- [ ] Khối dữ liệu dạng bộ thủ (không JLPT, không ví dụ) không làm crash parser và không tạo ra thẻ rỗng vô nghĩa.
- [ ] Có unit test cho parser và cho hàm merge.
- [ ] Không có tính năng cũ nào bị lỗi sau khi thêm code mới (chạy lại toàn bộ test suite hiện có, nếu có).

## Ghi chú cho agent

- File CSV mẫu đính kèm: `漢字_音_訓__trang_1_-_Table_1.csv` (trang 1/28) — dùng để test parser thực tế trước khi có đủ 28 file.
- Nếu cấu trúc UI/deck hiện tại của repo khác biệt lớn so với giả định trong prompt này (ví dụ không có khái niệm "deck"), hãy điều chỉnh cách triển khai cho phù hợp với kiến trúc thực tế, miễn giữ đúng các yêu cầu chức năng cốt lõi ở trên.
