# LỘ TRÌNH PHÁT TRIỂN
## Hệ thống Xếp Thời khóa biểu THPT — 49 chức năng / 9 phase / ~81 ngày công

> Bản trực quan: https://claude.ai/code/artifact/3c150719-2f31-46a2-aa29-3669d64e5266

---

## Cách dùng tài liệu

Mỗi phase là một mốc bàn giao có thể demo được. Trong phase, làm **tuần tự từng feature một** — thứ tự đã được sắp theo phụ thuộc kỹ thuật, đảo thứ tự sẽ phải làm lại.

Mỗi feature có:
- **Ngày công** — ước lượng cho một người quen stack hiện tại
- **Phụ thuộc** — feature bắt buộc phải xong trước
- **Chạm vào** — file/module sẽ sửa
- **Hoàn thành khi** — tiêu chí nghiệm thu, tick hết mới chuyển feature tiếp theo

Ký hiệu ưu tiên: 🔴 Cốt lõi · 🟠 Quan trọng · 🟡 Bổ sung

---

## Tổng quan các phase

| Phase | Tên | Feature | Ngày | Mốc bàn giao |
| :---: | :--- | :---: | :---: | :--- |
| **0** | Nền móng & Bảo mật ✅ | 10 | 3.7 | **Xong hoàn toàn** — guard, dọn code chết, sửa build |
| **1** | Đúng đắn thuật toán ✅ | 6 | 6.5 | **Xong** — TKB hợp lệ, 0 lỗi cứng, điểm dương |
| **2** | Chẩn đoán & Trực quan ✅ | 3 | 6.5 | **Xong** — pre-flight, realtime, Swagger |
| **3** | Chiều sâu thuật toán ✅ | 4 | 10 | **Xong** — benchmark 5 thuật toán, đa phương án, chi phí di chuyển |
| **4** | Đổi tiết dây chuyền ✅ | 4 | 10 | **Xong** — chu trình đổi tiết, XAI, kéo-thả thông minh, nhật ký |
| **5** | TKB Sống | 6 | 14.5 | `B1`–`B5` ✅ · còn `D4` thông báo |
| **6** | Cổng giáo viên | 5 | 8 | Giáo viên dùng thật trên điện thoại |
| **7** | Trợ lý AI | 6 | 12.5 | Chatbot trả lời + hành động được, có đo độ chính xác |
| **8** | Hoàn thiện | 5 | 9 | Công bằng, tự học, xuất bản |
| | **Tổng** | **49** | **80.7** | |

**Cắt ngắn theo quỹ thời gian:**
- 2 tuần → Phase 0–2 (~17 ngày)
- 1 tháng → Phase 0–4 (~37 ngày)
- 2 tháng → toàn bộ

---
---

# PHASE 0 — Nền móng & Bảo mật

**3.7 ngày · 10 feature · Không phụ thuộc gì**

Backend hiện **không có bất kỳ guard phân quyền nào** — mọi endpoint đều gọi được không cần đăng nhập. Phase này phải xong trước mọi thứ khác, vì Phase 7 (AI) dựa vào danh tính lấy từ JWT để phân quyền dữ liệu.

---

### 0.1 — Phân quyền JWT toàn hệ thống 🔴 — ✅ **ĐÃ LÀM**
**Ngày công:** 1.5 · **Phụ thuộc:** —

Cài `JwtStrategy` (passport-jwt đã có trong package.json nhưng chưa có file strategy), đăng ký `JwtAuthGuard` làm global guard, thêm `RolesGuard` + decorator `@Roles('ADMIN')` cho các route quản trị, `@Public()` cho `/auth/login` và `/auth/captcha`.

**Chạm vào:**
- `BE_TKB/src/auth/jwt.strategy.ts` *(mới)*
- `BE_TKB/src/auth/guards/jwt-auth.guard.ts`, `roles.guard.ts` *(mới)*
- `BE_TKB/src/auth/decorators/roles.decorator.ts`, `public.decorator.ts` *(mới)*
- `BE_TKB/src/app.module.ts` — đăng ký `APP_GUARD`
- Tất cả controller — gắn `@Roles`

**Hoàn thành khi:**
- [ ] `curl` không kèm token vào `/users` → trả 401
- [ ] Token role TEACHER gọi `DELETE /resources/teachers/:id` → trả 403
- [ ] `/auth/login`, `/auth/captcha` vẫn gọi được không cần token
- [ ] Toàn bộ luồng FE hiện tại vẫn chạy (FE đã gửi Bearer sẵn)

---

### 0.2 — Ẩn password_hash khỏi API 🔴 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.2 · **Phụ thuộc:** —

`GET /users` đang trả về hash mật khẩu của toàn bộ tài khoản.

**Chạm vào:** `BE_TKB/src/users/users.service.ts` — thêm `select` tường minh cho `findAll`, `findOne`, `create`, `update`

**Hoàn thành khi:**
- [ ] Không endpoint nào trả về trường `password_hash`
- [ ] Grep `password_hash` trong response DTO → 0 kết quả

---

### 0.3 — Bỏ fallback so sánh mật khẩu plaintext 🔴 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.2 · **Phụ thuộc:** —

Khi `bcrypt.compare` thất bại, code đang so sánh chuỗi thô — nghĩa là mật khẩu lưu dạng plaintext vẫn đăng nhập được.

**Chạm vào:** `BE_TKB/src/auth/auth.service.ts:55` và `:108`

**Hoàn thành khi:**
- [ ] Xóa cả 2 nhánh fallback
- [ ] Viết script migration băm lại các hash cũ chưa đúng định dạng bcrypt (nếu có)
- [ ] Đăng nhập bằng tài khoản seed vẫn hoạt động

---

### 0.4 — Bắt buộc JWT_SECRET từ env 🔴 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.2 · **Phụ thuộc:** —

Secret đang hardcode `superscretkeytkb2024` trong compose và `MY_CAPTCHA_SECRET_KEY` trong mã nguồn.

**Chạm vào:** `BE_TKB/src/auth/auth.service.ts:11`, `auth.module.ts`, `docker-compose.yml:45`, `DB_TKB/docker-compose.yml`

**Hoàn thành khi:**
- [ ] Thiếu `JWT_SECRET` → app throw khi khởi động, không chạy tiếp
- [ ] Không còn giá trị mặc định nào trong mã nguồn lẫn compose
- [ ] `.env.example` ghi rõ yêu cầu tối thiểu 32 ký tự

---

### 0.5 — Captcha lưu server-side 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** —

Hiện `sessionId = HMAC(mã captcha)` gửi thẳng cho client → dùng lại vô hạn, không hết hạn, không one-time.

**Chạm vào:** `BE_TKB/src/auth/auth.service.ts:18-42` — lưu vào Redis (đã có sẵn cho BullMQ)

**Hoàn thành khi:**
- [ ] Captcha lưu Redis với TTL 5 phút
- [ ] Verify xong là xóa key, dùng lại lần 2 → thất bại
- [ ] Gửi lại `sessionId` cũ sau 5 phút → thất bại

---

### 0.6 — Rate limit đăng nhập 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.3 · **Phụ thuộc:** —

**Chạm vào:** `@nestjs/throttler`, `BE_TKB/src/auth/auth.controller.ts`

**Hoàn thành khi:**
- [ ] Quá 5 lần sai trong 1 phút từ cùng IP → 429
- [ ] Đăng nhập đúng reset bộ đếm

---

### 0.7 — Giới hạn CORS origin 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.1 · **Phụ thuộc:** —

**Chạm vào:** `BE_TKB/src/main.ts:9` — `enableCors({ origin: process.env.CORS_ORIGIN?.split(',') })`

**Hoàn thành khi:**
- [ ] Chỉ domain trong `CORS_ORIGIN` gọi được
- [ ] Biến đã thêm vào `.env.example` và cả 2 file compose

---

### 0.12 — Xóa code chết 🟡 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** —

Làm sớm để các phase sau không phải đọc nhầm.

