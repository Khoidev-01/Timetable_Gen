# BÁO CÁO THIẾT KẾ CƠ SỞ DỮ LIỆU
## HỆ THỐNG XẾP THỜI KHÓA BIỂU TỰ ĐỘNG

---

## 1. TỔNG QUAN

Hệ thống được xây dựng trên nền tảng Cơ sở dữ liệu quan hệ (**Relational Database**), sử dụng hệ quản trị **PostgreSQL** để đảm bảo tính toàn vẹn dữ liệu, khả năng mở rộng và hiệu năng cao cho các truy vấn phức tạp của thuật toán xếp lịch.

Việc thiết kế Schema được thực hiện thông qua **Prisma ORM**, tuân thủ các nguyên tắc chuẩn hóa dữ liệu (Normalization) đến dạng chuẩn 3NF để giảm thiểu dư thừa và đảm bảo tính nhất quán.

### Kiến trúc Phân hệ
Cơ sở dữ liệu được chia thành 6 phân hệ chức năng chính:
1.  **Hệ thống (System)**: Quản lý chu kỳ thời gian (Năm học, Học kỳ).
2.  **Tài nguyên (Resources)**: Quản lý phòng học, môn học.
3.  **Nhân sự (Human Resources)**: Quản lý người dùng, giáo viên và ràng buộc bận.
4.  **Tổ chức (Organization)**: Quản lý danh mục lớp học.
5.  **Dữ liệu Đầu vào (Input)**: Phân công chuyên môn (Ai dạy gì, lớp nào).
6.  **Kết quả Đầu ra (Output)**: Thời khóa biểu đã sinh ra từ thuật toán.

---

## 2. CHI TIẾT LƯỢC ĐỒ QUAN HỆ (SCHEMA SPECIFICATION)

### 2.1. Phân hệ Hệ thống & Cấu hình

#### Bảng `academic_years` (Năm học)
Lưu trữ thông tin về các năm học trong hệ thống.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính, định danh duy nhất. |
| `name` | String | Not Null | Tên hiển thị (VD: "2024-2025"). |
| `start_date` | DateTime | Not Null | Ngày bắt đầu năm học. |
| `end_date` | DateTime | Not Null | Ngày kết thúc năm học. |
| `status` | Enum | Default: ACTIVE | Trạng thái (`ACTIVE`, `ARCHIVED`). |

#### Bảng `semesters` (Học kỳ)
Đơn vị thời gian cơ sở để thực hiện xếp thời khóa biểu.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `year_id` | UUID | **FK** | Tham chiếu đến `academic_years.id`. |
| `name` | String | Not Null | Tên học kỳ (VD: "Học kỳ 1"). |
| `is_current` | Boolean | Default: false | Đánh dấu học kỳ hiện hành. |

---

### 2.2. Phân hệ Tài nguyên Cơ sở Vật chất

#### Bảng `subjects` (Môn học)
Danh mục các môn học được giảng dạy.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | Int | **PK**, AutoInc | Khóa chính tự tăng. |
| `code` | String | **Unique** | Mã môn học (VD: "TOAN", "VAN"). |
| `name` | String | Not Null | Tên môn học. |
| `is_special` | Boolean | Default: false | Đánh dấu môn đặc biệt (Chào cờ, SHCN) có ràng buộc cố định. |
| `is_practice` | Boolean | Default: false | Đánh dấu môn thực hành (yêu cầu phòng chức năng). |

#### Bảng `rooms` (Phòng học)
Danh mục các phòng học vật lý.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | Int | **PK**, AutoInc | Khóa chính. |
| `name` | String | Not Null | Tên phòng (VD: "P.101"). |
| `type` | Enum | Default: CLASSROOM | Loại phòng (`CLASSROOM`, `LAB_IT`, `YARD`...). |
| `capacity` | Int | Default: 45 | Sức chứa tối đa. |

---

### 2.3. Phân hệ Nhân sự

#### Bảng `users` (Người dùng)
Quản lý thông tin đăng nhập và phân quyền.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `username` | String | **Unique** | Tên đăng nhập. |
| `role` | Enum | Default: TEACHER | Quyền hạn (`ADMIN`, `TEACHER`). |
| `teacher_profile_id` | String | **FK**, Unique | Liên kết 1-1 với bảng `teachers`. |

#### Bảng `teachers` (Giáo viên)
Hồ sơ giáo viên.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `code` | String | **Unique** | Mã giáo viên (VD: "GV001"). |
| `full_name` | String | Not Null | Họ và tên đầy đủ. |

