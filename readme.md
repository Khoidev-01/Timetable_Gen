# BÁO CÁO PHÂN TÍCH NGHIỆP VỤ (BUSINESS LOGIC)
## HỆ THỐNG XẾP THỜI KHÓA BIỂU TRƯỜNG THPT (TIMETABLE SCHEDULING SYSTEM)

---

## 1. MÔ TẢ BÀI TOÁN (PROBLEM STATEMENT)

Bài toán xếp thời khóa biểu (Timetabling Problem) là một bài toán tối ưu hóa tổ hợp kinh điển (NP-Complete). Mục tiêu là phân bổ tài nguyên (Giáo viên, Phòng học) vào các khung thời gian (Thứ, Tiết) cho các đối tượng (Lớp học) nhằm thỏa mãn một tập hợp các ràng buộc phức tạp.

**Mục tiêu của hệ thống**: Tự động hóa 100% quy trình xếp lịch, giảm thiểu thời gian xếp thủ công từ hàng tuần xuống còn vài phút, đồng thời tối ưu hóa sự thuận tiện cho giáo viên.

---

## 2. CÁC TÁC NHÂN HỆ THỐNG (ACTORS)

| Tác nhân | Vai trò | Quyền hạn |
| :--- | :--- | :--- |
| **Ban Giám Hiệu (Admin)** | Quản trị viên | - Cấu hình hệ thống (Năm học, Môn, Lớp).<br>- Phân công chuyên môn (Ai dạy lớp nào).<br>- Chạy thuật toán xếp lịch.<br>- Chốt và công bố TKB chính thức. |
| **Giáo viên (Teacher)** | Người dùng | - Xem TKB cá nhân.<br>- Đăng ký lịch bận/nguyện vọng nghỉ.<br>- Gửi phản hồi/yêu cầu điều chỉnh lịch. |

---

## 3. QUY TRÌNH NGHIỆP VỤ CHI TIẾT (BUSINESS PROCESS)

Quy trình nghiệp vụ được chia thành 3 giai đoạn chính: **Đầu vào (Pre-processing)** -> **Xử lý (Scheduling)** -> **Đầu ra (Post-processing)**.

### 3.1. Giai đoạn 1: Thiết lập Dữ liệu & Ràng buộc (Input)
Đây là giai đoạn quan trọng nhất, dữ liệu đầu vào càng chính xác thì kết quả càng tối ưu.

1.  **Thiết lập Chu kỳ (Cycle Setup)**:
    *   Admin tạo Năm học (VD: 2024-2025) và Học kỳ (HK1).
    *   Hệ thống khởi tạo lưới thời gian trống (6 ngày/tuần * 10 tiết/ngày).

2.  **Phân công Chuyên môn (Teaching Assignments)**:
    *   Quy định cốt lõi: **Giáo viên A** dạy **Môn B** cho **Lớp C** với số lượng **K tiết/tuần**.
    *   *Nghiệp vụ Block*: Một số môn (Toán, Văn) cần học liền 2 tiết (Block Assignment), hệ thống phải ghi nhận cấu hình này để không xếp rời rạc.

3.  **Thu thập Nguyện vọng (Constraints Gathering)**:
    *   Giáo viên đăng nhập, đánh dấu các ô "Bận" (Busy) vào các thời điểm không thể dạy.
    *   Hệ thống ghi nhận đây là **Ràng buộc Cứng** (Hard Constraint) để thuật toán tuyệt đối tránh.

### 3.2. Giai đoạn 2: Xếp lịch Tự động (Processing)
Hệ thống dựng lời giải bằng heuristic rồi cải thiện bằng **tìm kiếm cục bộ có khởi động lại** (local search with restarts).