**✅ Đã xong — 19 file ràng buộc trong `src/constraints/hard|soft`:** logic hữu ích đã được hấp thụ vào `ConstraintService` ở feature `0.17`, toàn bộ file đã xóa. Giữ lại `interfaces/constraint.interface.ts` cho tới khi `greedy.solver.ts` bị xóa.

**Xóa — code chết khác:**
- `BE_TKB/src/algorithm/greedy.solver.ts` — không được provide, còn dùng field tiếng Việt đã bị xóa khỏi schema
- `FE_TKB/app/components/TimetableGrid.tsx` (~650 dòng, mồ côi) + `TeacherRegistration.tsx` + `ConstraintConfig.tsx`
- `FE_TKB/app/components/admin/AssignmentDetailModal.tsx` — gọi 4 controller không tồn tại
- Redux: `lib/store.ts`, `lib/hooks.ts`, `lib/features/`, `app/StoreProvider.tsx` + gỡ `@reduxjs/toolkit`, `react-redux`

> ⚠️ `greedy.solver.ts` import `interfaces/constraint.interface.ts` — xóa solver trước, rồi mới xóa interface.

**Hoàn thành khi:**
- [ ] `npm run build` cả BE và FE đều pass
- [ ] Toàn bộ trang trong `/admin` và `/teacher` vẫn chạy
- [ ] `package.json` FE đã gỡ 2 package Redux

---

### 0.14 — Sửa start:prod lệch startup.sh 🟡 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.1 · **Phụ thuộc:** —

`package.json` ghi `node dist/main`, `startup.sh` chạy `node dist/src/main.js`.

**Hoàn thành khi:**
- [ ] `npm run start:prod` chạy được ở local sau `npm run build`

---

### 0.15 — Gỡ file log khỏi git 🟡 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.1 · **Phụ thuộc:** —

`fe-live.log` và `BE_TKB/server.log` đang bị track dù `.gitignore` đã có `*.log`.

**Hoàn thành khi:**
- [ ] `git rm --cached` cả 2 file
- [ ] `git ls-files | grep '\.log'` → rỗng

---
---

# PHASE 1 — Đúng đắn thuật toán

**6.5 ngày · 6 feature · Phụ thuộc: Phase 0**

Phải sửa xong trước Phase 3, vì benchmark một thuật toán sai thì số liệu vô nghĩa.

---

### 0.8 — Bỏ skipDuplicates khi lưu TKB 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 1 · **Phụ thuộc:** —

> **Ghi chú thực hiện:** bỏ `skipDuplicates` mà giữ `createMany` sẽ làm **cả lô** fail ngay tiết trùng đầu tiên. Nên thêm `partitionSlots()` phát hiện trùng trong bộ nhớ theo đúng 3 unique index trước, ghi log từng tiết bị từ chối kèm lý do, rồi mới ghi phần sạch. Sau khi ghi thì **đọc lại từ DB** và chấm điểm trên đúng dữ liệu đó.

`createMany({ skipDuplicates: true })` đang **nuốt âm thầm** các tiết vi phạm unique index. Số tiết trong DB ít hơn số tiết thuật toán sinh ra, và `fitness_score` đã lưu là điểm của lời giải trong bộ nhớ chứ không phải của TKB thật.

**Chạm vào:** `BE_TKB/src/algorithm/algorithm.service.ts:475-512`

**Hoàn thành khi:**
- [x] Bỏ `skipDuplicates`; `partitionSlots()` phát hiện trùng trước, log rõ từng tiết bị từ chối kèm Thứ / tiết / lớp / môn / lý do
- [x] Sau khi lưu, đọc lại slot từ DB rồi tính lại fitness → ghi đè `fitness_score` bằng điểm đó
- [x] `debugLogs` báo rõ: `Sinh N tiết → lưu M tiết → từ chối K tiết` kèm cờ HỢP LỆ / KHÔNG HỢP LỆ
- [x] Worker và FE nhận thêm `fitnessScore`, `isValid`, `stats`; FE báo toast đỏ khi TKB còn lỗi cứng
- [x] 6 unit test phủ `partitionSlots` — gồm cả trường hợp `room_id` null không xung đột với nhau

---

### 0.9 — Thống nhất nguồn xác định buổi học 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** —

> **Xác nhận bằng dữ liệu thật:** trước khi sửa, chào cờ chỉ được xếp cho 4 lớp mà phase 1 *đoán* là học sáng qua tên lớp. `10D1` và `12D1` học **chiều** nhưng bị nhét chào cờ vào tiết 1 sáng; `11A1` học **sáng** nhưng sinh hoạt cuối tuần rơi xuống tiết 10 chiều. Đã đổi sang đọc `cls.grade_level` và `cls.main_session`.

Phase 1 của thuật toán parse regex trên **tên lớp** (`[12,10].includes(grade)` — hardcode khối 10/12 học sáng), Phase 2 lại đọc `cls.main_session` từ DB. Hai nguồn mâu thuẫn → tiết chào cờ có thể rơi sai buổi.

**Chạm vào:** `algorithm.service.ts:134-138` — dùng `cls.grade_level` và `cls.main_session` sẵn có trong schema

**Hoàn thành khi:**
- [ ] Không còn `cls.name.match(/\d+/)` trong toàn bộ thuật toán
- [ ] Test: lớp khối 11 có `main_session = 0` → tiết cố định xếp buổi sáng

---

### 0.10 — moveSlot kiểm tra xung đột GV & phòng 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** —

Hiện chỉ tìm slot đích theo `class_id`. Kéo-thả gây trùng giáo viên sẽ ném lỗi Prisma thô ra FE.

**Chạm vào:** `algorithm.service.ts:514-558`

**Hoàn thành khi:**
- [ ] Kiểm tra đủ 3 chiều (lớp / GV / phòng) trước khi update
- [ ] Vi phạm → trả `400` kèm thông điệp tiếng Việt rõ ràng
- [ ] Vị trí tạm khi swap dùng giá trị âm thay vì `(0,0)`

---

### 0.11 — Nối logic phòng thực hành 🟡 — 🟨 **MỘT PHẦN**
**Ngày công:** 1 · **Phụ thuộc:** 0.10

> Ràng buộc sức chứa phòng chức năng đã cài (`checkRoomTypeCapacity`, `isRoomTypeFull`) nhưng **chưa kích hoạt được** vì dữ liệu thiếu: chưa môn nào có cờ `is_practice`, chưa lớp nào có `fixed_room_id`, chưa có phòng loại `YARD`. Xem checklist ở `0.17`.

`getValidRooms()` đã viết xong ở `constraint.service.ts:84` nhưng **không nơi nào gọi**. Mọi tiết đang gán cứng `roomId = cls.fixed_room_id`, môn thực hành không được đưa vào Lab.

**Chạm vào:** `algorithm.service.ts` phase 2 — gọi `getValidRooms` khi `assignment.period_type === PRACTICE`

**Hoàn thành khi:**
- [ ] Tiết Tin xếp vào phòng 314/315, Lý vào 301, Hóa 302, Sinh 303
- [ ] Xung đột phòng Lab được đếm vào lỗi cứng

---

### 0.17 — Bộ ràng buộc đầy đủ 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 3 · **Phụ thuộc:** 0.11

> **Ghi chú thực hiện:** thay vì nối 10 file class-based, logic đã được **hấp thụ thẳng vào `ConstraintService`**. Lý do: các file đó dùng `subjectId: string` trong khi model sống dùng `number`, và `check()` trả về ở vi phạm **đầu tiên** thay vì đếm tích lũy — sửa hai thứ này tương đương viết lại. Hấp thụ giữ được đúng style code xung quanh và không đụng vào phần fitness đang chạy tốt. 19 file đã xóa, `0.12` cập nhật theo.

Hiện thuật toán chỉ kiểm tra **2 ràng buộc khi đặt tiết** (ô đã chiếm chưa, GV trùng giờ chưa). Mọi ràng buộc còn lại chỉ được chấm điểm sau khi đã xếp xong — hoặc không tồn tại. Chi tiết ở [REVIEW.md — Phụ lục A](REVIEW.md).

Làm tuần tự 3 bước:

**Bước 1 (1đ) — Nối 10 file ràng buộc đã giữ lại từ `0.12`**

