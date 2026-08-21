# BÁO CÁO REVIEW & ĐÁNH GIÁ NGHIỆP VỤ

## Hệ thống Xếp Thời khóa biểu THPT — đối chiếu code với thực tế vận hành

> Ngày review: 11/08/2026 · Nhánh `main` · Commit `fd3a221`
> Tài liệu liên quan: [ROADMAP.md](ROADMAP.md)

---

## 1. Phạm vi & phương pháp

Review toàn bộ 3 module `BE_TKB` · `FE_TKB` · `DB_TKB`, đọc trực tiếp mã nguồn (không chạy hệ thống), đối chiếu với:

- Chương trình GDPT 2018 cấp THPT (cơ cấu môn học, số tiết/tuần)
- Thực tế vận hành thời khóa biểu ở trường THPT Việt Nam
- Chính tài liệu nghiệp vụ của dự án: `readme.md`, `readme1.md`, `readmedb.md`

**Quy ước đánh giá:**

| Ký hiệu | Ý nghĩa |
| :---: | :--- |
| ✅ | Khớp thực tế, dùng được |
| 🟡 | Đúng hướng nhưng còn thiếu |
| 🟠 | Lệch thực tế, cần sửa |
| 🔴 | Chưa dùng được / không hoạt động |

---

## 2. Bảng tổng kết 12 luồng chức năng

| # | Luồng | Mức | Nhận định một dòng |
| :---: | :--- | :---: | :--- |
| 1 | Thiết lập năm học / học kỳ | ✅ | Mô hình đúng, tách HK1/HK2 hợp lý |
| 2 | Import Excel phân công | ✅ | Điểm mạnh nhất của dự án, bám sát mẫu thật |
| 3 | Quản lý phòng học | 🟡 | Mô hình đúng nhưng phòng chức năng chưa được dùng |
| 4 | Quản lý môn học | ✅ | Danh mục GDPT 2018 đầy đủ |
| 5 | Quản lý giáo viên | 🟡 | Có định mức & giảm trừ nhưng thuật toán không đọc |
| 6 | Quản lý lớp & tổ hợp | 🟠 | Không mô hình được nhóm học liên lớp (chuyên đề) |
| 7 | Phân công chuyên môn | 🟡 | `block_config` bị dùng sai mục đích |
| 8 | Đăng ký lịch bận GV | 🟠 | Lưu đúng nhưng **thuật toán không tôn trọng khi xếp** |
| 9 | **Sinh TKB tự động** | 🔴 | **Chưa chuẩn — xem mục 4** |
| 10 | Điều chỉnh thủ công | 🟡 | Chỉ kiểm tra xung đột lớp, bỏ sót GV & phòng |
| 11 | Xuất Excel | ✅ | Hoạt động đúng |
| 12 | Cổng giáo viên | 🟠 | Giáo viên đang nhìn thấy cả bản nháp |

---

## 3. Đánh giá chi tiết từng luồng

### 3.1 — Thiết lập năm học / học kỳ ✅

**Code:** `AcademicYear` → `Semester` với `term_order`, `is_current`. Endpoint `/system/years`, `/system/semesters`.

**Thực tế:** Trường THPT vận hành theo năm học 2 học kỳ, phân công có thể khác nhau giữa 2 kỳ (GV nghỉ thai sản, luân chuyển). Mô hình khớp.

**Còn thiếu:**

- `AcademicYear.weeks` (mặc định 35) khai báo nhưng không nơi nào dùng
- Không có khái niệm **tuần thực học** — không phân biệt tuần 1 với tuần 20, nên không mô hình được lịch theo tuần

---

### 3.2 — Import Excel phân công ✅

**Code:** `excel.service.ts` (1637 dòng) đọc 8 sheet, validate theo dòng/cột, upsert trong transaction, có cả template và export ngược.

**Thực tế:** Đây là **đúng cách trường THPT làm việc**. Tổ trưởng chuyên môn nộp bảng phân công bằng Excel, giáo vụ tổng hợp. Việc hệ thống nhận thẳng file thay vì bắt nhập tay 1.240 dòng là quyết định thiết kế chính xác.

**Điểm tốt:**

- Tách `periodsHk1` / `periodsHk2` và `teacherHk1` / `teacherHk2` — phản ánh đúng việc GV có thể đổi giữa 2 kỳ
- Có `HEADER_ALIASES`, `SHEET_ALIASES` — chấp nhận file đặt tên cột khác nhau
- Danh mục môn `SUBJECT_CATALOG` phủ đủ GDPT 2018 kèm alias

**Còn thiếu:**

- Import **thay thế toàn bộ** (`assignments: { deleted, created }`). Thêm 1 phân công giữa kỳ phải import lại cả file
- Không có bản xem trước (preview) trước khi ghi — sai một ô là ghi đè hết

---

### 3.3 — Quản lý phòng học 🟡

**Code:** `Room` có `type` (7 loại gồm 4 loại Lab), `floor`, `capacity`. Lớp có `fixed_room_id`.

**Thực tế:** Ở THPT Việt Nam **học sinh ngồi cố định một phòng, giáo viên di chuyển**. Mô hình `fixed_room_id` là chính xác — nhiều phần mềm nước ngoài mô hình ngược lại và không dùng được ở Việt Nam.

**Vấn đề:**

- `getValidRooms()` — hàm phân bổ phòng Lab theo môn (Tin → 314/315, Lý → 301, Hóa → 302, Sinh → 303) đã viết đầy đủ ở `constraint.service.ts:84` nhưng **không nơi nào gọi**
- Mọi tiết đều gán `roomId = cls.fixed_room_id`, kể cả tiết thực hành
- Hệ quả: bài toán xung đột phòng thực chất **không tồn tại** trong hệ thống hiện tại, vì mỗi lớp một phòng riêng nên không bao giờ đụng nhau

→ Ràng buộc cứng "không trùng phòng" đang được thỏa mãn một cách tầm thường, không phải nhờ thuật toán.

---

### 3.4 — Quản lý môn học ✅

`SUBJECT_CATALOG` phủ đủ: môn bắt buộc, môn lựa chọn, hoạt động tập thể (`CHAO_CO`, `SH_CUOI_TUAN`), `GDDP`, `HDTN`, `GDTC`, `GDQP`.

**Lưu ý nhỏ:** chỉ `CHAO_CO` và `SH_CUOI_TUAN` được đánh `isSpecial: true`. `GDDP` và `HDTN` không được đánh dấu, nên logic tìm "môn văn hóa của GVCN" ở `algorithm.service.ts:158-162` có thể chọn nhầm GDĐP làm môn dạy tiết 2 thứ Hai.

---

### 3.5 — Quản lý giáo viên 🟡

**Code:** `Teacher` có `max_periods_per_week`, `workload_reduction`, `department`, `status`.

**Thực tế:** Định mức GV THPT là **17 tiết/tuần** theo quy định hiện hành, trừ đi giảm trừ do kiêm nhiệm (GVCN, tổ trưởng chuyên môn, bí thư Đoàn...). Mô hình có 2 trường này là đúng hướng.

**Vấn đề nghiêm trọng:**

```
grep max_periods_per_week / workload_reduction trong BE_TKB/src
→ chỉ xuất hiện trong excel.service.ts (import/export)
→ KHÔNG có trong algorithm/ hay constraint.service.ts
```

**Thuật toán hoàn toàn không biết đến định mức tiết/tuần.** Một giáo viên có thể bị xếp 30 tiết/tuần mà hệ thống không cảnh báo gì. Ràng buộc `weekly-limit-teacher.constraint.ts` có tồn tại — nhưng nằm trong thư mục code chết không được import.

**Thiếu:** mặc định `max_periods_per_week = 20` nên đổi thành 17 cho khớp quy định.

---

### 3.6 — Quản lý lớp & tổ hợp môn 🟠

**Code:** `Class` có `combination_code`, `grade_level`, `main_session`. Bảng `CurriculumCombination` lưu 4 môn lựa chọn + 3 chuyên đề.

**Thực tế GDPT 2018:** Học sinh chọn 4 môn lựa chọn từ các nhóm. Trường xử lý bằng cách **xếp học sinh vào lớp theo tổ hợp** — mô hình hiện tại khớp với cách làm này.

**Nhưng bỏ sót một tình huống rất phổ biến:**

> Nhiều trường **tách nhóm liên lớp** cho môn lựa chọn hoặc cụm chuyên đề. Ví dụ 10A1 + 10A2 + 10A3 xé ra thành các nhóm Lý / Hóa / Sinh học chung.

`TimetableSlot` gắn cứng vào **một** `class_id`. Không có khái niệm "nhóm học". Bảng `CurriculumCombination` có 3 trường `special_topic_code_*` cho chuyên đề nhưng mô hình xếp lịch không dùng được chúng.

→ Nếu trường áp dụng mô hình tách nhóm, hệ thống **không mô hình được**. Đây là hạn chế cấu trúc, không sửa nhanh được.

---

### 3.7 — Phân công chuyên môn 🟡

**Code:** `TeachingAssignment(semester, class, teacher, subject, total_periods, period_type, block_config)`.

**Lỗi phát hiện:**

```ts
// excel.service.ts:330 và :347
block_config: row.notes ?? null,
```

`block_config` — trường mô tả cấu hình tiết đôi (`"2+1"`) — đang bị dùng để **lưu cột Ghi chú**. Và ở chiều ngược lại:

```ts
// excel.service.ts:826
notes: assignment.block_config ?? '',
```

Hai trường bị hoán đổi ngữ nghĩa. Ngoài ra `block_config` **không được thuật toán đọc ở bất kỳ đâu** — xem mục 4.3.

---

### 3.8 — Đăng ký lịch bận giáo viên 🟠

**Code:** `TeacherConstraint(day_of_week, period, session, type)`. FE `/teacher/feedback` gửi `{day, period, session}`, `teacher-alias.controller.ts` chuyển thành constraint.

**Phần đúng:** chuyển đổi tiết tuyệt đối ↔ tiết tương đối trong `isTeacherBusy()` chính xác (tiết 1-5 = session 0, 6-10 = session 1).

**Ba vấn đề thực tế:**

**a) Thuật toán không tôn trợng lịch bận khi xếp.** Đây là phát hiện quan trọng nhất của luồng này:

```
isTeacherBusy() được gọi tại:
  ✓ getConflicts()          — sau khi đã xếp xong
  ✓ checkHardConstraints()  — chấm điểm
  ✓ getFitnessDetails()     — báo cáo
  ✗ phase1_FixedSlots()     — KHÔNG gọi
  ✗ phase2_Heuristic()      — KHÔNG gọi
```

Phase 2 chỉ gọi `checkTeacherConflict()` — hàm này chỉ so với các tiết **đã xếp**, không so với lịch bận đã đăng ký. Nghĩa là **greedy vô tư xếp giáo viên vào đúng ô họ đã báo bận**, rồi để phase 3 với 50 vòng lặp đi dọn. Thực tế phase 3 không đủ sức dọn.

**b) Không có hạn đăng ký.** Thực tế trường mở cổng đăng ký, chốt hạn, rồi mới xếp. Hệ thống không có trạng thái này — GV sửa lịch bận sau khi TKB đã xếp thì không có gì xảy ra.

