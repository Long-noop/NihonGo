# Prompt: Lưu vị trí thẻ đang xem (localStorage) — mở lại app không bị reset

## Vấn đề hiện tại

App hiện chỉ lưu trang hiện tại (`pageNumber`) vào **URL query param** `?page=N` (xem `loadPage()`, dùng `window.history.replaceState`), KHÔNG lưu vào `localStorage`. Hệ quả:

- Nếu người dùng mở lại app bằng URL gốc (không có `?page=`, ví dụ bấm icon PWA trên màn hình chính, hoặc gõ lại domain) → luôn về **Trang 1, thẻ 1**, mất hoàn toàn vị trí đang học dở.
- Ngay cả khi có `?page=N` trong URL, app cũng chỉ nhớ đúng **trang**, không nhớ **thẻ thứ mấy trong trang đó** (`idx` luôn reset về 0 mỗi lần `loadPage()` chạy — xem dòng `idx = 0;` trong `loadPage()`).

## Mục tiêu

Thêm 1 tính năng nhỏ, độc lập, dùng `localStorage` để lưu **vị trí thẻ đang xem gần nhất** (trang + thứ tự thẻ trong trang), tự động khôi phục khi mở lại app — **không cần F5/refresh thủ công, không cần giữ URL query cũ**.

## Yêu cầu kỹ thuật

### 1. Key lưu trữ

`localStorage` key: `nihongo_last_position_v1`. Giá trị dạng JSON: `{ page, idx, savedAt }` — `page` = số trang (1-27), `idx` = vị trí thẻ trong trang đó (0-based, khớp biến `idx` hiện có), `savedAt` = timestamp lưu (dùng để debug/không bắt buộc dùng logic gì với nó).

### 2. Khi nào lưu

Lưu lại **mỗi khi vị trí thẻ thay đổi trong chế độ duyệt tự do** (`appMode === 'browse'`), tức là sau mỗi lần gọi `go()`, `jumpToCard()`, `jumpToPage()`, hoặc khi bấm kết quả search để nhảy tới thẻ. Cách làm gọn nhất: viết 1 hàm `saveLastPosition()` nhỏ:

```js
function saveLastPosition() {
  if (appMode !== 'browse') return; // không lưu vị trí khi đang ở chế độ Ôn tập
  try {
    localStorage.setItem('nihongo_last_position_v1', JSON.stringify({
      page: pageNumber,
      idx: idx,
      savedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('[kanji] Không thể lưu vị trí:', err.message);
  }
}
```

Gọi hàm này ở **cuối** `render()` (an toàn nhất — `render()` là điểm chung mọi luồng điều hướng đều đi qua sau khi `idx`/`pageNumber` đã cập nhật xong), thay vì rải rác gọi ở từng hàm điều hướng riêng lẻ — tránh sót chỗ.

**Không lưu khi ở `appMode === 'review'`** — vị trí trong chế độ ôn tập được quản lý riêng bởi `reviewQueue`/`reviewPos`, không nên ghi đè lên vị trí duyệt tự do của người dùng.

### 3. Khi nào khôi phục

Trong `init()`, **trước khi** quyết định `initialPage` để gọi `loadPage()`:

- Ưu tiên 1: nếu URL có `?page=N` hợp lệ (logic đã có sẵn) → dùng giá trị đó (tôn trọng ý định rõ ràng của người dùng khi họ tự dán link có kèm số trang, ví dụ chia sẻ link cho người khác).
- Ưu tiên 2: nếu không có `?page=` trong URL, đọc `nihongo_last_position_v1` từ `localStorage` — nếu hợp lệ (`page` trong khoảng 1..pageTotal) → dùng `page` đó làm `initialPage`.
- Fallback cuối: trang 1 như hiện tại.

Sau khi `loadPage(initialPage)` xong (có `DATA.length`), nếu vị trí khôi phục là từ `localStorage` (không phải từ URL param), set thêm `idx` theo giá trị đã lưu, **clamp** trong khoảng `[0, DATA.length - 1]` để tránh lỗi nếu dữ liệu trang đã thay đổi (thêm/bớt thẻ) từ lần lưu trước:

```js
idx = Math.min(Math.max(0, savedIdx), DATA.length - 1);
```

Rồi mới gọi `render()` như luồng `init()` hiện có.

### 4. Không phá vỡ hành vi hiện tại

- Không đổi cách `?page=` trong URL hoạt động — tính năng này chỉ là **fallback** khi không có URL param, không thay thế nó.
- Không lưu/khôi phục trạng thái `flipped` (mặt trước/sau của thẻ) — mở lại app luôn hiện mặt trước, chỉ đúng thẻ/trang là được, giữ đơn giản.
- Không ảnh hưởng gì đến `nihongo_srs_v1` (SRS) hay `nihongo_theme_v1` (theme) — 3 key độc lập hoàn toàn.
- Bọc mọi thao tác `localStorage` trong try/catch (một số trình duyệt ở chế độ private/incognito có thể chặn `localStorage`, không được để lỗi này làm crash cả app).

## Việc cần giao nộp

1. `index.html` — thêm hàm `saveLastPosition()`, gọi trong `render()`; sửa `init()` để đọc `nihongo_last_position_v1` làm fallback khi không có `?page=` trong URL, khôi phục đúng `idx` sau khi `loadPage()` xong.
2. Tóm tắt ngắn cách test thủ công: mở app, nhảy tới ví dụ Trang 5, Thẻ 3, đóng tab (không giữ URL `?page=`), mở lại app bằng URL gốc → phải tự động về đúng Trang 5, Thẻ 3.