1.  **Bước 1: Xếp các Tiết Cố định (Fixed Slots)**:
    *   Đọc từ bảng `fixed_period_rules` — cấu hình được từ màn hình `/admin/fixed-periods`, không hardcode.
    *   Mỗi quy tắc khai báo: môn · thứ · tiết · khối nào · buổi nào · ai dạy · có khoá không.
    *   Bỏ qua quy tắc nếu giáo viên đã bận, để heuristic xếp bình thường thay vì tạo tiết bị loại lúc lưu.

2.  **Bước 2: Heuristic tham lam**:
    *   Môn trái buổi (GDTC, GDQP) xếp thành khối liên tiếp ở buổi đối diện.
    *   Kiểm tra ngay khi đặt: ô đã chiếm · giáo viên trùng giờ · giáo viên đã báo bận · vượt định mức tuần · hết phòng chức năng.

3.  **Bước 3: Sửa chữa và dồn tiết**:
    *   `repairMissingPeriods` quét lại phần heuristic không xếp được, có thể di dời một tiết chắn đường.
    *   `consolidateBlocks` ghép các tiết lẻ cùng môn thành tiết đôi.
    *   `compactClassSchedules` kéo tiết về đầu buổi để lớp không bị trống tiết giữa buổi.
    *   `alignHomeroomToEndOfDay` đưa sinh hoạt về cuối buổi thực tế của lớp.

4.  **Bước 4: Tìm kiếm cục bộ**:
    *   Ba phép biến đổi: hoán vị hai tiết (kể cả **liên lớp**), di chuyển một tiết sang ô trống, và gom tiết của giáo viên về ít buổi hơn.
    *   Chấp nhận nước đi làm điểm tăng **hoặc bằng** để thoát cao nguyên.
    *   Dừng sớm khi không cải thiện được nữa.

5.  **Bước 5: Chọn phương án tốt nhất**:
    *   Chạy tối đa 12 lần, dừng sớm khi có phương án 0 lỗi cứng.
    *   So sánh **từ điển**: ít lỗi cứng trước, điểm mềm sau — một TKB dùng được luôn thắng một TKB đẹp hơn nhưng không dùng được.

6.  **Bước 6: Gán phòng**:
    *   Chạy sau khi lưới ngừng thay đổi. Môn thực hành vào Lab đúng loại, GDTC ra sân, tiết thường ở phòng lớp.

> **Lưu ý:** phiên bản trước mô tả đây là *Genetic Algorithm*. Không đúng — không có quần thể, lai ghép hay đột biến. Xem [REVIEW.md](REVIEW.md) mục 4.4.

### 3.3. Giai đoạn 3: Tinh chỉnh & Công bố (Output)
1.  **Kiểm tra & Cảnh báo**:
    *   Hệ thống tự động phát hiện xung đột và hiển thị "vùng đỏ" nếu có vi phạm.
2.  **Điều chỉnh Thủ công (Drag & Drop)**:
    *   Admin có thể kéo thả tiết học để điều chỉnh nhỏ theo ý muốn.
    *   Hệ thống hỗ trợ gợi ý các ô trống hợp lệ khi kéo thả.
3.  **Xuất bản (Publish)**:
    *   Chốt TKB Chính thức -> Gửi thông báo đến toàn bộ giáo viên.
    *   Xuất file Excel báo cáo.

---

## 4. PHÂN TÍCH RÀNG BUỘC (CONSTRAINTS ANALYSIS)

Hệ thống phân chia ràng buộc thành 2 loại để xử lý mềm dẻo:

### 4.1. Ràng buộc Cứng (Hard Constraints)
Là các điều kiện bắt buộc phải thỏa mãn. Nếu vi phạm, TKB coi như **Hỏng (Invalid)**.
1.  **Xung đột Giáo viên**: Một giáo viên không thể dạy 2 lớp cùng lúc.
2.  **Xung đột Lớp học**: Một lớp không thể học 2 môn cùng lúc.
3.  **Xung đột Phòng**: Một phòng học không thể chứa 2 lớp cùng lúc.
4.  **Lịch Bận**: Không xếp vào các ô giáo viên đã đăng ký "Bận".