**c) Không giới hạn số ô được đăng ký.** FE có dòng chữ nghiêng nhắc nhở, không có ràng buộc. Một GV đăng ký bận 25/30 ô sẽ làm bài toán bất khả thi mà không ai biết trước.

---

### 3.9 — Sinh TKB tự động 🔴

Xem đánh giá riêng ở **mục 4**.

---

### 3.10 — Điều chỉnh thủ công 🟡

**Code:** `moveSlot()` hoán đổi 2 tiết, `toggleLock()` khóa/mở.

**Đúng:** dùng transaction 3 bước để tránh vi phạm unique index khi swap; tự động khóa tiết sau khi kéo (hợp lý — thao tác tay là chủ ý của người dùng).

**Sai:** tìm tiết đích chỉ theo `class_id`:

```ts
// algorithm.service.ts:522
const targetSlot = await this.prisma.timetableSlot.findFirst({
  where: { timetable_id, class_id, day: newDay, period: newPeriod }
});
```

Bảng có 3 unique index (lớp / giáo viên / phòng). Kéo một tiết vào ô làm giáo viên trùng giờ → Prisma ném lỗi P2002 thô, FE chỉ hiện *"Không thể cập nhật vị trí tiết học"*. Người dùng không biết vì sao.

**Thiếu:** không có gợi ý ô hợp lệ khi kéo (readme mục 3.3 có hứa), không có xem trước tác động.

---

### 3.11 — Xuất Excel ✅

`export.service.ts` + `/algorithm/export/:semesterId` hoạt động, đặt `Content-Disposition` đúng cho tên file tiếng Việt.

**Thiếu:** chưa có bản xuất theo từng lớp / từng GV để in dán bảng tin; chưa có PDF.

---

### 3.12 — Cổng giáo viên 🟠

**Vấn đề:** `getResult()` lấy TKB mới nhất **không lọc `is_official`**:

```ts
// algorithm.producer.ts:38
const latestTkb = await this.prisma.generatedTimetable.findFirst({
  where: { semester_id: semesterId },
  orderBy: { created_at: 'desc' },   // ← không có is_official
});
```

Và `is_official` **chưa từng được ghi ở bất kỳ đâu** — grep toàn dự án chỉ thấy 1 chỗ đọc, 0 chỗ ghi.

→ Giáo viên đang nhìn thấy **bản nháp mới nhất**, kể cả bản còn đầy lỗi vừa chạy thử. Ở trường thật đây là tình huống không chấp nhận được: TKB chưa duyệt mà đã lan ra toàn trường.

---

## 4. ĐÁNH GIÁ TRỌNG TÂM — Thuật toán sinh TKB đã chuẩn chưa?

### Kết luận ngắn: **Chưa chuẩn. Kết quả sinh ra chạy demo được nhưng chưa dùng được ở trường thật.**

Dưới đây là căn cứ.

---

### 4.1 — Phase 1: Xếp tiết cố định 🟠

**Làm gì:** duyệt mọi lớp × ngày × tiết, hỏi `checkFixedSlot()` xem ô đó có phải tiết cố định không.

**Bộ quy tắc đang hardcode trong `constraint.service.ts:140-175`:**

| Ô | Nội dung |
| :--- | :--- |
| Thứ 2 tiết 1 | Chào cờ |
| Thứ 2 tiết 2 | GVCN dạy môn của mình |
| Thứ 5 tiết 1 | Giáo dục địa phương |
| Thứ 5 tiết 2 | Hoạt động trải nghiệm |
| Thứ 7 tiết 4 | GVCN dạy |
| Thứ 7 tiết 5 | Sinh hoạt cuối tuần |

**Đối chiếu thực tế:**

- Chào cờ Thứ 2 tiết 1 — ✅ đúng phổ biến toàn quốc
- Sinh hoạt lớp tiết cuối Thứ 7 — ✅ đúng với trường học 6 ngày
- GVCN dạy tiết 2 Thứ 2 và tiết 4 Thứ 7 — 🟠 **quy tắc riêng của một trường cụ thể**, không phổ quát
- GDĐP tiết 1 và HĐTN tiết 2 Thứ 5 — 🟠 tương tự

**Vấn đề lớn nhất: toàn bộ quy tắc nằm trong code, không phải trong dữ liệu.** Trường khác muốn dùng phải sửa mã nguồn và build lại. Một hệ thống xếp TKB đúng chuẩn phải cho phép cấu hình tiết cố định từ giao diện.

**Thêm:** vòng lặp luôn chạy `for (d = 2; d <= 7; d++)` — cố định 6 ngày. **Nhiều trường THPT hiện đã học 5 ngày/tuần, nghỉ Thứ 7.** Hệ thống không hỗ trợ.

---

### 4.2 — Phát hiện nghiêm trọng: Lưới thời gian bị bóp quá chặt 🔴

Trong `phase2_Heuristic` có 2 dòng chặn ô, xuất hiện ở cả nhánh xếp block lẫn nhánh xếp thường:

```ts
// algorithm.service.ts:290-291 và :341-342
if (day === 2 && period === 1) continue;                      // Thứ 2 tiết 1
if (day === 5 && ![1, 2, 6, 7].includes(period)) continue;    // Thứ 5
```

Dòng thứ hai chặn **Thứ 5 chỉ còn tiết 1, 2 (sáng) và 6, 7 (chiều)**. Tức Thứ 5 mỗi buổi chỉ có **2 tiết**, ba tiết còn lại bị khóa cứng.

**Tính sức chứa cho một lớp học buổi sáng:**

| Thứ | Số ô khả dụng | Ghi chú |
| :---: | :---: | :--- |
| 2 | 5 | tiết 1 chào cờ, tiết 2 GVCN |
| 3 | 5 | |
| 4 | 5 | |
| **5** | **2** | ← chỉ tiết 1 (GDĐP) + tiết 2 (HĐTN) |
| 6 | 5 | |
| 7 | 5 | tiết 4 GVCN, tiết 5 sinh hoạt |
| | **27** | trong đó **6 ô đã là tiết cố định** |

→ **Còn 21 ô trống cho toàn bộ môn văn hóa.**

**Nhu cầu theo GDPT 2018 cấp THPT:** khoảng **29 tiết/tuần**. Trừ GDTC (2 tiết) và GDQP (1 tiết) xếp trái buổi, buổi chính vẫn cần **~26 tiết**, trong đó 6 tiết cố định đã tính → cần **~20 ô trống**.

**21 ô có / 20 ô cần = dư đúng 1 ô.**

Kết luận: **lưới thời gian gần như bão hòa hoàn toàn.** Chỉ cần một lớp có thêm 2 tiết chuyên đề, hoặc một GV đăng ký bận vài ô, là bài toán trở thành bất khả thi. Và code đã có sẵn đường xử lý cho tình huống này:

```ts
// algorithm.service.ts:374
this.logger.warn(`[WARNING] Class ${cls.name}: Incomplete Schedule.
                  Remaining: ${mainSessionSlots.length} Main, ...`);
```

→ Nghi vấn: **hệ thống nhiều khả năng đang sinh ra TKB thiếu tiết một cách có hệ thống**, và chỉ ghi warning vào log chứ không báo cho người dùng.

> ⚠️ **Cần kiểm chứng:** quy tắc chặn Thứ 5 có thể phản ánh một chính sách thật của trường (ví dụ chiều Thứ 5 họp chuyên môn). Nhưng kể cả vậy, việc chặn 3/5 tiết **buổi sáng** Thứ 5 vẫn cần được xác nhận lại — nếu là nhầm lẫn thì đây là lỗi nghiêm trọng nhất trong toàn hệ thống.

---

### 4.3 — Phase 2: Heuristic tham lam 🟠

**Làm đúng:**

- Tách môn trái buổi (GDTC, GDQP) và xếp thành khối liên tiếp ✅ — đúng thực tế
- Đảm bảo mỗi ngày chỉ có một môn trái buổi ✅ — hợp lý, tránh học sinh phải đến trường 2 lần nhiều ngày
- Trừ đi số tiết đã xếp ở phase 1 (`alreadyAssigned`) trước khi tính `remainingNeeded` ✅ — không bị đếm trùng
- Xáo trộn ngẫu nhiên danh sách trước khi xếp ✅ — tạo đa dạng giữa các lần chạy

**Làm thiếu — 4 điểm:**

| Bỏ sót | Hệ quả thực tế |
| :--- | :--- |
| Không gọi `isTeacherBusy()` | Xếp GV vào đúng ô họ báo bận |
| Không đọc `block_config` | **Tiết đôi không bao giờ được xếp liền** |
| Không kiểm tra `max_periods_per_week` | GV có thể bị xếp vượt định mức không giới hạn |
| Không gọi `getValidRooms()` | Tiết thực hành không vào phòng Lab |

Riêng **tiết đôi** đáng nói thêm. `readme.md` mục 3.1 ghi rõ:

> *"Một số môn (Toán, Văn) cần học liền 2 tiết (Block Assignment), hệ thống phải ghi nhận cấu hình này để không xếp rời rạc."*

Thực tế trong code: `block_config` không được đọc, và ràng buộc mềm `checkBlock2()` áp dụng cho một **danh sách môn hardcode** `['TOAN','VAN','NGU_VAN','TIN','LY','HOA','SINH']` bất kể phân công cấu hình thế nào. Tức là hệ thống **phạt** khi tiết bị xé lẻ, nhưng **không bao giờ chủ động xếp liền**. Phạt một thứ mà không có cơ chế tạo ra nó là thiết kế mâu thuẫn.

---

### 4.4 — Phase 3: Tối ưu hóa 🔴

```ts
const GENERATIONS = 50;
for (let gen = 0; gen < GENERATIONS; gen++) {
  // chọn 1 tiết đang xung đột
  // chọn ngẫu nhiên 1 tiết khác CÙNG LỚP
  // hoán đổi, giữ lại nếu điểm tăng
}
```

**Ba khuyết điểm chí mạng:**

**a) 50 vòng lặp cho ~700 tiết.** Mỗi vòng thử đúng 1 phép hoán đổi. Nếu phase 2 để lại 30 xung đột, phase 3 gỡ được nhiều nhất vài lỗi. Kết thúc vẫn còn ~25 lỗi cứng → điểm `1000 − 25×100 = −1500`.

**b) Chỉ hoán đổi trong cùng một lớp.** Xung đột phổ biến nhất là **một giáo viên bị xếp 2 lớp cùng giờ**. Loại xung đột này về bản chất cần di chuyển tiết **giữa hai lớp khác nhau** — không gian tìm kiếm hiện tại không chứa lời giải.

**c) Chỉ chấp nhận nước đi cải thiện.** Đây là hill climbing thuần, kẹt ở cực trị địa phương ngay lập tức. Không có cơ chế thoát (nhiệt độ như SA, danh sách cấm như Tabu, hay đột biến như GA).

**Sai lệch với tài liệu:** `readme1.md` mô tả đây là *"Genetic Algorithm"* với quần thể, lai ghép, đột biến. Không có thành phần nào trong số đó tồn tại. Hội đồng đọc code sẽ phát hiện ngay.

---

### 4.5 — Bảng ràng buộc: đã có gì, thiếu gì

**Ràng buộc cứng:**