- Sửa `ScheduleSlot.subjectId`/`roomId` từ `string` → `number` cho khớp `TimeSlot` đang dùng
- Đổi `check()` từ `return` ở vi phạm **đầu tiên** sang **đếm tích lũy** toàn bộ vi phạm
- Đăng ký vào `ConstraintService.calculatePenalty()` và `checkHardConstraints()`

**Bước 2 (1đ) — Chuyển 3 ràng buộc từ hậu kiểm sang phòng ngừa**

Gọi ngay trong vòng lặp đặt tiết của `phase2_Heuristic`, không chờ phase 3 dọn:

- `isTeacherBusy()` — hiện GV bị xếp vào đúng ô đã báo bận
- `weekly-limit-teacher` — đọc `Teacher.max_periods_per_week` thay vì hằng số 20
- `room-suitability` — đếm sức chứa phòng Lab theo từng khung giờ

**Bước 3 (1đ) — Bổ sung ràng buộc thực tế còn thiếu**

| Ràng buộc | Loại | Ghi chú |
| :--- | :---: | :--- |
| Đủ số tiết theo phân công | Cứng | Tổng tiết đã xếp mỗi (lớp, môn) phải bằng `total_periods` |
| Lớp không trống tiết giữa buổi | Cứng | Dùng `minimize-idle-class` nhưng nâng lên mức cứng |
| Tối thiểu số buổi GV đến trường | Mềm ⭐⭐⭐ | Nguyện vọng số 1 của giáo viên |
| Không dạy cả sáng lẫn chiều cùng ngày | Mềm ⭐⭐⭐ | `checkNoHoles` hiện bỏ qua trường hợp này |
| Không xếp môn tư duy ngay sau Thể dục | Mềm ⭐⭐ | Rất dễ cài |
| Ít nhất 1 ngày nghỉ trọn vẹn/tuần | Mềm ⭐⭐ | |

**Chạm vào:** `BE_TKB/src/constraints/`, `BE_TKB/src/algorithm/constraint.service.ts`, `algorithm.service.ts` phase 2

**Hoàn thành khi:**
- [x] Số ràng buộc kiểm tra **khi đặt tiết** tăng từ 2 lên **6**
- [x] Không còn tiết nào rơi vào ô giáo viên đã đăng ký bận *(guard tại chỗ đặt tiết)*
- [x] Thêm bước **dồn tiết** khép lỗ hổng giữa buổi của lớp sau phase 2
- [x] `getFitnessDetails()` liệt kê đủ 8 ràng buộc cứng + 11 ràng buộc mềm kèm số lỗi
- [x] `getFitnessDetails()` trả thêm cờ `isValid` và `breakdown`
- [x] 19 unit test phủ toàn bộ ràng buộc mới — `npx jest src/algorithm/constraint.service.spec.ts`
- [ ] Chặn công bố khi TKB thiếu tiết — *phát hiện đã xong (`isValid`), phần chặn chờ luồng công bố ở* `B5`
- [ ] Đo số buổi GV đến trường trung bình trước/sau — *chỉ số đã tính, chờ báo cáo ở* `D5`

**Cần seed thêm để kích hoạt đủ:**
- [ ] Thêm phòng loại `YARD` vào `ROOM_SEED` — chưa có sân nào nên ràng buộc sức chứa sân Thể dục đang bị bỏ qua
- [ ] Đặt cờ `is_practice` cho các môn Tin / Lý / Hóa / Sinh — hiện chưa môn nào được đánh dấu nên phòng Lab chưa bị giới hạn

> 📌 Phải xong **trước** `A1` — mọi số liệu benchmark đều phụ thuộc vào bộ ràng buộc này. Benchmark trên bộ ràng buộc thiếu là số liệu vô nghĩa.

---

### 0.16 — Cập nhật readme cho khớp code 🟡 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** 0.8, 0.17

Tài liệu ghi "Hybrid Genetic Algorithm" nhưng code là hill climbing; công thức fitness trong readme bỏ sót phần trừ điểm mềm.

**Chạm vào:** `readme.md`, `readme1.md`

**Hoàn thành khi:**
- [ ] Mô tả đúng 3 phase thực tế
- [ ] Công thức fitness khớp `calculateFitness()`
- [ ] Đánh dấu rõ tính năng nào đã có, tính năng nào còn trong lộ trình

---
---

# PHASE 2 — Chẩn đoán & Trực quan

**6.5 ngày · 3 feature · Phụ thuộc: Phase 1**

Kết thúc phase này là đã **demo được**: kiểm tra dữ liệu → chạy → xem lưới tự lấp đầy.

---

### A3 — Pre-flight Check 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 2.5 · **Phụ thuộc:** —

Phân tích dữ liệu đầu vào và chấm điểm khả thi 0–100 **trước** khi chạy thuật toán.

**Kiểm tra:**
- Tổng tiết cần xếp vs tổng ô khả dụng (theo từng lớp, từng buổi)
- GV có đủ ô rảnh sau khi trừ lịch bận đã đăng ký không
- Phòng chức năng: tổng tiết thực hành vs số ô Lab
- Lớp chưa có GVCN → không xếp được tiết Sinh hoạt
- Lớp chưa được phân công môn bắt buộc

**Chạm vào:**
- `BE_TKB/src/algorithm/feasibility.service.ts` *(mới)*
- `GET /algorithm/preflight/:semesterId`
- `FE_TKB/app/admin/timetable/page.tsx` — nút + panel kết quả

**Hoàn thành khi:**
- [x] Mỗi cảnh báo có mức độ (🔴 chặn / 🟠 rủi ro / 🟡 lưu ý)
- [x] Mỗi dòng có nút nhảy tới màn hình sửa tương ứng
- [x] Có ít nhất 1 gợi ý khắc phục cho mỗi lỗi chặn
- [x] Bấm "Xếp lịch" khi còn lỗi 🔴 → cảnh báo xác nhận
- [x] 12 phép kiểm tra, chấm điểm khả thi 0-100
- [x] Kiểm chứng trên dữ liệu thật: bắt đúng 2 giáo viên kín định mức và quy tắc tiết cố định trùng giáo viên

---

### A2 — Trực quan hóa xếp lịch realtime 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 3.5 · **Phụ thuộc:** —

Thay cơ chế poll 3 giây bằng WebSocket. Đây là khoảnh khắc đẹp nhất của buổi bảo vệ.

**Chạm vào:**
- `@nestjs/websockets` + `socket.io`
- `BE_TKB/src/worker/algorithm.processor.ts` — emit tiến trình qua Redis pub/sub
- `BE_TKB/src/algorithm/algorithm.gateway.ts` *(mới)*
- `algorithm.service.ts` — thêm callback tiến trình vào phase 2 & 3
- `FE_TKB/app/admin/timetable/page.tsx:217` — bỏ `pollResult`

**Hoàn thành khi:**
- [ ] Lưới TKB lấp đầy dần theo thời gian thực, ô xung đột hiện đỏ rồi chuyển xanh
- [ ] Đồ thị fitness cập nhật realtime
- [ ] Bộ đếm: `Lỗi cứng 47 → 0`, `Thế hệ n/N`, `Đã xếp n/N tiết`
- [ ] Nút Tạm dừng / Tiếp tục / Dừng hẳn hoạt động
- [ ] Mất kết nối rồi vào lại → tự đồng bộ trạng thái hiện tại

---

### F1 — Swagger API docs 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** 0.1

**Chạm vào:** `@nestjs/swagger`, `BE_TKB/src/main.ts`, thêm `@ApiTags` cho từng controller

**Hoàn thành khi:**
- [ ] `/api/docs` liệt kê đủ mọi endpoint
- [ ] Có nút Authorize để thử với JWT
- [ ] Endpoint nào cần quyền ADMIN được đánh dấu rõ

---
---

# PHASE 3 — Chiều sâu thuật toán

**10 ngày · 4 feature · Phụ thuộc: Phase 1**

Phase quyết định đồ án đạt loại nào. Trả lời câu hỏi *"sao em biết thuật toán của em tốt?"* bằng số liệu.

---