### 4.2. Ràng buộc Mềm (Soft Constraints)
Là các điều kiện về "chất lượng" và sự "thuận tiện". Vi phạm làm giảm điểm đánh giá nhưng TKB vẫn hợp lệ.
1.  **Phân bố đều**: Các môn nặng (Toán, Lý, Hóa) nên rải đều trong tuần, không dồn vào 1 ngày.
2.  **Hạn chế trống tiết (Gaps)**: Giáo viên không nên bị trống 1 tiết giữa 2 tiết dạy (gây lãng phí thời gian chờ).
3.  **Số tiết tối đa/ngày**: Không dạy quá 5 tiết/ngày để đảm bảo sức khỏe.

---

## 5. CHIẾN LƯỢC THUẬT TOÁN (ALGORITHMIC STRATEGY)

Hệ thống dùng **Heuristic dựng lời giải + Tìm kiếm cục bộ có khởi động lại** (không phải Genetic Algorithm).

### 5.1. Hàm mục tiêu

```
Fitness = 1000 − (số lỗi cứng × 100) − tổng phạt mềm
```

**Ràng buộc cứng** — vi phạm là TKB không dùng được:

| Ràng buộc | Kiểm tra khi đặt tiết |
| :--- | :---: |
| Giáo viên không dạy 2 lớp cùng giờ | ✅ |
| Lớp không học 2 môn cùng giờ | ✅ |
| Phòng không chứa 2 lớp cùng giờ | ✅ |
| Không xếp vào ô giáo viên đã báo bận | ✅ |
| Đủ số tiết theo phân công | ✅ |
| Lớp không trống tiết giữa buổi | ✅ |
| Giáo viên không vượt định mức tuần | ✅ |
| Đủ phòng chức năng / sân thể dục | ✅ |

**Ràng buộc mềm** và trọng số: môn dồn cục (10) · môn nặng liên tiếp (20) · môn ưu tiên ở tiết cuối (15) · tiết đôi bị xé lẻ (10) · tiết trống giáo viên (5) · quá 4 tiết/buổi (10) · số buổi giáo viên phải đến trường (8) · dạy cả sáng lẫn chiều cùng ngày (12) · môn tư duy ngay sau Thể dục (10) · không có ngày nghỉ (15) · quá 4 tiết liên tiếp (8) · môn cách nhau quá 3 ngày (8) · quá 3 tiết buổi phụ (12).

### 5.2. Ngưỡng đánh giá

TKB **dùng được** khi **số lỗi cứng = 0**. Điểm mềm càng cao càng tốt nhưng không quyết định tính hợp lệ.

Trên bộ dữ liệu mẫu (7 lớp · 21 giáo viên · 217 tiết), 5/5 lần chạy đạt 0 lỗi cứng, điểm dao động khoảng **−120 đến +150**, mỗi lần chạy 10–25 giây. Điểm khó đạt 1000 vì thang điểm bao gồm 13 tiêu chí chất lượng cùng lúc — chúng mâu thuẫn nhau và không thể thoả mãn đồng thời.

### 5.3. Định mức và quy định tham chiếu

- Định mức giáo viên THPT: **17 tiết/tuần** (Thông tư 05/2025/TT-BGDĐT)
- Tiết chào cờ và sinh hoạt là nhiệm vụ chủ nhiệm, **không tính vào định mức giảng dạy**
- Khoảng cách giữa hai tiết cùng môn không nên quá **3 ngày**

## 6. KẾT LUẬN
Hệ thống không chỉ giải quyết bài toán xếp lịch cơ bản mà còn hướng tới trải nghiệm người dùng thông qua việc xử lý tinh tế các Ràng buộc Mềm. Kiến trúc nghiệp vụ tách biệt rõ ràng giữa Input - Logic - Output giúp hệ thống dễ dàng bảo trì và mở rộng thêm các quy tắc mới trong tương lai.