| Ràng buộc | Kiểm tra khi xếp | Kiểm tra khi chấm | Đánh giá |
| :--- | :---: | :---: | :--- |
| GV không dạy 2 lớp cùng giờ | ✅ | ✅ | Đầy đủ |
| Lớp không học 2 môn cùng giờ | ✅ | ✅ | Đầy đủ |
| Phòng không chứa 2 lớp cùng giờ | ✅ | ✅ | Thỏa mãn tầm thường (mỗi lớp 1 phòng riêng) |
| **Không xếp vào ô GV báo bận** | ❌ | ✅ | 🔴 **Chỉ phát hiện sau, không phòng ngừa** |
| **Lớp không được trống tiết giữa buổi** | ❌ | ❌ | 🔴 **Hoàn toàn không có** |
| Không vượt định mức tiết/tuần | ❌ | ❌ | 🔴 Không có |
| Môn thực hành phải vào phòng Lab | ❌ | ❌ | 🔴 Không có |
| Tiết đôi phải liền nhau | ❌ | 🟡 | Chỉ phạt, không xếp |

**Ràng buộc mềm đang tính điểm** (`calculatePenalty`, trọng số hardcode):

| Mã | Nội dung | Trọng số | Áp dụng cho |
| :--- | :--- | :---: | :--- |
| SC01 | Môn học dồn cục | 10 | Lớp |
| SC02 | Môn nặng liên tiếp | 20 | Lớp |
| SC03 | Môn ưu tiên ở tiết cuối | 15 | Lớp |
| SC04 | Tiết đôi bị xé lẻ | 10 | Lớp |
| SC06 | Tiết trống giáo viên | 5 | **GV** |
| SC07 | GV dạy quá 4 tiết/buổi | 10 | **GV** |

---

### 4.6 — Khoảng trống nghiêm trọng nhất: lớp bị trống tiết giữa buổi

`checkNoHoles()` và `checkMaxLoad()` **chỉ chạy trên `teacherSchedule`**, không chạy trên `classSchedule`.

**Vì sao đây là vấn đề lớn nhất:** với giáo viên, một tiết trống giữa buổi chỉ là bất tiện. Với **một lớp học sinh**, tiết trống giữa buổi là điều **không thể chấp nhận** — 45 học sinh không có phòng để đi đâu, không có ai quản lý. Ở trường Việt Nam đây là ràng buộc **cứng**, không phải mềm.

Hiện tại hệ thống không kiểm tra điều này ở bất kỳ đâu:

- Phase 2 xếp tuần tự theo thứ tự tiết nên **tình cờ** cho ra lịch liền mạch
- Nhưng phase 3 hoán đổi tự do, và thao tác kéo-thả thủ công cũng tự do
- → Sau tối ưu hoặc sau chỉnh tay, lớp hoàn toàn có thể bị thủng tiết giữa buổi mà không cảnh báo gì

File `minimize-idle-class.constraint.ts` có tồn tại — nằm trong thư mục code chết không được import.

---

### 4.7 — Kết quả lưu vào DB không khớp kết quả tính toán 🔴

```ts
// algorithm.service.ts:498
await this.prisma.timetableSlot.createMany({
  data: slotsToCreate,
  skipDuplicates: true      // ← nuốt âm thầm
});
```

Bảng có 3 unique index. Tiết nào vi phạm sẽ bị **bỏ đi không báo lỗi**. Đồng thời:

```ts
// :78-82
const fitnessResult = this.constraintService.getFitnessDetails(solution.slots);
(solution as any).fitness_score = fitnessResult.score;   // điểm của lời giải TRONG BỘ NHỚ
const timetable = await this.saveToDatabase(...);        // lưu ít tiết hơn
```

→ **Điểm hiển thị cho người dùng là điểm của một thời khóa biểu không tồn tại trong cơ sở dữ liệu.** TKB thật có ít tiết hơn, và vì thiếu tiết nên có thể "sạch lỗi" một cách giả tạo.

Đây là lỗi làm mất tính tin cậy của toàn bộ con số đánh giá — và nếu hội đồng hỏi *"điểm 910 này nghĩa là gì"*, hiện tại không có câu trả lời đúng.

---

### 4.8 — Bảng chấm điểm tổng thể thuật toán

| Tiêu chí | Điểm | Nhận xét |
| :--- | :---: | :--- |
| Mô hình hóa bài toán | 8/10 | Schema tốt, unique index đặt đúng chỗ |
| Ràng buộc cứng | 4/10 | Thiếu 4 ràng buộc, 1 chỉ hậu kiểm |
| Ràng buộc mềm | 6/10 | Có 6 tiêu chí hợp lý nhưng bỏ sót phía học sinh |
| Chất lượng tối ưu hóa | 2/10 | 50 vòng, chỉ swap trong lớp, kẹt cực trị ngay |
| Tính cấu hình được | 2/10 | Tiết cố định, trọng số, số ngày học đều hardcode |
| Độ tin cậy kết quả | 3/10 | Điểm không khớp dữ liệu đã lưu |
| Phù hợp thực tế THPT VN | 5/10 | Nhiều quyết định đúng, nhưng lưới thời gian có vấn đề |
| | **30/70** | |

---

## 5. Ràng buộc thực tế THPT còn thiếu hoàn toàn

Ngoài các mục trên, đây là những tình huống thật ở trường mà hệ thống chưa mô hình được:

| Tình huống | Mức độ phổ biến | Đã có? |
| :--- | :---: | :---: |
| Lớp trống tiết giữa buổi | Xảy ra thường xuyên | ❌ |
| GV thỉnh giảng dạy nhiều trường (bận cả buổi) | Phổ biến | ❌ |
| GV nữ nuôi con nhỏ — tránh tiết 1 và tiết cuối | Phổ biến | ❌ |
| Tránh xếp GV cả sáng lẫn chiều cùng ngày | Rất phổ biến | ❌ |
| Trường học 5 ngày/tuần (nghỉ Thứ 7) | Đang tăng nhanh | ❌ |
| Môn 1 tiết / 2 tuần (tuần chẵn – lẻ) | Có ở một số môn | ❌ |
| Nhóm học liên lớp (chuyên đề, môn lựa chọn) | Phổ biến ở trường lớn | ❌ |
| Tuần kiểm tra giữa kỳ / cuối kỳ đảo lịch | Chắc chắn xảy ra | ❌ |
| Nghỉ lễ và lịch dạy bù | Chắc chắn xảy ra | ❌ |
| GV nghỉ ốm / thai sản giữa kỳ | Chắc chắn xảy ra | ❌ |
| GDQP dạy tập trung theo đợt thay vì hàng tuần | Tùy trường | ❌ |

---

## 6. Kết luận

### 6.1 — Trả lời câu hỏi trọng tâm

> **Hệ thống sinh thời khóa biểu đã chuẩn chưa?**

**Chưa.** TKB sinh ra hiện tại:

- ✅ Không để giáo viên dạy 2 lớp cùng giờ
- ✅ Không để lớp học 2 môn cùng giờ
- ❌ **Có thể xếp giáo viên vào đúng ô họ đã báo bận**
- ❌ **Có thể để lớp trống tiết giữa buổi** — không dùng được trên thực tế
- ❌ **Có thể để giáo viên vượt định mức tiết/tuần** không giới hạn
- ❌ **Không bao giờ xếp được tiết đôi liền nhau**
- ❌ **Không đưa tiết thực hành vào phòng Lab**
- ❌ **Nhiều khả năng thiếu tiết có hệ thống** do lưới thời gian bị bóp quá chặt
- ❌ **Điểm đánh giá không phản ánh dữ liệu thật đã lưu**

Đủ để chạy một buổi demo có kịch bản. **Chưa đủ để một trường THPT dùng thật.**

### 6.2 — Điểm mạnh cần giữ

Cần ghi nhận rõ, vì đây là nền móng tốt:

1. **Module Excel** — chỉn chu, bám sát cách trường làm việc thật, có validate và transaction
2. **Schema Prisma** — sạch sẽ, 3 unique index đặt đúng chỗ, tách 6 phân hệ rõ ràng
3. **Mô hình phòng cố định theo lớp** — đúng thực tế Việt Nam, nhiều phần mềm nước ngoài làm ngược
4. **Tách BullMQ worker** cho tác vụ dài — lựa chọn kiến trúc đúng
5. **Cơ chế khóa tiết và giữ qua các lần chạy lại** — thiết kế tốt, ít phần mềm có

### 6.3 — Thứ tự khắc phục

Ánh xạ sang [ROADMAP.md](ROADMAP.md):

| Ưu tiên | Vấn đề | Feature |
| :---: | :--- | :--- |
| 1 | Xác minh lại quy tắc chặn Thứ 5 và sức chứa lưới | *cần trao đổi với trường* |
| 2 | Điểm số không khớp DB (`skipDuplicates`) | `0.8` |
| 3 | Lịch bận GV không được tôn trọng khi xếp | `0.17` |
| 4 | Lớp trống tiết giữa buổi — thêm ràng buộc cứng | `0.17` |
| 5 | Định mức tiết/tuần không được kiểm tra | `0.17` |
| 6 | Tiết thực hành không vào Lab | `0.11` |
| 7 | Tiết đôi không được xếp | *bổ sung vào* `0.11` |
| 8 | `block_config` bị dùng nhầm cho cột Ghi chú | `0.11` |
| 9 | Chất lượng tối ưu hóa quá yếu | `A1` |
| 10 | Tiết cố định hardcode, không cấu hình được | `0.13` |
| 11 | GV thấy bản nháp (`is_official` không được ghi) | `B5` |
| 12 | Tiền kiểm tính khả thi trước khi chạy | `A3` |

### 6.4 — Ba việc cần làm ngay

1. **Kiểm chứng quy tắc Thứ 5 với trường thật.** Nếu đây là nhầm lẫn, sửa 2 dòng code sẽ giải quyết được vấn đề thiếu tiết hệ thống.
2. **Chạy thuật toán trên dữ liệu mẫu và đếm thủ công**: số tiết yêu cầu vs số tiết thực sự lưu trong `timetable_slots`. Con số chênh lệch sẽ cho biết mức độ nghiêm trọng thực tế.
3. **Thêm 2 ràng buộc cứng còn thiếu** (lớp không trống tiết, GV không vượt định mức) trước khi làm bất kỳ tính năng mới nào — vì mọi benchmark sau này đều dựa trên bộ ràng buộc này.

---
---

# PHỤ LỤC A — Kiểm kê ràng buộc trong mã nguồn

Hệ thống có **bốn nguồn khai báo ràng buộc riêng biệt và không khớp nhau**.

## A.1 — Ràng buộc áp dụng KHI ĐẶT TIẾT

Đây là con số quan trọng nhất: trong lúc thuật toán đặt tiết vào lưới, nó chỉ kiểm tra **2 thứ**.

| Phase | Kiểm tra gì khi đặt tiết |
| :--- | :--- |
| Phase 1 — tiết cố định | `isSlotOccupied()` |
| Phase 2 — greedy | `isSlotOccupied()` + `checkTeacherConflict()` |
| Phase 3 — tối ưu | `calculateFitness()` đầy đủ, nhưng chỉ 50 vòng |

Ngoài ra Phase 2 có **7 quy tắc hardcode** nằm ngoài hệ thống ràng buộc:

```ts
if (isMorning && p > 5) continue;                        // :142  sáng chỉ tiết 1-5
if (!isMorning && p <= 5) continue;                      // :143  chiều chỉ tiết 6-10
if (day === 2 && period === 1) continue;                 // :341  chừa Thứ 2 tiết 1
if (day === 5 && ![1,2,6,7].includes(period)) continue;  // :342  Thứ 5 chỉ 2 tiết/buổi
const isOpposite = subject.code === 'GDQP' || 'GDTC';    // :245  môn trái buổi
if (hasOpposite) continue;                               // :280  mỗi ngày 1 môn trái buổi
['CHAO_CO','SH_DAU_TUAN','SH_CUOI_TUAN','GDDP','HDTN']   // :223  loại khỏi greedy
```

Cộng 6 tiết cố định trong `checkFixedSlot()`.

→ **Xung đột phòng và lịch bận giáo viên không được kiểm tra khi đặt tiết**, chỉ chấm điểm sau.

## A.2 — Ràng buộc dùng CHẤM ĐIỂM (`ConstraintService`)

**Cứng** — `checkHardConstraints()`, −100 điểm/lỗi: trùng GV · trùng lớp · trùng phòng *(thỏa mãn tầm thường)* · GV dạy khi bận *(chỉ hậu kiểm)*

**Mềm** — `calculatePenalty()`, trọng số hardcode:

| Mã | Nội dung | Trọng số | Đối tượng |
| :--- | :--- | :---: | :--- |
| SC01 | Môn học dồn cục | ×10 | Lớp |
| SC02 | >3 môn nặng liên tiếp | ×20 | Lớp |
| SC03 | Toán/Văn/Anh ở tiết 4-5 | ×15 | Lớp |
| SC04 | Tiết đôi bị xé lẻ | ×10 | Lớp |
| SC06 | Tiết trống giáo viên | ×5 | GV |
| SC07 | GV dạy >4 tiết/buổi | ×10 | GV |

## A.3 — Thư mục chết `src/constraints/` — 19 file

**5 file là stub rỗng, luôn `return null`:**
`correct-assignment` · `spread-subjects` · `teacher-preference` · `balance-load` · `stability`

**4 file có logic nhưng không bao giờ kích hoạt được:**

| File | Lỗi |
| :--- | :--- |
| `time-slot-validity` | Kiểm tra `slot.day === 8` — ngày hợp lệ chỉ 2-7 |
| `opposite-session` | So mã môn `'THE_CHAT'`, danh mục thật dùng `'GDTC'` |
| `avoid-heavy-topics` | So `slot.subjectId` (ID) với `['TOAN','LY',…]` (mã môn) |
| `main-subject-morning` | Cùng lỗi so ID với mã môn |

**10 file dùng được nếu nối vào** — và chính là những thứ đang thiếu:

| File | Giá trị |
| :--- | :--- |
| `teacher-busy-time` | Trọng số 10000, chuyển đổi tiết tuyệt đối ↔ tương đối **đúng** |
| `minimize-idle-class` | Trọng số **50** — cao nhất nhóm mềm |
| `weekly-limit-teacher` | Định mức tuần |
| `daily-limit-class` · `daily-limit-teacher` | Giới hạn tiết/ngày |
| `room-suitability` | Đếm sức chứa Lab theo khung giờ — tốt hơn `getValidRooms()` |
| `no-teacher-conflict` · `no-class-conflict` · `no-room-conflict` | Trùng lặp với bản đang chạy |
| `minimize-idle-teacher` | Trùng lặp với `checkNoHoles` |

Ghi chú trong `minimize-idle-class.constraint.ts`:

```ts
weight = 50; // High weight, students shouldn't have gaps
```

→ Người thiết kế ban đầu **đã nhận ra đúng vấn đề** và đặt trọng số cao nhất. File này chưa bao giờ được nối vào.

**Hai lỗi thiết kế chung cả thư mục:**

- `check()` trả `Violation | null` và **`return` ngay ở vi phạm đầu tiên** → đếm 1 lỗi dù thực tế có 50
- `ScheduleSlot.subjectId`/`roomId` kiểu `string`, model sống dùng `number` → không nối được nếu không chuyển kiểu

## A.4 — Đối chiếu bốn nguồn

| Ràng buộc | Tài liệu | Giao diện | Thư mục chết | **Đang chạy** |
| :--- | :---: | :---: | :---: | :---: |
| Trùng giáo viên | ✅ | HC01 · 100 | ✅ | ✅ |
| Trùng lớp | ✅ | HC02 · 100 | ✅ | ✅ |
| Trùng phòng | ✅ | HC03 · 100 | ✅ | ⚠️ tầm thường |
| Lịch bận GV | ✅ | HC04 · 100 | ✅ | ⚠️ hậu kiểm |
| Tiết cố định | ✅ | HC05 · 100 | — | ✅ hardcode |
| Phân bố đều môn | ✅ | SC01 · 10 | 🔴 stub | ✅ |
| Môn nặng liên tiếp | — | SC02 · 20 | 🟠 hỏng | ✅ |
| Ưu tiên buổi sáng | — | SC03 · 15 | 🟠 hỏng | ✅ |
| Ghép tiết đôi | ✅ | SC04 · 10 | — | ⚠️ chỉ phạt |
| Trống tiết GV | ✅ | SC05 · 5 | ✅ | ✅ |
| Giới hạn tiết/buổi GV | ✅ *(5/ngày)* | SC06 · 10 | ✅ *(5/ngày)* | ✅ *(4/buổi)* |
| **Lớp trống tiết** | — | — | ✅ *(w=50)* | ❌ |
| **Định mức tiết/tuần** | — | — | ✅ | ❌ |
| **Giới hạn tiết/ngày lớp** | — | — | ✅ | ❌ |
| **Phòng Lab đúng môn** | ✅ *(mục 3.2)* | — | ✅ | ❌ |
| Môn trái buổi GDTC/GDQP | ✅ | — | 🟠 hỏng | ✅ hardcode |

**Ba điểm lệch:**

1. Trọng số giao diện khớp y hệt code (10/20/15/10/5/10) — giao diện được dựng để phản chiếu số hardcode, nhưng code không đọc ngược lại. Chỉnh xong không có tác dụng.
2. Tài liệu ghi *"không quá 5 tiết/ngày"*, code phạt khi **>4 tiết/buổi** — khác cả ngưỡng lẫn đơn vị.
3. Bốn ràng buộc đã viết xong nằm trong thư mục chết lại chính là bốn thứ thiếu nghiêm trọng nhất.

## A.5 — Tổng kết bằng số

| | Số lượng |
| :--- | :---: |
| Ràng buộc kiểm tra **khi đặt tiết** | **2** |
| Quy tắc hardcode trong thuật toán | 7 + 6 tiết cố định |
| Ràng buộc cứng dùng chấm điểm | 4 *(1 tầm thường, 1 hậu kiểm)* |
| Ràng buộc mềm dùng chấm điểm | 6 |
| Ràng buộc đã viết nhưng chưa nối | 10 |
| Ràng buộc viết dở dang / hỏng | 9 |
| Ràng buộc khai báo trên giao diện | 11 *(0 có tác dụng)* |

---
---

# PHỤ LỤC B — Ràng buộc thực tế còn thiếu

> Phân biệt hai ngưỡng: **TKB hợp lệ** = 0 lỗi cứng, máy chấp nhận. **TKB được chấp nhận** = hội đồng sư phạm không phản đối. Phần lớn mục dưới đây thuộc ngưỡng thứ hai — và đó mới là ngưỡng thật.

## B.1 — Ràng buộc CỨNG còn thiếu

| # | Ràng buộc | Ghi chú |
| :---: | :--- | :--- |
| 1 | **Đủ số tiết theo phân phối chương trình** | Hiện chỉ ghi `logger.warn` rồi lưu bình thường. Thiếu tiết = TKB **sai**, không phải "hơi kém" |
| 2 | **Lớp không trống tiết giữa buổi** | 45 học sinh không có chỗ để đi — ràng buộc cứng, không phải mềm |
| 3 | **Sức chứa sân thể dục** | Trường có 1 sân, không thể 5 lớp cùng học GDTC. Giới hạn vật lý tuyệt đối |
| 4 | **Họp tổ chuyên môn** | Cả tổ rảnh cùng lúc 1 buổi/tuần. Không mô phỏng được bằng `TeacherConstraint` từng người |
| 5 | **Định mức tiết/tuần giáo viên** | 17 tiết theo quy định, trừ giảm trừ kiêm nhiệm |

## B.2 — Ràng buộc MỀM quyết định TKB có được chấp nhận

Xếp theo mức độ giáo viên phàn nàn:

| # | Ràng buộc | Mức | Ghi chú |
| :---: | :--- | :---: | :--- |
| 1 | Tối thiểu hóa số buổi phải đến trường | ⭐⭐⭐ | **Nguyện vọng số 1.** Lịch 1 tiết/ngày × 6 ngày có 0 tiết trống nhưng là lịch tệ nhất — `checkNoHoles` không phân biệt được |
| 2 | Không dạy cả sáng lẫn chiều cùng ngày | ⭐⭐⭐ | `checkNoHoles` chỉ tính trong cùng buổi nên bỏ qua hoàn toàn |
| 3 | Ít nhất 1 ngày nghỉ trọn vẹn/tuần | ⭐⭐ | |
| 4 | Không xếp môn tư duy ngay sau Thể dục | ⭐⭐ | Học sinh vừa vận động, không tập trung được |
| 5 | Không dồn nhiều bài kiểm tra vào 1 ngày | ⭐⭐ | Cần thêm dữ liệu lịch kiểm tra. **Không phần mềm nào làm** |
| 6 | Gom lớp cùng khối cùng môn gần nhau | ⭐⭐ | Soạn 1 lần dạy 3 lớp. **Ngược** với "phân bố đều môn" hiện có |
| 7 | GV nữ nuôi con nhỏ — tránh tiết 1 và tiết cuối | ⭐⭐ | Giảm 3 tiết/tuần theo quy định |
| 8 | Không dạy quá 3-4 tiết liên tiếp | ⭐ | `checkMaxLoad` đếm tổng tiết/buổi, không đếm chuỗi liên tiếp |
| 9 | Lớp 12 ưu tiên khung giờ vàng | ⭐ | `checkMorningPriority` áp dụng chung mọi khối |

## B.3 — Ràng buộc theo thời gian — cần kiến trúc overlay `B1`

Không cài được bằng ràng buộc thông thường vì thay đổi theo tuần:

| Ràng buộc | Tần suất |
| :--- | :--- |
| Tuần kiểm tra giữa kỳ / cuối kỳ đảo lịch | 4 lần/năm, chắc chắn |
| Nghỉ lễ và lịch dạy bù | ~8 đợt/năm |
| Giáo viên nghỉ ốm / thai sản | Hàng tuần |
| Ngoại khóa, hội khỏe chiếm sân | Vài lần/năm |
| Khám sức khỏe, tiêm chủng chiếm tiết | 1-2 lần/năm |
| Thi thử tốt nghiệp khối 12 | 2-3 lần/năm |
| Đoàn thanh tra dự giờ | Không báo trước |
| Môn 1 tiết / 2 tuần (tuần chẵn – lẻ) | Tùy môn |