### F2 — Unit test bộ kiểm tra ràng buộc 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 1.5 · **Phụ thuộc:** —

Làm **trước** A1, vì benchmark dựa trên `ConstraintService` — phải tin được nó đã.

**Chạm vào:** `BE_TKB/src/algorithm/constraint.service.spec.ts`

**Hoàn thành khi:**
- [ ] Mỗi hàm ràng buộc cứng có ít nhất 1 ca đúng + 1 ca vi phạm
- [ ] `checkHardConstraints` test trên lịch mẫu có số lỗi biết trước
- [ ] `isTeacherBusy` test đủ 3 nhánh session (sáng / chiều / cả ngày)
- [ ] `npm test` pass, coverage `constraint.service.ts` ≥ 80%

---

### A1 — Benchmark Lab 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 5.5 · **Phụ thuộc:** F2

Chia làm 3 bước nhỏ, làm tuần tự:

**Bước 1 (1.5đ) — Tách interface `ISolver`**
- `solve(data, options, onProgress): Promise<TimeSlot[]>`
- Bọc hill climbing hiện tại thành `HillClimbingSolver`
- Bọc phase 2 thành `GreedySolver` (viết mới, không phải file cũ đã xóa)

**Bước 2 (2.5đ) — Cài 3 solver mới**
- `SimulatedAnnealingSolver` — nhiệt độ giảm dần, chấp nhận nước đi xấu theo xác suất
- `TabuSearchSolver` — danh sách cấm độ dài cố định, aspiration criterion
- `GeneticSolver` — quần thể, tournament selection, class-based crossover, elitism

**Bước 3 (1.5đ) — Trang so sánh**
- `POST /algorithm/benchmark` — chọn solver + tham số + số lần chạy
- Bảng: điểm tốt nhất / trung bình / độ lệch chuẩn / thời gian / tỉ lệ đạt 0 lỗi cứng
- Biểu đồ đường hội tụ chồng nhau
- Xuất CSV

**Chạm vào:**
- `BE_TKB/src/algorithm/solvers/` *(thư mục mới)*
- `BE_TKB/src/algorithm/benchmark.service.ts` *(mới)*
- Schema: bảng `benchmark_runs`
- `FE_TKB/app/admin/benchmark/page.tsx` *(mới)*

**Hoàn thành khi:**
- [ ] 4 solver chạy được trên cùng một bộ dữ liệu
- [ ] Chạy 30 lần mỗi solver, kết quả lưu DB
- [ ] Biểu đồ hội tụ hiển thị đúng
- [ ] CSV xuất ra dán thẳng được vào chương Thực nghiệm
- [ ] Có ít nhất 1 solver đạt 0 lỗi cứng trên dữ liệu mẫu

---

### A6 — Chi phí di chuyển cầu thang 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 1 · **Phụ thuộc:** 0.11

`Room.floor` đã có sẵn trong schema, chưa ai dùng. Rẻ nhất trong toàn bộ lộ trình.

**Chạm vào:**
- `BE_TKB/src/algorithm/constraint.service.ts` — thêm vào `calculatePenalty`
- Schema: `Teacher.mobility_weight Int @default(10)` (đơn vị 0.1)

**Hoàn thành khi:**
- [ ] Phạt = Σ |floor(tiết n) − floor(tiết n+1)| × hệ số GV, chỉ tính trong cùng buổi
- [ ] `getFitnessDetails` hiển thị mục "Chi phí di chuyển"
- [ ] Báo cáo top 5 GV leo nhiều bậc nhất, so sánh trước/sau tối ưu
- [ ] Sửa được `mobility_weight` trong màn hình quản lý giáo viên

---

### A8 — Sinh đa phương án + bảng so sánh 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 2 · **Phụ thuộc:** A1

**Chạm vào:** `algorithm.service.ts`, `FE_TKB/app/admin/timetable/page.tsx`

**Hoàn thành khi:**
- [ ] Một lần chạy sinh 3–5 `GeneratedTimetable` khác nhau
- [ ] Bảng so sánh: điểm tổng, tiết trống GV, độ đều môn, vi phạm nguyện vọng, chi phí di chuyển
- [ ] Chọn 1 phương án đặt `is_official = true`, các bản còn lại giữ để đối chiếu

---
---

# PHASE 4 — Đổi tiết dây chuyền

**10 ngày · 4 feature · Phụ thuộc: Phase 3**

Feature có giá trị học thuật cao nhất. Cùng cấu trúc toán học với bài toán ghép thận (Alvin Roth, Nobel Kinh tế 2012).

---

### B6 — Nhật ký, so sánh phiên bản, hoàn tác 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 2.5 · **Phụ thuộc:** 0.10

Làm **trước** A4 và A7 — cả hai đều cần dữ liệu này.

**Chạm vào:**
- Schema: `TimetableChangeLog` (actor, hành động, slot, vị trí cũ/mới, thời điểm, lý do)
- `algorithm.service.ts` — ghi log trong `moveSlot`, `toggleLock`
- `FE_TKB/app/admin/timetable/` — panel lịch sử + nút hoàn tác

**Hoàn thành khi:**
- [ ] Mọi thao tác thủ công đều được ghi kèm người thực hiện
- [ ] Xem diff giữa 2 thời điểm, ô thay đổi tô vàng
- [ ] Hoàn tác 1 thao tác hoặc rollback về mốc thời gian
- [ ] Rollback cũng được ghi vào nhật ký

---

### A4 — Đổi tiết dây chuyền 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 4 · **Phụ thuộc:** B6

Khi đổi trực tiếp A↔B bất khả thi, tìm chu trình đổi 3–4 bên.

**Thuật toán:**
1. Dựng đồ thị có hướng: đỉnh = tiết di chuyển được; cạnh `u → v` nếu đưa `u` vào vị trí `v` không vi phạm ràng buộc cứng; trọng số = Δ điểm mềm
2. Tìm chu trình độ dài ≤ 4 chứa tiết cần giải phóng — DFS có cắt tỉa
3. Xếp hạng: ít người liên quan nhất → Δ điểm tốt nhất
4. Duyệt nguyên tử: gửi cho tất cả GV trong chu trình, **cần tất cả đồng ý**, một người từ chối là hủy toàn bộ và đề xuất chu trình kế tiếp

**Chạm vào:**
- `BE_TKB/src/algorithm/swap-graph.service.ts` *(mới)* — dùng lại `ConstraintService` để dựng cạnh
- Schema: `SwapProposal`, `SwapParticipant`
- `FE_TKB/app/teacher/schedule/` — giao diện đề xuất + duyệt

**Hoàn thành khi:**
- [ ] Tìm được chu trình 3 bên trên dữ liệu mà đổi trực tiếp bất khả thi
- [ ] Thời gian tìm < 2 giây với ~700 tiết
- [ ] Sơ đồ chu trình hiển thị trực quan cho GV
- [ ] Một người từ chối → toàn bộ chu trình bị hủy, không có thay đổi nào áp dụng nửa vời
- [ ] Chu trình được duyệt xong ghi vào `TimetableChangeLog`

---

### E2 — Kéo-thả thông minh 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 2 · **Phụ thuộc:** 0.10

Readme mục 3.3 đã hứa từ đầu nhưng chưa làm.

**Chạm vào:**
- `POST /algorithm/validate-move` — trả `{ valid, violations[], deltaFitness }`
- `FE_TKB/app/components/dnd/DroppableCell.tsx`, `admin/TimetableGrid.tsx`

**Hoàn thành khi:**
- [ ] Nhấc tiết lên: ô hợp lệ sáng xanh, ô xung đột sáng đỏ
- [ ] Hover ô đích hiện `Δ điểm: −30` và lý do nếu không hợp lệ
- [ ] Thả vào ô đỏ → chặn kèm thông báo, không gọi API

---

### E1 — Giải thích được (XAI) 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 1.5 · **Phụ thuộc:** —

`getFitnessDetails()` đã tính sẵn mọi thứ, chỉ chưa gắn được vào từng slot cụ thể.

**Chạm vào:** `constraint.service.ts:397` — trả thêm `violatingSlotIds[]` cho mỗi mục

