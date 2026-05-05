# TKB Pro — Tài liệu chức năng hệ thống

> Hệ thống xếp thời khóa biểu tự động cho trường THPT  
> Stack: NestJS (BE) · Next.js (FE) · PostgreSQL · Redis · Docker  
> Hai role chính: **ADMIN** và **TEACHER**

---

## Mục lục

1. [Xác thực & Phiên đăng nhập](#1-xác-thực--phiên-đăng-nhập)
2. [Role ADMIN](#2-role-admin)
   - 2.1 [Tổng quan](#21-tổng-quan-dashboard)
   - 2.2 [Quản lý tài khoản](#22-quản-lý-tài-khoản)
   - 2.3 [Quản lý lớp học](#23-quản-lý-lớp-học)
   - 2.4 [Quản lý giáo viên](#24-quản-lý-giáo-viên)
   - 2.5 [Quản lý môn học](#25-quản-lý-môn-học)
   - 2.6 [Phân công chuyên môn](#26-phân-công-chuyên-môn)
   - 2.7 [Thời khóa biểu](#27-thời-khóa-biểu)
   - 2.8 [Lịch bận giáo viên](#28-lịch-bận-giáo-viên)
   - 2.9 [Cấu hình ràng buộc](#29-cấu-hình-ràng-buộc)
3. [Role TEACHER](#3-role-teacher)
   - 3.1 [Tổng quan](#31-tổng-quan-dashboard-1)
   - 3.2 [Thời khóa biểu cá nhân](#32-thời-khóa-biểu-cá-nhân)
   - 3.3 [Đăng ký lịch bận](#33-đăng-ký-lịch-bận)
   - 3.4 [Đổi mật khẩu](#34-đổi-mật-khẩu)
4. [Chức năng chung hai role](#4-chức-năng-chung-hai-role)
5. [Thuật toán & Ràng buộc](#5-thuật-toán--ràng-buộc)

---

## 1. Xác thực & Phiên đăng nhập

| Chức năng | Chi tiết |
|-----------|----------|
| **Đăng nhập có captcha** | Form đăng nhập hiển thị captcha SVG 4 ký tự. Người dùng nhập username + password + captcha. Captcha được verify bằng HMAC-SHA256 phía server — không lưu session, không cần cookie. |
| **JWT Token** | Sau đăng nhập thành công server trả `access_token` (JWT). FE lưu vào `localStorage`. Mỗi request API gửi kèm header `Authorization: Bearer <token>`. |
| **Phân quyền** | JWT payload chứa `role` (`ADMIN` / `TEACHER`). FE redirect về trang tương ứng (`/admin` hoặc `/teacher`). Truy cập sai role bị chặn ngay tại layout. |
| **Thông tin profile** | `GET /auth/profile` — trả về thông tin user hiện tại gồm: username, role, full_name, teacherId, teacher_profile (có homeroom_classes nếu là GV). |

---

## 2. Role ADMIN

### 2.1 Tổng quan (Dashboard)

**Trang:** `/admin`

- **Thẻ thống kê** — Hiển thị số lượng thực tế từ DB: Giáo viên · Lớp học · Môn học · Phòng học
- **Trạng thái xếp TKB** — Panel placeholder, định hướng mở rộng sau
- **Hoạt động gần đây** — Danh sách mẫu các hoạt động hệ thống

---

### 2.2 Quản lý tài khoản

**Trang:** `/admin/accounts`  
**API:** `GET/POST/PUT/DELETE /users`

| Thao tác | Mô tả |
|----------|-------|
| Xem danh sách | Liệt kê toàn bộ user, hiển thị username · role · ngày tạo |
| Thêm tài khoản | Tạo tài khoản mới với username/password/role. Mật khẩu tự động hash bcrypt. Có thể liên kết với hồ sơ giáo viên (`teacher_profile_id`) |
| Sửa tài khoản | Đổi role, liên kết lại hồ sơ GV, reset mật khẩu |
| Xóa tài khoản | Xóa vĩnh viễn |

> **Lưu ý:** Tài khoản TEACHER phải được liên kết `teacher_profile_id` thì các chức năng GV mới hoạt động đúng.

---

### 2.3 Quản lý lớp học

**Trang:** `/admin/classes`  
**API:** `GET/POST/PUT/DELETE /organization/classes`

| Thao tác | Mô tả |
|----------|-------|
| Xem danh sách | Liệt kê lớp, hiển thị tên lớp · khối · GVCN · phòng mặc định |
| Thêm / Sửa lớp | Tên lớp, khối (10/11/12), gán giáo viên chủ nhiệm, gán phòng cố định |
| Xóa lớp / Xóa toàn bộ | Xóa đơn lẻ hoặc xóa hết — cascade xóa phân công liên quan |
| Import qua Excel | Lớp được đồng bộ tự động khi import file Excel tổng năm học tại trang Phân công |

---

### 2.4 Quản lý giáo viên

**Trang:** `/admin/teachers`  
**API:** `GET/POST/PUT/DELETE /resources/teachers`

| Thao tác | Mô tả |
|----------|-------|
| Xem danh sách | Mã GV · Họ tên · **Lớp chủ nhiệm** (badge cam) · Liên hệ · Số tiết tối đa/tuần |
| Thêm / Sửa | Mã GV, họ tên, email, số điện thoại, số tiết tối đa mỗi tuần |
| Xóa / Xóa toàn bộ | Cascade xóa phân công và ràng buộc riêng |
| Ràng buộc riêng GV | `PUT /resources/teachers/:id/constraints` — Cấu hình các ràng buộc đặc biệt cho từng GV (ngày/giờ không thể dạy, ưu tiên lịch) |
| Xem chủ nhiệm | Cột "Chủ nhiệm" hiển thị tên lớp GV đang chủ nhiệm, hoặc "—" nếu không |

---

### 2.5 Quản lý môn học

**Trang:** `/admin/subjects`  
**API:** `GET/POST/PUT/DELETE /resources/subjects`

| Thao tác | Mô tả |
|----------|-------|
| Xem danh sách | Mã môn · Tên môn · Màu sắc hiển thị trên TKB |
| Thêm / Sửa | Tên, mã, chọn màu |
| Xóa / Xóa toàn bộ | Xóa môn kéo theo phân công liên quan |

---

### 2.6 Phân công chuyên môn

**Trang:** `/admin/assignments`  
**API:** `GET/POST/PUT/DELETE /assignments`, `/excel/workbook/*`, `/auto-assign/*`

#### Import/Export Excel

| Thao tác | Mô tả |
|----------|-------|
| **Tải mẫu Excel** | `GET /excel/workbook/template/:yearId` — Xuất file Excel trống có sẵn cấu trúc cho năm học đã chọn |
| **Import Excel tổng** | `POST /excel/workbook/import/:yearId` — Upload file `.xlsx` (tối đa 10MB). Hệ thống tự động đồng bộ: Giáo viên · Lớp học · Môn học · Phân công cho **cả 2 học kỳ** trong năm |
| **Xuất Excel hiện tại** | `GET /excel/workbook/export/:yearId` — Xuất toàn bộ dữ liệu phân công ra Excel |

#### Phân công tự động (Auto-Assign)

| Thao tác | Mô tả |
|----------|-------|
| Tải mẫu GV | `GET /auto-assign/template` — Mẫu Excel đơn giản chỉ chứa danh sách GV và số tiết |
| Tạo phân công tự động | `POST /auto-assign/generate/:yearId` — Upload Excel GV, thuật toán phân phối môn dạy cho từng GV dựa trên số tiết và chuyên môn |
| Xuất kết quả | `GET /auto-assign/export/:yearId` — Xuất kết quả phân công tự động ra Excel |

#### Quản lý phân công thủ công

| Thao tác | Mô tả |
|----------|-------|
| Xem danh sách | Lọc theo học kỳ. Hiển thị GV · Môn · Lớp · Số tiết/tuần |
| Thêm phân công | Chọn GV + Môn + Lớp + Học kỳ + Số tiết/tuần |
| Sửa / Xóa | Cập nhật số tiết hoặc xóa phân công |
| Xóa toàn bộ | Xóa hết phân công (có thể lọc theo học kỳ) |

---

### 2.7 Thời khóa biểu

**Trang:** `/admin/timetable`  
**API:** `/algorithm/*`

Đây là chức năng cốt lõi của hệ thống — xếp TKB tự động bằng thuật toán di truyền (Genetic Algorithm).

#### Xem TKB

| Chức năng | Mô tả |
|-----------|-------|
| **Chọn học kỳ** | Dropdown chọn năm học / học kỳ để xem TKB tương ứng |
| **Chọn tuần** | Nút `‹ Tuần N/Tổng (dd/mm – dd/mm) ›` — mỗi tuần hiển thị lịch riêng. Ngày được tính từ `start_date` của học kỳ |
| **Chọn lớp / GV** | Toggle xem theo Lớp hoặc theo Giáo viên. Dropdown chọn lớp/GV cụ thể |
| **Lưới TKB** | Ma trận Thứ (2–7) × Tiết (1–10, nhóm Sáng/Chiều). Mỗi ô hiển thị: tên môn, lớp/GV, phòng, màu môn |

#### Xếp TKB

| Chức năng | Mô tả |
|-----------|-------|
| **Chạy thuật toán** | `POST /algorithm/start` — Đưa job vào hàng đợi Redis/BullMQ. Worker xử lý background. FE polling `GET /algorithm/status/:jobId` hiển thị tiến độ phần trăm |
| **Tạo mẫu tuần** | Thuật toán sinh 1 mẫu TKB tối ưu, sau đó tự động nhân bản ra N tuần (N tính từ start_date/end_date học kỳ). Tất cả tuần giống nhau theo mặc định — "ưu tiên lặp lại" |
| **Điểm fitness** | Sau khi xếp, hiển thị điểm chất lượng TKB, phân tích vi phạm ràng buộc cứng/mềm |

#### Chỉnh sửa TKB thủ công

| Chức năng | Mô tả |
|-----------|-------|
| **Kéo thả tiết** | Drag-and-drop tiết từ ô này sang ô khác. Trong khi kéo: ô xanh = hợp lệ, ô đỏ = có xung đột |
| **Phát hiện xung đột thời gian thực** | Khi kéo qua ô đích, hệ thống kiểm tra ngay: trùng lớp học + trùng giáo viên. Badge "✓ Hợp lệ" hoặc "⚠️ Xung đột" hiển thị trên tiết đang kéo |
| **Log xung đột** | Panel "Xung đột khi kéo thả" bên dưới ghi lại chi tiết từng xung đột với timestamp. Có nút Xóa log |
| **Khóa tiết** | Click icon khóa để cố định 1 tiết — tiết bị khóa không bị thuật toán thay đổi khi xếp lại. Chỉ áp dụng cho tuần 1 (mẫu) |
| **Xóa TKB** | Xóa toàn bộ TKB của học kỳ để xếp lại từ đầu |

#### Xuất TKB

| Chức năng | Mô tả |
|-----------|-------|
| **Xuất Excel** | `GET /algorithm/export/:semesterId` — Xuất TKB ra file `.xlsx` đầy đủ |

#### Chi tiết vi phạm

| Chức năng | Mô tả |
|-----------|-------|
| **Điểm & vi phạm** | Panel hiển thị: Fitness score · Hard violations · Soft penalty · Danh sách chi tiết từng vi phạm (loại, quy tắc, mô tả) |

---

### 2.8 Lịch bận giáo viên

**Trang:** `/admin/busy-schedule`  
**API:** `/busy-schedule/*`

Quản lý yêu cầu lịch bận từ giáo viên và xử lý xung đột với TKB.

#### Tab "Chờ duyệt"

| Chức năng | Mô tả |
|-----------|-------|
| Xem yêu cầu | Danh sách yêu cầu `PENDING`: GV · Tuần · Thứ · Tiết · Lý do |
| **Duyệt** | `PATCH /busy-schedule/:id/approve` — Chấp nhận yêu cầu, tự động gửi thông báo cho GV |
| **Từ chối** | `PATCH /busy-schedule/:id/reject` — Mở dialog nhập lý do từ chối, gửi thông báo cho GV kèm lý do |

#### Tab "Đã xử lý"

| Chức năng | Mô tả |
|-----------|-------|
| Xem lịch sử | Toàn bộ yêu cầu `APPROVED` và `REJECTED` với badge trạng thái tương ứng |

#### Tab "Xung đột TKB"

| Chức năng | Mô tả |
|-----------|-------|
| **Phát hiện xung đột** | `GET /busy-schedule/conflicts/:semesterId` — So sánh yêu cầu `APPROVED` với TKB hiện tại. Tìm các ô GV đã duyệt bận nhưng TKB vẫn đang xếp họ dạy |
| **Hiển thị xung đột** | Card per xung đột: GV bị ảnh hưởng · Tuần/Thứ/Tiết · Lớp + Môn đang dạy · Lý do bận |
| **Gợi ý GV thay thế** | Hệ thống tự tìm tối đa 3 GV thay thế: cùng phân công môn đó trong học kỳ, không bận giờ đó, không đang dạy giờ đó |
| **Áp dụng thay thế** | Click tên GV gợi ý → cập nhật `teacher_id` trực tiếp trên slot TKB tuần đó. Chỉ ảnh hưởng tuần cụ thể, không đổi các tuần khác |
| **Không có GV thay** | Hiển thị "❌ Không tìm được GV thay thế — cần xử lý thủ công" |
| Badge đếm | Số xung đột hiển thị badge đỏ trên tab |

---

### 2.9 Cấu hình ràng buộc

**Trang:** `/admin/configuration`  
**API:** `GET/PATCH /cau-hinh-rang-buoc`

Cấu hình các quy tắc thuật toán xếp TKB. Có **5 ràng buộc cứng (Hard)** và **6 ràng buộc mềm (Soft)**.

#### Ràng buộc cứng (Hard Constraints) — Vi phạm = TKB không hợp lệ

| Mã | Tên | Mô tả |
|----|-----|-------|
| HC_01 | Không trùng giáo viên | Một GV không thể dạy 2 lớp cùng lúc |
| HC_02 | Không trùng lớp học | Một lớp không thể học 2 môn cùng lúc |
| HC_03 | Không trùng phòng học | Một phòng không thể chứa 2 lớp cùng lúc |
| HC_04 | Lịch bận giáo viên | Không xếp vào ô GV đã đăng ký bận (được duyệt) |
| HC_05 | Tiết cố định | Chào cờ (T2/T1), Sinh hoạt (T7/T5), GDĐP, HĐTN cố định vị trí |

#### Ràng buộc mềm (Soft Constraints) — Vi phạm = Trừ điểm fitness

| Mã | Tên | Trọng số | Mô tả |
|----|-----|----------|-------|
| SC_01 | Phân bố đều môn học | 10 | Môn nhiều tiết rải đều trong tuần |
| SC_02 | Tránh môn nặng liên tiếp | 20 | Toán/Lý/Hóa không quá 3 tiết liên tiếp |
| SC_03 | Ưu tiên buổi sáng | 15 | Toán/Văn/Anh ưu tiên tiết 1–3 |
| SC_04 | Ghép tiết đôi | 10 | Môn chính xếp liền tiết khi có thể |
| SC_05 | Hạn chế trống tiết | 5 | GV không bị trống tiết giữa 2 tiết dạy |
| SC_06 | Giới hạn tiết/buổi | 10 | GV không dạy quá 4 tiết/buổi |

**Thao tác cấu hình:**
- **Bật/Tắt** từng ràng buộc (toggle) — ràng buộc tắt bị bỏ qua hoàn toàn khi chạy thuật toán
- **Điều chỉnh trọng số** — Tăng/giảm mức phạt của ràng buộc mềm ảnh hưởng trực tiếp điểm fitness

---

## 3. Role TEACHER

### 3.1 Tổng quan (Dashboard)

**Trang:** `/teacher`

| Thành phần | Mô tả |
|------------|-------|
| **Banner chào** | Hiển thị tên GV. Nếu GV đang chủ nhiệm lớp → badge **"Chủ nhiệm: [Tên lớp]"** ngay trong banner |
| **Lịch dạy hôm nay** | Tự động xác định học kỳ hiện tại (so sánh ngày với start_date/end_date), tính tuần hiện tại, lọc TKB theo ngày trong tuần hôm nay. Hiển thị từng tiết: số tiết · môn · lớp · phòng |
| **Yêu cầu bận đang chờ** | Badge cảnh báo nếu có yêu cầu `PENDING` chưa được admin duyệt |
| **Thông báo gần đây** | 5 thông báo mới nhất với icon tương ứng (✅ duyệt / ❌ từ chối / 🔔 khác), badge chưa đọc |

---

### 3.2 Thời khóa biểu cá nhân

**Trang:** `/teacher/schedule`  
**API:** `GET /algorithm/result/:semesterId?week=N`

| Chức năng | Mô tả |
|-----------|-------|
| **Chọn học kỳ** | Dropdown năm học / học kỳ |
| **Chọn tuần** | Nút `‹ Tuần N (dd/mm – dd/mm) ›` với tổng số tuần học kỳ |
| **Lưới TKB cá nhân** | Hiển thị **chỉ các tiết của GV đang đăng nhập**. Auto-resolve teacher ID từ `/auth/profile`. Read-only — không thể kéo thả |
| **Tuần không có tiết** | Hiển thị "Tuần này không có tiết dạy" |

---

### 3.3 Đăng ký lịch bận

**Trang:** `/teacher/feedback`  
**API:** `POST /busy-schedule`, `GET /busy-schedule/my`, `DELETE /busy-schedule/:id`

#### Gửi yêu cầu bận

| Chức năng | Mô tả |
|-----------|-------|
| **Chọn học kỳ** | Dropdown năm học / học kỳ |
| **Chọn tuần** | Nút `‹ Tuần N ›` — tổng số tuần tính từ start_date/end_date học kỳ |
| **Lưới chọn tiết bận** | Ma trận 6 ngày × 10 tiết (Sáng 1–5, Chiều 6–10). Click để chọn/bỏ chọn ô bận. Ô **đã gửi** hiển thị màu cam "Đã gửi" — không thể click lại |
| **Nhập lý do** | Textarea bắt buộc |
| **Gửi yêu cầu** | `POST /busy-schedule` — Gửi tất cả ô đã chọn cùng 1 lý do. Nút hiển thị số tiết đang chọn. Nếu ô đã tồn tại trong DB → upsert (cập nhật lại trạng thái PENDING) |
| **Thông báo admin** | Hệ thống tự gửi thông báo đến tất cả admin khi GV đăng ký bận |

#### Theo dõi yêu cầu

| Chức năng | Mô tả |
|-----------|-------|
| **Xem yêu cầu tuần hiện tại** | Bảng bên dưới lưới: Thứ · Tiết · Lý do · Trạng thái (Chờ duyệt / Đã duyệt / Từ chối) |
| **Hủy yêu cầu** | Chỉ hủy được yêu cầu `PENDING`. `DELETE /busy-schedule/:id` |
| **Xem lý do từ chối** | Tooltip trên badge "Từ chối" hiển thị lý do admin nhập |

#### Vòng đời yêu cầu bận

```
GV gửi → PENDING → Admin duyệt → APPROVED → Kiểm tra xung đột TKB
                 ↘ Admin từ chối → REJECTED (có lý do)
```

Sau khi `APPROVED`:
- GV nhận thông báo kết quả
- Admin thấy trong tab "Xung đột TKB" nếu tiết đó đang có trong TKB

---

### 3.4 Đổi mật khẩu

**Trang:** `/teacher/profile`  
**API:** `POST /auth/change-password`

- Nhập mật khẩu cũ → mật khẩu mới → xác nhận
- Mật khẩu mới được hash bcrypt trước khi lưu

---

## 4. Chức năng chung hai role

### Thông báo (Notification Bell)

Hiển thị ở header của cả admin layout và teacher layout.

| Chức năng | Mô tả |
|-----------|-------|
| **Badge đếm chưa đọc** | Số đỏ góc trên phải icon chuông, cập nhật mỗi 30 giây |
| **Dropdown thông báo** | Click chuông → danh sách thông báo với icon theo category, thời gian tương đối (vừa xong / N phút trước / N giờ trước) |
| **Đánh dấu đã đọc** | Click vào thông báo chưa đọc → mark đã đọc. Nút "Đọc tất cả" |
| **Lọc theo loại** | Admin có thể lọc: Import · TKB · Lịch bận · Hệ thống (GV chỉ xem thông báo của mình) |

**Các loại thông báo:**

| Category | Ai nhận | Khi nào |
|----------|---------|---------|
| `BUSY_SCHEDULE` | Admin | GV gửi yêu cầu bận mới |
| `BUSY_SCHEDULE` | GV (người gửi) | Admin duyệt / từ chối yêu cầu bận |
| `TIMETABLE` | Admin | TKB được xếp xong |
| `IMPORT` | Admin | Import Excel thành công/thất bại |
| `SYSTEM` | Admin | Thông báo hệ thống |

### Chủ đề giao diện (Theme Toggle)

- Nút toggle Dark / Light mode ở header
- Áp dụng CSS variables toàn bộ app, lưu preference

---

## 5. Thuật toán & Ràng buộc

### Thuật toán xếp TKB

**Loại:** Genetic Algorithm (Thuật toán di truyền)  
**Xử lý:** Background job qua BullMQ + Redis (không block HTTP request)

**Quy trình:**

1. **Khởi tạo quần thể** — Sinh ngẫu nhiên N cá thể (mỗi cá thể = 1 bộ TKB đầy đủ)
2. **Đánh giá fitness** — Tính điểm chất lượng dựa trên vi phạm ràng buộc cứng/mềm
3. **Selection** — Chọn cá thể tốt nhất để sinh sản
4. **Crossover** — Lai ghép 2 TKB tạo TKB mới
5. **Mutation** — Hoán đổi ngẫu nhiên các tiết
6. **Lặp** — Nhiều thế hệ cho đến khi hội tụ hoặc hết thời gian
7. **Kết quả** — TKB tốt nhất được lưu vào DB

**Tính lặp tuần:**
- Thuật toán chỉ sinh 1 mẫu TKB (tuần 1)
- `saveToDatabase` tự động nhân bản mẫu ra N tuần (N = số tuần học kỳ)
- Mọi tuần giống hệt nhau theo mặc định → đảm bảo "ưu tiên lặp lại"
- Chỉnh sửa thủ công (kéo thả, khóa tiết) áp dụng **per-slot** theo tuần cụ thể, không ảnh hưởng tuần khác

**Tiết cố định (không thuật toán thay đổi):**
- Thứ 2 / Tiết 1 → Chào cờ (áp dụng tất cả lớp)
- Thứ 7 / Tiết 5 → Sinh hoạt lớp
- GDĐP, HĐTN → vị trí cố định theo cấu hình

### Scoring

```
Fitness = -(hard_violations × 100) - Σ(soft_penalty × weight)
```

- Hard violations → điểm âm rất nặng (×100 mỗi vi phạm)
- Soft penalties → tổng trọng số × số vi phạm
- TKB hoàn hảo = 0 vi phạm cứng, soft penalty tối thiểu

---

*Cập nhật lần cuối: 2026-05-05*