## B.4 — Ràng buộc công bằng & ổn định

| Ràng buộc | Ánh xạ |
| :--- | :--- |
| Phân bổ công bằng "tiết đẹp" giữa các GV | `A5` — chỉ số Gini |
| Sửa lịch giữa kỳ phải thay đổi tối thiểu | `stability.constraint.ts` có khung, còn rỗng |
| Giữ đúng nguyện vọng đã được duyệt | Cần phân biệt "đã hứa" vs "mong muốn" |

## B.5 — Ưu tiên nếu muốn TKB dùng được thật

| Thứ tự | Ràng buộc | Loại | Độ khó |
| :---: | :--- | :---: | :---: |
| 1 | Đủ số tiết theo phân công | Cứng | Dễ |
| 2 | Lớp không trống tiết giữa buổi | Cứng | Dễ |
| 3 | Định mức tiết/tuần GV | Cứng | Dễ |
| 4 | Sức chứa sân TD / phòng Lab | Cứng | Vừa |
| 5 | Tối thiểu số buổi GV đến trường | Mềm ⭐⭐⭐ | Dễ |
| 6 | Không dạy cả 2 buổi cùng ngày | Mềm ⭐⭐⭐ | Dễ |
| 7 | Họp tổ chuyên môn | Cứng | Vừa |
| 8 | Không xếp môn tư duy sau Thể dục | Mềm ⭐⭐ | Dễ |
| 9 | Ít nhất 1 ngày nghỉ/tuần | Mềm ⭐⭐ | Dễ |
| 10 | Gom lớp cùng khối cùng môn | Mềm ⭐⭐ | Vừa |

**Bảy trong mười thuộc loại "Dễ"** — đều là hàm thuần túy duyệt mảng slot, cùng dạng với các hàm `check*` đã có. Ước tính ~3 ngày cho cả 10, cộng việc nối lại 10 file trong thư mục chết → gộp thành feature [`0.17`](ROADMAP.md).

Đáng chú ý: **mục 5 và 6 là hai thứ giáo viên phàn nàn nhiều nhất**, đều rất dễ cài, và không phần mềm TKB phổ biến nào ở Việt Nam tối ưu chúng. Đo được bằng số liệu *(số buổi đến trường trung bình giảm từ 5.4 xuống 3.8)* sẽ là kết quả mạnh cho báo cáo.

---
---

# PHỤ LỤC C — Kết quả chạy thực tế

> Chạy ngày 13/08/2026 trên PostgreSQL 18 + Redis, dữ liệu seed từ `Mau_..._co_du_lieu_mau.xlsx`:
> 7 lớp · 21 giáo viên · 17 môn · 35 phòng · 210 phân công · HK1 năm 2026-2027.

## C.1 — Lỗi gốc: sai đơn vị số tiết

Truy vấn đầu tiên cho thấy mỗi lớp cần **513 tiết/tuần**. Đối chiếu file Excel:

| Cột | Ngữ văn | Lịch sử | Vật lý | GDĐP |
| :--- | :---: | :---: | :---: | :---: |
| `Tiết_năm_CT` | 105 | 52 | 70 | 35 |
| `Tiết_HK1` | 54 | 27 | 36 | 18 |
| `Tiết_HK2` | 51 | 25 | 34 | 17 |

`54 + 51 = 105` — hai cột học kỳ cộng lại bằng cột cả năm, xác nhận đây là **tổng tiết của học kỳ**. Nhưng importer lưu thẳng vào `total_periods`, còn thuật toán đọc trường đó là **tiết mỗi tuần**. Sai lệch **18 lần**.

Trớ trêu là dòng hướng dẫn trong chính template lại ghi *"Nhập số tiết mỗi tuần"* — mâu thuẫn với dữ liệu mẫu do cùng dự án phát hành.

**Đã sửa:** importer quy đổi theo số tuần thực học của học kỳ, lấy từ `AcademicYear.weeks` (trường có sẵn trong schema nhưng trước đó chưa nơi nào dùng), chia 35 tuần thành 18/17. Có heuristic dung thứ: giá trị ≤ 10 được hiểu là đã ở đơn vị tuần và kèm cảnh báo, vì không môn nào chạy cả học kỳ trong 10 tiết.

Sau khi sửa, mỗi lớp còn **29 tiết/tuần** — khớp chính xác GDPT 2018 (Toán 3, Văn 3, Anh 3, HĐTN 3, môn lựa chọn 2, chuyên đề 1).

## C.2 — Xác nhận nghi vấn lưới Thứ 5

Phân bố thực tế của lớp 10A1 sau lần chạy đầu:

| Thứ | 2 | 3 | 4 | **5** | 6 | 7 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Số tiết | 5 | 7 | 6 | **2** | 5 | 3 |

Thứ 5 chỉ có tiết 1 và 2 — **đúng như dự đoán ở mục 4.2**. Buổi sáng mất 3 tiết.

Nhưng thí nghiệm gỡ bỏ ràng buộc này cho kết quả bất ngờ: thiếu tiết chỉ giảm **11 → 10**. Vậy Thứ 5 **không phải nút thắt chính** — nó chỉ làm lưới chật thêm chứ không phải nguyên nhân gốc. Ràng buộc đã được giữ nguyên vì có thể phản ánh chính sách thật của trường.

## C.3 — Bốn lỗi cấu trúc phát hiện khi chạy

**1. Chào cờ bị từ chối ở 6/7 lớp.** Toàn trường chào cờ cùng lúc nhưng phase 1 gán chung một giáo viên BGH cho mọi lớp → vi phạm unique index `(timetable_id, teacher_id, day, period)` → chỉ lớp đầu tiên được lưu.
*Sửa:* mỗi lớp dùng GVCN của chính mình — vừa đúng thực tế vừa hết xung đột.

**2. GDĐP/HĐTN bị ghim cứng vào Thứ 5.** Một giáo viên GDĐP dạy cả 7 lớp, không thể có mặt ở 7 nơi cùng lúc. Đồng thời phase 2 lại **loại hai môn này khỏi danh sách xếp**, nên 2/3 số tiết HĐTN không bao giờ được đặt.
*Sửa:* bỏ ghim cứng, trả hai môn về cho heuristic xếp như môn thường.

**3. Greedy chạy một lượt duy nhất.** Mỗi ô lưới chỉ được thử một lần; tiết nào không đặt được lúc đó là mất vĩnh viễn, và phase 3 chỉ hoán vị chứ không bao giờ **thêm** tiết thiếu.
*Sửa:* thêm `repairMissingPeriods()` quét lại phần thiếu, có khả năng di dời một tiết chắn đường.

**4. Trừ trùng số tiết đã xếp.** Môn có hai dòng phân công (Toán lý thuyết 3 + chuyên đề 1) bị trừ `alreadyAssigned` **hai lần**, làm hụt đúng 1 tiết ở mọi môn mà GVCN dạy. Cùng dạng lỗi này cũng có trong hàm `checkMissingPeriods` mới viết.
*Sửa:* cộng dồn nhu cầu theo `(lớp, môn)` trước rồi mới trừ.

## C.4 — Diễn tiến qua các lần chạy

| Chỉ số | Lần 1 | Sau sửa #1,2 | Sau repair | Sau sửa #4 |
| :--- | :---: | :---: | :---: | :---: |
| Tiết sinh ra | 198 | 207 | 221 | **208** |
| Tiết lưu được | 189 | 206 | 220 | **208** |
| **Bị từ chối** | 9 | 1 | 1 | **0** |
| **Thiếu tiết** | 18 | 11 | 4 | **6** |
| Lớp trống tiết | 2 | 6 | 3 | **1** |
| Xung đột GV / lớp / phòng | 0 | 0 | 0 | **0** |
| Vượt định mức tuần | 0 | 0 | 4 | **0** |
| Điểm | −3274 | −3085 | −2712 | **−1734** |

> Cột "Lần 1" báo 18 lỗi thiếu tiết nhưng con số đó **sai lệch** — hàm đếm khi ấy còn lỗi trừ trùng, thực tế thiếu nhiều hơn. Từ cột 4 trở đi số liệu mới đáng tin.

## C.5 — Phần còn lại là bài toán dữ liệu, không phải thuật toán

6 tiết còn thiếu, tra ngược ra giáo viên:

| Lớp | Môn | Cần | Xếp | Giáo viên | Định mức | Đã tải |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| 10A1 | TOAN | 4 | 3 | GV_TOAN_01 | 17 | **17** |
| 12D1 | TOAN | 3 | 2 | GV_TOAN_01 | 17 | **17** |
| 12D1 | HDTN | 3 | 2 | GV_LS_01 | 17 | **17** |
| 12D1 | VAN | 4 | 3 | GV_NV_01 | 17 | 16 |

Đối chiếu phân công gốc: **GV_TOAN_01 và GV_LS_01 được phân công đúng 17 tiết trên định mức 17** — không còn một tiết dư nào. Bất kỳ trục trặc xếp lịch nào cũng thành thiếu tiết vĩnh viễn.

Tổng thể: cần 203 tiết, tổng định mức 356 tiết → **khả thi ở mức tổng**, nhưng **cạn kiệt ở mức cá nhân**. Đây chính xác là loại lỗi mà **Pre-flight Check (`A3`)** sinh ra để bắt trước khi chạy, thay vì để người dùng phát hiện sau.

## C.6 — Kết luận cập nhật cho mục 6.1

So với đánh giá ban đầu, sau các sửa chữa:

| Tiêu chí | Trước | Sau |
| :--- | :---: | :---: |
| Không trùng giáo viên / lớp / phòng | ✅ | ✅ |
| Tôn trọng lịch bận giáo viên | ❌ | ✅ |
| Không vượt định mức tuần | ❌ | ✅ |
| Lớp không trống tiết giữa buổi | ❌ | 🟡 còn 1 lỗi |
| Đủ số tiết theo phân công | ❌ | 🟡 còn 6, do dữ liệu |
| Điểm phản ánh đúng dữ liệu đã lưu | ❌ | ✅ |
| Tiết đôi xếp liền nhau | ❌ | ❌ chưa làm |
| Phòng thực hành vào Lab | ❌ | ❌ chờ seed `is_practice` |

**Thời khóa biểu sinh ra hiện đã không còn xung đột vật lý nào** và chỉ thiếu 6/203 tiết — trong đó phần lớn do phân công vượt sức giáo viên chứ không phải thuật toán. Đây là mức có thể mang ra demo. Để dùng thật ở trường vẫn cần: tiết đôi, phòng thực hành, và Pre-flight Check chặn dữ liệu bất khả thi từ đầu.

---
---

# PHỤ LỤC D — Vòng cải thiện thứ hai

> Tiếp nối Phụ lục C. Mục tiêu: đưa thời khóa biểu từ *"không còn xung đột nhưng vẫn thiếu tiết"* lên **hợp lệ hoàn toàn**.

## D.1 — Sáu lỗi tiếp theo

**1. Tiết nghi lễ bị tính vào định mức giảng dạy.** Chào cờ và sinh hoạt cuối tuần chiếm 2 tiết quota của GVCN, đẩy `GV_TOAN_01` lên 17/17 và làm 2 tiết Toán không xếp được. Thực tế nhiệm vụ GVCN được bù bằng `workload_reduction`, không tính vào định mức tiết dạy.
*Sửa:* loại môn `is_special` khỏi phép đếm định mức. → thiếu tiết 6 → 4, lỗ hổng lớp 1 → 0.