**Hoàn thành khi:**
- [ ] Tooltip mỗi ô: "Tiết cố định do quy chế" / "Bị ghim vì GV bận các ô khác" / "Đã bị khóa thủ công bởi X"
- [ ] Panel lỗi bên phải, click 1 dòng → highlight đúng các ô vi phạm
- [ ] Ô đang vi phạm có viền đỏ thường trực

---
---

# PHASE 5 — TKB Sống

**14.5 ngày · 6 feature · Phụ thuộc: Phase 4**

Phase giải bài toán 180 ngày — khoảng trống lớn nhất của mọi phần mềm TKB hiện có.

---

### B1 — Kiến trúc hai tầng 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 5 · **Phụ thuộc:** B6

TKB gốc bất biến; mọi thay đổi là **overlay có thời hạn**.

```prisma
model ScheduleOverlay {
  id         String   @id @default(uuid())
  type       OverlayType   // HOLIDAY | ABSENCE | EXAM_WEEK | EVENT | MAKEUP | SWAP
  scope      OverlayScope  // SCHOOL | GRADE | CLASS | TEACHER
  scope_ref  String?
  date_from  DateTime
  date_to    DateTime
  priority   Int
  payload    Json
  status     String        // DRAFT | APPROVED | ACTIVE | EXPIRED
  created_by String
}
```

**Chạm vào:**
- Schema: `ScheduleOverlay` + 2 enum
- `BE_TKB/src/schedule/effective-schedule.service.ts` *(mới)*
- `GET /schedule/effective?date=&teacher=&class=`

**Hoàn thành khi:**
- [ ] Overlay ưu tiên cao đè lên thấp đúng thứ tự
- [ ] TKB gốc không bao giờ bị sửa
- [ ] Overlay hết hạn → TKB tự trở về gốc, không cần thao tác gì
- [ ] Truy vấn lịch hiệu lực của 1 GV trong 1 ngày < 100ms
- [ ] Test: chồng 3 overlay khác loại lên cùng 1 ngày, kết quả đúng dự kiến

---

### D4 — Thông báo trong ứng dụng 🟨 **MỘT PHẦN**
**Ngày công:** 1 · **Phụ thuộc:** 0.1

Nền tảng bắt buộc cho B2, B5, D3.

**Chạm vào:** Schema `Notification`, `BE_TKB/src/notifications/`, chuông thông báo trên layout FE

**Hoàn thành khi:**
- [x] Tạo / đánh dấu đã đọc / đếm chưa đọc — `NotificationService`, chuông ở `admin/layout.tsx` và `teacher/layout.tsx`
- [ ] Đẩy realtime qua WebSocket đã dựng ở A2 — *hiện đang hỏi lại máy chủ mỗi 30 giây*

> Phần này đến từ nhánh `main` khi gộp hai hướng làm việc (2026-08-21).

---

### B3 — Xếp dạy thay / dạy bù 🟠 ★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 3 · **Phụ thuộc:** B1

**Chạm vào:** `BE_TKB/src/schedule/substitute.service.ts` *(mới)*

**Hoàn thành khi:**
- [ ] Tìm GV cùng môn rảnh đúng tiết đó
- [ ] Xếp hạng: cùng tổ bộ môn > đã từng dạy lớp đó > tải nhẹ nhất
- [ ] Không có ai rảnh → đề xuất phương án đổi tiết (dùng A4) hoặc ghép lớp
- [ ] Áp dụng → sinh overlay loại `ABSENCE`

---

### B2 — Chế độ 6h45 🔴 ★★★ — ✅ **ĐÃ LÀM**
**Ngày công:** 3 · **Phụ thuộc:** B3, D4

GV báo ốm 6h45, tiết đầu 7h00. Một nút, 10 giây có phương án cho toàn bộ số tiết.

**Chạm vào:**
- `POST /schedule/emergency-absence`
- `FE_TKB/app/admin/emergency/page.tsx` *(mới)*

**Hoàn thành khi:**
- [ ] Nhập GV + ngày → liệt kê đủ các tiết cần phủ, mỗi tiết có phương án
- [ ] Tiết không có GV rảnh → hiện 3 phương án thay thế (đổi tiết / ghép lớp / tự học có giám thị)
- [ ] "Áp dụng tất cả" → sinh overlay + gửi thông báo + cập nhật TKB hôm nay, tất cả trong 1 transaction
- [ ] Hôm sau TKB tự trở về bình thường, không thao tác gì
- [ ] Toàn bộ luồng < 10 giây

---

### B4 — Tự tính phụ cấp dạy thay 🟠 — ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** B2

**Hoàn thành khi:**
- [ ] Bảng tổng hợp theo tháng: GV, số tiết dạy thay, lớp, ngày
- [ ] Xuất Excel
- [ ] Số liệu lấy từ overlay, không cần ai nhập tay

---

### B5 — Quy trình duyệt & công bố 🟡 — ✅ **ĐÃ LÀM**
**Ngày công:** 2 · **Phụ thuộc:** D4

**Hoàn thành khi:**
- [ ] Trạng thái NHÁP → CHỜ DUYỆT → ĐÃ CÔNG BỐ, chuyển được cả 2 chiều
- [ ] Công bố → khóa TKB gốc, gửi thông báo toàn trường
- [ ] Sinh mã QR mở trang xem lịch công khai
- [ ] TKB đã công bố chỉ sửa được qua overlay, không sửa trực tiếp

---
---

# PHASE 6 — Cổng giáo viên

**8 ngày · 5 feature · Phụ thuộc: Phase 5**

---

### D1 — Xuất lịch .ics 🟠 ★★
**Ngày công:** 0.5 · **Phụ thuộc:** B1

Nhỏ nhất trong lộ trình nhưng ai xem cũng phản ứng.

**Chạm vào:** `GET /schedule/ical/:teacherId.ics` — sinh từ lịch hiệu lực

**Hoàn thành khi:**
- [ ] Đăng ký được vào Google Calendar và Outlook
- [ ] Overlay (nghỉ, dạy thay) phản ánh đúng vào file
- [ ] URL có token riêng, không đoán được

---

### D5 — Dashboard phân tích thật ✅ **ĐÃ LÀM**
**Ngày công:** 2.5 · **Phụ thuộc:** —

Thay 4 con số hardcode (45 GV / 24 lớp / 12 môn / 30 phòng) ở `app/admin/page.tsx`.

**Hoàn thành khi:**
- [x] Số liệu lấy từ DB theo học kỳ đang chọn — `AnalyticsService.dashboard()`
- [x] Heatmap mật độ tiết theo Thứ × Tiết toàn trường
- [x] Biểu đồ tải giảng dạy từng GV vs định mức, cột đỏ = quá tải
- [x] Tỉ lệ lấp đầy từng phòng
- [x] Cảnh báo tự động GV vượt định mức

> **Bắt được một mâu thuẫn nội tại.** Bản đầu báo 3 GV "vượt định mức" (19/17, 19/17, 18/17)
> trên chính thời khóa biểu mà thuật toán khẳng định 0 lỗi cứng. Nguyên nhân: thuật toán
> loại chào cờ/sinh hoạt khỏi định mức theo Thông tư 05/2025 (nhiệm vụ chủ nhiệm đã được
> trả bằng `workload_reduction`), còn dashboard đếm tất cả. Đã cho dashboard dùng cùng
> quy tắc và tách riêng số tiết nghi lễ. Sau khi sửa: **0 cảnh báo**, GV cao nhất
> `17 tiết dạy + 2 nghi lễ / định mức 17`.

---

### D2 — Nguyện vọng ba mức ✅ **ĐÃ LÀM**
**Ngày công:** 1 · **Phụ thuộc:** —

`ConstraintType.AVOID` đã khai báo trong schema nhưng chưa bao giờ được dùng. Thêm mức thứ
ba `PREFER`.

**Chạm vào:** enum `ConstraintType` · `ConstraintService` (3 tập chỉ mục) ·
`PATCH /giao-vien/:id/busy-time` · `GET /giao-vien/:id/preferences` · `/teacher/preferences`

