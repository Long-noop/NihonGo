# Prompt: Thêm tính năng SRS (localStorage) + Search cho NihonGo Kanji Flashcards

## Bối cảnh dự án

Đây là repo `NihonGo` — web app flashcard học Hán tự (kanji) cho người Việt học tiếng Nhật, tại `github.com/Long-noop/NihonGo`. App hiện tại là 1 trang tĩnh (`index.html`), không có backend, không có build step, chạy trực tiếp qua `file://` hoặc static hosting, có PWA offline qua `sw.js`.

Cấu trúc hiện có:

```
index.html                 # toàn bộ UI + logic JS inline (~800 dòng)
data/kanji-sample.json     # dữ liệu mẫu cũ, không dùng để load runtime
data/pages/page-1.json ... page-27.json   # dữ liệu thật, mỗi trang ~10-90 thẻ
data/kanjivg/*.svg         # SVG nét chữ, tra theo mã Unicode của kanji
asserts/styles.css
sw.js, manifest.json       # PWA
```

Mỗi phần tử trong `page-N.json` có dạng:

```json
{
  "kanji": "一",
  "han_viet": "NHẤT",
  "meaning": "Một",
  "examples": [
    { "word": "一日", "hiragana": "いちにち", "meaning": "Một ngày" }
  ]
}
```

Tổng dữ liệu: **2134 thẻ** trên 27 trang, ~864KB tổng. **Lưu ý**: cần xử lý khi tạo ID duy nhất, không được giả định `kanji` luôn là khóa duy nhất.

Logic JS hiện tại (`init()`, `loadPage()`, `render()`, `go()`, `jumpToCard()`, `jumpToPage()`) chỉ hỗ trợ duyệt tuyến tính: fetch từng trang JSON khi cần, lật thẻ xem nghĩa, next/prev/swipe/keyboard, không có bất kỳ cơ chế lưu trạng thái nào (đã grep toàn repo, không có `localStorage`/`IndexedDB` ở đâu cả — kể cả theme sáng/tối cũng reset mỗi lần load lại trang).

## Mục tiêu

Thêm 2 tính năng vào app hiện có, **không phá vỡ chế độ duyệt tự do đang chạy tốt**:

1. **Hệ thống ôn tập ngắt quãng (SRS) lưu bằng `localStorage`** — theo dõi thẻ nào đã học, khi nào cần ôn lại, để người dùng ôn hiệu quả thay vì chỉ lướt qua.
2. **Tìm kiếm** theo kanji / âm Hán Việt / nghĩa, xuyên suốt toàn bộ 2134 thẻ (không chỉ trang hiện tại).

## Yêu cầu kỹ thuật chi tiết

### A. Build một file index tổng hợp

Viết script Node (`build-index.js`, chạy bằng `node build-index.js`, không cần thêm dependency ngoài Node core) gộp toàn bộ `data/pages/page-*.json` thành `data/index.json` — bản rút gọn (không kèm `examples`) dùng cho cả search lẫn tính "thẻ nào due":

- Mỗi phần tử: `{ id, kanji, han_viet, meaning, page, i }` trong đó `i` là vị trí (0-based) của thẻ đó trong file `page-N.json` tương ứng.
- `id` mặc định = ký tự `kanji`.
- `index.json` sẽ được `fetch` 1 lần lúc `init()` của app, giữ toàn bộ trong bộ nhớ — không cần lazy load vì kích thước nhỏ (~150KB).

### C. Module Search (`search.js` hoặc gộp tương tự)

- Chuẩn hóa chuỗi: bỏ dấu tiếng Việt (NFD strip diacritics) + lowercase, để gõ không dấu vẫn tìm ra kết quả có dấu.
- Tìm kiếm substring trên cả 3 trường: `kanji`, `han_viet`, `meaning`.
- Giới hạn kết quả trả về (ví dụ 50) để tránh render quá nhiều.
- Kết quả trả về phải giữ nguyên field `page` và `i` từ `index.json` để có thể nhảy thẳng tới thẻ đó.

### D. Tích hợp UI vào `index.html` hiện có

**Không viết lại từ đầu** — giữ nguyên toàn bộ cơ chế `loadPage`/`render`/`go`/animation KanjiVG đang hoạt động, chỉ bổ sung:

1. **Thanh tìm kiếm** trong `.topbar` (cạnh nút đổi theme): input text, khi gõ → hiện dropdown/overlay danh sách kết quả (kanji + han_viet + meaning rút gọn). Click 1 kết quả → gọi `loadPage(item.page)` rồi nhảy tới `item.i` (tái dùng logic có sẵn của `jumpToCard`/tương đương), đóng dropdown.
   - Mỗi kết quả trong dropdown hiển thị thêm 1 chip nhỏ trạng thái SRS (Mới / Đang học / Cần ôn / Đã thuộc) dựa trên `nihongo_srs_v1`.
   - Debounce input ~150ms để tránh filter liên tục khi gõ nhanh.

2. **Nút "Ôn tập"** cạnh khu vực điều khiển hiện có, hiển thị badge số thẻ đang due hôm nay (từ `buildQueue(...).length`). Bấm vào chuyển app sang **chế độ ôn tập**:
   - Dùng `buildQueue()` để lấy hàng đợi, lưu vào biến state riêng (không đụng vào `DATA`/`idx` dùng cho chế độ duyệt tự do — có thể cần thêm 1 biến mode: `'browse' | 'review'`).
   - Khi ở chế độ ôn tập và thẻ đã lật (flipped), thay 2 nút prev/next bằng **4 nút: Quên / Khó / Tốt / Dễ** (Again/Hard/Good/Easy). Bấm 1 trong 4 nút → gọi `reviewCard()`, lưu lại `localStorage`, rồi tự động chuyển sang thẻ tiếp theo trong hàng đợi (không cần bấm next).
   - Hết hàng đợi → hiện màn hình "Hoàn thành ôn tập hôm nay 🎉" (không dùng emoji nếu bạn theo style hiện tại của app — kiểm tra codebase xem có dùng emoji ở đâu không rồi quyết định), có nút quay lại chế độ duyệt tự do.
   - Chế độ ôn tập vẫn tái sử dụng `render()` để hiển thị kanji/SVG — chỉ cần set đúng `pageNumber`/`idx` trước khi gọi.

3. Khi khởi tạo (`init()`), fetch thêm `data/index.json`, build search index và tính số thẻ due để hiển thị badge — thực hiện song song với `loadPage(initialPage)` hiện có bằng `Promise.all`, không làm chậm thời gian hiển thị thẻ đầu tiên.

### E. Ràng buộc / lưu ý quan trọng

- Không thêm framework hay build tool (React, Vite, v.v.) — giữ nguyên vanilla JS, 1 file HTML + vài file JS nhỏ tách riêng cho SRS/search, load qua `<script src="...">` thường.
- Không phá vỡ tính năng offline PWA hiện có — nếu thêm file JS/JSON mới, phải cập nhật danh sách cache trong `sw.js` để chúng cũng được cache khi offline.
- Giữ nguyên toàn bộ UX hiện tại của chế độ duyệt tự do (swipe, keyboard, jump theo trang/card, animation nét chữ) — đây là code đang chạy tốt, không refactor lại phần này trừ khi thật sự cần thiết để tích hợp.
- Tôn trọng style code hiện có: comment tiếng Anh dạng banner (`// ══...`), tên biến camelCase, UI text tiếng Việt.
- Vì đây là app tĩnh chạy cả qua `file://`, `fetch()` tới `data/index.json` cần test hoạt động khi serve qua HTTP local (đã có sẵn vấn đề `file://` chặn `fetch` được ghi nhận trước đó trong dự án — không cần fix lại, chỉ cần biết để không tạo thêm lỗi tương tự).

## Việc cần giao nộp

1. `build-index.js` — script tạo `data/index.json`, chạy thử và xác nhận log ra đúng ~2134 thẻ, cảnh báo 2 ca trùng.
2. `data/index.json` — file đã generate.
3. `search.js` — module search như mô tả ở mục C.
4. Sửa `index.html` — thêm thanh search, nút Ôn tập, 4 nút đánh giá, wiring gọi các module trên.
5. Sửa `sw.js` — thêm các file mới vào danh sách cache.