**2. Không có cơ chế ghép tiết đôi.** Hệ thống **phạt** khi tiết đôi bị xé lẻ nhưng chưa bao giờ **tạo ra** tiết đôi — heuristic điền từng ô một nên không thể sinh khối.
*Sửa:* thêm `consolidateBlocks()` hoán vị các tiết lẻ về cạnh tiết cùng môn. → xé lẻ 72 → 20, điểm −1706 → −1022.

**3. `checkSpreadSubjects` đánh nhau với tiết đôi.** Nó phạt môn dùng ít hơn 3 ngày, trong khi Toán 4 tiết xếp 2 cặp trên 2 ngày mới là đúng thực tế.
*Sửa:* đổi luật thành "tối đa 2 tiết mỗi môn mỗi ngày". → điểm −1022 → −885.

**4. Hai hàm chấm điểm cho kết quả khác nhau.** Log lộ ra local search thấy **−16624** trong khi điểm lưu là **−591**. Nguyên nhân: `groupBy` sinh khoá `'none'` cho phòng null, nhưng `checkHardConstraints` chỉ loại `'undefined'`/`'null'` — nên **toàn bộ 210 tiết không có phòng bị gom một nhóm và tính là trùng phòng**. `checkRoomConflictDetails` thì loại đúng.
*Sửa:* dùng chung hàm `isRoomlessKey()`. → hai hàm khớp nhau, điểm −591 → −509.

> Ghi chú: không lớp nào trong dữ liệu mẫu được gán `fixed_room_id`, nên ràng buộc trùng phòng hiện vẫn thoả mãn một cách tầm thường như mục 3.3 đã nêu.

**5. Sinh hoạt cuối tuần bị ghim ở tiết 5.** Khi lớp hết tiết sớm hơn, nó để lại lỗ hổng ở giữa buổi mà compaction không đóng được vì tiết nghi lễ bị khoá. Thực tế sinh hoạt là **tiết cuối của ngày**, không phải **tiết số 5**.
*Sửa:* `alignHomeroomToEndOfDay()` dời nó về ngay sau tiết học cuối. → lỗi cứng 4 → 2.

**6. Tiết GVCN dạy Thứ 7 cũng bị khoá.** Đây chỉ là ưu tiên mềm (GVCN dạy ngay trước sinh hoạt) nhưng bị khoá cứng nên chặn compaction.
*Sửa:* chỉ khoá nghi lễ thật, không khoá tiết GVCN. → **lỗi cứng 2 → 0, `valid: true` lần đầu tiên.**

## D.2 — Ràng buộc Thứ 5: câu trả lời dứt điểm

Phụ lục C kết luận Thứ 5 "không phải nút thắt chính" vì gỡ nó chỉ giảm thiếu tiết 11 → 10. Kết luận đó **đúng ở thời điểm ấy nhưng sai sau khi sửa hết các lỗi khác** — khi đó các lỗi khác đang át.

Đo lại với toàn bộ sửa chữa đã có:

| | Giữ ràng buộc Thứ 5 | Bỏ ràng buộc Thứ 5 |
| :--- | :---: | :---: |
| Tiết xếp được | 210 | **214** |
| Thiếu tiết | 4 | **0** |
| Lỗi cứng | 4 | **0** |
| Hợp lệ | ❌ | **✅** |
| Điểm | −419 | **+43** |

Ràng buộc Thứ 5 chính là thứ duy nhất còn ngăn thời khóa biểu hợp lệ. Nó **không được ghi ở bất kỳ đâu** trong schema, readme hay template.

**Xử lý:** không xoá thẳng mà đưa thành cấu hình `gridPolicy.shortThursday`, mặc định `false`. Nếu trường thật sự dạy Thứ 5 rút gọn, đặt lại `true` và chấp nhận thiếu khoảng 4 tiết/tuần.

## D.3 — Nâng cấp thuật toán tối ưu

| | Trước | Sau |
| :--- | :--- | :--- |
| Số vòng lặp | 50 | 4 000 + 12 000 |
| Phép biến đổi | hoán vị **trong cùng lớp** | hoán vị **liên lớp** + **di chuyển sang ô trống** |
| Chấp nhận | chỉ khi điểm tăng | tăng hoặc bằng (thoát cao nguyên) |
| Số phương án | 1 | tối đa 12, dừng sớm khi có bản hợp lệ |
| Chọn phương án | — | **từ điển**: ít lỗi cứng trước, điểm sau |

Phép **di chuyển sang ô trống** là mấu chốt: chỉ hoán vị thì không bao giờ gom được tiết của một giáo viên về ít buổi hơn.

Thứ tự các bước cũng quan trọng: ban đầu các bước dọn dẹp chạy **sau** local search và phá kết quả của nó (điểm tụt về −159..−229). Đảo lại thành *dọn → tối ưu ngắn → dọn → tối ưu chính* đưa điểm lên dương.

## D.4 — Kết quả cuối, 5 lần chạy liên tiếp

| Lần | Hợp lệ | Điểm | Số phương án thử | Thời gian |
| :---: | :---: | :---: | :---: | :---: |
| 1 | ✅ | +35 | 5 | 10s |
| 2 | ✅ | +89 | 5 | 10s |
| 3 | ✅ | +148 | 5 | 15s |
| 4 | ✅ | +63 | 5 | 24s |
| 5 | ✅ | +91 | 5 | 20s |

**5/5 hợp lệ, điểm dương ở mọi lần chạy.** Đối chiếu cơ sở dữ liệu: 214/214 tiết lưu được, 0 bị từ chối, **0/84 cặp (lớp, môn) thiếu tiết**.

Lịch lớp 10A1 của một lần chạy:

```
Thứ 2  CHAO_CO(1) HDTN(2) HDTN(3) ANH(4)
Thứ 3  LS(1) TIN(2) LY(3) LY(4)
Thứ 4  ANH(1) ANH(2) GDDP(3) SINH(4) SINH(5) | GDQP(6)
Thứ 5  VAN(1) VAN(2) TOAN(3) TOAN(4) LY(5)
Thứ 6  TOAN(1) TOAN(2) HDTN(3) LS(4) HOA(5) | GDTC(9) GDTC(10)
Thứ 7  HOA(1) HOA(2) VAN(3) TIN(4) SH_CUOI_TUAN(5)
```

Chào cờ đúng Thứ 2 tiết 1 · sinh hoạt đúng tiết cuối Thứ 7 · GDTC và GDQP đúng buổi trái · tiết đôi rõ ràng ở HDTN, LY, ANH, SINH, VAN, TOAN, HOA, GDTC · không lỗ hổng giữa buổi.

## D.5 — Bảng tổng kết toàn bộ hành trình

| Chỉ số | Ban đầu | Sau Phụ lục C | **Hiện tại** |
| :--- | :---: | :---: | :---: |
| Tiết lưu được | 189 | 208 | **214** |
| Tiết bị từ chối | 9 | 0 | **0** |
| Thiếu tiết | 18 | 6 | **0** |
| Lỗ hổng lớp | 2 | 1 | **0** |
| Tiết đôi bị xé lẻ | — | 66 | **~28** |
| Vượt định mức tuần | — | 0 | **0** |
| Xung đột GV / lớp / phòng | 0 | 0 | **0** |
| **Trạng thái** | KHÔNG HỢP LỆ | KHÔNG HỢP LỆ | **HỢP LỆ** |
| **Điểm** | **−3274** | **−1734** | **+35 … +148** |

## D.6 — Còn lại gì

Không còn lỗi cứng. Các khoản trừ còn lại đều là chất lượng:

| Khoản | Mức | Ghi chú |
| :--- | :---: | :--- |
| Giáo viên phải đến trường thêm buổi | ~−330 | Lớn nhất. Cần phép biến đổi chuyên biệt hơn là hoán vị ngẫu nhiên |
| Tiết đôi còn xé lẻ | ~−280 | Còn ~28 tiết chưa ghép được |
| Giáo viên dạy cả sáng lẫn chiều | ~−160 | Liên quan trực tiếp tới khoản đầu |
| Môn ưu tiên ở tiết cuối | ~−100 | |

Ba việc còn chưa làm để dùng thật ở trường:

1. ~~**Phòng thực hành**~~ → đã làm, xem Phụ lục E
2. **Pre-flight Check (`A3`)** — chặn dữ liệu bất khả thi trước khi chạy
3. ~~**Cấu hình tiết cố định từ giao diện**~~ → đã làm, xem Phụ lục E

---
---

# PHỤ LỤC E — Tiết cố định cấu hình được, phòng học thật, ràng buộc theo quy định

## E.1 — Tiết cố định: xếp rồi khoá

Bộ quy tắc trước đây nằm cứng trong `checkFixedSlot()`, trường khác muốn đổi phải sửa mã nguồn. Nay là bảng `fixed_period_rules` + API `/tiet-co-dinh` + màn hình `/admin/fixed-periods`.

Mỗi quy tắc khai báo: **môn · thứ · tiết · khối nào · buổi nào · ai dạy · có khoá không**.

| Trường | Ý nghĩa |
| :--- | :--- |
| `subject_code` | Mã môn, hoặc `GVCN_TEACHING` cho "tiết bất kỳ của GVCN" |
| `grade_level` | `null` = mọi khối |
| `main_session` | `null` = mọi buổi · `0` = lớp học sáng · `1` = lớp học chiều |
| `teacher_rule` | `HOMEROOM` · `BGH` · `ASSIGNED` (GV đang phân công dạy môn đó) |
| `is_locked` | Tiết có bị khoá sau khi xếp không |

**Sửa luôn một lỗi cũ:** bộ quy tắc mặc định tách riêng cho lớp sáng và lớp chiều. Trước đây `checkFixedSlot` chỉ trả về chào cờ khi `session === 'SANG'`, nên **3 lớp buổi chiều không hề có chào cờ lẫn sinh hoạt**. Nay cả 7 lớp đều có, đúng buổi của mình.

**Lỗi phát hiện khi thử nghiệm tính năng:** thêm quy tắc ghim GDĐP cho cả khối 10 vào cùng một ô, trong khi cả hai lớp do cùng một giáo viên dạy. Phase 1 vẫn đẩy slot rồi bị loại lúc lưu. Đã sửa: phase 1 kiểm tra giáo viên có rảnh không trước khi ghim, nếu bận thì bỏ qua quy tắc cho lớp đó và để heuristic xếp bình thường. Hệ thống giờ **suy giảm êm** trước cấu hình sai của người dùng thay vì mất tiết.

## E.2 — Phòng học trở thành ràng buộc thật

Trước: không lớp nào có `fixed_room_id`, không môn nào có `is_practice`, không có phòng `YARD` — ràng buộc trùng phòng thoả mãn một cách tầm thường.

Đã sửa:

- `is_practice` cho **TIN · LY · HOA · SINH · GDTC**
- Thêm 2 sân (`YARD`) vào `ROOM_SEED`
- Gán phòng chủ nhiệm: khối 10 tầng 2, khối 11–12 tầng 1
- Thêm bước `assignRooms()` chạy **sau** khi lưới ngừng thay đổi — luồn đặt phòng qua từng phép hoán vị sẽ tăng gấp đôi chi phí mỗi bước mà không được gì