**Hoàn thành khi:**
- [x] Giao diện 3 mức: Bận (đỏ) / Hạn chế (vàng) / Mong muốn (xanh)
- [x] Bận = ràng buộc cứng, Hạn chế = phạt mềm (14đ), Mong muốn = thưởng (6đ)
- [x] `getFitnessDetails` báo % nguyện vọng được đáp ứng

**Vì sao ba mức chứ không phải hai.** Một hệ thống coi mọi yêu cầu là tuyệt đối thì hoặc từ
chối xếp được lịch, hoặc âm thầm bỏ qua những yêu cầu không đáp ứng nổi. Tách "không thể"
khỏi "không muốn" là điều cho phép giáo viên nói thật mà trường vẫn xếp được lịch.

**Đo trên dữ liệu thật:** đăng ký 2 nguyện vọng đang được đáp ứng → điểm tăng đúng 12
(2 × trọng số 6), báo cáo `Đáp ứng nguyện vọng giáo viên: +12 điểm (2/2)`.

**Sửa kèm:** `isTeacherBusy` trước đây quét toàn bộ danh sách ràng buộc của giáo viên mỗi
lần gọi, ngay trong vòng lặp chấm điểm. Nay dùng `Set` tra cứu O(1) — ba mức mà giữ nguyên
cách cũ thì chi phí nhân ba.

---

### D3 — Đề xuất đổi tiết hai chiều 🟠 ★★
**Ngày công:** 2 · **Phụ thuộc:** A4, D4

**Hoàn thành khi:**
- [ ] GV A chọn tiết → hệ thống gợi ý danh sách đổi được (từ A4)
- [ ] B nhận thông báo, đồng ý / từ chối kèm lý do
- [ ] Admin duyệt cuối, hệ thống kiểm tra lại ràng buộc trước khi áp dụng
- [ ] Áp dụng → sinh overlay loại `SWAP`

---

### D6 — PWA cho giáo viên 🟡
**Ngày công:** 2 · **Phụ thuộc:** D1, B5

**Hoàn thành khi:**
- [ ] Cài được lên màn hình chính điện thoại
- [ ] Xem lịch tuần offline sau lần tải đầu
- [ ] Quét QR từ B5 mở thẳng lịch cá nhân

---
---

# PHASE 7 — Trợ lý AI

**12.5 ngày · 6 feature · Phụ thuộc: Phase 6**

Kiến trúc **Tool-calling agent** cho dữ liệu có cấu trúc, RAG chỉ cho văn bản quy chế.

> ⚠️ **ChatGPT Plus không dùng để gọi từ backend được.** Cần API key riêng ở `platform.openai.com`, tính tiền theo token. Nạp $5–10 là đủ cho cả kỳ. Model phải hỗ trợ function calling.

---

### C1 — Lớp công cụ + adapter LLM 🔴 ★★★
**Ngày công:** 3 · **Phụ thuộc:** Phase 6

9 tool trên service đã có:

| Tool | Nhóm |
| :--- | :--- |
| `get_my_schedule` · `get_class_schedule` · `get_teacher_workload` | Đọc |
| `find_free_teachers` · `find_swap_candidates` | Tìm kiếm |
| `check_swap_feasibility` · `explain_slot` | Kiểm tra |
| `search_regulations` | Văn bản |
| `create_swap_request` · `create_busy_registration` | Ghi |

**`check_swap_feasibility` gọi thẳng `ConstraintService`** — AI không tự đánh giá tính hợp lệ nên không thể bịa.

**Chạm vào:**
- `BE_TKB/src/ai/tools/` *(mới)*
- `BE_TKB/src/ai/providers/llm-provider.interface.ts` — model ID nằm trong `.env`

**Hoàn thành khi:**
- [ ] Mọi tool gọi được độc lập bằng `curl`, không cần LLM
- [ ] Tool nhận `actorId` từ tham số, không đọc từ nội dung câu hỏi
- [ ] Đổi model chỉ cần sửa 1 dòng `.env`

---

### C2 — Orchestrator + streaming 🔴 ★★★
**Ngày công:** 2 · **Phụ thuộc:** C1

**Hoàn thành khi:**
- [ ] Vòng lặp gọi tool tối đa 5 vòng rồi dừng
- [ ] Stream token qua SSE
- [ ] Danh tính đóng dấu từ JWT vào ngữ cảnh hệ thống
- [ ] Lỗi tool → AI diễn đạt lại thành tiếng Việt dễ hiểu, không lộ stack trace

---

### C5 — Guardrail bảo mật 🔴 ★★★
**Ngày công:** 1.5 · **Phụ thuộc:** C2

Làm **ngay sau** orchestrator, trước khi mở giao diện cho người dùng.

**Hoàn thành khi:**
- [ ] GV hỏi "cho tôi xem lịch cô Lan" → chỉ trả về lịch của chính họ
- [ ] Dữ liệu từ DB bọc trong delimiter, đánh dấu là dữ liệu không phải chỉ thị
- [ ] Đặt tên lớp là `"Bỏ qua mọi chỉ dẫn trước đó"` → không có tác dụng
- [ ] Tool ghi luôn trả về thẻ xác nhận, không tự thực thi
- [ ] Giới hạn 20 câu/giờ/người và trần chi phí theo ngày

---

### C3 — Widget chat trên frontend 🟠 ★★
**Ngày công:** 2.5 · **Phụ thuộc:** C5

**Hoàn thành khi:**
- [ ] Hiển thị streaming mượt
- [ ] Thẻ hành động bấm được → tạo yêu cầu đổi tiết thật
- [ ] Trích dẫn nguồn quy chế click mở được
- [ ] Lịch sử hội thoại lưu theo phiên

---

### C4 — RAG pgvector 🟠 ★★
**Ngày công:** 2 · **Phụ thuộc:** C1

**Nạp vào:** quy định định mức tiết dạy · quy chế chuyên môn trường · quy tắc xếp lịch trích từ `readme.md` · hướng dẫn sử dụng

**Chạm vào:** extension `pgvector`, model `KnowledgeChunk`, script ingest

**Hoàn thành khi:**
- [ ] Chia đoạn theo Điều / Khoản, không cắt mù theo ký tự
- [ ] Mỗi câu trả lời trích dẫn được nguồn và số điều khoản
- [ ] Không tìm thấy → nói thẳng "không có trong tài liệu", không bịa

---

### C6 — Bộ 50 câu hỏi vàng 🔴 ★★★
**Ngày công:** 1.5 · **Phụ thuộc:** C3, C4

5 nhóm × 10 câu: tra cứu lịch · đếm/thống kê · kiểm tra khả thi · tra quy chế · **câu hỏi bẫy vượt quyền**.

**Hoàn thành khi:**
- [ ] Mỗi câu có đáp án đúng và tool đúng cần gọi
- [ ] Script chạy tự động, xuất bảng kết quả
- [ ] Đo đủ: tool selection accuracy, answer accuracy, refusal rate, độ trễ TB, chi phí TB/câu
- [ ] Refusal rate trên nhóm câu bẫy = 100%
- [ ] Kết quả đưa được thẳng vào báo cáo

---
---

# PHASE 8 — Hoàn thiện

**9 ngày · 5 feature · Phụ thuộc: Phase 7**

---

### A5 — Chỉ số công bằng Gini 🟨 **MỘT PHẦN**
**Ngày công:** 3 · **Phụ thuộc:** A6, D2

**Chạm vào:** `FairnessService` · `GET /algorithm/fairness/:semesterId` · `/admin/fairness`

**Hoàn thành khi:**
- [x] Điểm chất lượng lịch từng GV = f(tiết trống, số buổi đến trường, ngày nghỉ, tiết cuối buổi, đổi tầng, chuỗi dạy liên tục, nguyện vọng không được đáp ứng)
- [x] Hệ số Gini + đường cong Lorenz
- [x] Liệt kê GV thiệt thòi nhất kèm phương án cải thiện
- [ ] Thanh trượt Hiệu quả ↔ Công bằng sinh đường Pareto

**Đo trên dữ liệu thật:**