#### Bảng `teacher_constraints` (Ràng buộc Giáo viên)
Dữ liệu đăng ký lịch bận/nghỉ của giáo viên.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | Int | **PK** | Khóa chính. |
| `teacher_id` | UUID | **FK** | Tham chiếu `teachers.id`. |
| `day_of_week` | Int | Not Null | Thứ trong tuần (2-7). |
| `period` | Int | Not Null | Tiết học (1-10). |
| `type` | Enum | Not Null | Loại ràng buộc (`BUSY`, `AVOID`). |

> **Tối ưu hóa**: Bảng này có Index phức hợp `@@index([teacher_id, day_of_week, period])` để tăng tốc độ truy vấn kiểm tra trùng lịch trong thuật toán.

---

### 2.4. Phân hệ Tổ chức

#### Bảng `classes` (Lớp học)
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `name` | String | Not Null | Tên lớp (VD: "10A1"). |
| `fixed_room_id` | Int | **FK** | Phòng học cố định của lớp (nếu có). |
| `homeroom_teacher_id`| UUID | **FK** | Giáo viên chủ nhiệm. |
| `main_session` | Int | Not Null | Buổi học chính (0: Sáng, 1: Chiều). |

---

### 2.5. Phân hệ Dữ liệu Đầu vào (Input)

#### Bảng `teaching_assignments` (Phân công Chuyên môn)
Dữ liệu đầu vào quan trọng nhất, quy định "Ai dạy Lớp nào, Môn gì, bao nhiêu tiết".
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `semester_id` | UUID | **FK** | Học kỳ áp dụng. |
| `class_id` | UUID | **FK** | Lớp được dạy. |
| `teacher_id` | UUID | **FK** | Giáo viên giảng dạy. |
| `subject_id` | Int | **FK** | Môn học. |
| `total_periods` | Int | Not Null | Tổng số tiết/tuần. |
| `block_config` | String | Nullable | Cấu hình xếp tiết (VD: "2+1" tiết). |

---

### 2.6. Phân hệ Kết quả (Output)

#### Bảng `generated_timetables` (Header TKB)
Lưu trữ thông tin tổng quan của một bản thời khóa biểu đã sinh ra.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `semester_id` | UUID | **FK** | Học kỳ. |
| `fitness_score` | Float | Nullable | Điểm đánh giá độ tối ưu (Fitness Function). |
| `is_official` | Boolean | Default: false | Đánh dấu bản TKB chính thức. |

#### Bảng `timetable_slots` (Chi tiết Tiết học)
Bảng quan trọng nhất chứa kết quả xếp lịch chi tiết.
| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Khóa chính. |
| `timetable_id` | UUID | **FK** | Thuộc về bản TKB nào. |
| `class_id` | UUID | **FK** | Lớp học. |
| `teacher_id` | UUID | **FK** | Giáo viên dạy. |
| `room_id` | Int | **FK** | Tại phòng nào. |
| `day` | Int | Not Null | Thứ (2-7). |
| `period` | Int | Not Null | Tiết (1-10). |
| `is_locked` | Boolean | Default: false | Cho phép người dùng khóa slot này (cố định thủ công). |

---

## 3. PHÂN TÍCH RÀNG BUỘC TOÀN VẸN (INTEGRITY CONSTRAINTS)

Để đảm bảo tính đúng đắn logic của Thời khóa biểu, Database sử dụng các **Composite Unique Constraints** (Ràng buộc duy nhất phức hợp) trên bảng `timetable_slots`. Điều này ngăn chặn triệt để các lỗi xung đột ngay từ tầng dữ liệu:

1.  **Chống trùng lịch Lớp (`unique_class_slot`)**:
    -   `[timetable_id, class_id, day, period]`
    -   Ý nghĩa: Tại một thời điểm, một lớp chỉ có thể học 1 môn.

2.  **Chống trùng lịch Giáo viên (`unique_teacher_slot`)**:
    -   `[timetable_id, teacher_id, day, period]`
    -   Ý nghĩa: Tại một thời điểm, một giáo viên chỉ có thể dạy 1 nơi.

3.  **Chống trùng lịch Phòng học (`unique_room_slot`)**:
    -   `[timetable_id, room_id, day, period]`
    -   Ý nghĩa: Tại một thời điểm, một phòng chỉ có thể chứa 1 lớp.

## 4. KẾT LUẬNBảng 
Thiết kế Cơ sở dữ liệu này đảm bảo:
-   **Tính quy chuẩn**: Tách biệt rõ ràng giữa Dữ liệu đầu vào (Assignments) và Kết quả (Slots).
-   **Hiệu năng**: Sử dụng Index hợp lý cho các truy vấn kiểm tra ràng buộc (Constraint Checking) thường xuyên.
-   **An toàn dữ liệu**: Các ràng buộc cứng (Hard Constraints) được cài đặt ngay tại Database level, đảm bảo TKB sinh ra không bao giờ vi phạm các lỗi logic cơ bản.
