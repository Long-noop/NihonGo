# Prompt: Sửa 4 lỗi trong tính năng SRS (Ôn tập / localStorage)

Đã test kỹ code hiện tại (`srs.js`, `index.html`) bằng cách chạy `reviewCard()`/`buildQueue()`/`getDueCount()` trực tiếp qua Node và đọc lại toàn bộ luồng UI. Phát hiện 4 lỗi thật, xếp theo mức độ nghiêm trọng.

## Cách tính năng đang hoạt động hiện tại (mô tả chính xác từ code, không suy đoán)

### 1. Lưu trữ dữ liệu

- Toàn bộ 2134 thẻ được nạp 1 lần vào biến `INDEX` (từ `data/index.json`), song song với việc load trang đầu tiên, trong `init()`.
- Trạng thái học của từng thẻ lưu trong `localStorage` dưới key **`nihongo_srs_v1`**, dạng object: `{ [cardId]: CardState }`. `cardId` chính là field `id` trong `INDEX` (thường = ký tự kanji).
- `CardState = { ef, interval, reps, lapses, due, status }`:
  - `ef` — ease factor, khởi đầu `2.5`, tăng/giảm theo mỗi lần chấm điểm, tối thiểu `1.3`.
  - `interval` — số ngày tới lần ôn kế tiếp (chỉ có ý nghĩa khi `status = 'review'`).
  - `reps` — số lần đã chấm điểm liên tiếp thành công ở trạng thái hiện tại.
  - `lapses` — tổng số lần bấm "Quên" (Again) trong lịch sử thẻ đó.
  - `due` — timestamp (ms) của lần ôn tiếp theo; `null` nếu thẻ chưa từng được chạm tới.
  - `status` — `'new'` (chưa học) → `'learning'` (đang trong các bước học ngắn) → `'review'` (đã "tốt nghiệp", ôn theo chu kỳ dài dần).
- Theme sáng/tối lưu **riêng**, key `nihongo_theme_v1`, không liên quan gì đến `nihongo_srs_v1`.

### 2. Thuật toán chấm điểm — `KanjiSRS.reviewCard(cardState, grade)`

`grade`: `0 = Quên (Again)`, `1 = Khó (Hard)`, `2 = Tốt (Good)`, `3 = Dễ (Easy)`. Hàm thuần (không mutate input), trả về `CardState` mới:

- **Bấm Quên (bất kỳ trạng thái nào)**: `lapses += 1`, `reps` reset về 0, `status = 'learning'`, `due = now + 10 phút`, `ef` giảm 0.2 (tối thiểu 1.3). Thẻ quay lại từ đầu chu trình học.
- **Khi `status` là `'new'` hoặc `'learning'`** (chưa tốt nghiệp): có 2 bước học ngắn định nghĩa sẵn `LEARNING_STEPS = [10 phút, 1 ngày]`.
  - Nếu bấm **Dễ** ngay từ đầu: tốt nghiệp thẳng lên `status = 'review'`, `interval = 4 ngày`.
  - Nếu bấm Khó/Tốt và còn bước học chưa đi hết: chuyển sang bước kế tiếp trong `LEARNING_STEPS` *(hiện đang có bug off-by-one ở đây — xem BUG #2 bên dưới)*.
  - Nếu đã đi hết các bước học: tốt nghiệp lên `status = 'review'`, `interval = 1 ngày`.
- **Khi `status = 'review'`** (đã tốt nghiệp, ôn định kỳ dài hạn): `interval` mới = `interval cũ × hệ số`, hệ số là `1.2` (Khó), `ef` hiện tại (Tốt), hoặc `ef × 1.3` (Dễ); `ef` giảm 0.15 nếu Khó, tăng 0.15 nếu Dễ; `due = now + interval mới (ngày)`.

### 3. Xây hàng đợi ôn tập — `KanjiSRS.buildQueue(index, state, { newLimit = 20 })`

Duyệt toàn bộ `INDEX`, tách thành 2 nhóm: **thẻ due** (đã có `state`, `due <= now`) và **thẻ mới** (chưa có `state` trong `nihongo_srs_v1`, hoặc `due === null`). Thẻ due được sort theo `due` tăng dần (hạn cũ nhất lên trước). Lấy tối đa `newLimit` thẻ mới (mặc định 20/phiên). Trộn xen kẽ: cứ 4 thẻ due thì chèn 1 thẻ mới, lặp lại tới khi hết cả 2 danh sách. Kết quả là mảng thẻ theo đúng thứ tự sẽ hiển thị trong phiên ôn tập.

### 4. Luồng UI khi bấm nút "Ôn tập" (`#reviewBtn`, icon hình thẻ bài có badge số due)

1. `enterReviewMode()` chạy: gọi `KanjiSRS.getDueCount(INDEX, state)` — nếu bằng 0 thì hiện thông báo nhẹ "Chưa có thẻ nào cần ôn hôm nay" rồi dừng lại *(đây chính là BUG #1 — xem bên dưới)*. Nếu không, gọi `buildQueue()` để tạo `reviewQueue`, đặt `reviewPos = 0`, đặt `appMode = 'review'`.
2. Ẩn toàn bộ UI của chế độ duyệt tự do (`.controls` prev/flip/next, `.jump-controls`, `.progress`, `.progress-track`, `.page-label`), hiện khối `#reviewControls`.
3. `loadReviewCard()`: lấy thẻ tại `reviewQueue[reviewPos]`. Nếu thẻ đó thuộc trang (`page`) khác trang đang hiển thị, gọi lại `loadPage()` có sẵn để fetch đúng file `data/pages/page-N.json`; sau đó set `idx = item.i` và gọi `render()` — **tái sử dụng nguyên vẹn** cơ chế render thẻ/SVG/animation của chế độ duyệt tự do, không viết lại.
4. Ban đầu thẻ hiện mặt trước (chưa lật), khối `#reviewFlipRow` (nút "Lật thẻ") hiển thị, `#reviewGradeRow` (4 nút chấm điểm) ẩn.
5. Người dùng lật thẻ bằng: nút "Lật thẻ" riêng, hoặc phím Space/Enter (đã có check `appMode === 'review'` đúng) → gọi `showReviewGradeButtons()`, ẩn hàng nút lật, hiện hàng 4 nút chấm điểm. **Chạm trực tiếp vào chính thẻ bài lại KHÔNG kích hoạt luồng này** *(BUG #3)*.
6. Người dùng bấm 1 trong 4 nút (hoặc phím số 1/2/3/4, đã wire sẵn trong keydown handler): `submitGrade(grade)` → đọc `state` mới nhất từ `localStorage`, tính `CardState` mới qua `KanjiSRS.reviewCard()`, ghi đè `state[item.id]`, lưu lại toàn bộ `state` qua `KanjiSRS.saveState()`, tăng `reviewPos`, gọi lại `loadReviewCard()` cho thẻ tiếp theo.
7. Khi `reviewPos >= reviewQueue.length` (hết hàng đợi): `showReviewComplete()` — ẩn `#reviewControls`, hiện `#reviewComplete` (màn "Hoàn thành ôn tập hôm nay!" kèm nút "Quay lại duyệt"), đồng thời gọi lại `updateReviewBadge()` để cập nhật số due còn lại (phòng trường hợp có thẻ vừa lỡ hẹn 10 phút quay lại due ngay trong phiên).
8. Bấm "Quay lại duyệt" (`#reviewBackBtn`): `exitReviewMode()` — set `appMode = 'browse'`, ẩn UI review, hiện lại toàn bộ UI duyệt tự do như cũ, cập nhật badge.

### 5. Badge số due trên nút Ôn tập

`updateReviewBadge()` chạy sau khi `loadIndex()` xong trong `init()`, và mỗi khi thoát chế độ ôn tập / hoàn thành phiên. Hiện đang tính bằng `KanjiSRS.getDueCount(INDEX, state)` — cùng hàm gây ra BUG #1, nên badge cũng bị ảnh hưởng tương tự (không đếm thẻ mới).

### 6. Liên kết với tính năng Search

Dropdown kết quả search (`renderDropdown()` trong `index.html`) gọi `getSrsStatus(cardId)` → `KanjiSRS.getCard(state, id).status` để hiển thị 1 chip nhỏ cạnh mỗi kết quả: "Mới" (`new`), "Đang học" (`learning`), "Cần ôn" (`review`, dùng chung nhãn cho cả thẻ review dù due hay chưa due — chip không phân biệt được 2 trường hợp này). Đây là điểm đọc dữ liệu duy nhất từ `nihongo_srs_v1` bên ngoài luồng ôn tập chính.

## BUG #1 (NGHIÊM TRỌNG — CHẶN HOÀN TOÀN TÍNH NĂNG)

**Hiện tượng**: Người dùng mới (chưa từng học, `localStorage` trống) bấm nút "Ôn tập" → luôn nhận thông báo "Chưa có thẻ nào cần ôn hôm nay", badge trên nút Ôn tập luôn ẩn/= 0 — **dù có 2134 thẻ hoàn toàn mới đang chờ học**. Tính năng không thể dùng được ngay từ lần đầu tiên.

**Nguyên nhân đã xác nhận bằng test Node**:
```js
const SRS = require('./srs.js');
const index = [{id:'a'},{id:'b'},{id:'c'}];
const state = {}; // fresh install
SRS.getDueCount(index, state);        // → 0
SRS.buildQueue(index, state).length;  // → 3  (!!)
```
`getDueCount()` trong `srs.js` (hàm cuối file) chỉ đếm thẻ **đã có state VÀ due <= now** — cố tình bỏ qua thẻ mới toanh (`!cs`). Nhưng `enterReviewMode()` trong `index.html` lại dùng đúng `getDueCount() === 0` làm điều kiện chặn vào chế độ ôn tập, và `updateReviewBadge()` cũng dùng cùng hàm này để hiển thị badge. Vì vậy trên mọi trình duyệt chưa có lịch sử học, badge/gate luôn báo "0" bất kể có bao nhiêu thẻ mới.

**Cách sửa**: Không đổi ý nghĩa `getDueCount()` (nó vẫn đúng để phân biệt "due" khỏi "new" cho các mục đích khác như chip trạng thái). Thay vào đó:
- Thêm 1 hàm mới trong `srs.js`, ví dụ `getLearnableCount(index, state, opts)`, trả về `due-count + số thẻ mới (giới hạn newLimit, mặc định 20)` — tức là đúng bằng `buildQueue(index, state, opts).length` nhưng không cần build cả mảng đầy đủ nếu muốn tối ưu (hoặc đơn giản nhất: `return buildQueue(index, state, opts).length;` — ưu tiên đơn giản, đúng hơn tối ưu sớm).
- Sửa `enterReviewMode()` trong `index.html`: đổi điều kiện chặn từ `KanjiSRS.getDueCount(INDEX, state) === 0` sang kiểm tra `reviewQueue.length === 0` SAU KHI đã gọi `buildQueue()` (tức là build queue trước, rồi mới kiểm tra rỗng hay không — không cần gọi `getDueCount` riêng nữa ở bước gate này).
- Sửa `updateReviewBadge()`: đổi từ `getDueCount()` sang `getLearnableCount()` (hoặc `buildQueue(...).length`) để badge phản ánh đúng "có bao nhiêu thẻ có thể học/ôn ngay bây giờ", không chỉ riêng thẻ due.

## BUG #2 — Bỏ qua bước học 10 phút đầu tiên (thuật toán SM-2)

Trong `reviewCard()`, khối xử lý `status === 'new' || status === 'learning'`:
```js
if (cs.reps < LEARNING_STEPS.length - 1) {
  cs.reps++;
  cs.status = 'learning';
  cs.due    = now + LEARNING_STEPS[cs.reps];   // ← BUG: dùng reps SAU khi đã ++
  return cs;
}
```
`LEARNING_STEPS = [10 phút, 1 ngày]`. Vì code tăng `reps` trước rồi mới lấy `LEARNING_STEPS[reps]`, lần học đầu tiên (reps 0→1) lấy luôn `LEARNING_STEPS[1]` = 1 ngày, bỏ qua hoàn toàn bước 10 phút (`LEARNING_STEPS[0]`) — mọi thẻ mới "tốt nghiệp" chỉ sau 1 lần chấm đúng thay vì 2 lần như thiết kế.

**Cách sửa**: Lấy `LEARNING_STEPS[cs.reps]` TRƯỚC khi tăng `reps`, hoặc đổi thứ tự: tăng `reps` sau khi đã dùng để index. Test lại bằng cách mô phỏng: thẻ mới → bấm "Tốt" lần 1 → `due` phải là **~10 phút sau**, không phải 1 ngày.

## BUG #3 — Chạm trực tiếp vào thẻ trong chế độ Ôn tập không hiện nút chấm điểm

Handler gắn trên `#card`:
```js
card.addEventListener("click", () => {
  abortAnimation();
  setFlipped(!flipped);
});
```
Handler này không kiểm tra `appMode`. Trong chế độ browse thì đúng, nhưng trong chế độ `review`, lật thẻ theo cách này **không gọi `showReviewGradeButtons()`** (khác với handler bàn phím Space/Enter đã có check `appMode === 'review'` đúng ở dòng ~794-799). Kết quả: người dùng chạm trực tiếp vào thẻ (thao tác tự nhiên nhất, nhất là mobile) để xem đáp án, nhưng không thấy 4 nút Quên/Khó/Tốt/Dễ xuất hiện — kẹt UI.

**Cách sửa**: Thêm nhánh `appMode === 'review'` vào handler click của `#card`, giống logic đã đúng trong keydown handler:
```js
card.addEventListener("click", () => {
  abortAnimation();
  if (appMode === 'review') {
    if (!flipped) {
      setFlipped(true);
      showReviewGradeButtons();
    }
    // nếu đã flipped rồi, tap vào thẻ trong review mode không nên lật ngược lại
    // (ép người dùng phải chấm điểm bằng 1 trong 4 nút, không cho "trốn" bằng cách lật lại)
    return;
  }
  setFlipped(!flipped);
});
```

## BUG #4 — Toàn bộ text mới thêm cho chế độ Ôn tập bị mất dấu tiếng Việt

So với text cũ trong app (có dấu đầy đủ: "Tìm kanji, âm HV…", "Chưa có thẻ nào cần ôn"...), các chuỗi mới thêm cho review mode bị thiếu dấu hoàn toàn:

| Vị trí | Hiện tại (sai) | Sửa thành |
|---|---|---|
| `reviewFlipBtn` text | `Lat the` | `Lật thẻ` |
| `gradeAgain` | `Quen` | `Quên` |
| `gradeHard` | `Kho` | `Khó` |
| `gradeGood` | `Tot` | `Tốt` |
| `gradeEasy` | `De` | `Dễ` |
| `.review-complete-title` | `Hoan thanh on tap hom nay!` | `Hoàn thành ôn tập hôm nay!` |
| `reviewCompleteStats` (mặc định trong HTML) | `Ban da on xong tat ca cac the.` | `Bạn đã ôn xong tất cả các thẻ.` |
| `reviewCompleteStats` (set bằng JS trong `showReviewComplete()`) | `` `Ban da on xong ${reviewTotal} the trong phien nay.` `` | `` `Bạn đã ôn xong ${reviewTotal} thẻ trong phiên này.` `` |
| `reviewBackBtn` | `Quay lai duyet` | `Quay lại duyệt` |
| `showEmptyNotice()` | `Chua co the nao can on hom nay.` | `Chưa có thẻ nào cần ôn hôm nay.` |
| `updateReviewProgress()` | `` `Tien trinh: <b>${reviewPos}</b> / <b>${reviewTotal}</b> the` `` | `` `Tiến trình: <b>${reviewPos}</b> / <b>${reviewTotal}</b> thẻ` `` |

Kiểm tra kỹ toàn bộ file `index.html` xem còn chuỗi tiếng Việt mất dấu nào khác không (grep các từ có nguyên âm không dấu đứng cạnh phụ âm cuối kiểu tiếng Việt), không chỉ sửa đúng danh sách trên.

## Ràng buộc

- Sửa đúng, tối thiểu — không refactor lại toàn bộ file, không đổi tên biến/hàm đang hoạt động tốt.
- Sau khi sửa BUG #1 và #2, viết lại đúng đoạn test Node ở trên (hoặc tương tự) để tự xác nhận: (a) fresh state → `buildQueue().length > 0` khi có thẻ mới, `enterReviewMode()` không còn bị chặn; (b) thẻ mới bấm "Tốt" lần đầu → `due` ~10 phút sau, không phải 1 ngày.
- Không cần bump lại `STATIC_CACHE` trong `sw.js` nếu chỉ sửa nội dung `srs.js`/`index.html` — nhưng nếu bạn thực sự deploy bản vá, nhớ bump version cache (`v3 → v4`) để service worker không tiếp tục phục vụ bản lỗi từ cache (đã có tiền lệ vấn đề này trong dự án).

## Việc cần giao nộp

1. `srs.js` — sửa BUG #1 (thêm hàm learnable count hoặc dùng lại `buildQueue`) và BUG #2 (off-by-one learning step).
2. `index.html` — sửa `enterReviewMode()`/`updateReviewBadge()` cho BUG #1, sửa handler click `#card` cho BUG #3, sửa toàn bộ text cho BUG #4.
3. Nếu có bump cache: `sw.js` version mới.
4. Tóm tắt ngắn: đã test lại bằng cách nào, kết quả trước/sau cho từng bug.