```
Hệ số Gini: 0.146
Điểm lịch: cao nhất 95, trung vị 70, thấp nhất 40 — chênh 55 điểm

40đ  Hoàng Ngọc Sơn   — Tiết trống phải chờ (5 lần, −30 điểm)
41đ  Phạm Thu Hà      — Tiết trống phải chờ (4 lần, −24 điểm)
48đ  Vũ Thị Hương     — Buổi đến trường dư (4 lần, −20 điểm)

Phân bố: 40 41 47 48 49 64 65 68 69 70 81 81 82 90 90 92 92 93 95
```

**Đây là phát hiện đáng nói.** Thời khóa biểu này **hợp lệ, 0 lỗi cứng, điểm tốt** — nhưng
một giáo viên có tuần 40 điểm trong khi người khác 95. Điểm tổng không hề cho biết điều đó;
nó cộng mọi khoản trừ lại rồi im lặng về việc phần bất tiện rơi vào ai.

**Mỗi giáo viên được chấm so với chính khối lượng dạy của họ.** Người dạy 20 tiết không thể
có tuần giống người dạy 8 tiết — trừ điểm vì chênh lệch không thể tránh đó thì chính chỉ số
công bằng lại thành bất công.

---

### A7 — Khai phá ràng buộc ẩn ✅ **ĐÃ LÀM**
**Ngày công:** 3 · **Phụ thuộc:** B6

Mỗi lần người xếp lịch kéo một tiết đi chỗ khác là một điều họ biết về trường mà phần mềm
không biết. Trước đây tri thức đó bay hơi cùng thao tác kéo; học kỳ sau lại kéo y hệt.

**Chạm vào:** `PatternMiningService` · `GET /algorithm/mined-rules/:semesterId` ·
`POST /algorithm/mined-rules/accept` · `/admin/mined-rules`

**Hoàn thành khi:**
- [x] Phát hiện được 3 loại quy luật: GV luôn bị chuyển khỏi khung giờ X · môn luôn bị chuyển khỏi khung giờ X · lớp luôn bị bỏ trống khung giờ X
- [x] Mỗi phát hiện có độ tin cậy (%) và số lần quan sát
- [x] Chấp nhận → tự tạo ràng buộc tương ứng
- [ ] Biểu đồ số thao tác thủ công giảm dần qua các học kỳ — *cần ≥ 2 học kỳ dữ liệu thật*

**Hai quyết định đáng ghi lại:**

1. **Không tự thêm ràng buộc.** Cùng một thao tác kéo có thể vì GV bận, vì lớp có hoạt
   động, hoặc vì phòng thí nghiệm kẹt. Hệ thống chỉ **đặt câu hỏi** kèm bằng chứng; chỉ
   người xếp lịch mới biết lý do thật.

2. **Quy luật "môn" và "lớp" đòi hỏi ≥ 2 giáo viên khác nhau.** Bản đầu không có điều kiện
   này nên khi một GV Lịch sử bị kéo khỏi Thứ 5 tiết 5 sáu lần, hệ thống báo *hai* phát
   hiện — một về GV, một về môn Lịch sử — cùng một bằng chứng đội hai cái mũ. Giờ quy luật
   cấp môn chỉ hiện khi nhiều GV cùng thể hiện.

**Endpoint chấp nhận là endpoint riêng, có lý do.** `PUT /resources/teachers/:id/constraints`
sẵn có **xoá sạch rồi ghi lại** toàn bộ ràng buộc của GV; bấm "Đúng, thêm ràng buộc" qua
endpoint đó sẽ âm thầm thổi bay mọi lịch bận nhập tay trước đó.

---

### 0.13 — Nối trang cấu hình ràng buộc vào thuật toán ✅ **ĐÃ LÀM**
**Ngày công:** 1 · **Phụ thuộc:** —

Trọng số admin chỉnh ở `/admin/configuration` trước đây lưu in-memory và **thuật toán không
hề đọc** — chỉnh xong chạy lại, kết quả không đổi.

**Chạm vào:** `constraint-catalogue.ts` · `ConstraintSettingsService` · bảng
`constraint_settings` · `ConstraintService.loadSettings()`

**Hoàn thành khi:**
- [x] Trọng số lưu vào DB, không mất khi restart
- [x] `calculatePenalty()` đọc trọng số từ DB thay vì hardcode
- [x] Tắt một ràng buộc mềm → điểm và kết quả thay đổi thấy rõ

**Đo bằng ba lần chạy thuật toán thật** trên cùng dữ liệu, chỉ đổi trọng số "Tiết trống
giáo viên":

| Cấu hình | Trọng số | Số tiết trống GV | Điểm | Hợp lệ |
| :--- | ---: | ---: | ---: | :---: |
| Tắt hẳn | 0 | 55 | +134 | ✅ |
| Mặc định | 5 | 24 | −180 | ✅ |
| Nâng lên 200 | 200 | 2 | −832 | ✅ |

Đơn điệu theo trọng số, và cột điểm cho thấy đúng bản chất đánh đổi: ép tiết trống xuống 2
phải trả giá bằng các ràng buộc mềm khác.

**Trang cấu hình trước đây còn nói dối một cách khác:** liệt kê 11 ràng buộc trong khi
thuật toán áp dụng **8 cứng + 14 mềm**. Vài dòng trên màn hình không ứng với gì trong code,
còn 8 ràng buộc mềm có thật thì không hiện ra. Nay danh mục nằm cùng chỗ với code và có
test chặn lệch pha — thêm một trọng số mà quên khai báo là build đỏ.

**Ba ràng buộc cứng không thể tắt:** GV trùng giờ · lớp trùng giờ · phòng trùng giờ. Một
thời khóa biểu vi phạm chúng là không thực hiện được, không phải kém tối ưu.

---

### 0.18 — Chấm điểm tăng dần ✅ **ĐÃ LÀM**
**Ngày công:** 2 · **Phụ thuộc:** 0.17

Mỗi ràng buộc thêm vào đều làm **toàn bộ** quá trình tìm kiếm chậm đi, vì điểm được tính lại
từ đầu trên cả 217 tiết sau mọi thao tác thử. Đến mục `D2` thì một lần chạy đã vượt 10 phút.

**Chạm vào:** `IncrementalScorer` · `ConstraintService.classPenalty/teacherPenalty/
classHardViolations/teacherHardViolations/crossEntityHardViolations/invariantHardViolations`

**Nhận xét khiến việc này làm được:** một thao tác đổi chỗ chỉ thay đổi *khi nào* một hai
tiết diễn ra. Nó không đổi tiết nào tồn tại, ai dạy, hay thuộc lớp nào. Vậy chỉ cần chấm lại
một hai lớp và một hai giáo viên liên quan — trên 7 lớp và 21 giáo viên thì phần lớn công
việc được bỏ qua.

Mọi hàm chấm điểm vốn đã **cộng dồn độc lập theo từng lớp / từng giáo viên**, nên phép tách
là chính xác tuyệt đối chứ không phải xấp xỉ.

**Kết quả đo:**

| | Trước | Sau |
| :--- | ---: | ---: |
| Một lần chạy | > 10 phút (bị cắt) | **4,1 – 5,7 giây** |
| Điểm | −289 | **−151 … −283** |
| Lỗi cứng | 0 | 0 |

Nhanh hơn khoảng **100 lần**, và điểm còn tốt hơn vì trong cùng ngân sách vòng lặp thì tìm
kiếm chạy được trọn vẹn thay vì bị cắt giữa chừng.

**Hai điều được giữ ngoài phép tính tăng dần, có lý do:**
- `checkMissingPeriods` và `checkTeacherWeeklyLimit` **bất biến** dưới mọi thao tác — đổi chỗ
  không làm mất tiết cũng không đổi giáo viên — nên chỉ tính một lần cho cả lần chạy.
- Trùng phòng và sức chứa phòng chức năng không quy về một lớp hay một giáo viên nào, nên
  vẫn tính toàn cục. Trong lúc tìm kiếm thì phòng chưa được gán nên chúng gần như bằng 0.