Kết quả kiểm chứng:

| Môn | Loại phòng | Số tiết |
| :--- | :--- | :---: |
| LY | LAB_PHYSICS | 12 |
| HOA | LAB_CHEM | 10 |
| SINH | LAB_BIO | 4 |
| TIN | LAB_IT | 14 |
| GDTC | YARD | 14 |
| Các môn còn lại | CLASSROOM | — |
| CHAO_CO | *(không phòng)* | 4 |

**0 lần trùng phòng.**

## E.3 — Hai ràng buộc mềm mới theo quy định hiện hành

Tra cứu quy định và hướng dẫn chuyên môn, bổ sung:

**`checkSubjectSpacing`** — phạt khi hai tiết của cùng một môn cách nhau **quá 3 ngày**. Nguồn chuyên môn nêu rõ vượt ngưỡng này thì học sinh không còn giữ được mạch kiến thức. Đây là **giới hạn dưới** bù cho `checkSpreadSubjects` vốn chỉ có giới hạn trên (≤ 2 tiết/môn/ngày). Trọng số 8.

**`checkAfternoonLoad`** — phạt khi lớp học **quá 3 tiết ở buổi phụ**, theo hướng dẫn dạy học 2 buổi/ngày. Trọng số 12.

Đối chiếu quy định khác:

| Quy định | Trạng thái |
| :--- | :--- |
| Định mức THPT 17 tiết/tuần | ✅ khớp dữ liệu, đã kiểm tra trong thuật toán |
| GVCN giảm 4 tiết/tuần, tổ trưởng CM giảm 3, tổ phó 1 | 🟡 có trường `workload_reduction` phẳng, chưa có bảng kiêm nhiệm |
| Không kiêm nhiệm quá 2 nhiệm vụ | ❌ chưa mô hình được |
| TKB Thứ 2 → Thứ 6 (tuần 5 ngày) | 🟡 `gridPolicy` đã có chỗ, mặc định vẫn 6 ngày |

## E.4 — Phép biến đổi chuyên biệt cho khoản trừ lớn nhất

Thêm `tryConsolidateTeacherMove` vào local search: chọn buổi mà giáo viên có **ít tiết nhất**, thử dời tiết đó sang buổi họ **đã có mặt**. Hoán vị ngẫu nhiên thỉnh thoảng cũng tình cờ làm được, nhưng nhắm thẳng vào buổi nhẹ nhất thì trúng thường xuyên hơn nhiều.

Chỉ số thực đo được:

| | Giá trị |
| :--- | :---: |
| Số tiết trung bình mỗi GV | 11.4 |
| **Số ngày đến trường trung bình** | **4.3 / 6** |
| Số buổi trung bình | 5.1 |
| Sàn lý thuyết (`⌈tiết/5⌉`) | 2.7 |

Phân bố: 2 GV đến 2 ngày · 4 GV đến 3 ngày · 3 GV đến 4 ngày · 6 GV đến 5 ngày · 4 GV đến 6 ngày.

Sàn lý thuyết 2.7 buổi gần như không đạt được trên thực tế: một giáo viên dạy 5 lớp thì 5 lớp đó phải cùng rảnh đúng khung giờ ấy, mà mỗi lớp lại có ràng buộc riêng. Khoảng cách 5.1 so với 2.7 phản ánh mâu thuẫn thật giữa tiện lợi cho giáo viên và nhu cầu của lớp, không phải điểm yếu thuật toán.

## E.5 — Kết quả sau vòng này

5 lần chạy liên tiếp, dữ liệu sạch:

| Lần | Hợp lệ | Điểm | Số tiết |
| :---: | :---: | :---: | :---: |
| 1 | ✅ | −116 | 217 |
| 2 | ✅ | −71 | 217 |
| 3 | ✅ | −19 | 217 |
| 4 | ✅ | −55 | 217 |
| 5 | ✅ | −79 | 217 |

**5/5 hợp lệ.** Số tiết tăng 214 → 217 vì 3 lớp buổi chiều nay đã có chào cờ. Điểm thấp hơn Phụ lục D vì thang điểm đã cộng thêm hai khoản trừ mới và ràng buộc phòng đã thật sự có hiệu lực — không so trực tiếp được giữa hai vòng.

## E.6 — Lệch pha cơ sở dữ liệu cần dọn

Khi tạo migration, Prisma phát hiện database có những thứ **không nằm trong bất kỳ migration nào lẫn `schema.prisma`**:

- Bảng `notifications`, `teacher_busy_requests`
- Cột `timetable_slots.week`
- Cột `semesters.start_date`, `semesters.end_date`
- Unique index `curriculum_combinations(code, grade_level)`

Dấu hiệu ai đó từng chạy `prisma db push` thay vì tạo migration. Migration mới được viết tay chỉ thêm bảng `fixed_period_rules`, không đụng phần lệch. **Nên dọn trước khi triển khai thật**, vì `prisma migrate` sẽ còn báo drift và có thể sinh migration phá dữ liệu.

---

# Phụ lục F — Vòng cải thiện thứ ba: dashboard và khai phá quy luật

## F.1 — Dashboard tự tố cáo thuật toán, hoá ra dashboard sai

Sau khi nối `/admin` vào số liệu thật, màn hình lập tức báo **3 giáo viên vượt định mức**
(19/17, 19/17, 18/17) trên đúng thời khóa biểu mà thuật toán khẳng định **0 lỗi cứng**.

Hai con số cùng một dữ liệu mà mâu thuẫn nhau thì chắc chắn một bên sai. Ở đây là dashboard:
`checkTeacherWeeklyLimit()` loại chào cờ và sinh hoạt khỏi định mức — theo Thông tư 05/2025,
đây là nhiệm vụ chủ nhiệm và đã được trả bằng `workload_reduction`, tính thêm vào định mức
là tính hai lần — còn dashboard đếm mọi tiết trong bảng.

Sau khi cho dashboard dùng cùng quy tắc và tách riêng cột nghi lễ:

```
Lỗi cứng: 0 · Cảnh báo vượt định mức: 0
Lê Quang Minh    17 tiết dạy + 2 nghi lễ / định mức 17
Đặng Thị Hoa     17 tiết dạy + 2 nghi lễ / định mức 17
Nguyễn Thị Lan   16 tiết dạy + 2 nghi lễ / định mức 17
```