**Bộ chấm điểm tự phát hiện thay đổi** thay vì bắt mỗi hàm sinh thao tác phải khai báo. Cách
kia chạy đúng cho tới khi ai đó thêm loại thao tác thứ tư rồi quên khai. So hai số nguyên
cho mỗi tiết rẻ hơn nhiều so với chấm lại một lớp, và không thể quên được.

**Điều kiện bắt buộc: kết quả phải trùng khít.** `incremental-scoring.spec.ts` đối chiếu với
bản tính đầy đủ sau **mỗi** thao tác trên hơn 700 lần đổi chỗ ngẫu nhiên. Nếu hai bên lệch
nhau, thuật toán sẽ tối ưu một con số khác với con số nhà trường nhìn thấy — mà không ai
báo.

**Đã thử nâng ngân sách vòng lặp lên 40.000 và 120.000**: không đáng, vì ngưỡng dừng sớm
cũng tính theo ngân sách nên tìm kiếm không thoát nữa, mỗi lần chạy mất vài phút. Giữ 12.000.

---

### B7 — Nối đơn xin nghỉ vào lịch hiệu lực ✅ **ĐÃ LÀM**
**Ngày công:** 2 · **Phụ thuộc:** B1, B3

Phát hiện ở Phụ lục H: giáo viên đăng ký nghỉ, admin bấm duyệt, và **không có gì xảy ra**.
Đơn nằm ở bảng `teacher_busy_requests` mà lịch hiệu lực không đọc, thuật toán cũng không
đọc. Không ai được phân dạy thay, lớp lên lớp gặp phòng trống.

**Chạm vào:** `AbsenceLinkService` · `BusyScheduleService.approve()` ·
`GET /schedule/absence-request/:requestId/preview`

**Hoàn thành khi:**
- [x] Quy `(học kỳ, tuần, thứ)` ra ngày cụ thể, neo vào thứ Hai của tuần đầu học kỳ
- [x] Duyệt đơn → sinh `ScheduleOverlay` dạng vắng mặt cho đúng ngày đó
- [x] Nhiều tiết cùng ngày gộp thành một lần vắng, khác ngày thì tách
- [x] Lớp nhìn thấy ghi chú, giáo viên vắng không còn tiết đó trong lịch
- [x] Endpoint xem trước để admin biết duyệt xong sẽ ra gì

**Kiểm chứng đầu-cuối trên dữ liệu thật:**

```
Bùi Thị Mai xin nghỉ Tuần 2, Thứ 3, tiết 4 (= 2026-09-15)
Trước khi duyệt: 2 tiết trong lịch hiệu lực, 0 overlay
Duyệt đơn:       {"periods":1,"overlays":1}
Sau khi duyệt:   1 tiết trong lịch hiệu lực, 1 overlay
Lớp nhìn thấy:   "10A2 tiết 4: nghỉ (Họp chuyên môn cấp Sở)"
```

**Cố ý không tự phân người dạy thay.** Ai đứng lớp thay là quyết định của phó hiệu trưởng;
danh sách ứng viên đã xếp hạng là gợi ý, không phải câu trả lời. Điều được bảo đảm là **lần
vắng hiện ra trong lịch** thay vì im lặng không làm gì.

**Cố ý không tạo `TeacherConstraint`.** Nghỉ một buổi mà biến thành ràng buộc lặp hàng tuần
sẽ chặn khung giờ đó suốt học kỳ. Vắng có ngày cụ thể thuộc về tầng overlay — đúng thứ kiến
trúc hai tầng (`B1`) sinh ra để làm.

**Học kỳ thiếu ngày bắt đầu thì không chặn việc duyệt** — đơn vẫn được duyệt, hệ thống ghi
lại lý do không quy được ra ngày thay vì bỏ qua im lặng.

---

### 0.19 — Đọc bản chính thức phải xác định ✅ **ĐÃ LÀM**
**Ngày công:** 0.5 · **Phụ thuộc:** —

Năm chỗ trong hệ thống tìm thời khóa biểu chính thức bằng `findFirst` **không kèm thứ tự**.
`publish()` có xoá cờ của các bản khác trong cùng một giao dịch, nhưng **không có ràng buộc
nào ở tầng cơ sở dữ liệu** bắt buộc chỉ một bản mang cờ đó.

Đã gặp thật trong lúc kiểm thử: một script đặt `is_official` trực tiếp làm có hai bản cùng
mang cờ, và `findFirst` trả về **bản cũ từ tám ngày trước**. Lịch hiệu lực, bảng điều khiển,
chỉ số công bằng và luồng dạy thay đều đọc nhầm bản mà không có gì báo.

Đã thêm `orderBy: { created_at: 'desc' }` vào cả năm chỗ, kèm giải thích vì sao.

---

### E3 — Xuất PDF 🟡
**Ngày công:** 1.5 · **Phụ thuộc:** B1

**Hoàn thành khi:**
- [ ] TKB toàn trường khổ A3 nằm ngang
- [ ] TKB từng lớp khổ A4 để dán bảng tin
- [ ] TKB từng GV
- [ ] Tiếng Việt có dấu hiển thị đúng

---

### F3 — CI cơ bản ✅ **ĐÃ LÀM**
**Ngày công:** 1 · **Phụ thuộc:** F2

Cho tới giờ, thứ duy nhất kiểm tra 101 test còn chạy được và cả hai phía còn biên dịch được
là **có người nhớ chạy chúng**.

**Chạm vào:** `.github/workflows/ci.yml`

**Ba việc chạy song song trên mỗi lần push và mỗi pull request:**

| Việc | Các bước |
| :--- | :--- |
| Backend | `npm ci` · `prisma generate` · `tsc --noEmit` · `jest --ci` · `nest build` |
| Frontend | `npm ci` · `tsc --noEmit` · `next build` |
| Migration | không file nào bị `.gitignore` bỏ sót · `prisma validate` |

**Test chạy được mà không cần database** — chúng giả lập Prisma và không mở kết nối nào. CI
chỉ cần `DATABASE_URL` để schema phân tích được, và `JWT_SECRET` vì hệ thống cố ý không có
giá trị mặc định.

**Việc thứ ba tồn tại vì một lỗi có thật.** Luật `*.sql` trong `.gitignore` từng chặn mọi
migration mới, nên lần triển khai sau sẽ chạy trên schema cũ mà không ai biết. Đã thử lại
bằng cách tạm gỡ ngoại lệ — chốt chặn bắt đúng file và làm đỏ build.

Cả bốn bước đã chạy thử tại máy trước khi đẩy lên, kể cả `nest build`.

---
---

## Kịch bản demo 15 phút

Dùng bảng này làm bộ lọc: chức năng nào không xuất hiện ở đây thì không giúp ghi điểm trước hội đồng.

| Phút | Nội dung | Feature |
| :---: | :--- | :--- |
| 0–2 | Import Excel phân công thật — 45 GV, 24 lớp, 1.240 tiết trong 8 giây | *đã có* |
| 2–4 | Kiểm tra khả thi bắt lỗi "GV quá tải", sửa ngay tại chỗ | A3 |
| 4–7 | Xếp lịch — lưới lấp đầy trực tiếp, lỗi cứng 47 → 0 | A2 |
| 7–9 | So sánh GA / SA / Tabu / Hill Climbing, biểu đồ hội tụ, bảng 30 lần chạy | A1 |
| 9–11 | Kéo một tiết, xem cảnh báo Δ điểm, rồi hoàn tác | E2 · B6 |
| 11–13 | "Cô Lan báo ốm thứ 5" → 3 GV dạy thay trong 2 giây | B2 · A4 |
| 13–15 | Công bố TKB, quét QR bằng điện thoại thật | B5 · D1 |

---

## Ghi chú ước lượng

- Ngày công tính cho **một người đã quen stack hiện tại**, chưa trừ thời gian viết báo cáo và làm slide.
- Ba feature có phụ thuộc dễ bỏ sót: **B6 phải xong trước A4 và A7** · **D4 phải xong trước B2, B5, D3** · **F2 nên xong trước A1**.
- Nếu chỉ chọn hai feature để đầu tư: **A4** (chiều sâu thuật toán) + **B1/B2** (giá trị thực tiễn). Thêm **A6** vì chỉ tốn 1 ngày.