**Bài học:** hai chỗ trong hệ thống cùng trả lời một câu hỏi ("giáo viên này có quá tải
không") là một chỗ để lệch pha. Trước đó đã có đúng lỗi này giữa hai hàm tính điểm — chênh
nhau ~16000 điểm vì `groupBy` gom mọi tiết chưa có phòng vào cùng khoá `'none'` (Phụ lục D).

## F.2 — Khai phá quy luật ẩn: kiểm chứng bằng thao tác thật

Không mô phỏng dữ liệu — kịch bản kiểm thử gọi thẳng `POST /algorithm/move-slot` như người
xếp lịch kéo thả trên giao diện, rồi đọc lại bằng `GET /algorithm/mined-rules/:semesterId`.

Kết quả từ 21 lần di chuyển thật:

```
[91% · 6 lần] Đặng Thị Hoa thường bị chuyển khỏi Thứ 5 tiết 5
   → đề xuất: GV_LS_01 bận Thứ 5, buổi sáng, tiết 5
[67% · 4 lần] Lê Quang Minh thường bị chuyển khỏi Thứ 6 tiết 5
   → đề xuất: GV_TOAN_01 bận Thứ 6, buổi sáng, tiết 5

Chấp nhận gợi ý: created=true  — lịch bận 0 → 1
Bấm lần hai:      created=false — lịch bận vẫn 1
```

Sau kiểm thử, toàn bộ 217 tiết được trả về đúng vị trí ban đầu, điểm quay lại **−263** đúng
bằng giá trị trước khi thử, khoá tạm đã gỡ, chỉ còn 10 tiết nghi lễ được ghim như thiết kế.

## F.3 — Ba điều kiểm thử này phát hiện

1. **Kéo một tiết sẽ ghim tiết đó (`is_locked: true`).** Muốn sửa lại chính thao tác vừa
   làm thì phải mở khoá trước, nếu không API từ chối. Hợp lý khi cố định chỗ vừa đặt, nhưng
   người dùng kéo nhầm sẽ vấp — **đáng cân nhắc lại**, chưa sửa vì đụng vào hành vi có chủ ý.

2. **Quy luật cấp môn ban đầu chỉ là quy luật cấp giáo viên nói lại.** Một GV Lịch sử bị kéo
   khỏi Thứ 5 tiết 5 sáu lần làm hệ thống báo hai phát hiện từ cùng một bằng chứng. Đã thêm
   điều kiện ≥ 2 giáo viên khác nhau cho quy luật cấp môn và cấp lớp.

3. **`PUT /resources/teachers/:id/constraints` xoá sạch rồi ghi lại.** Nếu nút "Đúng, thêm
   ràng buộc" gọi endpoint này thì mỗi lần chấp nhận một gợi ý sẽ âm thầm xoá mọi lịch bận
   nhập tay của giáo viên đó. Đã viết endpoint cộng dồn riêng, có kiểm tra trùng.

## F.4 — Ranh giới cố ý của tính năng khai phá

Hệ thống **không tự thêm ràng buộc**, chỉ đặt câu hỏi kèm bằng chứng. Cùng một thao tác kéo
có thể vì giáo viên bận, vì lớp có hoạt động riêng, hoặc vì phòng thực hành kẹt lịch — dữ
liệu không phân biệt được, chỉ người xếp lịch mới biết. Một hệ thống tự suy ra "GV này bận
Thứ 5" rồi tự chặn sẽ tạo ra ràng buộc sai mà không ai biết tại sao thời khóa biểu học kỳ
sau lại tệ đi.

Ngưỡng 3 lần quan sát là mức thấp có chủ ý, đủ để hệ thống hữu ích ngay trong học kỳ đầu.
Độ tin cậy trần 95% — không bao giờ 100%, vì suy luận này về bản chất không chắc chắn.

---

# Phụ lục G — Nối trang cấu hình vào thuật toán

## G.1 — Trang cấu hình nói dối hai lần

`/admin/configuration` có đủ ô nhập trọng số và công tắc bật/tắt, nhìn như một trang điều
khiển thật. Thực tế:

1. **Trọng số lưu vào một mảng ở cấp module**, mất khi restart, và **thuật toán không bao
   giờ đọc**. Admin hạ trọng số rồi chạy lại nhận về thời khóa biểu y hệt, không có gì báo
   tại sao.
2. **Danh sách 11 ràng buộc gõ tay** trong khi thuật toán áp dụng **8 cứng + 14 mềm**. Một
   số dòng trên màn hình không ứng với gì trong code; 8 ràng buộc mềm có thật thì vô hình
   với admin.

Đây là dạng lỗi khó chịu hơn không có tính năng: người dùng tin là mình đang điều khiển.

## G.2 — Cách sửa

Danh mục ràng buộc (`constraint-catalogue.ts`) đặt cạnh code áp dụng chúng, dùng **đúng
những khoá** mà `ConstraintService.weights` và `checkHardConstraints()` dùng. Database chỉ
lưu **phần admin sửa khác mặc định** — tên và mô tả không lưu xuống DB, vì như vậy màn hình
có thể mô tả một ràng buộc mà thuật toán đã bỏ.

Một test đọc thẳng mã nguồn `constraint.service.ts` và đối chiếu với danh mục. Đã thử làm
lệch một khoá để kiểm chứng: test đỏ đúng như thiết kế.

## G.3 — Kiểm chứng bằng ba lần chạy thật

Cùng dữ liệu, chỉ đổi trọng số "Tiết trống giáo viên":

| Cấu hình | Trọng số | Số tiết trống GV | Điểm | Hợp lệ |
| :--- | ---: | ---: | ---: | :---: |
| Tắt hẳn | 0 | 55 | +134 | ✅ |
| Mặc định | 5 | 24 | −180 | ✅ |
| Nâng lên 200 | 200 | 2 | −832 | ✅ |

Số vi phạm giảm đơn điệu khi trọng số tăng — bằng chứng thuật toán đọc đúng con số trên màn
hình. Cột điểm cho thấy cái giá: ép tiết trống từ 24 xuống 2 làm tổng điểm tệ đi vì các
ràng buộc mềm khác phải nhường chỗ. Cả ba đều 0 lỗi cứng.

Đây cũng là thứ hội đồng thử được ngay tại chỗ: *"tắt ràng buộc này xem sao"*.

## G.4 — Những chỗ cố tình không cho phép

| Thao tác | Kết quả | Lý do |
| :--- | :--- | :--- |
| Tắt "GV trùng giờ" / "Lớp trùng giờ" / "Phòng trùng giờ" | Từ chối | Không thực hiện được, không phải kém tối ưu |
| Đặt mức phạt lỗi cứng = 0 | Từ chối | Thuật toán sẽ coi lời giải sai cũng tốt như lời giải đúng |
| Đặt trọng số riêng cho một ràng buộc cứng | Từ chối | Code dùng một mức phạt chung; cho nhập số riêng là hứa điều không có |
| Trọng số âm hoặc số lẻ | Từ chối | — |

Năm ràng buộc cứng còn lại **tắt được**, vì chúng là lựa chọn của trường chứ không phải quy
luật vật lý: lịch bận giáo viên, đủ số tiết, lớp không trống tiết, định mức tuần, đủ phòng
chức năng.

Nếu đọc cấu hình thất bại, thuật toán **quay về trọng số mặc định và ghi log**, không dừng
lại — một trang cấu hình hỏng không được ngăn trường xếp thời khóa biểu.

---

# Phụ lục H — Nguyện vọng ba mức và hai phát hiện kèm theo

## H.1 — Vì sao ba mức chứ không phải hai

`ConstraintType.AVOID` đã nằm trong schema từ lâu nhưng **chưa dòng code nào đọc nó**. Chỉ
có `BUSY` được dùng, và nó là ràng buộc cứng tuyệt đối.

Hệ quả thực tế: giáo viên chỉ có một cách nói — "tôi bận". Không có cách nào nói "dạy được
nhưng tôi không muốn" hay "tôi thích dạy giờ này". Nên hoặc họ khai bận cả những khung giờ
thật ra vẫn dạy được (làm bài toán không giải nổi), hoặc không khai gì (nguyện vọng biến
mất). Cả hai đều tệ.

Nay có ba mức:

| Mức | Bản chất | Thuật toán |
| :--- | :--- | :--- |
| Bận | Sự thật về cuộc sống — họp, đi học, đưa đón con | Ràng buộc cứng, tuyệt đối không xếp |
| Hạn chế | Dạy được nhưng không muốn | Trừ 14 điểm, vẫn xếp nếu không còn cách |
| Mong muốn | Thích dạy giờ này | **Cộng 6 điểm** — khoản duy nhất cộng thay vì trừ |

Đo trên dữ liệu thật: đăng ký 2 nguyện vọng đang được đáp ứng → điểm tăng đúng 12, báo cáo
`Đáp ứng nguyện vọng giáo viên: +12 điểm (2/2)`.

## H.2 — Phát hiện: hai nơi cùng nói "đăng ký bận", chỉ một nơi tới được thuật toán

Sau khi gộp hai hướng làm việc, hệ thống có **hai luồng** cùng tên:

| | Ghi vào bảng | Thuật toán có đọc? |
| :--- | :--- | :---: |
| `/teacher/feedback` — "Đăng ký lịch bận" | `teacher_busy_requests` | **Không** |
| `/teacher/preferences` — nguyện vọng | `teacher_constraints` | Có |

Kiểm chứng bằng cách đếm tham chiếu chéo:

```
busy-schedule chạm bảng teacher_constraints:        0 lần
thuật toán đọc bảng teacher_busy_requests:          0 lần
busy-schedule tạo schedule_overlays:                0 lần
```

**Nghĩa là:** giáo viên đăng ký bận ở `/teacher/feedback`, admin bấm duyệt, và **thời khóa
biểu sinh ra sau đó không hề biết**. Yêu cầu đã duyệt chỉ dùng cho tính năng phát hiện xung
đột và gợi ý đổi tiết trong chính module đó.

**Đây không hẳn là lỗi thiết kế** — hai bảng có bản chất khác nhau: `teacher_busy_requests`
có `week_number` nên là nghỉ **một tuần cụ thể**, còn `teacher_constraints` là bận **lặp
hàng tuần**. Nghỉ một tuần lẽ ra phải đi vào `schedule_overlays` của kiến trúc hai tầng
(mục `B1`) rồi kích hoạt luồng dạy thay, chứ không phải sinh lại thời khóa biểu.

**Nhưng chưa có gì nối chúng lại.** Đã duyệt một yêu cầu nghỉ tuần thì không sinh overlay,
không ai được phân dạy thay. Cần một mục riêng trong lộ trình; chưa làm vì nằm ngoài phạm vi
`D2`.

Giao diện đã đổi tên để bớt nhầm: *"Nguyện vọng"* (lặp hàng tuần) và *"Xin nghỉ theo tuần"*.

## H.3 — Phát hiện: thời khóa biểu càng nhiều ràng buộc càng chạy chậm

Mỗi ràng buộc thêm vào đều được tính lại **từ đầu trên toàn bộ 217 tiết, ở mọi lần đánh
giá**. Đo thực tế:

```
217 tiết, 2000 lần gọi mỗi hàm:
  0.484 ms   checkHardConstraints
  0.453 ms   calculatePenalty
  ─────────
  0.94 ms một lần đánh giá  →  12000 vòng x 12 lần khởi động lại ≈ 2,2 phút
```

Thực tế còn lâu hơn con số đó vì mỗi vòng lặp đánh giá nhiều phương án. Trong quá trình làm
mục này, một lần chạy đã vượt 10 phút và bị cắt.

Hai chỗ đã sửa được ngay:

- `getSubjectCode` quét mảng tuyến tính + `toUpperCase()` mỗi lần gọi → cache theo id
- `preferenceReport` quét toàn bộ tiết để tìm nguyện vọng **mà chưa ai đăng ký** — nó đang là
  thành phần đắt nhất của `calculatePenalty` (0.085 ms). Nay thoát sớm khi không có gì để
  tính: **0.000 ms**
- `isTeacherBusy` quét danh sách ràng buộc của giáo viên mỗi lần gọi → `Set` tra cứu O(1)

**Cách sửa tận gốc là đánh giá tăng dần**: một thao tác đổi chỗ chỉ đụng 2 tiết, nên chỉ cần
tính lại phần điểm liên quan tới 2 tiết đó thay vì cả 217. Đây là việc riêng, đáng đưa vào
lộ trình — nếu không, mỗi ràng buộc mới sẽ tiếp tục làm mọi lần chạy chậm thêm.

---

# Phụ lục I — Chấm điểm tăng dần: 100 lần nhanh hơn

## I.1 — Vấn đề tự lớn dần

Ở Phụ lục H tôi ghi nhận thuật toán chậm dần theo mỗi ràng buộc thêm vào. Đến mục `D2` thì
một lần chạy vượt 10 phút và bị cắt. Nguyên nhân đơn giản: sau **mỗi thao tác thử**, điểm
được tính lại từ đầu trên cả 217 tiết.

## I.2 — Nhận xét khiến việc này làm được

Một thao tác đổi chỗ chỉ thay đổi **khi nào** một hai tiết diễn ra. Nó không đổi:

- tiết nào tồn tại → `checkMissingPeriods` bất biến
- ai dạy tiết nào → `checkTeacherWeeklyLimit` bất biến
- tiết thuộc lớp nào

Vậy chỉ cần chấm lại **một hai lớp và một hai giáo viên** liên quan. Trên 7 lớp và 21 giáo
viên, đó là phần lớn công việc được bỏ qua.

Phép tách chính xác tuyệt đối chứ không phải xấp xỉ, vì mọi hàm chấm điểm vốn đã cộng dồn
độc lập theo từng lớp / từng giáo viên — chúng chỉ chưa bao giờ được gọi riêng lẻ.

## I.3 — Kết quả

| | Trước | Sau |
| :--- | ---: | ---: |
| Một lần chạy | > 10 phút (bị cắt) | **4,1 – 5,7 giây** |
| Điểm | −289 | **−151 … −283** |
| Lỗi cứng | 0 | 0 |
| Hợp lệ | ✅ | ✅ 4/4 lần |

Điểm còn **tốt hơn** vì trong cùng ngân sách vòng lặp, tìm kiếm nay chạy trọn vẹn thay vì bị
cắt giữa chừng.

## I.4 — Hai quyết định thiết kế

**Bộ chấm điểm tự phát hiện thay đổi.** Phương án hiển nhiên là bắt mỗi hàm sinh thao tác
khai báo những tiết nó vừa đụng. Cách đó chạy đúng cho tới khi ai đó thêm loại thao tác thứ
tư rồi quên khai — và lỗi sẽ im lặng, chỉ biểu hiện thành điểm sai. Thay vào đó bộ chấm điểm
giữ ảnh chụp vị trí và tự so. Duyệt 217 tiết so hai số nguyên rẻ hơn nhiều so với chấm lại
một lớp, và không thể quên được.

**Điều kiện bắt buộc: phải trùng khít.** Một bộ chấm điểm lệch dần sẽ khiến thuật toán tối ưu
một con số khác với con số nhà trường nhìn thấy, mà không có gì báo. `incremental-scoring.spec.ts`
đối chiếu với bản tính đầy đủ sau **mỗi** thao tác, qua hơn 700 lần đổi chỗ và dời tiết ngẫu
nhiên, trên lịch sinh ngẫu nhiên có cả lịch bận, nguyện vọng và môn ngoài trời.

## I.5 — Thử nâng ngân sách vòng lặp: không đáng

Nhanh gấp 100 lần thì tự nhiên nghĩ tới việc đổi tốc độ lấy chất lượng. Đã thử 40.000 và
120.000 vòng thay vì 12.000: mỗi lần chạy trở lại mức vài phút. Lý do là ngưỡng dừng sớm
(`plateauLimit`) tính theo ngân sách, nên tăng ngân sách thì tìm kiếm không còn thoát sớm
nữa. Giữ nguyên 12.000. Muốn chỉnh cho đúng thì nên dùng Benchmark Lab (`A1`) chứ không phải
đoán.
